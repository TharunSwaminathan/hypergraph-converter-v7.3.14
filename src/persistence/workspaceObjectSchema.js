import { isProjectId, newProjectId } from "./projectSchema.js";
import { boundedCopy, parseBoundedJSON, StorageFault, utf8Bytes } from "./storageSafety.js";
import { WORKSPACE_LIMITS as L, requireBudget } from "./storageBudget.js";
import { isSha256, sha256, sourceBytes } from "./workspaceProvenance.js";
import { canonicalizeGraph, graphFingerprint, stableStringify } from "../graph/graphFingerprint.js";
import { createGraphState, isApplicationGraphType } from "../graph/graphState.js";

const fail = (code, message) => { throw new StorageFault(code, message, true); };
const timestamp = value => typeof value === "string" && value.length <= 32 && !Number.isNaN(Date.parse(value));
const plainLimits = { bytes: L.manifestBytes, depth: 16, nodes: 18000, array: 256, string: 2048 };
const graphLimits = { bytes: L.graphBytes, depth: 16, nodes: L.graphNodes, array: L.graphArray, string: 60000 };
const text = (value, max) => typeof value === "string" && value.length <= max;
const keys = (value, expected) => value && Object.keys(value).sort().join() === [...expected].sort().join();
export const workspaceObjectKey = (projectId, objectId) => `${projectId}/${objectId}`;
export function validateObjectHeader(input, projectId) {
  const h = boundedCopy(input, plainLimits);
  if (h?.schemaVersion !== 1) fail("INCOMPATIBLE", "Workspace object schema is unsupported; original data is preserved.");
  if (!keys(h, ["id", "objectId", "projectId", "objectType", "schemaVersion", "revision", "createdAt", "updatedAt", "byteLength", "sha256", "provenance", "lifecycle"])
    || !isProjectId(projectId) || h.projectId !== projectId || !isProjectId(h.objectId) || h.id !== workspaceObjectKey(projectId, h.objectId)
    || !["source", "graph", "derived"].includes(h.objectType) || !Number.isSafeInteger(h.revision) || h.revision < 2
    || !timestamp(h.createdAt) || !timestamp(h.updatedAt) || !isSha256(h.sha256) || !["COMPLETE", "EXTERNAL"].includes(h.lifecycle)
    || (h.lifecycle === "EXTERNAL" && h.objectType !== "source")) fail("CORRUPT", "Workspace object ownership/type/identity is invalid.");
  requireBudget(h.byteLength, h.objectType === "source" ? L.sourceBytes : h.objectType === "graph" ? L.graphBytes : L.derivedBytes, "Workspace object");
  if (h.objectType === "source" && (!keys(h.provenance, ["sourceKey", "name", "mediaType", "kind", "originalId"])
    || !text(h.provenance.sourceKey, 160) || !h.provenance.sourceKey || !text(h.provenance.name, 256) || !text(h.provenance.mediaType, 160)
    || !["upload", "editor", "parser"].includes(h.provenance.kind) || !text(h.provenance.originalId, 512))) fail("CORRUPT", "Source provenance is invalid.");
  return h;
}
export function rootHeaders(root) {
  return [...root.sources, ...(root.graph ? [root.graph] : []), root.derived, ...root.history.flatMap(entry => [entry.graph, entry.derived, ...entry.sources])];
}
export function durableByteCount(root) {
  const unique = new Map(rootHeaders(root).map(h => [h.id, h]));
  const objects = [...unique.values()].reduce((sum, h) => sum + (h.lifecycle === "EXTERNAL" ? 0 : h.byteLength) + utf8Bytes(stableStringify(h)), 0);
  let total = objects;
  for (let i = 0; i < 4; i++) total = objects + utf8Bytes(stableStringify({ ...root, sha256: root.sha256 ?? "0".repeat(64), totalBytes: total }));
  return total;
}
export function validateWorkspaceRoot(input, projectId) {
  const root = boundedCopy(input, plainLimits);
  if (root?.schemaVersion !== 1) fail("INCOMPATIBLE", "Workspace schema is unsupported; storage is read-only.");
  if (!keys(root, ["projectId", "schemaVersion", "publicationRevision", "createdAt", "updatedAt", "lifecycle", "sources", "graph", "derived", "history", "totalBytes", "sha256"])
    || root.projectId !== projectId || !isProjectId(projectId) || !Number.isSafeInteger(root.publicationRevision) || root.publicationRevision < 2
    || !timestamp(root.createdAt) || !timestamp(root.updatedAt) || root.lifecycle !== "COMPLETE" || !isSha256(root.sha256)
    || !Array.isArray(root.sources) || root.sources.length > L.sources || !Array.isArray(root.history) || root.history.length > L.checkpoints) fail("INCOMPLETE", "Workspace publication manifest is incomplete or invalid.");
  const headers = rootHeaders(root), unique = new Map();
  for (const h of headers) {
    const value = validateObjectHeader(h, projectId);
    if (value.revision > root.publicationRevision) fail("INCOMPLETE", "Workspace object is newer than its publication.");
    if (unique.has(h.id) && stableStringify(unique.get(h.id)) !== stableStringify(h)) fail("CORRUPT", "Workspace object identity collision.");
    unique.set(h.id, h);
  }
  if (root.derived.objectType !== "derived" || new Set(root.sources.map(h => h.provenance.sourceKey)).size !== root.sources.length || root.sources.some(h => h.objectType !== "source")) fail("CORRUPT", "Workspace source/derived type is invalid.");
  const graphRelation = (g, sources) => {
    if (!g || g.objectType !== "graph" || !keys(g.provenance, ["sources", "parser", "mappingSha256", "transform", "parentSnapshotSha256"])
      || !Array.isArray(g.provenance.sources) || g.provenance.sources.length > L.sources
      || !text(g.provenance.parser, 160) || !isSha256(g.provenance.mappingSha256) || !text(g.provenance.transform, 160)
      || !(g.provenance.parentSnapshotSha256 === null || isSha256(g.provenance.parentSnapshotSha256))) fail("CORRUPT", "Graph provenance is invalid.");
    for (const ref of g.provenance.sources) if (!keys(ref, ["objectId", "sha256"]) || !sources.some(s => s.objectId === ref.objectId && s.sha256 === ref.sha256)) fail("CORRUPT", "Graph refers to a missing or substituted source.");
  };
  if (root.graph) graphRelation(root.graph, root.sources);
  for (const entry of root.history) { if (!keys(entry, ["graph", "sources", "derived"]) || entry.derived?.objectType !== "derived" || !Array.isArray(entry.sources) || entry.sources.length > L.sources || entry.sources.some(h => h.objectType !== "source")) fail("CORRUPT", "Checkpoint metadata is invalid."); graphRelation(entry.graph, entry.sources); }
  const total = durableByteCount(root);
  requireBudget(total, L.projectBytes, "Project durable bytes");
  if (root.totalBytes !== total) fail("CORRUPT", "Workspace byte accounting is invalid.");
  return root;
}
export async function sealRoot(input) {
  const body = { ...input }; delete body.sha256;
  body.totalBytes = durableByteCount(body);
  const bytes = new TextEncoder().encode(stableStringify(body)); requireBudget(bytes.byteLength, L.manifestBytes - 80, "Workspace manifest");
  return validateWorkspaceRoot({ ...body, sha256: await sha256(bytes) }, body.projectId);
}
export async function verifyRoot(input, projectId) {
  const root = validateWorkspaceRoot(input, projectId), sealed = await sealRoot(root);
  if (sealed.sha256 !== root.sha256) fail("CORRUPT", "Workspace manifest digest mismatch.");
  return root;
}
function graphPayload(input) {
  const g = boundedCopy(input, graphLimits);
  if (!keys(g, ["graphType", "graphId", "graphVersion", "graphFingerprint", "hyperedges", "explicitVertices"]) || !isApplicationGraphType(g.graphType)
    || !text(g.graphId, 160) || !g.graphId || !Number.isSafeInteger(g.graphVersion) || g.graphVersion < 0
    || !(g.hyperedges === null || Array.isArray(g.hyperedges)) || !(g.explicitVertices === null || Array.isArray(g.explicitVertices))) fail("CORRUPT_GRAPH", "Canonical graph schema/type is invalid.");
  const edgeIds = new Set();
  for (const edge of g.hyperedges ?? []) {
    if (!keys(edge, ["id", "vertices", "time", "weight", "attributes"]) || !text(edge.id, 240) || edgeIds.has(edge.id) || !Array.isArray(edge.vertices)
      || edge.vertices.some(v => !text(v, 240)) || new Set(edge.vertices).size !== edge.vertices.length || !Number.isFinite(edge.weight)
      || !(edge.time === null || typeof edge.time === "string" || typeof edge.time === "number") || !edge.attributes || Array.isArray(edge.attributes)) fail("CORRUPT_GRAPH", "Canonical graph membership/metadata is invalid.");
    edgeIds.add(edge.id);
  }
  if (g.explicitVertices?.some(v => !text(v, 240)) || g.graphFingerprint !== graphFingerprint(g.hyperedges ?? [], g)) fail("CORRUPT_GRAPH", "Canonical graph fingerprint does not match its contents.");
  return g;
}
export async function prepareWorkspace(projectId, revision, input, previous = null) {
  if (!isProjectId(projectId) || !Number.isSafeInteger(revision) || revision < 2) fail("CORRUPT", "Invalid project publication identity.");
  if (previous) await verifyRoot(previous, projectId);
  if (!Array.isArray(input.sources) || input.sources.length > L.sources) fail("LIMIT", "Too many workspace sources.");
  let declaredSourceBytes = 0;
  for (const source of input.sources) {
    if (source?.bytes == null && !source?.external) fail("MISSING_SOURCE", "Authoritative source bytes are missing.");
    const size = source.external?.byteLength ?? source.bytes?.size ?? source.bytes?.byteLength;
    if (size === undefined) fail("UNSUPPORTED_SOURCE", "Unsupported source byte type.");
    requireBudget(size, L.sourceBytes, "Source object"); declaredSourceBytes += size;
    requireBudget(declaredSourceBytes + 1, L.projectBytes, "Current source set");
  }
  const now = new Date().toISOString(), records = [], sources = [], sourceKeys = new Set();
  async function object(objectType, data, provenance, external = null) {
    const objectId = newProjectId(), bytes = external ? null : data;
    const h = validateObjectHeader({ id: workspaceObjectKey(projectId, objectId), projectId, objectId, objectType, schemaVersion: 1,
      revision, createdAt: now, updatedAt: now, byteLength: external?.byteLength ?? bytes.byteLength, sha256: external?.sha256 ?? await sha256(bytes), provenance, lifecycle: external ? "EXTERNAL" : "COMPLETE" }, projectId);
    records.push({ ...h, data: bytes }); return h;
  }
  for (const source of input.sources) {
    if (sourceKeys.has(source.key)) fail("CORRUPT", "Duplicate workspace source key."); sourceKeys.add(source.key);
    const provenance = boundedCopy({ sourceKey: source.key, name: source.name, mediaType: source.mediaType ?? "", kind: source.kind ?? "upload", originalId: source.originalId ?? "" }, plainLimits);
    sources.push(await object("source", source.external ? null : await sourceBytes(source.bytes, L.sourceBytes), provenance, source.external));
  }
  const metadata = boundedCopy(input.metadata ?? {}, { bytes: L.derivedBytes, depth: 16, nodes: 20000, array: 1000, string: 60000 });
  const mapping = boundedCopy(input.mapping ?? {}, { bytes: 128 * 1024, depth: 12, nodes: 5000, array: 1000, string: 8192 });
  const encodedMetadata = new TextEncoder().encode(stableStringify({ schemaVersion: 1, workspace: metadata, mapping }));
  requireBudget(encodedMetadata.byteLength, L.derivedBytes, "Derived workspace metadata");
  const derived = await object("derived", encodedMetadata.buffer, { kind: "deterministic-workspace-metadata" });
  let graph = null;
  if (input.graph) {
    const admitted = boundedCopy(input.graph, graphLimits);
    const payload = graphPayload({ ...admitted, hyperedges: admitted.hyperedges === null ? null : canonicalizeGraph(admitted.hyperedges) }), sourceRefs = input.graphSourceKeys ?? sources.map(s => s.provenance.sourceKey);
    if (!Array.isArray(sourceRefs) || sourceRefs.length > L.sources) fail("CORRUPT", "Invalid graph source references.");
    const refs = sourceRefs.map(key => { const h = sources.find(s => s.provenance.sourceKey === key); if (!h) fail("MISSING_SOURCE", "Graph source identity is missing."); return { objectId: h.objectId, sha256: h.sha256 }; });
    graph = await object("graph", new TextEncoder().encode(stableStringify(payload)).buffer, { sources: refs, parser: input.parser ?? "deterministic-editor",
      mappingSha256: await sha256(new TextEncoder().encode(stableStringify(mapping))), transform: input.transform ?? "workspace-checkpoint", parentSnapshotSha256: previous?.graph?.sha256 ?? null });
  }
  const history = previous ? [...previous.history, ...(previous.graph ? [{ graph: previous.graph, sources: previous.sources, derived: previous.derived }] : [])] : [];
  while (history.length > L.checkpoints) history.shift();
  const body = { projectId, schemaVersion: 1, publicationRevision: revision, createdAt: previous?.createdAt ?? now, updatedAt: now, lifecycle: "COMPLETE", sources, graph, derived, history, totalBytes: 0 };
  const count = () => durableByteCount(body);
  while (count() > L.projectBytes && history.length) history.shift();
  body.totalBytes = count(); requireBudget(body.totalBytes, L.projectBytes, "Project durable bytes");
  const root = await sealRoot(body);
  return { root, records, writeBytes: records.reduce((n, record) => { const header = { ...record }; delete header.data; return n + (record.data?.byteLength ?? 0) + utf8Bytes(stableStringify(header)); }, 0) + utf8Bytes(stableStringify(root)) };
}
export async function validateWorkspaceData(bundle) {
  const { projectId } = bundle.manifest, root = await verifyRoot(bundle.root, projectId);
  if (bundle.manifest.deleted) fail("DELETED", "Deleted projects cannot restore workspace data.");
  if (root.publicationRevision > bundle.manifest.revision) fail("INCOMPLETE", "Workspace publication is newer than the project manifest.");
  const selected = bundle.checkpointId ? root.history.find(entry => entry.graph.objectId === bundle.checkpointId) : root;
  if (!selected) fail("INCOMPLETE", "Requested graph checkpoint is missing.");
  const data = new Map();
  for (const h of [...selected.sources, ...(selected.graph ? [selected.graph] : []), selected.derived]) {
    const stored = bundle.objects.find(item => item?.id === h.id);
    if (!stored || stored.data == null || h.lifecycle === "EXTERNAL") fail(h.objectType === "source" ? "MISSING_SOURCE" : "INCOMPLETE", "Committed workspace bytes are missing; exact recovery is required.");
    const { data: bytes, ...header } = stored;
    if (stableStringify(header) !== stableStringify(h) || !(bytes instanceof ArrayBuffer) || bytes.byteLength !== h.byteLength || await sha256(bytes) !== h.sha256) fail(h.objectType === "source" ? "CORRUPT_SOURCE" : h.objectType === "graph" ? "CORRUPT_GRAPH" : "CORRUPT", "Stored object digest/type/ownership mismatch. Workspace remains unavailable.");
    data.set(h.id, bytes);
  }
  let graph = null;
  if (selected.graph) {
    const payload = graphPayload(parseBoundedJSON(new TextDecoder("utf-8", { fatal: true }).decode(data.get(selected.graph.id)), graphLimits));
    const owned = createGraphState(payload.hyperedges, { graphType: payload.graphType, explicitVertices: payload.explicitVertices });
    graph = Object.freeze({ ...owned, graphId: payload.graphId, graphVersion: payload.graphVersion, graphFingerprint: payload.graphFingerprint });
  }
  const metadata = parseBoundedJSON(new TextDecoder("utf-8", { fatal: true }).decode(data.get(selected.derived.id)), { bytes: L.derivedBytes, depth: 18, nodes: 25000, array: 1000, string: 60000 });
  if (!keys(metadata, ["schemaVersion", "workspace", "mapping"]) || metadata.schemaVersion !== 1) fail("INCOMPATIBLE", "Derived metadata schema is incompatible.");
  if (selected.graph && await sha256(new TextEncoder().encode(stableStringify(metadata.mapping))) !== selected.graph.provenance.mappingSha256) fail("CORRUPT", "Mapping provenance does not match the graph snapshot.");
  return { manifest: bundle.manifest, root, graph, sources: selected.sources.map(h => ({ ...h, bytes: data.get(h.id), available: true, requiresReupload: false })), metadata: metadata.workspace, mapping: metadata.mapping,
    history: root.history.map(entry => ({ graph: entry.graph, verified: false })), missingHistoryIds: bundle.missingHistoryIds ?? [], historical: Boolean(bundle.checkpointId),
    orphanIds: bundle.orphanIds ?? [], orphanStatus: bundle.orphanIds?.length ? "ORPHANED" : "COMPLETE", available: true };
}
export function encodedWorkspaceSize(root) { return utf8Bytes(stableStringify(root)); }
