import assert from "node:assert/strict";
import { buildH2H, expH2H } from "../src/utils/mappings.js";
import { normalizeParsedHyperedges, parseAdjList, parseH2HText } from "../src/utils/parsers.js";
import { MalformedAdjacency, MalformedH2H } from "./fixtures/v7.3.14/stage0-regression-fixtures.mjs";

// HG713-C08: both line grammars must consume the complete non-comment line.
for (const value of MalformedH2H) assert.throws(() => parseH2HText(value), /H2H line/);
for (const value of MalformedAdjacency) assert.throws(() => parseAdjList(value), /Adjacency line/);
assert.throws(() => parseH2HText("h1: h2[shared: a], ???"), /H2H line/);
assert.throws(() => parseH2HText("h1: h2[shared: a"), /unterminated shared-vertex clause/);
assert.throws(() => parseH2HText("h1: h2[common: a]"), /must use \[shared:/);
assert.throws(() => parseH2HText("h1: h2: [shared: a]"), /extra structural colon/);
assert.throws(() => parseH2HText("h1: h2[shared: a]\nh1: (none)"), /duplicates line 1/);
assert.throws(() => parseAdjList("A:"), /has no neighbor ids/);

assert.deepEqual(parseH2HText("solo: (none)"), [{ id: "solo", vertices: [], time: null, weight: 1 }]);
assert.deepEqual(parseAdjList("# comment\nA: B, C\nB: A\nC: C"), [
  { id: "h0", vertices: ["A", "B"], time: null, weight: 1 },
  { id: "h1", vertices: ["A", "C"], time: null, weight: 1 },
  { id: "h2", vertices: ["C", "C"], time: null, weight: 1 },
]);
assert.deepEqual(parseAdjList("1: 2 2\n2: 1\n__proto__: constructor\nconstructor: __proto__"), [
  { id: "h0", vertices: [1, 2], time: null, weight: 1 },
  { id: "h1", vertices: ["__proto__", "constructor"], time: null, weight: 1 },
]);

assert.deepEqual(parseH2HText("1: 2[shared: 0, __proto__]\n2: 1[shared: 0, __proto__]"), [
  { id: "1", vertices: [0, "__proto__"], time: null, weight: 1 },
  { id: "2", vertices: [0, "__proto__"], time: null, weight: 1 },
]);

// S2-N02: the exporter emits exact arbitrary hyperedge IDs, so the importer
// must not strip and then synthesize an "h" prefix during its round trip.
const source = [
  { id: "edge-A", vertices: ["shared"], time: null, weight: 1 },
  { id: "__proto__", vertices: ["shared"], time: null, weight: 1 },
  { id: "edge with spaces", vertices: ["shared"], time: null, weight: 1 },
  { id: "edge,comma", vertices: ["shared"], time: null, weight: 1 },
  { id: '"quoted-edge"', vertices: ["shared"], time: null, weight: 1 },
];
const exported = expH2H(buildH2H(source));
const roundTripped = parseH2HText(exported);
assert.deepEqual(roundTripped.map(edge => edge.id).sort(), ['"quoted-edge"', "__proto__", "edge-A", "edge with spaces", "edge,comma"].sort());
assert.ok(roundTripped.every(edge => edge.vertices.includes("shared")));
assert.deepEqual(
  normalizeParsedHyperedges("h2h", roundTripped).hyperedges.map(edge => edge.id).sort(),
  source.map(edge => edge.id).sort(),
);

const longMalformed = `h1: h2[shared: a] ${"x".repeat(50_000)}`;
assert.throws(() => parseH2HText(longMalformed), /H2H line/);

console.log("v7.3.14 Stage 2 H2H/adjacency grammar regressions passed.");
