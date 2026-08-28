import { performance } from "node:perf_hooks";
import { runBFS } from "../src/algorithms/bfs.js";
import { runConnectedComponents } from "../src/algorithms/connectedComponents.js";
import { runDFS } from "../src/algorithms/dfs.js";
import { OneHugeEdge } from "../tests/fixtures/v7.3.14/stage0-regression-fixtures.mjs";

const algorithm = process.argv[2];
const vertexCount = Number(process.argv[3]);
if (!Number.isInteger(vertexCount) || vertexCount < 1) throw new Error("A positive integer vertex count is required.");

const runners = {
  cc: graph => runConnectedComponents(graph),
  bfs: graph => runBFS(graph, "v0"),
  dfs: graph => runDFS(graph, "v0"),
};
if (!runners[algorithm]) throw new Error(`Unknown algorithm ${JSON.stringify(algorithm)}.`);

const graph = OneHugeEdge(vertexCount);
const heapBefore = process.memoryUsage().heapUsed;
const startedAt = performance.now();
const result = runners[algorithm](graph);
const elapsedMs = performance.now() - startedAt;
const heapAfter = process.memoryUsage().heapUsed;

console.log(JSON.stringify({
  algorithm,
  fixture: `OneHugeEdge${vertexCount}`,
  hyperedges: 1,
  vertices: vertexCount,
  incidences: vertexCount,
  elapsedMs,
  heapBefore,
  heapAfter,
  heapDelta: heapAfter - heapBefore,
  count: result.count ?? null,
  largestComponentSize: result.components?.[0]?.size ?? null,
  reached: result.reached ?? null,
  visitCount: result.visitOrder?.length ?? result.components?.[0]?.vertices?.length ?? 0,
  treeEdgeCount: result.edgesUsed?.length ?? 0,
  distanceCount: result.distances?.size ?? 0,
  maxDistance: result.distances?.size ? Math.max(...result.distances.values()) : null,
  stepCount: result.steps?.length ?? 0,
  visitedTraceReferences: sumStepField(result.steps, "visited"),
  frontierTraceReferences: sumStepField(result.steps, "frontier"),
  newlyDiscoveredTraceReferences: sumStepField(result.steps, "newlyDiscovered"),
}));

function sumStepField(steps, field) {
  return steps?.reduce((total, step) => total + (step[field]?.length ?? 0), 0) ?? 0;
}
