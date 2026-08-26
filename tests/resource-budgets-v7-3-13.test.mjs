import assert from "node:assert/strict";
import { buildAdjacencyList } from "../src/algorithms/graphModel.js";
import { buildTwoSectionProjectionSafely, PROJECTION_BUDGETS } from "../src/algorithms/projection.js";
import {
  buildV2VBounded,
  DERIVED_STATUS,
  expCanonicalJSON,
  expClique,
  expMatrixResult,
} from "../src/utils/mappings.js";
import { shouldRequestH2H, shouldRequestV2V } from "../src/utils/derivedRequests.js";

assert.equal(shouldRequestH2H({ activeSection: "mappings", selectedMappingId: "h2v", expId: "h2v_txt" }), false);
assert.equal(shouldRequestV2V({ activeSection: "mappings", selectedMappingId: "h2v", expId: "h2v_txt" }), false);
assert.equal(shouldRequestH2H({ activeSection: "mappings", selectedMappingId: "h2h", expId: "h2v_txt" }), true);
assert.equal(shouldRequestV2V({ activeSection: "mappings", selectedMappingId: "v2v", expId: "h2v_txt" }), true);
assert.equal(shouldRequestH2H({ activeSection: "export", selectedMappingId: "h2v", expId: "h2h_txt" }), true);
assert.equal(shouldRequestV2V({ activeSection: "export", selectedMappingId: "h2v", expId: "clique" }), true);
assert.equal(shouldRequestV2V({ activeSection: "export", selectedMappingId: "h2v", expId: "canonical" }), true);
assert.equal(shouldRequestV2V({ activeSection: "export", selectedMappingId: "h2v", expId: "matrix" }), false);

{
  const oneBigHyperedge = [{ id: "h0", vertices: Array.from({ length: 1000 }, (_, i) => `v${i}`) }];
  const projection = buildTwoSectionProjectionSafely(oneBigHyperedge);
  assert.equal(projection.ok, false);
  assert.equal(projection.estimatedPairs, 499_500);
  assert.equal(projection.budget, Math.min(
    PROJECTION_BUDGETS.maxEstimatedPairs,
    PROJECTION_BUDGETS.maxProjectedEdges,
    PROJECTION_BUDGETS.maxOutputRows,
    Math.floor(PROJECTION_BUDGETS.maxAdjacencyReferences / 2),
  ));
  const v2v = buildV2VBounded(oneBigHyperedge);
  assert.equal(v2v.status, DERIVED_STATUS.OVER_BUDGET);
  assert.match(v2v.reason, /output rows|projection safety/i);
  assert.throws(() => buildAdjacencyList(oneBigHyperedge), /V2V projection not computed/);
}

{
  const small = [{ id: "h0", vertices: ["a", "b", "c"] }];
  const projection = buildTwoSectionProjectionSafely(small);
  assert.equal(projection.ok, true);
  assert.equal(projection.projection.edges.length, 3);
  const adjacency = buildAdjacencyList(small);
  assert.deepEqual([...adjacency.get("a")].sort(), ["b", "c"]);
}

{
  const largeSparse = Array.from({ length: 2000 }, (_, i) => ({
    id: `h${i}`,
    vertices: [`v${i}`],
  }));
  const matrix = expMatrixResult(largeSparse);
  assert.equal(matrix.status, DERIVED_STATUS.OVER_BUDGET);
  assert.equal(matrix.estimate.cells, 4_004_001);
  assert.match(matrix.text, /Matrix CSV export not generated/);
}

{
  const small = [
    { id: "h0", vertices: ["a", "b"] },
    { id: "h1", vertices: ["b"] },
  ];
  const matrix = expMatrixResult(small);
  assert.equal(matrix.status, DERIVED_STATUS.COMPUTED);
  assert.match(matrix.text, /^vertex,h0,h1\r\n/);
}

{
  const suppliedV2V = {
    status: DERIVED_STATUS.COMPUTED,
    projection: { weightPolicy: "count_shared_hyperedges", edges: [{ src: "a", dst: "b", weight: 1, hyperedges: ["h0"] }] },
    edges: [{ src: "a", dst: "b", weight: 1, hyperedges: ["h0"] }],
  };
  assert.match(expClique([], { v2vResult: suppliedV2V }), /a,b,1/);
  const canonical = JSON.parse(expCanonicalJSON([{ id: "h0", vertices: ["a", "b"] }], { fmt: "test" }, { v2vResult: suppliedV2V }));
  assert.equal(canonical.metadata.projection.edgeCount, 1);
  assert.deepEqual(canonical.v2vProjection, suppliedV2V.projection.edges);
}

console.log("v7.3.13 resource/lazy projection/export budget tests passed.");
