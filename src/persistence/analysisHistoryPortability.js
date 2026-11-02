import { boundedCopy, parseBoundedJSON, StorageFault } from "./storageSafety.js";
import { isProjectId, validateProject } from "./projectSchema.js";
import { stableStringify } from "../graph/graphFingerprint.js";
import { sha256 } from "./workspaceProvenance.js";
import { HISTORY_LIMITS, historyBytes, historyDigest, validateHistoryRecord, verifyHistoryEnvelope, rebasePortableHistory } from "./analysisHistorySchema.js";

export const HISTORY_PORTABLE_MAGIC = "CANDY-ANALYSIS-HISTORY\n";
export const HISTORY_PORTABLE_LIMITS = Object.freeze({ bytes: 3 * 1024 * 1024, depth: 24, nodes: 60000, array: 10000, string: 60000 });
const utf8 = new TextEncoder(), stages = new WeakMap();
const bad = (message, code = "CORRUPT") => { throw new StorageFault(code, message, true); };
function name(value) {
  if (typeof value !== "string" || !value.trim() || value.length > 80 || [...value].some(ch => ch.codePointAt(0) < 32 || ch.codePointAt(0) === 127)) bad("Invalid history project name.");
  return value;
}
// Inspect direct API inputs without invoking accessors/toJSON. File JSON still
// goes through this same admission path, including exact fields and byte caps.
function plain(input) {
  const active = new Set(); let nodes = 0;
  function visit(value, depth) {
    if (++nodes > HISTORY_PORTABLE_LIMITS.nodes || depth > HISTORY_PORTABLE_LIMITS.depth) bad("History data exceeds its structural limit.", "LIMIT");
    if (value === null || ["string", "number", "boolean"].includes(typeof value)) return;
    if (!value || typeof value !== "object" || active.has(value) || ![Object.prototype, null, Array.prototype].includes(Object.getPrototypeOf(value))) bad("History requires acyclic plain data.");
    if (Array.isArray(value) && value.length > HISTORY_PORTABLE_LIMITS.array) bad("History array exceeds its limit.", "LIMIT");
    active.add(value);
    for (const key of Reflect.ownKeys(value)) {
      if (Array.isArray(value) && key === "length") continue;
      const d = Object.getOwnPropertyDescriptor(value, key);
      if (typeof key !== "string" || ["__proto__", "prototype", "constructor"].includes(key) || !d?.enumerable || !Object.hasOwn(d, "value") || d.value === undefined) bad("Unsafe history property.");
      visit(d.value, depth + 1);
    }
    active.delete(value);
  }
  visit(input, 0);
  return boundedCopy(input, HISTORY_PORTABLE_LIMITS);
}
export async function validateHistoryPortableObject(input) {
  const v = plain(input);
  if (v?.schemaVersion !== 1 || v.format !== "candy.analysis-history") bad("Unsupported standalone history format or schema.", "INCOMPATIBLE");
  if (Object.keys(v).sort().join() !== "format,name,records,schemaVersion,sha256,sourceProjectId" || !isProjectId(v.sourceProjectId) || !/^[0-9a-f]{64}$/.test(v.sha256)) bad("Invalid standalone history identity.");
  name(v.name);
  if (!Array.isArray(v.records) || !v.records.length || v.records.length > HISTORY_LIMITS.records || historyBytes(v.records) > HISTORY_LIMITS.projectBytes) bad("Standalone history exceeds its record limit.", "LIMIT");
  const ids = new Set();
  for (const record of v.records) {
    await validateHistoryRecord(record, v.sourceProjectId);
    if (ids.has(record.recordId)) bad("Duplicate historical result identity.");
    ids.add(record.recordId);
  }
  const { sha256: stored, ...body } = v;
  if (await historyDigest(body) !== stored) bad("Standalone history digest mismatch.");
  return v;
}
export async function decodeHistoryPortable(input) {
  let bytes;
  if (typeof Blob !== "undefined" && input instanceof Blob) {
    if (input.size > HISTORY_PORTABLE_LIMITS.bytes) bad("History file exceeds 3 MiB.", "LIMIT");
    bytes = new Uint8Array(await input.arrayBuffer());
  } else if (input instanceof ArrayBuffer || input instanceof Uint8Array) {
    if (input.byteLength > HISTORY_PORTABLE_LIMITS.bytes) bad("History file exceeds 3 MiB.", "LIMIT");
    bytes = input instanceof ArrayBuffer ? new Uint8Array(input.slice(0)) : new Uint8Array(input).slice();
  } else bad("Select an uncompressed standalone history file.");
  if (bytes.length > HISTORY_PORTABLE_LIMITS.bytes) bad("History file exceeds 3 MiB.", "LIMIT");
  const prefix = utf8.encode(HISTORY_PORTABLE_MAGIC);
  if (bytes.length < prefix.length || prefix.some((n, i) => bytes[i] !== n)) bad("Not a standalone history file.", "INCOMPATIBLE");
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(prefix.length)); }
  catch { bad("History file is not valid UTF-8."); }
  const value = parseBoundedJSON(text, HISTORY_PORTABLE_LIMITS);
  if (stableStringify(value) !== text) bad("History JSON is noncanonical or has duplicate keys.");
  return { value: await validateHistoryPortableObject(value), fileSha256: await sha256(bytes) };
}
export async function exportAnalysisHistory(store, projectId) {
  const snapshot = await store.readHistoryPortableSnapshot(projectId), project = validateProject(snapshot.project);
  if (project.projectId !== projectId) bad("History snapshot owner mismatch.");
  if (project.deleted) bad("Deleted project cannot export history.", "DELETED");
  const history = await verifyHistoryEnvelope(snapshot.history, projectId);
  if (!history?.records.length) bad("No retained analysis history to export.", "INCOMPLETE");
  if (history.revision > project.revision) bad("History is newer than its project.");
  const body = { format: "candy.analysis-history", schemaVersion: 1, sourceProjectId: projectId, name: name(snapshot.name), records: history.records };
  const bytes = utf8.encode(HISTORY_PORTABLE_MAGIC + stableStringify({ ...body, sha256: await historyDigest(body) }));
  const verified = await decodeHistoryPortable(bytes);
  return Object.freeze({ bytes, sha256: verified.fileSha256, filename: `candy-history-${projectId}.candy-analysis-history`, recordCount: history.records.length });
}
export async function stageAnalysisHistory(input) {
  const decoded = await decodeHistoryPortable(input), value = decoded.value;
  const handle = Object.freeze({ name: value.name, recordCount: value.records.length, backends: Object.freeze([...new Set(value.records.map(r => r.execution.backend))].sort()), origin: "IMPORTED / unverified", sourceProjectId: value.sourceProjectId });
  stages.set(handle, decoded);
  return handle;
}
export function discardAnalysisHistoryStage(handle) { stages.delete(handle); }
export async function takeHistoryPublication(handle, projectId, revision) {
  const decoded = stages.get(handle);
  if (!decoded) bad("History review is obsolete or already consumed. Select the file again.", "ABANDONED");
  stages.delete(handle); // Consume synchronously before any asynchronous work.
  const v = decoded.value, history = await rebasePortableHistory(v.records, v.sourceProjectId, projectId, revision);
  await verifyHistoryEnvelope(history, projectId);
  return { history, name: v.name, sourceProjectId: v.sourceProjectId, fileSha256: decoded.fileSha256 };
}
