import { boundedCopy, StorageFault, utf8Bytes } from "./storageSafety.js";
import { isProjectId, newProjectId } from "./projectSchema.js";
import { isSha256, sha256 } from "./workspaceProvenance.js";
import { stableStringify } from "../graph/graphFingerprint.js";
import { admitMemoryContent } from "./assistantMemorySafety.js";

export const MEMORY_TYPES = Object.freeze(["PROJECT_SUMMARY", "PROJECT_GOAL", "USER_DECISION", "USER_CONSTRAINT", "WORK_COMPLETED", "CURRENT_STATUS", "OPEN_ISSUE", "NEXT_STEP", "REFERENCE", "PROJECT_PREFERENCE", "TECHNICAL_FACT", "RESULT_SUMMARY", "ASSISTANT_NOTE"]);
export const MEMORY_PROVENANCE = Object.freeze(["USER_EXPLICIT", "WORKSPACE_DERIVED", "ASSISTANT_INFERRED", "SYSTEM_DERIVED", "IMPORTED"]);
export const MEMORY_LIMITS = Object.freeze({ contentChars: 2000, contentBytes: 8000, records: 100, active: 32, projectBytes: 256 * 1024, retrieved: 8, contextChars: 6000, perType: 2 });
const reject = message => { throw new StorageFault("CORRUPT", message, true); };
const keys = (v, names) => v && Object.keys(v).sort().join() === names.split(" ").sort().join();
const date = v => typeof v === "string" && /^\d{4}-\d\d-\d\dT/.test(v) && v.length <= 32 && Number.isFinite(Date.parse(v));
export const memoryDigest = value => sha256(new TextEncoder().encode(stableStringify(value)));
export function validateMemoryEnvelope(raw, projectId) {
  const v = boundedCopy(raw, { bytes: MEMORY_LIMITS.projectBytes, depth: 8, nodes: 12000, array: MEMORY_LIMITS.records, string: MEMORY_LIMITS.contentChars });
  if (v?.schemaVersion !== 1) throw new StorageFault("INCOMPATIBLE", "Unsupported memory schema; original records preserved.", true);
  if (!keys(v, "projectId schemaVersion revision records sha256") || !isProjectId(projectId) || v.projectId !== projectId || !Number.isSafeInteger(v.revision) || v.revision < 1 || !isSha256(v.sha256) || !Array.isArray(v.records)) reject("Memory collection ownership/shape is invalid.");
  const ids = new Set();
  for (const r of v.records) {
    if (!keys(r, "memoryId projectId memoryType schemaVersion topic content createdAt updatedAt revision status provenance sourceRefs importance confidence supersedes contentDigest") || r.schemaVersion !== 1 || !isProjectId(r.memoryId) || ids.has(r.memoryId) || r.projectId !== projectId || !MEMORY_TYPES.includes(r.memoryType) || !MEMORY_PROVENANCE.includes(r.provenance) || !["ACTIVE", "SUPERSEDED", "FORGOTTEN"].includes(r.status) || !date(r.createdAt) || !date(r.updatedAt) || r.updatedAt < r.createdAt || !Number.isSafeInteger(r.revision) || r.revision < 1 || r.revision > v.revision || typeof r.topic !== "string" || !/^[a-z0-9][a-z0-9._-]{0,79}$/.test(r.topic) || ![0, 1, 2].includes(r.importance) || !["USER_STATED", "DETERMINISTIC", "UNVERIFIED"].includes(r.confidence) || !isSha256(r.contentDigest) || typeof r.content !== "string" || r.content.length > MEMORY_LIMITS.contentChars || utf8Bytes(r.content) > MEMORY_LIMITS.contentBytes || !Array.isArray(r.sourceRefs) || r.sourceRefs.length > 1 || (r.supersedes !== null && !isProjectId(r.supersedes))) reject("Memory record metadata is invalid.");
    admitMemoryContent(r.topic);
    if (r.confidence !== (r.provenance === "USER_EXPLICIT" ? "USER_STATED" : ["WORKSPACE_DERIVED", "SYSTEM_DERIVED"].includes(r.provenance) ? "DETERMINISTIC" : "UNVERIFIED")) reject("Memory certainty conflicts with provenance.");
    if (r.status === "FORGOTTEN" ? r.content !== "" || r.sourceRefs.length : admitMemoryContent(r.content) !== r.content) reject("Memory content/lifecycle is invalid.");
    for (const s of r.sourceRefs) if (!keys(s, "projectId workspaceDigest graphFingerprint sourceDigests") || s.projectId !== projectId || !isSha256(s.workspaceDigest) || !(s.graphFingerprint === null || typeof s.graphFingerprint === "string" && /^[a-zA-Z0-9:_-]{1,160}$/.test(s.graphFingerprint)) || !Array.isArray(s.sourceDigests) || s.sourceDigests.length > 24 || !s.sourceDigests.every(isSha256)) reject("Memory source provenance is invalid.");
    if (r.provenance === "WORKSPACE_DERIVED" && r.status !== "FORGOTTEN" && r.sourceRefs.length !== 1) reject("Workspace-derived memory requires a verified workspace link.");
    ids.add(r.memoryId);
  }
  if (v.records.filter(r => r.status === "ACTIVE").length > MEMORY_LIMITS.active) throw new StorageFault("LIMIT", "Active memory limit reached.", true);
  const byId = new Map(v.records.map(r => [r.memoryId, r]));
  for (const r of v.records) if (r.supersedes) {
    const p = byId.get(r.supersedes);
    if (!p || p.memoryId === r.memoryId || p.revision >= r.revision || !["SUPERSEDED", "FORGOTTEN"].includes(p.status) || p.topic !== r.topic || p.memoryType !== r.memoryType) reject("Broken or cyclic memory supersession.");
  }
  return v;
}
export async function sealMemoryEnvelope(projectId, revision, records) {
  const body = { projectId, schemaVersion: 1, revision, records };
  return validateMemoryEnvelope({ ...body, sha256: await memoryDigest(body) }, projectId);
}
export async function verifyMemoryEnvelope(raw, projectId) {
  if (!raw) return null;
  const v = validateMemoryEnvelope(raw, projectId), { sha256: expected, ...body } = v;
  if (await memoryDigest(body) !== expected) reject("Memory collection digest mismatch.");
  for (const r of v.records) if (await memoryDigest(r.content) !== r.contentDigest) reject("Memory content digest mismatch.");
  return v;
}
export async function prepareMemoryMutation(projectId, revision, previous, command, binding = null) {
  const c = boundedCopy(command, { bytes: 12000, depth: 3, nodes: 25, string: MEMORY_LIMITS.contentChars });
  if (!c || !["remember", "supersede", "forget", "forgetType", "clear"].includes(c.kind)) reject("Unknown memory operation.");
  const allowed = ["kind", "memoryId", "memoryType", "content", "topic", "provenance", "importance"];
  if (Object.keys(c).some(k => !allowed.includes(k))) reject("Unsupported memory operation field.");
  let records = previous ? structuredClone(previous.records) : [];
  const now = new Date().toISOString();
  if (c.kind === "clear") records = [];
  else if (["forget", "forgetType"].includes(c.kind)) {
    if (c.kind === "forget" && !records.some(r => r.memoryId === c.memoryId) || c.kind === "forgetType" && !MEMORY_TYPES.includes(c.memoryType)) reject("Unknown memory/category.");
    const emptyDigest = await memoryDigest("");
    records = records.map(r => (c.kind === "forget" ? r.memoryId === c.memoryId : r.memoryType === c.memoryType) ? { ...r, content: "", sourceRefs: [], status: "FORGOTTEN", updatedAt: now, contentDigest: emptyDigest } : r);
  } else {
    const content = admitMemoryContent(c.content), provenance = c.provenance ?? "USER_EXPLICIT";
    const confidence = provenance === "USER_EXPLICIT" ? "USER_STATED" : ["WORKSPACE_DERIVED", "SYSTEM_DERIVED"].includes(provenance) ? "DETERMINISTIC" : "UNVERIFIED";
    const contentDigest = await memoryDigest(content), old = c.kind === "supersede" ? records.find(r => r.memoryId === c.memoryId && r.status === "ACTIVE") : null;
    if (c.kind === "supersede" && !old) reject("Only an active owned memory can be superseded.");
    const memoryType = old?.memoryType ?? c.memoryType ?? "USER_DECISION", topic = old?.topic ?? c.topic ?? "general";
    if (c.kind === "remember" && records.some(r => r.status === "ACTIVE" && r.memoryType === memoryType && r.topic === topic && r.contentDigest === contentDigest && r.provenance === provenance)) throw new StorageFault("DUPLICATE", "An identical active memory already exists.", true);
    const sourceRefs = provenance === "WORKSPACE_DERIVED" ? binding ? [binding] : [] : [];
    if (old) records = records.map(r => r.memoryId === old.memoryId ? { ...r, status: "SUPERSEDED", updatedAt: now } : r);
    records.push({ memoryId: newProjectId(), projectId, memoryType, schemaVersion: 1, topic, content, createdAt: now, updatedAt: now, revision, status: "ACTIVE", provenance, sourceRefs, importance: c.importance ?? 1, confidence, supersedes: old?.memoryId ?? null, contentDigest });
  }
  return sealMemoryEnvelope(projectId, revision, records);
}
