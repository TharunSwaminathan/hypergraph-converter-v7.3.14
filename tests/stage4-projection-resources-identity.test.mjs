import assert from "node:assert/strict";
import { buildAdjacencyList } from "../src/algorithms/graphModel.js";
import {
  buildTwoSectionProjection,
  buildTwoSectionProjectionSafely,
  PROJECTION_WEIGHT_POLICIES,
} from "../src/algorithms/projection.js";
import {
  DenseProjection,
  DuplicateOverlap,
} from "./fixtures/v7.3.14/stage0-regression-fixtures.mjs";
import { buildV2VBounded, DERIVED_STATUS } from "../src/utils/mappings.js";

const nulProjection = buildTwoSectionProjection([
  record("h1", ["a", "b\u0000c"]),
  record("h2", ["a\u0000b", "c"]),
]);
assert.deepEqual(nulProjection.edges, [
  { src: "a", dst: "b\u0000c", weight: 1, hyperedges: ["h1"] },
  { src: "a\u0000b", dst: "c", weight: 1, hyperedges: ["h2"] },
]);

const numericLexical = buildTwoSectionProjection([
  record("h1", ["01", "1"]),
  record("h2", ["1", "01"]),
]);
assert.deepEqual(numericLexical.edges, [
  { src: "01", dst: "1", weight: 2, hyperedges: ["h1", "h2"] },
]);
const decimalLexical = buildTwoSectionProjection([
  record("h1", ["1.0", "1"]),
  record("h2", ["1", "1.0"]),
]);
assert.deepEqual(decimalLexical.edges, [
  { src: "1", dst: "1.0", weight: 2, hyperedges: ["h1", "h2"] },
]);

const exactIdentifiers = buildTwoSectionProjection([
  record("h", ["0", "__proto__", "constructor", "null", "Δ😀", "😀", "toString"]),
]);
assert.equal(exactIdentifiers.edges.length, 21);
assert.ok(exactIdentifiers.vertices.includes("0"));
assert.ok(exactIdentifiers.vertices.includes("__proto__"));
assert.ok(exactIdentifiers.vertices.includes("null"));
assert.ok(exactIdentifiers.vertices.includes("Δ😀"));
assert.ok(exactIdentifiers.vertices.includes("😀"));

const weightedGraph = [record("h0", ["b", "a"], { weight: 0 }), record("h1", ["a", "b"], { weight: 2 })];
for (const [weightPolicy, expectedWeight] of [
  [PROJECTION_WEIGHT_POLICIES.COUNT_SHARED_HYPEREDGES, 2],
  [PROJECTION_WEIGHT_POLICIES.SUM_HYPEREDGE_WEIGHTS, 2],
  [PROJECTION_WEIGHT_POLICIES.MIN_HYPEREDGE_WEIGHT, 0],
  [PROJECTION_WEIGHT_POLICIES.UNWEIGHTED, 1],
]) {
  const projection = buildTwoSectionProjection(weightedGraph, { weightPolicy });
  assert.deepEqual(projection.edges, [{ src: "a", dst: "b", weight: expectedWeight, hyperedges: ["h0", "h1"] }]);
}

const overlap = buildTwoSectionProjectionSafely(DuplicateOverlap());
assert.equal(overlap.ok, true);
assert.equal(overlap.projection.edges.length, 1_035);
assert.equal(overlap.usage.candidatePairWork, 207_000);
assert.equal(overlap.usage.uniqueProjectedEdges, 1_035);
assert.equal(overlap.usage.projectedEdgeSupportReferences, 207_000);
assert.equal(overlap.usage.adjacencyReferences, 2_070);
assert.equal(overlap.projection.edges[0].weight, 200);
assert.equal(overlap.projection.edges[0].hyperedges.length, 200);
const boundedOverlap = buildV2VBounded(DuplicateOverlap());
assert.equal(boundedOverlap.status, DERIVED_STATUS.COMPUTED);
assert.equal(boundedOverlap.edges.length, 1_035);
assert.equal(boundedOverlap.usage.candidatePairWork, 207_000);
assert.equal(boundedOverlap.estimate.uniqueProjectedEdges, 1_035);

const candidateRefusal = buildTwoSectionProjectionSafely(DuplicateOverlap({ hyperedgeCount: 10, vertexCount: 10 }), {
  maxCandidatePairWork: 100,
  maxUniqueProjectedEdges: Infinity,
  maxProjectedEdgeSupportReferences: Infinity,
  maxSynchronousWork: Infinity,
});
assertRefusal(candidateRefusal, "candidatePairWork");

