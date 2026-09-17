// Standalone qualification transport. Not registered with Runtime Companion.
import assert from "node:assert/strict";
import { canonicalizeHypergraphIncidence } from "../../src/candy/adapters/hypergraphIncidenceAdapter.js";
import { CANDY_ERROR_CODES, failCandy } from "../../src/candy/contracts/errorClasses.js";
import { HYPERGRAPH_3EDGE_MOTIF_TAXONOMY_V1 } from "../../src/candy/hypergraphMotifs/taxonomy.js";

export const CUDA_MOTIF_RESULT_SCHEMA = "candy.hypergraph-motif-cuda-static-result/1";
export function packCudaMotifRequest(value, deviceIndex = 0) {
  if (!Number.isSafeInteger(deviceIndex) || deviceIndex < 0 || deviceIndex > 2147483647) {
    failCandy(CANDY_ERROR_CODES.BACKEND_UNAVAILABLE, "Invalid CUDA device index.");
  }
  const graph = canonicalizeHypergraphIncidence(value, { maxHyperedges: 256, maxTotalIncidences: 100_000 });
  const visits = graph.hyperedgeCount < 3 ? 0 : graph.incidenceCount * (graph.hyperedgeCount - 1) * (graph.hyperedgeCount - 2) / 2;
  if (!Number.isSafeInteger(visits) || visits > 5_000_000) failCandy(CANDY_ERROR_CODES.RESOURCE_LIMIT, "Qualified aggregate work budget exceeded.");
  const offsets = [0], members = [];
  for (const edge of graph.hyperedges) {
    for (const member of edge.vertexNativeIndices) members.push(member);
    offsets.push(members.length);
  }
  // Use code units rather than UTF-8 conversion, preserving lone surrogates too.
  const graphHex = Array.from({ length: graph.graphId.length }, (_, index) => graph.graphId.charCodeAt(index).toString(16).padStart(4, "0")).join("");
  const text = [
    "CANDY_HYPERGRAPH_MOTIF_CUDA_STATIC_REQUEST_V1",
    "algorithm HYPERGRAPH_3EDGE_MOTIF_COUNT",
    `taxonomy ${HYPERGRAPH_3EDGE_MOTIF_TAXONOMY_V1}`,
    "mode STATIC",
    `graph_type ${graph.graphType}`,
    `graph_id_u16 ${graphHex}`,
    `graph_version ${graph.graphVersion}`,
    `cuda_device ${deviceIndex}`,
    `vertex_count ${graph.vertexCount}`,
    `hyperedge_count ${graph.hyperedgeCount}`,
    `incidence_count ${graph.incidenceCount}`,
    `offsets ${offsets.length} ${offsets.join(" ")}`,
    `memberships ${members.length} ${members.join(" ")}`,
    "END",
    "",
  ].join("\n");
  return { graph, text, deviceIndex };
}

function exactKeys(value, keys) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value));
  assert.deepEqual(Object.keys(value).sort(), [...keys].sort());
}
function integer(value) { assert.ok(Number.isSafeInteger(value) && value >= 0); }
export function validateCudaMotifResult(value, packed) {
  exactKeys(value, ["ok", "schemaVersion", "algorithm", "taxonomyVersion", "backend", "mode", "inputGraphRef", "counts", "totalConnectedTriples", "cuda"]);
  assert.equal(value.ok, true);
  assert.equal(value.schemaVersion, CUDA_MOTIF_RESULT_SCHEMA);
  assert.equal(value.algorithm, "HYPERGRAPH_3EDGE_MOTIF_COUNT");
  assert.equal(value.taxonomyVersion, HYPERGRAPH_3EDGE_MOTIF_TAXONOMY_V1);
  assert.equal(value.backend, "CUDA_STATIC");
  assert.equal(value.mode, "STATIC");
  exactKeys(value.inputGraphRef, ["graphId", "graphVersion"]);
  assert.deepEqual(value.inputGraphRef, { graphId: packed.graph.graphId, graphVersion: packed.graph.graphVersion });
  assert.ok(Array.isArray(value.counts) && value.counts.length === 30);
  value.counts.forEach(integer);
  integer(value.totalConnectedTriples);
  const n = packed.graph.hyperedgeCount;
  assert.ok(value.totalConnectedTriples <= (n < 3 ? 0 : n * (n - 1) * (n - 2) / 6));
  assert.equal(value.counts.reduce((sum, count) => sum + count, 0), value.totalConnectedTriples);
  const cuda = value.cuda;
  exactKeys(cuda, ["deviceIndex", "deviceName", "computeMajor", "computeMinor", "compiledArchitecture", "compilerVersion", "runtimeVersion", "driverVersion", "kernelLaunchSucceeded", "synchronizationSucceeded", "kernelMilliseconds"]);
  assert.equal(cuda.deviceIndex, packed.deviceIndex);
  assert.ok(typeof cuda.deviceName === "string" && cuda.deviceName.length > 0 && cuda.deviceName.length <= 256);
  [cuda.computeMajor, cuda.computeMinor, cuda.runtimeVersion, cuda.driverVersion].forEach(integer);
  assert.ok(cuda.computeMajor > 0 && cuda.runtimeVersion > 0 && cuda.driverVersion > 0);
  assert.match(cuda.compiledArchitecture, /^sm_[0-9]{2,3}$/);
  assert.match(cuda.compilerVersion, /^[0-9]+\.[0-9]+\.[0-9]+$/);
  assert.equal(cuda.kernelLaunchSucceeded, true);
  assert.equal(cuda.synchronizationSucceeded, true);
  assert.ok(Number.isFinite(cuda.kernelMilliseconds) && cuda.kernelMilliseconds >= 0);
  return value;
}
