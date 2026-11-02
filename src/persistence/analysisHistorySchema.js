import { boundedCopy, StorageFault } from "./storageSafety.js";
import { isProjectId } from "./projectSchema.js";
import { stableStringify } from "../graph/graphFingerprint.js";
import { sha256 } from "./workspaceProvenance.js";
import { admitMemoryContent } from "./assistantMemorySafety.js";
import { MOTIF_TAXONOMY } from "../candy/contracts/runtimeMotif.js";

export const HISTORY_LIMITS = Object.freeze({ records: 24, recordBytes: 256 * 1024, projectBytes: 2 * 1024 * 1024, applicationBytes: 8 * 1024 * 1024, ledger: 512 });
export const CPU_HISTORY_ALGORITHMS = Object.freeze({ connected_components: "Connected Components", bfs: "Breadth-First Search", dfs: "Depth-First Search", shortest_path: "Shortest Path (Dijkstra)", degree_distribution: "Degree Distribution", k_core: "K-Core Decomposition" });
const cpuKeys = { connected_components: "algorithm components vertexToComponent count", bfs: "algorithm startVertex visitOrder edgesUsed distances reached total", dfs: "algorithm startVertex visitOrder edgesUsed distances reached total", shortest_path: "algorithm startVertex targetVertex distances previous path reachable edgesUsed warnings", degree_distribution: "algorithm entries degrees histogram min max avg totalVertices", k_core: "algorithm status coreness degeneracy peelOrder cores usage limits" };
const utf8 = new TextEncoder(), hex = x => typeof x === "string" && /^[0-9a-f]{64}$/.test(x);
const bad = (message, code = "CORRUPT") => { throw new StorageFault(code, message, true); };
const exact = (value, names) => value && Object.keys(value).sort().join() === names.split(" ").sort().join();
const integer = x => Number.isSafeInteger(x) && x >= 0;
const text = (x, n = 160) => typeof x === "string" && x.length <= n && ![...x].some(ch => ch.codePointAt(0) < 32 || ch.codePointAt(0) === 127);
const timestamp = x => typeof x === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(x) && Number.isFinite(Date.parse(x));
export const historyBytes = value => utf8.encode(stableStringify(value)).byteLength;
export const historyDigest = value => sha256(utf8.encode(stableStringify(value)));
function sensitive(value) {
  const scan = stableStringify(value).replace(/\s+/g, " ");
  try { admitMemoryContent(scan); } catch (e) { if (e.code === "SENSITIVE") throw e; }
  if (/"(?:password|passwd|api[_-]?key|access[_-]?token|authorization|secret|credential|runtime[_-]?token)"\s*:\s*"[^"\s]+"/i.test(scan)) bad("Credential-like analysis output cannot be archived.", "SENSITIVE");
  if (/\b(?:password|passwd|api[ _-]?key|access[ _-]?token|authorization|secret|credential|runtime[ _-]?token)\b\s*[:=]\s*\S+/i.test(scan)) bad("Credential-like analysis output cannot be archived.", "SENSITIVE");
}
function normalized(value, depth = 0, budget = { nodes: 0 }) {
  if (++budget.nodes > 20000 || depth > 12) bad("Analysis outcome exceeds its normalization limit.", "LIMIT");
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : { number: String(value) };
  if (value instanceof Map && Object.getPrototypeOf(value) === Map.prototype) return { mapEntries: [...Map.prototype.entries.call(value)].map(([k, v]) => [normalized(k, depth + 1, budget), normalized(v, depth + 1, budget)]) };
  if (Array.isArray(value)) {
    if (value.length > 10000) bad("Analysis outcome array exceeds its limit.", "LIMIT");
    return Array.from({ length: value.length }, (_, index) => {
      const d = Object.getOwnPropertyDescriptor(value, index);
      if (!d || !Object.hasOwn(d, "value")) bad("Sparse or accessor outcomes cannot enter history.");
      return normalized(d.value, depth + 1, budget);
    });
  }
  if (!value || typeof value !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) bad("Analysis outcome is not plain data.");
  const descriptors = Object.getOwnPropertyDescriptors(value), output = {};
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (!["__proto__", "prototype", "constructor"].includes(key) && !descriptor.get && !descriptor.set && descriptor.value !== undefined) output[key] = normalized(descriptor.value, depth + 1, budget);
    else bad("Unsafe analysis outcome property.");
  }
  return output;
}
export function cpuHistoryPayload(algorithm, result) {
  if (!Object.hasOwn(CPU_HISTORY_ALGORITHMS, algorithm) || Object.getOwnPropertyDescriptor(result ?? {}, "algorithm")?.value !== algorithm || algorithm === "k_core" && Object.getOwnPropertyDescriptor(result ?? {}, "status")?.value !== "computed") bad("Only a completed supported algorithm can enter history.", "INCOMPLETE");
  const selected = {};
  for (const key of cpuKeys[algorithm].split(" ")) {
    const descriptor = Object.getOwnPropertyDescriptor(result, key);
    if (!descriptor) continue;
    if (descriptor.get || descriptor.set) bad("Outcome accessors cannot enter history.");
    selected[key] = descriptor.value;
  }
  return { schemaVersion: 1, kind: "CPU_OUTCOME", data: normalized(selected) };
}
export function motifHistoryPayload(evidence) {
  const result = evidence?.result, native = result?.native, incremental = evidence?.backend === "CUDA_INCREMENTAL";
  if (!native || !["CUDA_STATIC", "CUDA_INCREMENTAL"].includes(evidence.backend)) bad("Validated motif completion is unavailable.", "INCOMPLETE");
  return { schemaVersion: 1, kind: incremental ? "MOTIF_DELTA" : "MOTIF_COUNTS", data: { counts: [...(incremental ? native.deltaCounts : native.counts)], total: incremental ? native.deltaTotalConnectedTriples : native.totalConnectedTriples, taxonomyVersion: evidence.taxonomyVersion } };
}
export async function analysisInputDigest(hyperedges) {
  const input = boundedCopy(hyperedges, { bytes: 8 * 1024 * 1024, depth: 20, nodes: 400000, array: 100000, string: 60000 });
  return historyDigest(input);
}
function completionBody(record) { const { sha256: ignored, completionSha256: ignoredCompletion, projectRevisionAtCapture: ignoredRevision, ...body } = record; void ignored; void ignoredCompletion; void ignoredRevision; return body; }
export async function sealHistoryRecord(input) {
  const { sha256: ignored, completionSha256: ignoredCompletion, ...body } = input; void ignored; void ignoredCompletion;
  const record = { ...body, completionSha256: await historyDigest(completionBody(body)) };
  return { ...record, sha256: await historyDigest(record) };
}
export async function validateHistoryRecord(input, projectId) {
  const r = boundedCopy(input, { bytes: HISTORY_LIMITS.recordBytes, depth: 20, nodes: 30000, array: 10000, string: 60000 });
  if (r?.schemaVersion !== 1) bad("Unsupported analysis history schema.", "INCOMPATIBLE");
  if (!exact(r, "schemaVersion recordId projectId projectRevisionAtCapture createdAt completedAt analysisType algorithm label parameters input execution status payload resultSha256 provenance completionSha256 sha256") || !isProjectId(r.recordId) || r.projectId !== projectId || !isProjectId(projectId)
    || !(r.projectRevisionAtCapture === null || integer(r.projectRevisionAtCapture) && r.projectRevisionAtCapture > 0) || !timestamp(r.createdAt) || !timestamp(r.completedAt) || Date.parse(r.completedAt) < Date.parse(r.createdAt) || r.status !== "completed") bad("Invalid historical analysis identity.");
  if (!exact(r.input, "graphId graphVersion graphType graphFingerprint contentSha256 workspacePublicationRevision sourceDigest preview") || !text(r.input.graphId) || !integer(r.input.graphVersion) || !["Hypergraph", "DynamicHypergraph"].includes(r.input.graphType) || !text(r.input.graphFingerprint) || !hex(r.input.contentSha256)
    || !(r.input.workspacePublicationRevision === null || integer(r.input.workspacePublicationRevision)) || !(r.input.sourceDigest === null || hex(r.input.sourceDigest)) || typeof r.input.preview !== "boolean") bad("Invalid historical input identity.");
  if (!exact(r.execution, "backend runtimeVersion deviceName compilerVersion") || !["CPU", "CUDA_STATIC", "CUDA_INCREMENTAL"].includes(r.execution.backend) || [r.execution.runtimeVersion, r.execution.deviceName, r.execution.compilerVersion].some(x => x !== null && !text(x))) bad("Invalid historical backend metadata.");
  if (!exact(r.provenance, "origin sourceProjectId sourceRecordId sourceRecordSha256 sourceProjectRevision nativeRequestDigest") || !["LOCAL", "IMPORTED"].includes(r.provenance.origin) || !(r.provenance.sourceProjectId === null || isProjectId(r.provenance.sourceProjectId)) || !(r.provenance.sourceRecordId === null || isProjectId(r.provenance.sourceRecordId)) || !(r.provenance.sourceRecordSha256 === null || hex(r.provenance.sourceRecordSha256)) || !(r.provenance.sourceProjectRevision === null || integer(r.provenance.sourceProjectRevision)) || !(r.provenance.nativeRequestDigest === null || hex(r.provenance.nativeRequestDigest))) bad("Invalid historical provenance.");
  if (r.provenance.origin === "LOCAL" && [r.provenance.sourceProjectId, r.provenance.sourceRecordId, r.provenance.sourceRecordSha256, r.provenance.sourceProjectRevision].some(x => x !== null) || r.provenance.origin === "IMPORTED" && (!r.provenance.sourceProjectId || !r.provenance.sourceRecordId || !r.provenance.sourceRecordSha256)) bad("Historical origin is inconsistent.");
  if (!exact(r.payload, "schemaVersion kind data") || r.payload.schemaVersion !== 1 || !hex(r.resultSha256) || await historyDigest(r.payload) !== r.resultSha256) bad("Historical outcome digest mismatch.");
  if (r.analysisType === "CPU_ALGORITHM") {
    if (!Object.hasOwn(CPU_HISTORY_ALGORITHMS, r.algorithm) || r.label !== CPU_HISTORY_ALGORITHMS[r.algorithm] || r.execution.backend !== "CPU" || r.execution.runtimeVersion !== null || r.execution.deviceName !== null || r.execution.compilerVersion !== null || r.payload.kind !== "CPU_OUTCOME" || r.payload.data?.algorithm !== r.algorithm || !exact(r.parameters, "startVertex targetVertex") || [r.parameters.startVertex, r.parameters.targetVertex].some(x => x !== null && !text(x, 512))) bad("Invalid CPU history contract.");
    const data = r.payload.data;
    if (!exact(data, cpuKeys[r.algorithm])) bad("Missing or unexpected CPU history field.");
    const mapping = value => exact(value, "mapEntries") && Array.isArray(value.mapEntries) && value.mapEntries.every(pair => Array.isArray(pair) && pair.length === 2 && typeof pair[0] === "string") && new Set(value.mapEntries.map(pair => pair[0])).size === value.mapEntries.length;
    const vertices = value => Array.isArray(value) && value.every(x => typeof x === "string");
    if (["bfs", "dfs", "shortest_path"].includes(r.algorithm)) {
      if (data.startVertex !== r.parameters.startVertex || !mapping(data.distances) || data.distances.mapEntries.some(([, n]) => !(typeof n === "number" && Number.isFinite(n) && n >= 0 || exact(n, "number") && n.number === "Infinity")) || !Array.isArray(data.edgesUsed) || data.edgesUsed.some(edge => !exact(edge, "from to") || typeof edge.from !== "string" || typeof edge.to !== "string")) bad("Invalid historical traversal outcome.");
      if (r.algorithm === "shortest_path" ? data.targetVertex !== r.parameters.targetVertex || !mapping(data.previous) || data.previous.mapEntries.some(([, v]) => v !== null && typeof v !== "string") || !vertices(data.path) || typeof data.reachable !== "boolean" || !vertices(data.warnings) : !vertices(data.visitOrder) || !integer(data.reached) || !integer(data.total) || data.reached > data.total || data.reached !== data.visitOrder.length) bad("Invalid historical path/traversal summary.");
    } else if (r.parameters.startVertex !== null || r.parameters.targetVertex !== null) bad("Unexpected non-traversal parameters.");
    if (r.algorithm === "connected_components" && (!integer(data.count) || !Array.isArray(data.components) || data.count !== data.components.length || !mapping(data.vertexToComponent) || data.vertexToComponent.mapEntries.some(([, n]) => !integer(n) || n >= data.count) || data.components.some(c => !exact(c, "id vertices size color") || !integer(c.id) || !integer(c.size) || !vertices(c.vertices) || c.size !== c.vertices.length || !text(c.color, 40)))) bad("Invalid historical component outcome.");
    if (r.algorithm === "degree_distribution" && (!integer(data.totalVertices) || !Array.isArray(data.entries) || !Array.isArray(data.degrees) || !Array.isArray(data.histogram) || [data.min, data.max, data.avg].some(x => typeof x !== "number" || !Number.isFinite(x) || x < 0) || data.degrees.length !== data.totalVertices || data.entries.length !== data.totalVertices)) bad("Invalid historical degree outcome.");
    if (r.algorithm === "degree_distribution" && (data.entries.some((x, i) => !exact(x, "vertex degree") || typeof x.vertex !== "string" || !integer(x.degree) || data.degrees[i] !== x.degree) || data.histogram.some(x => !exact(x, "degree count") || !integer(x.degree) || !integer(x.count)) || data.histogram.reduce((n, x) => n + x.count, 0) !== data.totalVertices)) bad("Invalid nested historical degree outcome.");
    if (r.algorithm === "k_core" && (data.status !== "computed" || !mapping(data.coreness) || !integer(data.degeneracy) || !Array.isArray(data.peelOrder) || !Array.isArray(data.cores))) bad("Invalid historical core outcome.");
    if (r.algorithm === "k_core" && (data.coreness.mapEntries.some(([, n]) => !integer(n) || n > data.degeneracy) || data.peelOrder.some(x => !exact(x, "vertex coreness degreeAtRemoval") || typeof x.vertex !== "string" || !integer(x.coreness) || !integer(x.degreeAtRemoval)) || data.cores.some(x => !exact(x, "k vertices size") || !integer(x.k) || !vertices(x.vertices) || x.size !== x.vertices.length) || !exact(data.usage, "hyperedges vertices incidences incidenceIndexBuilds candidatePairWork uniqueProjectedEdges adjacencyReferences synchronousWork elapsedMs") || Object.values(data.usage).some(x => typeof x !== "number" || !Number.isFinite(x) || x < 0) || !exact(data.limits, "maxCandidatePairWork maxUniqueProjectedEdges maxAdjacencyReferences maxSynchronousWork") || Object.values(data.limits).some(x => !(integer(x) || exact(x, "number") && x.number === "Infinity")))) bad("Invalid nested historical core outcome.");
  } else if (r.analysisType === "HYPERGRAPH_MOTIF") {
    const incremental = r.execution.backend === "CUDA_INCREMENTAL";
    if (r.algorithm !== "HYPERGRAPH_3EDGE_MOTIF_COUNT" || r.label !== (incremental ? "Hypergraph motif delta" : "Hypergraph motifs") || !["CUDA_STATIC", "CUDA_INCREMENTAL"].includes(r.execution.backend) || !hex(r.provenance.nativeRequestDigest) || !exact(r.parameters, "mode deviceId timeoutMs pendingUpdateDigest") || r.parameters.mode !== (incremental ? "INCREMENTAL" : "STATIC") || !integer(r.parameters.deviceId) || !integer(r.parameters.timeoutMs) || r.parameters.timeoutMs < 1 || r.parameters.timeoutMs > 600000 || (incremental ? !hex(r.parameters.pendingUpdateDigest) : r.parameters.pendingUpdateDigest !== null) || r.payload.kind !== (incremental ? "MOTIF_DELTA" : "MOTIF_COUNTS") || !exact(r.payload.data, "counts total taxonomyVersion") || r.payload.data.taxonomyVersion !== MOTIF_TAXONOMY || !Array.isArray(r.payload.data.counts) || r.payload.data.counts.length !== 30 || r.payload.data.counts.some(x => !Number.isSafeInteger(x) || !incremental && x < 0) || !Number.isSafeInteger(r.payload.data.total) || r.payload.data.counts.reduce((s, x) => s + x, 0) !== r.payload.data.total) bad("Invalid motif history contract.");
  } else bad("Unsupported historical analysis type.", "INCOMPATIBLE");
  sensitive(r);
  const { sha256: stored, ...body } = r;
  if (!hex(stored) || await historyDigest(body) !== stored || !hex(r.completionSha256) || await historyDigest(completionBody(r)) !== r.completionSha256) bad("Historical record digest mismatch.");
  return Object.freeze(r);
}
export async function sealHistoryEnvelope(projectId, revision, records = [], seen = []) {
  const body = { schemaVersion: 1, projectId, revision, records, seen };
  boundedCopy(body, { bytes: HISTORY_LIMITS.projectBytes - 80, depth: 22, nodes: 50000, array: 10000, string: 60000 });
  if (historyBytes(body) + 80 > HISTORY_LIMITS.projectBytes) bad("Project analysis history exceeds its byte limit.", "LIMIT");
  return { ...body, sha256: await historyDigest(body) };
}
export async function verifyHistoryEnvelope(input, projectId) {
  if (input == null) return null;
  const value = boundedCopy(input, { bytes: HISTORY_LIMITS.projectBytes, depth: 22, nodes: 50000, array: 10000, string: 60000 });
  if (value.schemaVersion !== 1) bad("Unsupported history collection schema.", "INCOMPATIBLE");
  if (!exact(value, "schemaVersion projectId revision records seen sha256") || value.projectId !== projectId || !isProjectId(projectId) || !integer(value.revision) || value.revision < 1 || !Array.isArray(value.records) || value.records.length > HISTORY_LIMITS.records || !Array.isArray(value.seen) || value.seen.length > HISTORY_LIMITS.ledger) bad("Invalid historical collection.");
  const ledger = new Map();
  for (const entry of value.seen) { if (!exact(entry, "id digest") || !isProjectId(entry.id) || !hex(entry.digest) || ledger.has(entry.id)) bad("Invalid historical completion ledger."); ledger.set(entry.id, entry.digest); }
  const ids = new Set();
  for (const record of value.records) { await validateHistoryRecord(record, projectId); if (ids.has(record.recordId) || ledger.get(record.recordId) !== record.completionSha256) bad("Historical completion identity mismatch."); ids.add(record.recordId); }
  const { sha256: stored, ...body } = value;
  if (!hex(stored) || await historyDigest(body) !== stored) bad("Historical collection digest mismatch.");
  return value;
}
export async function rebasePortableHistory(records, sourceProjectId, projectId, revision) {
  if (!Array.isArray(records) || records.length > HISTORY_LIMITS.records) bad("Portable analysis history exceeds its count limit.", "LIMIT");
  const rebased = [], ids = new Set();
  for (const record of records) {
    const old = await validateHistoryRecord(record, sourceProjectId);
    if (ids.has(old.recordId)) bad("Duplicate portable history identity."); ids.add(old.recordId);
    const bytes = (await historyDigest([sourceProjectId, old.recordId, old.sha256, projectId])).slice(0, 32).split(""); bytes[12] = "4"; bytes[16] = ((parseInt(bytes[16], 16) & 3) | 8).toString(16); const id = bytes.join("");
    const recordId = `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
    rebased.push(await sealHistoryRecord({ ...old, recordId, projectId, projectRevisionAtCapture: null, input: { ...old.input, workspacePublicationRevision: null }, provenance: { ...old.provenance, origin: "IMPORTED", sourceProjectId, sourceRecordId: old.recordId, sourceRecordSha256: old.sha256, sourceProjectRevision: old.projectRevisionAtCapture } }));
  }
  return sealHistoryEnvelope(projectId, revision, rebased, rebased.map(x => ({ id: x.recordId, digest: x.completionSha256 })));
}
export async function historyCompletionRecord({ projectId, operationId, createdAt, completedAt, graph, hyperedges, workspacePublicationRevision = null, preview = false, algorithm = null, parameters, result = null, evidence = null, runtimeVersion = null, pendingUpdate = null }) {
  const motif = Boolean(evidence), backend = motif ? evidence.backend : "CPU", incremental = backend === "CUDA_INCREMENTAL";
  const payload = motif ? motifHistoryPayload(evidence) : cpuHistoryPayload(algorithm, result), cuda = evidence?.result?.native?.cuda;
  if (incremental) { if (!pendingUpdate) bad("Incremental historical input identity is unavailable.", "INCOMPLETE"); parameters = { ...parameters, pendingUpdateDigest: await historyDigest(boundedCopy(pendingUpdate, { bytes: 256 * 1024, depth: 12, nodes: 20000, array: 10000, string: 60000 })) }; }
  const record = { schemaVersion: 1, recordId: operationId, projectId, projectRevisionAtCapture: null, createdAt, completedAt, analysisType: motif ? "HYPERGRAPH_MOTIF" : "CPU_ALGORITHM", algorithm: motif ? "HYPERGRAPH_3EDGE_MOTIF_COUNT" : algorithm,
    label: motif ? incremental ? "Hypergraph motif delta" : "Hypergraph motifs" : CPU_HISTORY_ALGORITHMS[algorithm], parameters,
    input: { graphId: graph.graphId, graphVersion: graph.graphVersion, graphType: graph.graphType, graphFingerprint: graph.graphFingerprint, contentSha256: await analysisInputDigest(hyperedges), workspacePublicationRevision, sourceDigest: null, preview },
    execution: { backend, runtimeVersion: motif ? runtimeVersion : null, deviceName: motif ? cuda?.deviceName ?? null : null, compilerVersion: motif ? cuda?.compilerVersion ?? null : null }, status: "completed", payload, resultSha256: await historyDigest(payload),
    provenance: { origin: "LOCAL", sourceProjectId: null, sourceRecordId: null, sourceRecordSha256: null, sourceProjectRevision: null, nativeRequestDigest: evidence?.nativeRequestDigest ?? null } };
  return validateHistoryRecord(await sealHistoryRecord(record), projectId);
}
