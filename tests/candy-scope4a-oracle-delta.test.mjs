import assert from "node:assert/strict";
import { CANDY_SCHEMA_VERSIONS } from "../src/candy/contracts/schemaVersions.js";
import { GRAPH_TYPES, validateAlgorithmGraphCompatibility } from "../src/candy/contracts/graphTypes.js";
import { CANDY_ERROR_CODES, isCandyContractError } from "../src/candy/contracts/errorClasses.js";
import {
  HYPERGRAPH_3EDGE_MOTIF_ALGORITHM,
} from "../src/candy/contracts/hypergraphMotifSchemas.js";
import {
  computeExactHypergraphMotifDelta,
  countHypergraphThreeEdgeMotifs,
  runIncrementalHypergraphMotifReference,
  runStaticHypergraphMotifReference,
} from "../src/candy/hypergraphMotifs/referenceOracle.js";
import {
  HYPERGRAPH_3EDGE_MOTIF_TAXONOMY,
  HYPERGRAPH_3EDGE_MOTIF_TAXONOMY_V1,
  MOTIF_SHAPES,
} from "../src/candy/hypergraphMotifs/taxonomy.js";
import {
  ALL_30_MOTIF_WITNESSES,
  ANCHOR_COUNTEREXAMPLE_DELETE,
  ANCHOR_OVER_SUBTRACTION_COUNTEREXAMPLE,
  DISCONNECTED_TRIPLE,
  hypergraphValue,
} from "./fixtures/candy-scope4-motifs.mjs";

for (const witness of ALL_30_MOTIF_WITNESSES) {
  const result = countHypergraphThreeEdgeMotifs(witness.graph);
  assert.equal(result.totalConnectedTriples, 1, `motif ${witness.motifId} witness is connected`);
  assert.equal(result.counts[witness.motifId - 1], 1, `motif ${witness.motifId} classifies into its own bin`);
  assert.equal(result.counts.reduce((sum, count) => sum + count, 0), 1);

  const reordered = {
    ...witness.graph,
    vertices: [...witness.graph.vertices].reverse(),
    hyperedges: [...witness.graph.hyperedges].reverse().map(edge => ({ ...edge, vertices: [...edge.vertices].reverse() })),
  };
  assert.deepEqual(countHypergraphThreeEdgeMotifs(reordered).counts, result.counts);

  const renamed = {
    ...witness.graph,
    vertices: witness.graph.vertices.map((_, index) => `renamed-${index * 17 + 5}`),
    hyperedges: witness.graph.hyperedges.map((edge, edgeIndex) => ({
      id: `renamed-edge-${edgeIndex * 23 + 11}`,
      vertices: edge.vertices.map(vertex => `renamed-${witness.graph.vertices.indexOf(vertex) * 17 + 5}`),
    })),
  };
  assert.deepEqual(countHypergraphThreeEdgeMotifs(renamed).counts, result.counts);
}
assert.equal(ALL_30_MOTIF_WITNESSES.length, HYPERGRAPH_3EDGE_MOTIF_TAXONOMY.entries.length);
assert.equal(ALL_30_MOTIF_WITNESSES.filter(witness => witness.shape === MOTIF_SHAPES.OPEN_WEDGE).length, 6);
assert.equal(countHypergraphThreeEdgeMotifs(DISCONNECTED_TRIPLE).totalConnectedTriples, 0);
assert.throws(
  () => countHypergraphThreeEdgeMotifs(ALL_30_MOTIF_WITNESSES[0].graph, { maxHyperedges: 2, maxIncidences: 100 }),
  error => isCandyContractError(error, CANDY_ERROR_CODES.RESOURCE_LIMIT),
);

const nestedAndIdentical = hypergraphValue({
  graphId: "nested-identical",
  vertices: ["a", "b", "c", "isolated"],
  hyperedges: [
    { id: "small", vertices: ["a"] },
    { id: "large", vertices: ["a", "b", "c"] },
    { id: "same-incidence-new-id", vertices: ["a", "b", "c"] },
  ],
});
assert.equal(countHypergraphThreeEdgeMotifs(nestedAndIdentical).totalConnectedTriples, 1);

const staticRequest = graph => ({
  schemaVersion: CANDY_SCHEMA_VERSIONS.HYPERGRAPH_MOTIF_REQUEST,
  requestId: "scope4-static",
  algorithm: HYPERGRAPH_3EDGE_MOTIF_ALGORITHM,
  taxonomyVersion: HYPERGRAPH_3EDGE_MOTIF_TAXONOMY_V1,
  mode: "STATIC",
  graphRef: { graphId: graph.graphId, graphVersion: graph.graphVersion },
});
const staticResult = runStaticHypergraphMotifReference(staticRequest(ALL_30_MOTIF_WITNESSES[0].graph), ALL_30_MOTIF_WITNESSES[0].graph);
assert.equal(staticResult.totalConnectedTriples, 1);

