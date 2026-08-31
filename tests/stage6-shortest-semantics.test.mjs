import assert from "node:assert/strict";
import { runShortestPath, runShortestPathWithDiagnostics } from "../src/algorithms/shortestPath.js";
import {
  OneHugeEdge1K,
  PrototypeIDs,
  TinyBasic,
} from "./fixtures/v7.3.14/stage0-regression-fixtures.mjs";
import { legacyRunShortestPath, serializeShortest } from "./helpers/stage6LegacyAlgorithms.mjs";

const record = (id, vertices, weight = 1) => ({ id, vertices, time: null, weight, attributes: {} });
const cases = [
  ["tiny reachable", TinyBasic, { startVertex: "a", targetVertex: "d" }],
  ["unknown", TinyBasic, { startVertex: "missing", targetVertex: "d" }],
  ["no target", TinyBasic, { startVertex: "a" }],
  ["target equals start", TinyBasic, { startVertex: "a", targetVertex: "a" }],
  ["unreachable", [record("h0", ["a", "b"]), record("h1", ["x", "y"])], { startVertex: "a", targetVertex: "y" }],
  ["zero weight", [record("zero", ["a", "b"], 0)], { startVertex: "a", targetVertex: "b" }],
  ["overlap min", [record("heavy", ["a", "b"], 8), record("light", ["a", "b", "c"], 2)], { startVertex: "a", targetVertex: "c" }],
  ["invalid weights", [
    { ...record("missing", ["a", "b"]), weight: undefined },
    record("negative", ["b", "c"], -2),
    record("bad", ["c", "d"], "bad"),
  ], { startVertex: "a", targetVertex: "d" }],
  ["duplicate membership", [record("dup", ["a", "b", "a", "b"])], { startVertex: "a", targetVertex: "b" }],
  ["prototype ids", PrototypeIDs, { startVertex: "__proto__", targetVertex: "ordinary" }],
  ["literal null", [record("null", ["null", "ordinary"])], { startVertex: "null", targetVertex: "ordinary" }],
  ["numeric zero", [record("zero", [0, "ordinary"])], { startVertex: 0, targetVertex: "ordinary" }],
];

for (const [name, graph, options] of cases) {
  assert.deepEqual(
    serializeShortest(runShortestPath(graph, options)),
    serializeShortest(legacyRunShortestPath(graph, options)),
    name,
  );
}

const zero = runShortestPath([record("zero", ["a", "b"], 0)], { startVertex: "a", targetVertex: "b" });
assert.equal(zero.distances.get("b"), 0);

const min = runShortestPath([
  record("heavy", ["a", "b"], 9),
  record("light", ["a", "b"], 2),
], { startVertex: "a", targetVertex: "b" });
assert.equal(min.distances.get("b"), 2);

const huge = runShortestPathWithDiagnostics(OneHugeEdge1K(), { startVertex: "v0", targetVertex: "v999" });
assert.equal(huge.result.reachable, true);
assert.equal(huge.result.distances.get("v999"), 1);
assert.equal(huge.result.distances.size, 1_000);
assert.equal(huge.metrics.incidenceIndexBuilds, 1);
assert.equal(huge.metrics.storedProjectedEdges, 0);
assert.equal(huge.metrics.storedGlobalAdjacencyReferences, 0);
assert.equal(huge.metrics.cachedNeighborEntries, 0);
assert.equal(huge.metrics.maxTransientNeighborEntries, 999);
assert.equal(huge.metrics.neighborCandidateEncounters, 999_000);

const hugeEarly = runShortestPathWithDiagnostics(OneHugeEdge1K(), { startVertex: "v0", targetVertex: "v1" });
assert.equal(hugeEarly.result.distances.get("v1"), 1);
assert.equal(hugeEarly.metrics.expandedVertices, 2);
assert.equal(hugeEarly.metrics.neighborCandidateEncounters, 1_998);

console.log("Stage 6 shortest-path semantic and OneHugeEdge gates passed.");
