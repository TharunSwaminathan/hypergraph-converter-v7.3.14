import assert from "node:assert/strict";
import { buildWeightedAdjacency } from "../src/algorithms/graphModel.js";
import { runShortestPath } from "../src/algorithms/shortestPath.js";

const zeroWeight = [
  { id: "h0", vertices: ["A", "B"], weight: 0 },
  { id: "h1", vertices: ["B", "C"], weight: 2 },
];
const zero = runShortestPath(zeroWeight, { startVertex: "A", targetVertex: "B" });
assert.equal(zero.reachable, true);
assert.equal(zero.distances.get("B"), 0, "zero weight is a valid Dijkstra cost");
assert.deepEqual(zero.warnings, []);

const badWeights = [
  { id: "neg", vertices: ["A", "B"], weight: -3 },
  { id: "missing", vertices: ["B", "C"] },
  { id: "invalid", vertices: ["C", "D"], weight: "not-a-number" },
];
const weighted = buildWeightedAdjacency(badWeights);
assert.equal(weighted.adjacency.get("A").get("B"), 1, "negative weights fall back to default cost");
assert.equal(weighted.adjacency.get("B").get("C"), 1, "missing weights fall back to default cost");
assert.equal(weighted.adjacency.get("C").get("D"), 1, "invalid weights fall back to default cost");
assert.equal(weighted.warnings.length, 3);

const path = runShortestPath(badWeights, { startVertex: "A", targetVertex: "D" });
assert.equal(path.reachable, true);
assert.equal(path.distances.get("D"), 3);
assert.equal(path.warnings.length, 3);

console.log("shortest path weight tests v7.3.6 passed.");
