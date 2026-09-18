// Standalone Scope 4B2 transport; no runtime registration or CPU motif counting.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { applyHypergraphMotifUpdate } from "../../src/candy/adapters/hypergraphUpdateAdapter.js";
import { canonicalIdentifierKey, createCanonicalIdentifierMapping } from "../../src/candy/adapters/identifierMapping.js";
import { CANDY_ERROR_CODES, failCandy } from "../../src/candy/contracts/errorClasses.js";
import { packCudaMotifRequest, validateCudaMotifResult, CUDA_MOTIF_RESULT_SCHEMA } from "./hypergraph-motif-cuda-contract.mjs";

export const CUDA_INCREMENTAL_RESULT_SCHEMA = "candy.hypergraph-motif-cuda-incremental-result/1";
const PACKED = new WeakSet();
const HEADER = "CANDY_HYPERGRAPH_MOTIF_CUDA_INCREMENTAL_REQUEST_V1";
export const candidateCount = (n, a) => choose3(n) - choose3(n - a);
const choose3 = n => n < 3 ? 0 : n * (n - 1) * (n - 2) / 6;
const hex = value => Array.from({ length: value.length }, (_, i) => value.charCodeAt(i).toString(16).padStart(4, "0")).join("");
export function signIncrementalPayload(body) {
  const digest = createHash("sha256").update(body, "utf8").digest("hex");
  return { digest, text: `${HEADER}\nrequest_digest ${digest}\n${body}` };
}
function snapshot(graph, commonVertices, commonEdges, affectedIds, prefix) {
  const affectedKeys = new Set(affectedIds.map(id => canonicalIdentifierKey(id)));
  const offsets = [0], members = [], affected = [], tags = [];
  graph.hyperedges.forEach((edge, index) => {
    tags.push(commonEdges.toNative(edge.canonicalId));
    const row = edge.vertexNativeIndices.map(i => commonVertices.toNative(graph.vertexMapping.toCanonical(i))).sort((a, b) => a - b);
    for (const member of row) members.push(member);
    offsets.push(members.length);
    if (affectedKeys.has(canonicalIdentifierKey(edge.canonicalId))) affected.push(index);
  });
  assert.equal(affected.length, affectedIds.length);
  const candidates = candidateCount(graph.hyperedgeCount, affected.length);
  const lines = [
    `${prefix}vertex_count ${commonVertices.entries.length}`,
    `${prefix}hyperedge_count ${graph.hyperedgeCount}`,
    `${prefix}incidence_count ${graph.incidenceCount}`,
    `${prefix}edge_tags ${tags.length} ${tags.join(" ")}`,
    `${prefix}offsets ${offsets.length} ${offsets.join(" ")}`,
    `${prefix}memberships ${members.length} ${members.join(" ")}`,
    `${prefix}affected ${affected.length} ${affected.join(" ")}`,
    `${prefix}candidate_count ${candidates}`,
  ];
  return { lines, affected: Object.freeze(affected), candidates };
}
export function packCudaIncrementalRequest(oldValue, updateValue, deviceIndex = 0) {
  const oldStatic = Object.freeze(packCudaMotifRequest(oldValue, deviceIndex));
  if (oldStatic.graph.graphType !== "DynamicHypergraph") failCandy(CANDY_ERROR_CODES.INVALID_GRAPH_TYPE, "CUDA_INCREMENTAL requires DynamicHypergraph.");
  // Bound operations before the qualified adapter copies or maps an update.
  if (Array.isArray(updateValue?.deletions) && updateValue.deletions.length > 256
    || Array.isArray(updateValue?.insertions) && updateValue.insertions.length > 256) failCandy(CANDY_ERROR_CODES.RESOURCE_LIMIT, "Incremental operation count exceeds bound.");
  if (Array.isArray(updateValue?.insertions)) {
    let incidences = 0;
    for (const insertion of updateValue.insertions) {
      if (Array.isArray(insertion?.vertices)) incidences += insertion.vertices.length;
      if (incidences > 100_000) failCandy(CANDY_ERROR_CODES.RESOURCE_LIMIT, "Inserted incidence count exceeds bound.");
    }
  }
  const applied = applyHypergraphMotifUpdate(oldStatic.graph, updateValue);
  if (applied.update.updateId.length > 512) failCandy(CANDY_ERROR_CODES.RESOURCE_LIMIT, "Update identity exceeds transport bound.");
  const newStatic = Object.freeze(packCudaMotifRequest(applied.value, deviceIndex));
  const commonVertices = newStatic.graph.vertexMapping;
  const edgeIds = new Map([...oldStatic.graph.hyperedgeMapping.entries, ...newStatic.graph.hyperedgeMapping.entries].map(e => [e.key, e.canonicalId]));
  const commonEdges = createCanonicalIdentifierMapping([...edgeIds.values()], { schemaVersion: "standalone.common-edge-tags/1", label: "common hyperedge" });
  const old = snapshot(oldStatic.graph, commonVertices, commonEdges, applied.update.deletions, "old_");
  const next = snapshot(newStatic.graph, commonVertices, commonEdges, applied.update.insertions.map(e => e.id), "new_");
  const body = [
    "algorithm HYPERGRAPH_3EDGE_MOTIF_COUNT", "taxonomy candy.hypergraph-3edge-motif-taxonomy/1", "mode INCREMENTAL", "graph_type DynamicHypergraph",
    `graph_id_u16 ${hex(oldStatic.graph.graphId)}`, `old_graph_version ${oldStatic.graph.graphVersion}`, `new_graph_version ${newStatic.graph.graphVersion}`,
    `update_id_u16 ${hex(applied.update.updateId)}`, `cuda_device ${deviceIndex}`, ...old.lines, ...next.lines, "END", "",
  ].join("\n");
  const signed = signIncrementalPayload(body);
  if (Buffer.byteLength(signed.text, "utf8") > 2 * 1024 * 1024) failCandy(CANDY_ERROR_CODES.RESOURCE_LIMIT, "Packed request exceeds byte bound.");
  const packed = Object.freeze({ ...signed, oldStatic, newStatic, oldGraph: oldStatic.graph, newGraph: newStatic.graph, newValue: applied.value, update: applied.update, deviceIndex, oldAffected: old.affected, newAffected: next.affected, oldCandidateCount: old.candidates, newCandidateCount: next.candidates });
  PACKED.add(packed);
  return packed;
}
function exact(value, keys) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value));
  assert.deepEqual(Object.keys(value).sort(), [...keys].sort());
}
export function validateCudaIncrementalResult(value, packed) {
  assert.ok(PACKED.has(packed), "Expected authoritative adapter-derived request context");
  exact(value, ["ok", "schemaVersion", "algorithm", "taxonomyVersion", "backend", "mode", "inputGraphRef", "outputGraphRef", "updateId", "requestDigest", "oldAffectedEdgeCount", "newAffectedEdgeCount", "oldCandidateCount", "newCandidateCount", "oldAffectedCounts", "newAffectedCounts", "deltaCounts", "deltaTotalConnectedTriples", "cuda"]);
  assert.equal(value.ok, true); assert.equal(value.schemaVersion, CUDA_INCREMENTAL_RESULT_SCHEMA);
  assert.equal(value.algorithm, "HYPERGRAPH_3EDGE_MOTIF_COUNT"); assert.equal(value.taxonomyVersion, "candy.hypergraph-3edge-motif-taxonomy/1");
  assert.equal(value.backend, "CUDA_INCREMENTAL"); assert.equal(value.mode, "INCREMENTAL");
  for (const [ref, graph] of [[value.inputGraphRef, packed.oldGraph], [value.outputGraphRef, packed.newGraph]]) {
    exact(ref, ["graphId", "graphVersion"]); assert.deepEqual(ref, { graphId: graph.graphId, graphVersion: graph.graphVersion });
  }
  assert.equal(value.updateId, packed.update.updateId); assert.equal(value.requestDigest, packed.digest);
  assert.equal(value.oldAffectedEdgeCount, packed.oldAffected.length); assert.equal(value.newAffectedEdgeCount, packed.newAffected.length);
  assert.equal(value.oldCandidateCount, packed.oldCandidateCount); assert.equal(value.newCandidateCount, packed.newCandidateCount);
  for (const [counts, bound] of [[value.oldAffectedCounts, packed.oldCandidateCount], [value.newAffectedCounts, packed.newCandidateCount]]) {
    assert.ok(Array.isArray(counts) && counts.length === 30);
    counts.forEach(count => assert.ok(Number.isSafeInteger(count) && count >= 0 && count <= bound));
    assert.ok(counts.reduce((sum, count) => sum + count, 0) <= bound);
  }
  assert.ok(Array.isArray(value.deltaCounts) && value.deltaCounts.length === 30);
  value.deltaCounts.forEach((delta, i) => { assert.ok(Number.isSafeInteger(delta)); assert.equal(delta, value.newAffectedCounts[i] - value.oldAffectedCounts[i]); });
  assert.ok(Number.isSafeInteger(value.deltaTotalConnectedTriples));
  assert.equal(value.deltaTotalConnectedTriples, value.deltaCounts.reduce((sum, delta) => sum + delta, 0));
  // Reuse the unchanged STATIC metadata validator without executing/counting STATIC.
  validateCudaMotifResult({ ok: true, schemaVersion: CUDA_MOTIF_RESULT_SCHEMA, algorithm: value.algorithm, taxonomyVersion: value.taxonomyVersion, backend: "CUDA_STATIC", mode: "STATIC", inputGraphRef: value.inputGraphRef, counts: Array(30).fill(0), totalConnectedTriples: 0, cuda: value.cuda }, packed.oldStatic);
  return value;
}