const delta = computeExactHypergraphMotifDelta(ANCHOR_OVER_SUBTRACTION_COUNTEREXAMPLE, ANCHOR_COUNTEREXAMPLE_DELETE);
assert.equal(delta.oldTotalConnectedTriples, 6);
assert.equal(delta.newTotalConnectedTriples, 3);
assert.equal(delta.invariantPassed, true);
assert.equal(delta.deltaCounts.reduce((sum, count) => sum + count, 0), -3);
delta.deltaCounts.forEach((change, index) => assert.equal(delta.oldCounts[index] + change, delta.newCounts[index]));

// Independent model of the discovered reference defect: both closed triangles
// have minimum anchor h1, so anchor-wide subtraction would remove two even
// though deleting h2 destroys only one.
const countClosedH2HTriples = hyperedges => {
  const sets = hyperedges.map(edge => new Set(edge.vertices));
  const intersects = (left, right) => [...left].some(vertex => right.has(vertex));
  let count = 0;
  for (let first = 0; first < sets.length - 2; first += 1) {
    for (let second = first + 1; second < sets.length - 1; second += 1) {
      for (let third = second + 1; third < sets.length; third += 1) {
        if (intersects(sets[first], sets[second])
          && intersects(sets[second], sets[third])
          && intersects(sets[first], sets[third])) count += 1;
      }
    }
  }
  return count;
};
const referenceAnchorSubtraction = -2;
const oldClosedH2HTriples = countClosedH2HTriples(ANCHOR_OVER_SUBTRACTION_COUNTEREXAMPLE.hyperedges);
const newClosedH2HTriples = countClosedH2HTriples(
  ANCHOR_OVER_SUBTRACTION_COUNTEREXAMPLE.hyperedges.filter(edge => edge.id !== "h2"),
);
const exactDestroyedClosedH2HTriples = newClosedH2HTriples - oldClosedH2HTriples;
assert.equal(oldClosedH2HTriples, 2);
assert.equal(newClosedH2HTriples, 1);
assert.equal(referenceAnchorSubtraction, -2);
assert.equal(exactDestroyedClosedH2HTriples, -1);
assert.notEqual(referenceAnchorSubtraction, exactDestroyedClosedH2HTriples);

const incrementalRequest = {
  ...staticRequest(ANCHOR_OVER_SUBTRACTION_COUNTEREXAMPLE),
  requestId: "scope4-incremental",
  mode: "INCREMENTAL",
  motifStateRef: {
    schemaVersion: CANDY_SCHEMA_VERSIONS.HYPERGRAPH_MOTIF_STATE,
    stateId: "motif-state-1",
    graphId: ANCHOR_OVER_SUBTRACTION_COUNTEREXAMPLE.graphId,
    graphVersion: 1,
    stateVersion: 1,
    taxonomyVersion: HYPERGRAPH_3EDGE_MOTIF_TAXONOMY_V1,
  },
  updateRef: {
    updateId: ANCHOR_COUNTEREXAMPLE_DELETE.updateId,
    baseGraphId: ANCHOR_OVER_SUBTRACTION_COUNTEREXAMPLE.graphId,
    baseGraphVersion: 1,
    nextGraphVersion: 2,
  },
};
const incrementalResult = runIncrementalHypergraphMotifReference(
  incrementalRequest,
  ANCHOR_OVER_SUBTRACTION_COUNTEREXAMPLE,
  ANCHOR_COUNTEREXAMPLE_DELETE,
  incrementalRequest.motifStateRef,
);
assert.equal(incrementalResult.validation.deltaInvariant, "passed");
assert.deepEqual(incrementalResult.counts, delta.newCounts);

for (const graphType of [GRAPH_TYPES.ORDINARY, GRAPH_TYPES.DYNAMIC_ORDINARY, GRAPH_TYPES.PROJECTED_ORDINARY]) {
  assert.equal(validateAlgorithmGraphCompatibility("SSSP", graphType).compatible, true);
}
for (const graphType of [GRAPH_TYPES.HYPERGRAPH, GRAPH_TYPES.DYNAMIC_HYPERGRAPH]) {
  assert.throws(
    () => validateAlgorithmGraphCompatibility("SSSP", graphType),
    error => isCandyContractError(error, CANDY_ERROR_CODES.INVALID_GRAPH_TYPE),
  );
}

console.log("Scope 4A-R CPU oracle, exact delta, invariance, and SSSP regression tests passed.");
