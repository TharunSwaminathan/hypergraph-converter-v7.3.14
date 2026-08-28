import assert from "node:assert/strict";
import { runBFS } from "../src/algorithms/bfs.js";
import { runConnectedComponents } from "../src/algorithms/connectedComponents.js";
import { runDFS } from "../src/algorithms/dfs.js";
import { normalizeHyperedges } from "../src/utils/parsers.js";
import {
  DuplicateOverlap,
  LiteralNullID,
  PrototypeIDs,
  TinyBasic,
  WeightZero,
  ZeroID,
} from "./fixtures/v7.3.14/stage0-regression-fixtures.mjs";
import {
  legacyRunBFS,
  legacyRunConnectedComponents,
  legacyRunDFS,
  serializeAlgorithmResult,
} from "./helpers/stage4LegacyAlgorithms.mjs";

const canonical = graph => normalizeHyperedges(graph, { identifierMode: "structured" }).hyperedges;
const affordableFixtures = [
  TinyBasic,
  canonical(ZeroID),
  canonical(PrototypeIDs),
  canonical(LiteralNullID),
  canonical(WeightZero),
  DuplicateOverlap({ hyperedgeCount: 3, vertexCount: 8 }),
  [
    record("h0", ["a", "b"]),
    record("h1", ["c", "d"]),
    record("singleton", ["alone"]),
  ],
  [record("s0", ["a"]), record("s1", ["b"]), record("s2", ["c"])],
  [record("o0", ["a", "b", "c"]), record("o1", ["c", "d"]), record("o2", ["a", "d"])],
  [record("lexical", ["2", "10", "01", "1"])],
];

for (const graph of affordableFixtures) compareGraph(graph);

const RANDOM_SEED = 0x74_03_14;
const RANDOM_GRAPHS = 3_000;
const random = mulberry32(RANDOM_SEED);
const identifiers = ["0", "null", "__proto__", "constructor", "toString", "2", "10", "01", "1", "Δ😀", "a", "b"];
const mismatches = emptyMismatchCounts();
let bfsRuns = 0;
let dfsRuns = 0;
let ccRuns = 0;

for (let caseIndex = 0; caseIndex < RANDOM_GRAPHS; caseIndex += 1) {
  const graph = randomGraph(caseIndex, random, identifiers);
  compareConnectedComponents(graph, mismatches);
  ccRuns += 1;
  const vertices = firstSeenVertices(graph);
  for (const start of [...vertices, "missing-start"]) {
    compareTraversal(runBFS(graph, start), legacyRunBFS(graph, start), "bfs", mismatches);
    compareTraversal(runDFS(graph, start), legacyRunDFS(graph, start), "dfs", mismatches);
    bfsRuns += 1;
    dfsRuns += 1;
  }
}

assert.deepEqual(mismatches, emptyMismatchCounts());
console.log(`v7.3.14 Stage 4 traversal differential passed: ${RANDOM_GRAPHS} graphs, ${bfsRuns} BFS, ${dfsRuns} DFS, ${ccRuns} CC, seed=${RANDOM_SEED}.`);

function compareGraph(graph) {
  compareConnectedComponents(graph);
  for (const start of [...firstSeenVertices(graph), "missing-start"]) {
    assert.deepEqual(serializeAlgorithmResult(runBFS(graph, start)), serializeAlgorithmResult(legacyRunBFS(graph, start)));
    assert.deepEqual(serializeAlgorithmResult(runDFS(graph, start)), serializeAlgorithmResult(legacyRunDFS(graph, start)));
  }
}

function compareConnectedComponents(graph, counts) {
  const actual = serializeAlgorithmResult(runConnectedComponents(graph));
  const expected = serializeAlgorithmResult(legacyRunConnectedComponents(graph));
  if (counts && !same(actual, expected)) counts.cc += 1;
  else if (!counts) assert.deepEqual(actual, expected);
}

function compareTraversal(actualValue, expectedValue, algorithm, counts) {
  const actual = serializeAlgorithmResult(actualValue);
  const expected = serializeAlgorithmResult(expectedValue);
  for (const field of ["algorithm", "startVertex", "reached", "total"]) {
    if (!same(actual[field], expected[field])) counts[`${algorithm}Contract`] += 1;
  }
  if (!same(actual.visitOrder, expected.visitOrder)) counts[`${algorithm}VisitOrder`] += 1;
  if (!same(actual.edgesUsed, expected.edgesUsed)) counts[`${algorithm}TreeEdges`] += 1;
  if (!same(actual.distances, expected.distances)) counts[`${algorithm}Distances`] += 1;
  if (!same(actual.steps, expected.steps)) counts[`${algorithm}Steps`] += 1;
}

function emptyMismatchCounts() {
  return {
    bfsContract: 0,
    bfsVisitOrder: 0,
    bfsTreeEdges: 0,
    bfsDistances: 0,
    bfsSteps: 0,
    dfsContract: 0,
    dfsVisitOrder: 0,
    dfsTreeEdges: 0,
    dfsDistances: 0,
    dfsSteps: 0,
    cc: 0,
  };
}

function record(id, vertices, extra = {}) {
  return { id, vertices, time: extra.time ?? null, weight: extra.weight ?? 1, attributes: extra.attributes ?? {} };
}

function firstSeenVertices(graph) {
  const seen = new Set();
  for (const hyperedge of graph) for (const vertex of hyperedge.vertices) seen.add(String(vertex));
  return [...seen];
}

function randomGraph(caseIndex, generator, ids) {
  const integer = maximum => Math.floor(generator() * maximum);
  const pool = ids.slice(0, 1 + integer(ids.length));
  return Array.from({ length: integer(7) }, (_, edgeIndex) => {
    const cardinality = integer(Math.min(7, pool.length + 1));
    const vertices = [];
    while (vertices.length < cardinality) {
      const vertex = pool[integer(pool.length)];
      if (!vertices.includes(vertex)) vertices.push(vertex);
    }
    if (vertices.length && generator() < 0.2) vertices.push(vertices[0]);
    return record(`case-${caseIndex}-h${edgeIndex}`, vertices, { weight: edgeIndex % 4 === 0 ? 0 : 1 });
  });
}

function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let result = value;
    result = Math.imul(result ^ result >>> 15, result | 1);
    result ^= result + Math.imul(result ^ result >>> 7, result | 61);
    return ((result ^ result >>> 14) >>> 0) / 4_294_967_296;
  };
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
