import { parseBoundedJSON, StorageFault } from "./storageSafety.js";
import { isProjectId } from "./projectSchema.js";
import { rootHeaders, verifyRoot, validateWorkspaceData, sealRoot } from "./workspaceObjectSchema.js";
import { validateProject } from "./projectSchema.js";
import { sha256 } from "./workspaceProvenance.js";
import { stableStringify } from "../graph/graphFingerprint.js";
import { verifyMemoryEnvelope, sealMemoryEnvelope } from "./assistantMemorySchema.js";
import { admitMemoryContent } from "./assistantMemorySafety.js";
import { validateConnectionProfile, initialConnectionProfile } from "./modelConnectionSchema.js";
import { decodeWorkspaceInputs } from "./workspaceCapture.js";
import { WORKSPACE_LIMITS } from "./storageBudget.js";
import { getFormatDetails } from "../agent/fileDetection.js";

export const PORTABLE_MAGIC = "CANDY-WORKSPACE\n";
export const PORTABLE_LIMITS = Object.freeze({ containerBytes: 48 * 1024 * 1024, payloadBytes: WORKSPACE_LIMITS.projectBytes, payloads: 156, references: 156, expandedBytes: 2 * WORKSPACE_LIMITS.projectBytes });
const stages = new WeakMap(), utf8 = new TextEncoder();
const bad = (message, code = "CORRUPT") => { throw new StorageFault(code, message, true); };
const keys = (v, names) => v && Object.keys(v).sort().join() === names.split(" ").sort().join();
const digest = value => sha256(utf8.encode(stableStringify(value)));
function label(value) { if (typeof value !== "string" || !value.trim() || value.length > 80 || [...value].some(ch => ch.codePointAt(0) < 32 || ch.codePointAt(0) === 127)) bad("Invalid portable project name."); return value; }
function sensitive(bytes) {
  const text = new TextDecoder().decode(bytes).replace(/\s+/g, " ");
  // Recognizable credential material is refused, never silently redacted.
  // Arbitrary user files still require the user's review before sharing.
  try { if (text.trim()) admitMemoryContent(text); } catch (error) { if (error.code === "SENSITIVE") throw error; }
  if (/"(?:password|passwd|api[_-]?key|access[_-]?token|authorization|secret|credential|runtime[_-]?token)"\s*:\s*"[^"\s]{1,}"/i.test(text)) bad("Credential-like source or graph content cannot be exported or imported.", "SENSITIVE");
}
function base64(bytes) { let text = ""; for (let i = 0; i < bytes.length; i += 32768) text += String.fromCharCode(...bytes.subarray(i, i + 32768)); return btoa(text); }
function unbase64(text, length) {
  if (typeof text !== "string" || text.length !== 4 * Math.ceil(length / 3) || !/^[A-Za-z0-9+/]*={0,2}$/.test(text)) bad("Invalid or oversized portable payload encoding.");
  let decoded; try { decoded = atob(text); } catch { bad("Invalid portable payload encoding."); }
  if (decoded.length !== length || btoa(decoded) !== text) bad("Noncanonical portable payload encoding.");
  return Uint8Array.from(decoded, ch => ch.charCodeAt(0)).buffer;
}
function portableModel(profile) {
  if (!profile) return null;
  const safe = validateConnectionProfile(profile);
  return { schemaVersion: 1, provider: "ollama", endpoint: safe.endpoint, transport: safe.transport, selectedModel: safe.selectedModel };
}
function validateModel(value) {
  if (value === null) return null;
  if (!keys(value, "schemaVersion provider endpoint transport selectedModel") || value.schemaVersion !== 1 || value.provider !== "ollama") bad("Invalid portable model preference.");
  return initialConnectionProfile(value.selectedModel, value.endpoint, value.transport);
}
async function validateSnapshot(project, root, objects, memory) {
  validateProject(project); await verifyRoot(root, project.projectId);
  if (root.publicationRevision > project.revision) bad("Portable root is newer than its project.");
  const headers = new Map();
  for (const h of rootHeaders(root)) {
    if (headers.has(h.id) && stableStringify(headers.get(h.id)) !== stableStringify(h)) bad("Conflicting duplicate object identity.");
    headers.set(h.id, h);
  }
  if (headers.size > PORTABLE_LIMITS.payloads || objects.length !== headers.size || new Set(objects.map(x => x.id)).size !== objects.length) bad("Missing, extra or duplicate portable objects.");
  let total = 0;
  for (const object of objects) {
    const { data, ...header } = object, expected = headers.get(object.id);
    if (!expected || expected.lifecycle !== "COMPLETE" || stableStringify(header) !== stableStringify(expected) || !(data instanceof ArrayBuffer) || data.byteLength !== expected.byteLength) bad("Portable object header/payload mismatch.");
    total += data.byteLength; if (total > PORTABLE_LIMITS.payloadBytes) bad("Portable workspace exceeds its payload limit.", "LIMIT");
    if (await sha256(data) !== expected.sha256) bad("Portable object SHA-256 mismatch."); sensitive(data);
  }
  const bundle = { manifest: project, root, objects };
  function applicationData(restored) {
    const m = restored.metadata;
    if (m?.fmt !== "ai_prompt" && typeof getFormatDetails(m?.fmt)?.routeId !== "string") bad("Unsupported saved input format.", "INCOMPATIBLE");
    if (![m.editors, m.batches, m.customKeys, m.manual].every(Array.isArray)) bad("Invalid application source references.");
    const byKey = new Map(restored.sources.map(s => [s.provenance.sourceKey, s])), byId = new Map(restored.sources.map(s => [s.objectId, s]));
    let count = 0, expanded = 0;
    function reference(key) {
      const source = byKey.get(key); if (!source) bad("Application metadata refers to a missing source.");
      expanded += source.byteLength;
      if (++count > PORTABLE_LIMITS.references || expanded > PORTABLE_LIMITS.expandedBytes) bad("Application source-reference expansion exceeds its import limit.", "LIMIT");
    }
    for (const row of m.editors) reference(row?.key);
    for (const batch of m.batches) { if (!Array.isArray(batch?.keys)) bad("Invalid batch source references."); for (const key of batch.keys) reference(key); }
    for (const key of m.customKeys) reference(key);
    for (const row of m.manual) reference(row?.key);
    reference(m.parserKey);
    for (const ref of restored.root.graph?.provenance.sources ?? []) reference(byId.get(ref.objectId)?.provenance.sourceKey);
    decodeWorkspaceInputs(restored);
  }
  applicationData(await validateWorkspaceData(bundle));
  for (const checkpoint of root.history) {
    const restored = await validateWorkspaceData({ ...bundle, checkpointId: checkpoint.graph.objectId });
    applicationData({ ...restored, root: { ...restored.root, graph: checkpoint.graph } });
  }
  const envelope = await verifyMemoryEnvelope(memory, project.projectId);
  if (envelope && envelope.revision > project.revision) bad("Portable memory revision exceeds its project.");
  return { root, objects, memory: envelope };
}
// The manifest carries data identity, never an adoptable local writer revision.
function archiveProject(project, root, memory) {
  return { ...project, revision: Math.max(root.publicationRevision, memory?.revision ?? 1), previousRevision: Math.max(root.publicationRevision, memory?.revision ?? 1) - 1 };
}
export async function exportPortableWorkspace(store, projectId) {
  const snapshot = await store.readPortableSnapshot(projectId);
  if (!snapshot.root) bad("There is no saved workspace to export.", "INCOMPLETE");
  const verified = await validateSnapshot(snapshot.project, snapshot.root, snapshot.objects, snapshot.memory);
  const name = label(snapshot.name), manifest = { schemaVersion: 2, project: { schemaVersion: 1, projectId, name, createdAt: snapshot.project.createdAt }, workspace: { schemaVersion: 1, root: verified.root }, memory: verified.memory, modelPreferences: portableModel(snapshot.modelProfile) };
  sensitive(utf8.encode(stableStringify(manifest)));
  const payloads = [...verified.objects].sort((x, y) => x.objectId.localeCompare(y.objectId, "en")).map(o => ({ schemaVersion: 1, path: `objects/${o.objectId}.bin`, encoding: "base64", data: base64(new Uint8Array(o.data)) }));
  const text = PORTABLE_MAGIC + stableStringify({ format: "candy.workspace", manifest, manifestSha256: await digest(manifest), payloads });
  const bytes = utf8.encode(text); if (bytes.byteLength > PORTABLE_LIMITS.containerBytes) bad("Portable container exceeds its limit.", "LIMIT");
  return Object.freeze({ bytes, sha256: await sha256(bytes), filename: `candy-workspace-${projectId}.candy-workspace`, name, payloadCount: payloads.length });
}
export async function stagePortableWorkspace(input) {
  let bytes;
  if (typeof Blob !== "undefined" && input instanceof Blob) { if (input.size > PORTABLE_LIMITS.containerBytes) bad("Portable file exceeds its limit.", "LIMIT"); bytes = new Uint8Array(await input.arrayBuffer()); }
  else if (input instanceof ArrayBuffer) { if (input.byteLength > PORTABLE_LIMITS.containerBytes) bad("Portable file exceeds its limit.", "LIMIT"); bytes = new Uint8Array(input.slice(0)); }
  else if (ArrayBuffer.isView(input)) { if (input.byteLength > PORTABLE_LIMITS.containerBytes) bad("Portable file exceeds its limit.", "LIMIT"); bytes = new Uint8Array(input.buffer, input.byteOffset, input.byteLength).slice(); }
  else bad("Select a portable workspace file.");
  const prefix = utf8.encode(PORTABLE_MAGIC);
  if (bytes.length < prefix.length || prefix.some((value, index) => bytes[index] !== value)) bad("Unsupported container. Only uncompressed CANDY workspace files are accepted.", "INCOMPATIBLE");
  let text; try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { bad("Portable file is not valid UTF-8."); }
  if (!text.startsWith(PORTABLE_MAGIC)) bad("Unsupported container. Only uncompressed CANDY workspace files are accepted.", "INCOMPATIBLE");
  const body = text.slice(PORTABLE_MAGIC.length), envelope = parseBoundedJSON(body, { bytes: PORTABLE_LIMITS.containerBytes, depth: 24, nodes: 70000, array: 1000, string: 12 * 1024 * 1024 });
  if (stableStringify(envelope) !== body) bad("Portable JSON must be canonical; duplicate or ambiguous names are rejected.");
  if (!keys(envelope, "format manifest manifestSha256 payloads") || envelope.format !== "candy.workspace") bad("Invalid portable container schema.");
  let m = envelope.manifest;
  if (![1, 2].includes(m?.schemaVersion)) bad("Unsupported portable schema version; no data was changed.", "INCOMPATIBLE");
  if (!keys(m, m.schemaVersion === 1 ? "schemaVersion project workspace memory" : "schemaVersion project workspace memory modelPreferences")) bad("Unknown portable manifest field.");
  if (await digest(m) !== envelope.manifestSha256) bad("Portable manifest SHA-256 mismatch.");
  sensitive(utf8.encode(stableStringify(m)));
  const migratedFrom = m.schemaVersion === 1 ? 1 : null;
  if (migratedFrom) m = { ...m, schemaVersion: 2, modelPreferences: null };
  if (!keys(m.project, "schemaVersion projectId name createdAt") || m.project.schemaVersion !== 1 || !isProjectId(m.project.projectId)) bad("Invalid portable project identity.");
  label(m.project.name);
  if (!keys(m.workspace, "schemaVersion root") || m.workspace.schemaVersion !== 1) bad("Invalid portable workspace schema.");
  if (m.memory !== null && (!m.memory || typeof m.memory !== "object" || Array.isArray(m.memory))) bad("Invalid portable memory collection.");
  const root = await verifyRoot(m.workspace.root, m.project.projectId), memory = await verifyMemoryEnvelope(m.memory, m.project.projectId), model = validateModel(m.modelPreferences);
  const headers = new Map(rootHeaders(root).map(h => [h.objectId, h]));
  if (!Array.isArray(envelope.payloads) || envelope.payloads.length > PORTABLE_LIMITS.payloads || envelope.payloads.length !== headers.size) bad("Missing, extra or excessive payloads.");
  const seen = new Set(), objects = []; let total = 0;
  for (const p of envelope.payloads) {
    if (!keys(p, "schemaVersion path encoding data") || p.schemaVersion !== 1 || p.encoding !== "base64" || !/^objects\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.bin$/.test(p.path) || seen.has(p.path)) bad("Noncanonical, duplicate or unsafe payload path.");
    seen.add(p.path); const header = headers.get(p.path.slice(8, -4));
    if (!header) bad("Unreferenced portable payload."); total += header.byteLength;
    if (total > PORTABLE_LIMITS.payloadBytes) bad("Portable payload budget exceeded.", "LIMIT");
    objects.push({ ...header, data: unbase64(p.data, header.byteLength) });
  }
  // A synthetic manifest is used only for existing data validators. Its local
  // revision never enters the database or grants an imported owner authority.
  const revision = Math.max(root.publicationRevision, memory?.revision ?? 1), project = { appNamespace: "hypergraph-converter-studio", schemaVersion: 1, projectId: m.project.projectId, revision, previousRevision: revision - 1, createdAt: m.project.createdAt, updatedAt: root.updatedAt, deleted: false, tombstone: null, storageState: "committed", migrationLineage: [] };
  await validateSnapshot(archiveProject(project, root, memory), root, objects, memory);
  const handle = Object.freeze({ name: m.project.name, sourceProjectId: project.projectId, sha256: await sha256(bytes), payloadCount: objects.length, memoryCount: memory?.records.filter(x => x.status === "ACTIVE").length ?? 0, model: model?.selectedModel ?? null, migratedFrom });
  stages.set(handle, { root, objects, memory, model, name: handle.name, digest: handle.sha256, sourceProjectId: project.projectId, migratedFrom });
  return handle;
}
export async function preparePortablePublication(handle, projectId, revision) {
  const stage = stages.get(handle); if (!stage) bad("Import staging is missing or obsolete.", "ABANDONED");
  if (!isProjectId(projectId) || !Number.isSafeInteger(revision) || revision < 2) bad("Invalid local import identity.");
  const mapped = new Map();
  for (const h of rootHeaders(stage.root)) mapped.set(h.id, { ...h, projectId, id: projectId + "/" + h.objectId, revision });
  const header = h => mapped.get(h.id), root = await sealRoot({ ...stage.root, projectId, publicationRevision: revision, sources: stage.root.sources.map(header), graph: stage.root.graph ? header(stage.root.graph) : null, derived: header(stage.root.derived), history: stage.root.history.map(x => ({ sources: x.sources.map(header), graph: header(x.graph), derived: header(x.derived) })) });
  const sealedHeaders = new Map(rootHeaders(root).map(h => [h.objectId, h]));
  const records = stage.objects.map(o => ({ ...sealedHeaders.get(o.objectId), data: o.data.slice(0) }));
  const memories = (stage.memory?.records ?? []).filter(x => x.status === "ACTIVE").map(x => ({ ...x, projectId, revision, supersedes: null, provenance: "IMPORTED", confidence: "UNVERIFIED", sourceRefs: x.sourceRefs.map(ref => ({ ...ref, projectId, workspaceDigest: ref.workspaceDigest === stage.root.sha256 ? root.sha256 : ref.workspaceDigest })) }));
  const memory = await sealMemoryEnvelope(projectId, revision, memories);
  return { root, records, memory, model: stage.model ? initialConnectionProfile(stage.model.selectedModel, stage.model.endpoint, stage.model.transport) : null, name: stage.name, digest: stage.digest, sourceProjectId: stage.sourceProjectId, migratedFrom: stage.migratedFrom, sourceSchema: 2 };
}
export function portableStageValid(handle) { return stages.has(handle); }
