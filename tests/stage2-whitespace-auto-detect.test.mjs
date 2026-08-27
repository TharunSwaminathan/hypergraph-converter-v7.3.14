import assert from "node:assert/strict";
import { autoDetect, parseCSVFmt } from "../src/utils/parsers.js";
import { computeStats } from "../src/utils/mappings.js";
import { WhitespaceRows } from "./fixtures/v7.3.14/stage0-regression-fixtures.mjs";

// HG713-R03: the legacy CSV route also owns whitespace-separated rows. Each
// row is a hyperedge; whitespace inside a row separates vertex identifiers.
assert.deepEqual(
  parseCSVFmt(WhitespaceRows.text).map(edge => edge.vertices),
  WhitespaceRows.expected.map(edge => edge.vertices),
);
assert.deepEqual(
  parseCSVFmt("alpha beta\ngamma delta epsilon").map(edge => edge.vertices),
  [["alpha", "beta"], ["gamma", "delta", "epsilon"]],
);
assert.deepEqual(
  parseCSVFmt("# comment\r\n1\t2\r\n\r\n3    4 5\r\n6").map(edge => edge.vertices),
  [[1, 2], [3, 4, 5], [6]],
);

// Integration-level Auto Detect -> selected parser -> statistics check for
// the actual built-in example.
const detected = autoDetect(WhitespaceRows.text);
const builtIn = parseCSVFmt(WhitespaceRows.text);
const stats = computeStats(builtIn);
assert.equal(detected, "csv");
assert.deepEqual({ hyperedges: stats.E, vertices: stats.V, incidences: builtIn.reduce((sum, edge) => sum + edge.vertices.length, 0) }, {
  hyperedges: 3,
  vertices: 5,
  incidences: 9,
});

// Auto Detect is a structural detector, not a parse-every-format fallback.
// It must inspect all relevant rows before choosing edge-list precedence.
assert.equal(autoDetect("alpha beta\ngamma delta epsilon"), "csv");
assert.equal(autoDetect("alpha beta\ngamma delta"), "edgelist");
assert.equal(autoDetect('"Smith, John",plain\nsecond,row'), "csv");
assert.equal(autoDetect("hyperedge_id,vertex_id,time,weight\nh1,a,t1,2"), "incidence");
assert.equal(autoDetect("h1,a,t1,2\nh1,b,t1,2\nh2,c,t2,3"), "incidence");
assert.equal(autoDetect("h1,a\nh2,b"), "csv", "a normal comma-row document is not incidence solely because column 1 resembles an edge id");
assert.equal(autoDetect("urn:a,b\nurn:c,d"), "csv", "colon payload in a normal comma row retains CSV precedence");
assert.equal(autoDetect("A: B,C\nB: A"), "adjlist", "colon-plus-spacing is a structural adjacency signature");
assert.equal(autoDetect("A: B C\nh1: h2[shared: x] trailing"), "h2h", "an H2H marker on a later line determines the H2H route");
assert.equal(autoDetect("h1: (none)"), "h2h");
assert.equal(autoDetect("h1: garbage"), "simple", "the structurally valid Simple/H2H ambiguity retains documented Simple precedence");

console.log("v7.3.14 Stage 2 whitespace-row and Auto Detect regressions passed.");
