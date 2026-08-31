import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildAlgorithmIncidenceIndex } from "../src/algorithms/algorithmIncidence.js";
import { K_CORE_STATUS, runKCore } from "../src/algorithms/kCore.js";
import { runShortestPath } from "../src/algorithms/shortestPath.js";
import { countTriadsBounded, DERIVED_STATUS } from "../src/utils/mappings.js";
import { normalizeParsedHyperedges, parseInputFormat } from "../src/utils/parsers.js";
import { serializeKCore, serializeShortest } from "./helpers/stage6LegacyAlgorithms.mjs";

const record = (id, vertices, metadata = {}) => ({
  id,
  vertices,
  time: metadata.time ?? null,
  weight: metadata.weight ?? 1,
  attributes: metadata.attributes ?? {},
});
const identifierError = /string or finite number|finite number|non-empty/;

// A. Finite numeric graph IDs normalize through the central Stage 1 policy.
const numericMetadata = { time: 7, weight: 3, attributes: { source: "numeric" } };
const numericGraph = [record(1, [0, 2], numericMetadata)];
const stringGraph = [record("1", ["0", "2"], numericMetadata)];
const numericIndex = buildAlgorithmIncidenceIndex(numericGraph);
assert.deepEqual([...numericIndex.hyperedges], ["1"]);
assert.deepEqual([...numericIndex.vertices], ["0", "2"]);
assert.equal(numericIndex.hyperedgesById.get("1").time, 7);
assert.equal(numericIndex.hyperedgesById.get("1").weight, 3);
assert.strictEqual(numericIndex.hyperedgesById.get("1").attributes, numericMetadata.attributes);
assert.deepEqual(
  serializeShortest(runShortestPath(numericGraph, { startVertex: 0, targetVertex: 2 })),
  serializeShortest(runShortestPath(stringGraph, { startVertex: "0", targetVertex: "2" })),
);
assert.deepEqual(serializeKCore(runKCore(numericGraph)), serializeKCore(runKCore(stringGraph)));
assert.throws(() => buildAlgorithmIncidenceIndex([
  record(1, ["a"]),
  record("1", ["b"]),
]), /duplicate/i);

// B/P. Structured strings survive exactly; Unicode normalization is forbidden.
const exactIds = [
  " A ",
  "\"foo\"",
  "__proto__",
  "constructor",
  "toString",
  "null",
  "#lead",
  "é",
  "e\u0301",
  "😀",
];
const exactIndex = buildAlgorithmIncidenceIndex([record(" exact edge ", exactIds)]);
assert.deepEqual([...exactIndex.hyperedges], [" exact edge "]);
assert.deepEqual([...exactIndex.vertices], exactIds);
assert.notEqual(exactIds.indexOf("é"), exactIds.indexOf("e\u0301"));

// C-H. Unsupported graph member types are rejected before JS can stringify them.
const invalidVertices = [
  { x: 1 }, [], true, false, 1n, null, undefined,
  Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY,
  "", "   ",
];
for (const value of invalidVertices) {
  const graph = [record("edge", ["anchor", value])];
  assert.throws(() => buildAlgorithmIncidenceIndex(graph), identifierError);
  assert.throws(() => runShortestPath(graph, { startVertex: "anchor" }), identifierError);
  assert.throws(() => runKCore(graph), identifierError);
}

// I. Hyperedge IDs use the same policy, with no algorithm-layer synthesis.
const invalidHyperedgeIds = [
  { x: 1 }, [], true, false, 1n, null, undefined,
  Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY,
  "", "   ",
];
for (const value of invalidHyperedgeIds) {
  assert.throws(() => buildAlgorithmIncidenceIndex([record(value, ["a"])]), identifierError);
}
assert.throws(() => buildAlgorithmIncidenceIndex([{ vertices: ["a"] }]), identifierError);

// J/K. Query boundaries reject unsupported values rather than treating them as unknown IDs.
const queryGraph = [record("query", ["a", "b"])];
const invalidStarts = [
  { x: 1 }, [], true, false, 1n, null, undefined,
  Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY,
  "", "   ",
];
for (const startVertex of invalidStarts) {
  assert.throws(() => runShortestPath(queryGraph, { startVertex, targetVertex: "b" }), identifierError);
}
const invalidTargets = [
  { x: 1 }, [], true, false, 1n,
  Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY,
  "", "   ",
];
for (const targetVertex of invalidTargets) {
  assert.throws(() => runShortestPath(queryGraph, { startVertex: "a", targetVertex }), identifierError);
}

// L. Null and undefined targets retain the established no-target result state.
for (const targetVertex of [null, undefined]) {
  const result = runShortestPath(queryGraph, { startVertex: "a", targetVertex });
  assert.equal(result.targetVertex, null);
  assert.equal(result.reachable, null);
  assert.equal(result.distances.get("b"), 1);
}

// M. A valid but absent start remains an empty/unreachable result, not an error.
const unknown = runShortestPath(queryGraph, { startVertex: "missing", targetVertex: "b" });
assert.equal(unknown.startVertex, "missing");
assert.equal(unknown.reachable, false);
assert.equal(unknown.distances.size, 0);

// N/O/P. Literal null, prototype names, and exact-distinct Unicode remain ordinary IDs.
const specialGraph = [record("__proto__", ["null", "__proto__", "constructor", "toString", "é", "e\u0301"] )];
const literalNull = runShortestPath(specialGraph, { startVertex: "null", targetVertex: "toString" });
assert.equal(literalNull.reachable, true);
assert.deepEqual(literalNull.path, ["null", "toString"]);
const prototypes = runKCore(specialGraph);
assert.equal(prototypes.status, K_CORE_STATUS.COMPUTED);
for (const id of ["null", "__proto__", "constructor", "toString", "é", "e\u0301"]) {
  assert.equal(prototypes.coreness.has(id), true, id);
}
assert.equal(prototypes.coreness.size, 6);

// Triad exports remain canonical-only producers. The application Stats path
// passes finalHes, and the parser/commit entry canonicalizes before that state.
const appSource = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
assert.match(appSource, /countTriadsBounded\(finalHes\)/);
assert.match(appSource, /normalizeParsedHyperedges\(targetFormat, raw\)/);
const parsed = normalizeParsedHyperedges("json", parseInputFormat("json", {
  text: JSON.stringify([{ id: 9, vertices: [0, "null", "__proto__"] }]),
})).hyperedges;
assert.deepEqual(parsed.map(edge => edge.id), ["9"]);
assert.deepEqual(parsed[0].vertices, ["0", "null", "__proto__"]);
assert.equal(countTriadsBounded(parsed).status, DERIVED_STATUS.COMPUTED);

console.log("Stage 6 corrective canonical identifier boundary gates passed (A-P)." );
