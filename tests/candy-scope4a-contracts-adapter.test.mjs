import assert from "node:assert/strict";
import { canonicalizeHypergraphIncidence } from "../src/candy/adapters/hypergraphIncidenceAdapter.js";
import { applyHypergraphMotifUpdate } from "../src/candy/adapters/hypergraphUpdateAdapter.js";
import { CANDY_SCHEMA_VERSIONS } from "../src/candy/contracts/schemaVersions.js";
import { CANDY_ERROR_CODES, isCandyContractError } from "../src/candy/contracts/errorClasses.js";
import { GRAPH_TYPES, validateHypergraphMotifCompatibility } from "../src/candy/contracts/graphTypes.js";
import {
  HYPERGRAPH_3EDGE_MOTIF_ALGORITHM,
  HYPERGRAPH_3EDGE_MOTIF_BACKEND,
  validateHypergraphMotifRequest,
  validateHypergraphMotifResult,
  validateHypergraphMotifUpdate,
} from "../src/candy/contracts/hypergraphMotifSchemas.js";
import { HYPERGRAPH_3EDGE_MOTIF_TAXONOMY_V1 } from "../src/candy/hypergraphMotifs/taxonomy.js";
import { hypergraphValue } from "./fixtures/candy-scope4-motifs.mjs";

const assertCandyCode = (fn, code) => assert.throws(fn, error => isCandyContractError(error, code));
const graph = hypergraphValue({
  graphId: "typed-incidence",
  graphType: GRAPH_TYPES.DYNAMIC_HYPERGRAPH,
  vertices: ["10", 10, "isolated", "z", -4],
  hyperedges: [
    { id: "edge-z", vertices: ["z", 10] },
    { id: 91, vertices: ["10"] },
    { id: "same-a", vertices: [-4] },
    { id: "same-b", vertices: [-4] },
  ],
});
const reordered = {
  ...graph,
  vertices: [...graph.vertices].reverse(),
  hyperedges: [...graph.hyperedges].reverse().map(edge => ({ ...edge, vertices: [...edge.vertices].reverse() })),
};
const canonical = canonicalizeHypergraphIncidence(graph);
const canonicalReordered = canonicalizeHypergraphIncidence(reordered);
assert.deepEqual(
  canonical.hyperedges.map(edge => [edge.canonicalId, [...edge.vertexNativeIndices]]),
  canonicalReordered.hyperedges.map(edge => [edge.canonicalId, [...edge.vertexNativeIndices]]),
);
assert.deepEqual(canonical.vertexMapping.entries.map(entry => entry.canonicalId), canonicalReordered.vertexMapping.entries.map(entry => entry.canonicalId));
assert.equal(canonical.isolatedVertexNativeIndices.length, 1);
assert.notEqual(canonical.vertexMapping.toNative("10"), canonical.vertexMapping.toNative(10));
assert.equal(canonical.hyperedges.filter(edge => edge.vertexNativeIndices.length === 1).length, 3);

assertCandyCode(() => canonicalizeHypergraphIncidence({ ...graph, graphType: GRAPH_TYPES.ORDINARY }), CANDY_ERROR_CODES.INVALID_GRAPH_TYPE);
for (const graphType of [GRAPH_TYPES.ORDINARY, GRAPH_TYPES.DYNAMIC_ORDINARY, GRAPH_TYPES.PROJECTED_ORDINARY]) {
  assertCandyCode(() => validateHypergraphMotifCompatibility(graphType), CANDY_ERROR_CODES.INVALID_GRAPH_TYPE);
}
for (const graphType of [GRAPH_TYPES.HYPERGRAPH, GRAPH_TYPES.DYNAMIC_HYPERGRAPH]) {
  assert.equal(validateHypergraphMotifCompatibility(graphType).compatible, true);
}
assertCandyCode(() => canonicalizeHypergraphIncidence({
  ...graph,
  hyperedges: [{ id: "bad", vertices: ["z", "z"] }],
}), CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA);
assertCandyCode(() => canonicalizeHypergraphIncidence({
  ...graph,
  hyperedges: [{ id: "empty", vertices: [] }],
}), CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA);
assertCandyCode(() => canonicalizeHypergraphIncidence({
  ...graph,
  hyperedges: [{ id: "bad", vertices: ["missing"] }],
}), CANDY_ERROR_CODES.INVALID_VERTEX);
assertCandyCode(() => canonicalizeHypergraphIncidence({
  ...graph,
  hyperedges: [{ id: "dup", vertices: ["z"] }, { id: "dup", vertices: [10] }],
}), CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA);