const uniqueRefusal = buildTwoSectionProjectionSafely([record("unique", ["a", "b", "c", "d", "e", "f"])], {
  maxCandidatePairWork: Infinity,
  maxUniqueProjectedEdges: 5,
  maxProjectedEdgeSupportReferences: Infinity,
  maxSynchronousWork: Infinity,
});
assertRefusal(uniqueRefusal, "uniqueProjectedEdges");

const supportRefusal = buildTwoSectionProjectionSafely([
  record("h0", ["a", "b", "c", "d"]),
  record("h1", ["a", "b", "c", "d"]),
  record("h2", ["a", "b", "c", "d"]),
], {
  maxCandidatePairWork: Infinity,
  maxUniqueProjectedEdges: Infinity,
  maxProjectedEdgeSupportReferences: 10,
  maxSynchronousWork: Infinity,
});
assertRefusal(supportRefusal, "projectedEdgeSupportReferences");

const synchronousRefusal = buildTwoSectionProjectionSafely([record("work", ["a", "b", "c", "d"])], {
  maxCandidatePairWork: Infinity,
  maxUniqueProjectedEdges: Infinity,
  maxProjectedEdgeSupportReferences: Infinity,
  maxSynchronousWork: 3,
});
assertRefusal(synchronousRefusal, "synchronousWork");

const downstreamLimitsDoNotPreflight = buildTwoSectionProjectionSafely(DuplicateOverlap({ hyperedgeCount: 2, vertexCount: 6 }), {
  maxCandidatePairWork: Infinity,
  maxUniqueProjectedEdges: Infinity,
  maxProjectedEdgeSupportReferences: Infinity,
  maxSynchronousWork: Infinity,
  maxAdjacencyReferences: 1,
  maxRenderEdges: 1,
  maxExportRows: 1,
  maxMatrixCells: 1,
});
assert.equal(downstreamLimitsDoNotPreflight.ok, true);
assert.ok(downstreamLimitsDoNotPreflight.usage.adjacencyReferences > downstreamLimitsDoNotPreflight.limits.maxAdjacencyReferences);
assert.ok(downstreamLimitsDoNotPreflight.usage.renderEdges > downstreamLimitsDoNotPreflight.limits.maxRenderEdges);
assert.ok(downstreamLimitsDoNotPreflight.usage.exportRows > downstreamLimitsDoNotPreflight.limits.maxExportRows);
assert.ok(downstreamLimitsDoNotPreflight.usage.matrixCells > downstreamLimitsDoNotPreflight.limits.maxMatrixCells);
assert.match(downstreamLimitsDoNotPreflight.resourceMaterialization.adjacencyReferences, /downstream/);

assert.throws(
  () => buildAdjacencyList([record("adj", ["a", "b", "c"])], { maxAdjacencyReferences: 2 }),
  /adjacency references.*adjacencyReferences safety limit/i,
);

const denseUniqueRefusal = buildTwoSectionProjectionSafely(DenseProjection({ vertexCount: 1_000 }));
assertRefusal(denseUniqueRefusal, "uniqueProjectedEdges");
assert.equal("projection" in denseUniqueRefusal, false, "a resource refusal cannot expose a partial projection");
const candidateSafetyRefusal = buildTwoSectionProjectionSafely(DenseProjection({ vertexCount: 3_000 }));
assertRefusal(candidateSafetyRefusal, "candidatePairWork");
assert.equal("projection" in candidateSafetyRefusal, false);
const boundedCandidateRefusal = buildV2VBounded(DenseProjection({ vertexCount: 3_000 }));
assert.equal(boundedCandidateRefusal.status, DERIVED_STATUS.OVER_BUDGET);
assert.equal(boundedCandidateRefusal.exceededResource, "candidatePairWork");
assert.equal(boundedCandidateRefusal.value, null);

console.log("v7.3.14 Stage 4 projection resource and collision-safe identity tests passed.");

function assertRefusal(result, exceededResource) {
  assert.equal(result.ok, false);
  assert.equal(result.overBudget, true);
  assert.equal(result.exceededResource, exceededResource);
  assert.match(result.reason, new RegExp(exceededResource, "i"));
  assert.ok(result.usage[exceededResource] > result.limits[`max${exceededResource[0].toUpperCase()}${exceededResource.slice(1)}`]);
}

function record(id, vertices, extra = {}) {
  return { id, vertices, time: extra.time ?? null, weight: extra.weight ?? 1, attributes: extra.attributes ?? {} };
}
