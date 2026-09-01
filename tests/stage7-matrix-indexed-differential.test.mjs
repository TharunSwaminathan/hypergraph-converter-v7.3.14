import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { csvDocument, expMatrixResult } from "../src/utils/mappings.js";
import { vcmp } from "../src/utils/parsers.js";
import {
  LiteralNullID,
  PrototypeIDs,
  WeightZero,
  ZeroID,
} from "./fixtures/v7.3.14/stage0-regression-fixtures.mjs";

const fixtures = [
  ZeroID,
  PrototypeIDs,
  LiteralNullID,
  WeightZero,
  [record("unicode", ["Δ😀", "東京", "é"])],
  [],
  [record("empty", [])],
  [record("single", ["0"])],
  [record("duplicates", ["a", "a", "b"])],
  [record("h,\"\r\n", [" v ", "line\r\nbreak", "#comment", "東京😀"])],
];
for (const graph of fixtures) assertExact(graph);

const seed = 0x7_04_14;
let state = seed >>> 0;
const identifiers = ["0", "null", "__proto__", "constructor", "toString", "", " a ", "x,y", "q\"z", "line\r\nbreak", "Δ😀", "東京"];
const randomGraphs = 5_000;
for (let graphIndex = 0; graphIndex < randomGraphs; graphIndex += 1) {
  const vertexPool = identifiers.slice(0, 1 + randomInt(identifiers.length));
  const graph = Array.from({ length: randomInt(9) }, (_, edgeIndex) => {
    const memberships = Array.from({ length: randomInt(9) }, () => vertexPool[randomInt(vertexPool.length)]);
    return record(edgeIndex % 5 === 0 ? `h,${graphIndex},${edgeIndex}` : `h${graphIndex}-${edgeIndex}`, memberships, edgeIndex % 4 === 0 ? 0 : 1);
  });
  assertExact(graph);
}

const benchmark = {};
for (const size of [200, 300, 400]) {
  const graph = denseMatrix(size);
  const startedAt = performance.now();
  const result = expMatrixResult(graph);
  benchmark[size] = {
    elapsedMs: performance.now() - startedAt,
    cells: result.estimate.cells,
    characters: result.text.length,
  };
  assert.equal(result.text, legacyMatrix(graph));
}

const source = readFileSync(new URL("../src/utils/mappings.js", import.meta.url), "utf8");
const matrixFunction = source.slice(source.indexOf("function expMatrixWithinBudget"), source.indexOf("function matrixOverBudgetMessage"));
assert.match(matrixFunction, /new Set\(h\.vertices\.map\(String\)\)/);
assert.match(matrixFunction, /members\.has\(v\)/);
assert.doesNotMatch(matrixFunction, /h\.vertices\.map\(String\)\.includes\(v\)/);

console.log(`Stage 7 indexed Matrix differential passed: ${randomGraphs} random graphs, seed=${seed}, benchmark=${JSON.stringify(benchmark)}.`);

function assertExact(graph) {
  const actual = expMatrixResult(graph);
  assert.equal(actual.status, "computed");
  assert.equal(actual.text, legacyMatrix(graph));
}

function legacyMatrix(hyperedges) {
  const vertices = [...new Set(hyperedges.flatMap(edge => edge.vertices.map(String)))].sort(vcmp);
  const rows = [["vertex", ...hyperedges.map(edge => edge.id)]];
  vertices.forEach(vertex => rows.push([
    vertex,
    ...hyperedges.map(edge => edge.vertices.map(String).includes(vertex) ? "1" : "0"),
  ]));
  return csvDocument(rows);
}

function denseMatrix(size) {
  const vertices = Array.from({ length: size }, (_, index) => `v${index}`);
  return Array.from({ length: size }, (_, index) => record(`h${index}`, vertices));
}

function record(id, vertices, weight = 1) {
  return { id, vertices, time: null, weight, attributes: {} };
}

function randomInt(maximum) {
  state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
  return state % maximum;
}