const staticRequest = {
  schemaVersion: CANDY_SCHEMA_VERSIONS.HYPERGRAPH_MOTIF_REQUEST,
  requestId: "static-request",
  algorithm: HYPERGRAPH_3EDGE_MOTIF_ALGORITHM,
  taxonomyVersion: HYPERGRAPH_3EDGE_MOTIF_TAXONOMY_V1,
  mode: "STATIC",
  graphRef: { graphId: graph.graphId, graphVersion: graph.graphVersion },
};
assert.equal(validateHypergraphMotifRequest(staticRequest, canonical).mode, "STATIC");
assertCandyCode(() => validateHypergraphMotifRequest({
  ...staticRequest,
  graphRef: { graphId: graph.graphId, graphVersion: 0 },
}, canonical), CANDY_ERROR_CODES.STALE_GRAPH_VERSION);

const update = {
  schemaVersion: CANDY_SCHEMA_VERSIONS.HYPERGRAPH_MOTIF_UPDATE,
  updateId: "replace-91",
  baseGraphRef: { graphId: graph.graphId, graphVersion: 1 },
  nextGraphVersion: 2,
  ordering: "DELETE_THEN_INSERT",
  collisionPolicy: "REJECT_EXCEPT_EXACT_DELETE_REINSERT",
  deletions: [91],
  insertions: [{ id: 91, vertices: ["new-vertex", "z"] }],
};
assert.equal(validateHypergraphMotifUpdate(update, canonical).ordering, "DELETE_THEN_INSERT");
const applied = applyHypergraphMotifUpdate(graph, update);
assert.equal(applied.canonical.graphVersion, 2);
assert.notEqual(applied.canonical.vertexMapping.toNative("new-vertex"), undefined);
assertCandyCode(() => validateHypergraphMotifUpdate({ ...update, deletions: ["missing"] }, canonical), CANDY_ERROR_CODES.INVALID_UPDATE_BATCH);
assertCandyCode(() => validateHypergraphMotifUpdate({ ...update, deletions: [], insertions: [{ id: "edge-z", vertices: ["z"] }] }, canonical), CANDY_ERROR_CODES.INVALID_UPDATE_BATCH);
assertCandyCode(() => validateHypergraphMotifUpdate({ ...update, deletions: [91, 91] }, canonical), CANDY_ERROR_CODES.INVALID_UPDATE_BATCH);
assertCandyCode(() => validateHypergraphMotifUpdate({ ...update, insertions: [{ id: 91, vertices: ["z", "z"] }] }, canonical), CANDY_ERROR_CODES.INVALID_UPDATE_BATCH);
assertCandyCode(() => validateHypergraphMotifUpdate({
  ...update,
  baseGraphRef: { graphId: graph.graphId, graphVersion: 0 },
  nextGraphVersion: 1,
}, canonical), CANDY_ERROR_CODES.STALE_GRAPH_VERSION);

const incrementalRequest = {
  ...staticRequest,
  requestId: "incremental-request",
  mode: "INCREMENTAL",
  motifStateRef: {
    schemaVersion: CANDY_SCHEMA_VERSIONS.HYPERGRAPH_MOTIF_STATE,
    stateId: "state-1",
    graphId: graph.graphId,
    graphVersion: 1,
    stateVersion: 1,
    taxonomyVersion: HYPERGRAPH_3EDGE_MOTIF_TAXONOMY_V1,
  },
  updateRef: { updateId: update.updateId, baseGraphId: graph.graphId, baseGraphVersion: 1, nextGraphVersion: 2 },
};
assert.equal(validateHypergraphMotifRequest(incrementalRequest, canonical).mode, "INCREMENTAL");
assertCandyCode(() => validateHypergraphMotifRequest({
  ...incrementalRequest,
  motifStateRef: { ...incrementalRequest.motifStateRef, graphVersion: 0 },
}, canonical), CANDY_ERROR_CODES.STALE_PROPERTY_STATE);
assertCandyCode(() => validateHypergraphMotifRequest(incrementalRequest, {
  ...canonical,
  graphType: GRAPH_TYPES.HYPERGRAPH,
}), CANDY_ERROR_CODES.INVALID_GRAPH_TYPE);

const malformedResult = {
  schemaVersion: CANDY_SCHEMA_VERSIONS.HYPERGRAPH_MOTIF_RESULT,
  requestId: "bad-result",
  algorithm: HYPERGRAPH_3EDGE_MOTIF_ALGORITHM,
  taxonomyVersion: HYPERGRAPH_3EDGE_MOTIF_TAXONOMY_V1,
  backend: HYPERGRAPH_3EDGE_MOTIF_BACKEND,
  mode: "STATIC",
  inputGraphRef: { graphId: graph.graphId, graphVersion: 1 },
  counts: Array(29).fill(0),
  totalConnectedTriples: 0,
  validation: { status: "passed", method: "EXACT_SET_ENUMERATION" },
  warnings: [],
};
assertCandyCode(() => validateHypergraphMotifResult(malformedResult), CANDY_ERROR_CODES.OUTPUT_PARSE_FAILURE);

console.log("Scope 4A-R Hypergraph contracts and adapter tests passed.");
