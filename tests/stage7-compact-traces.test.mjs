import assert from "node:assert/strict";
import { runBFS } from "../src/algorithms/bfs.js";
import { runDFS } from "../src/algorithms/dfs.js";
import { getTraceStorageSummary, materializeTraceStep } from "../src/algorithms/compactTrace.js";
import { runShortestPath } from "../src/algorithms/shortestPath.js";
import { legacyRunBFS, legacyRunDFS } from "./helpers/stage4LegacyAlgorithms.mjs";
import { legacyRunShortestPath } from "./helpers/stage6LegacyAlgorithms.mjs";
import { LargeSparse, OneHugeEdge1K, OneHugeEdge5K } from "./fixtures/v7.3.14/stage0-regression-fixtures.mjs";

let state = 0x7_07_14;
const identifiers = ["0", "null", "__proto__", "constructor", "toString", "Δ😀", "a", "b"];
const randomGraphs = 2_000;
let materializedSteps = 0;
for (let graphIndex = 0; graphIndex < randomGraphs; graphIndex += 1) {
  const graph = randomGraph(graphIndex);
  const starts = [...new Set(graph.flatMap(edge => edge.vertices.map(String))), "missing"];
  for (const start of starts) {
    materializedSteps += assertTraversal(runBFS(graph, start), legacyRunBFS(graph, start));
    materializedSteps += assertTraversal(runDFS(graph, start), legacyRunDFS(graph, start));
    const target = starts[starts.length > 1 ? 1 : 0];
    materializedSteps += assertShortest(runShortestPath(graph, { startVertex: start, targetVertex: target }), legacyRunShortestPath(graph, { startVertex: start, targetVertex: target }));
  }
}

const bfs5K = runBFS(OneHugeEdge5K(), "v0");
const dfs5K = runDFS(OneHugeEdge5K(), "v0");
const shortest1K = runShortestPath(OneHugeEdge1K(), { startVertex: "v0", targetVertex: "v999" });
const sparseShortest = runShortestPath(LargeSparse(), { startVertex: "v0", targetVertex: "v1000" });
for (const result of [bfs5K, dfs5K, shortest1K, sparseShortest]) {
  const summary = getTraceStorageSummary(result.steps);
  assert.equal(summary.compact, true);
  assert.equal(summary.retainedFullStepSnapshots, 0);
  assert.equal(summary.cachedFullSteps, 0);
  assert.ok(summary.scalarRecords + summary.deltaReferences <= result.steps.length * 3 + result.edgesUsed.length + 2);
}
assert.equal(Array.isArray(bfs5K.steps), true);
assert.equal(bfs5K.steps.length, 5_000);
assert.deepEqual(materializeTraceStep(bfs5K.steps, 0), {
  visited: ["v0"],
  frontier: bfs5K.visitOrder.slice(1),
  current: "v0",
  newlyDiscovered: bfs5K.visitOrder.slice(1),
});
assert.equal(getTraceStorageSummary(bfs5K.steps).cachedFullSteps, 1);

console.log(`Stage 7 compact trace differential passed: ${randomGraphs} random graphs, ${materializedSteps} fully materialized steps; 5K/1K retained summaries are linear.`);

function assertTraversal(actual, expected) {
  assert.equal(Array.isArray(actual.steps), true);
  assert.equal(actual.steps.length, expected.steps.length);
  assert.deepEqual(actual.visitOrder, expected.visitOrder);
  assert.deepEqual(actual.edgesUsed, expected.edgesUsed);
  assert.deepEqual([...actual.distances], [...expected.distances]);
  for (let index = 0; index < actual.steps.length; index += 1) {
    assert.deepEqual(materializeTraceStep(actual.steps, index), expected.steps[index]);
  }
  return actual.steps.length;
}

function assertShortest(actual, expected) {
  for (const field of ["algorithm", "startVertex", "targetVertex", "path", "reachable", "edgesUsed", "warnings"]) {
    assert.deepEqual(actual[field], expected[field]);
  }
  assert.deepEqual([...actual.distances], [...expected.distances]);
  assert.deepEqual([...actual.previous], [...expected.previous]);
  assert.equal(actual.steps.length, expected.steps.length);
  for (let index = 0; index < actual.steps.length; index += 1) {
    assert.deepEqual(materializeTraceStep(actual.steps, index), expected.steps[index]);
  }
  return actual.steps.length;
}

function randomGraph(graphIndex) {
  const pool = identifiers.slice(0, 1 + randomInt(identifiers.length));
  return Array.from({ length: randomInt(7) }, (_, edgeIndex) => ({
    id: `g${graphIndex}h${edgeIndex}`,
    vertices: Array.from({ length: randomInt(6) }, () => pool[randomInt(pool.length)]),
    time: null,
    weight: edgeIndex % 5 === 0 ? 0 : 1,
    attributes: {},
  }));
}

function randomInt(maximum) {
  state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
  return state % maximum;
}
