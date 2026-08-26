import assert from "node:assert/strict";
import { parseJSON, parseCSRJson, parseCSRCsv, normalizeHyperedges } from "../src/utils/parsers.js";
import { buildH2HBounded, buildV2VBounded, countTriadsBounded, computeStats, expH2V, expClique, validateHes, DERIVED_STATUS } from "../src/utils/mappings.js";
import { assertPlainSerializable, validateParserCodeSafety } from "../src/utils/customParser.js";

assert.deepEqual(parseJSON('[{"id":"h1","vertices":["Alice"],"weight":0,"attributes":{"source":"test"}}]')[0], {
  id: "h1",
  vertices: ["Alice"],
  time: null,
  weight: 0,
  attributes: { source: "test" },
});
assert.throws(() => parseJSON('[{"id":"h1","vertices":"Alice"}]'), /hyperedges\[0\]\.vertices must be an array; received string/);
assert.throws(() => parseJSON('[{"id":"h1","vertices":["Alice"],"weight":"bad"}]'), /hyperedges\[0\]\.weight must be a finite number/);
assert.throws(() => parseJSON('[{"id":"h1","vertices":["Alice"],"attributes":[]}]'), /hyperedges\[0\]\.attributes must be a plain object/);

assert.equal(parseCSRJson(JSON.stringify({
  vertexIds: ["a"],
  hyperedgeIds: ["h1"],
  rowOffsets: [0, 1],
  columnIndices: [0],
  hyperedgeWeights: [0],
}))[0].weight, 0);
assert.throws(() => parseCSRJson(JSON.stringify({
  vertexIds: ["a"],
  hyperedgeIds: ["h1", "h2"],
  rowOffsets: [0, 1, 1],
  columnIndices: [0],
  hyperedgeWeights: [1],
})), /hyperedgeWeights: metadata vector has length 1, expected 2/);
assert.throws(() => parseCSRCsv("vertexIds,a\nhyperedgeIds,h1\nrowOffsets,0,1\ncolumnIndices,0\nhyperedgeWeights,bad"), /hyperedgeWeights\[0\] must be a finite number/);

const zero = normalizeHyperedges([{ id: "h0", vertices: ["a"], weight: 0 }]).hyperedges;
assert.match(expH2V(zero.map(h => ({ hid: h.id, vertices: h.vertices, weight: h.weight, time: h.time }))), /@weight=0/);
assert.equal(computeStats(zero).hasW, true);

const hugeV2V = buildV2VBounded([{ id: "h0", vertices: Array.from({ length: 2500 }, (_, i) => `v${i}`) }]);
assert.equal(hugeV2V.status, DERIVED_STATUS.OVER_BUDGET);
assert.equal(hugeV2V.estimatedPairs, 3_123_750);
assert.match(expClique([{ id: "h0", vertices: Array.from({ length: 2500 }, (_, i) => `v${i}`) }]), /Export refused/);

const starOverlap = Array.from({ length: 1000 }, (_, i) => ({ id: `h${i}`, vertices: ["shared", `v${i}`] }));
assert.equal(buildH2HBounded(starOverlap).status, DERIVED_STATUS.OVER_BUDGET);
assert.equal(countTriadsBounded(starOverlap).status, DERIVED_STATUS.OVER_BUDGET);

const collision = validateHes([
  { id: "h1", vertices: ["a|b", "c"] },
  { id: "h2", vertices: ["a", "b", "c"] },
]);
assert.equal(collision.some(issue => issue.type === "duplicate"), false);

assert.equal(validateParserCodeSafety("const label = 'location';\n// process column\nreturn rows.map(row => row.location + row.process);").ok, true);
assert.equal(validateParserCodeSafety("return fetch('http://localhost')").ok, false);

const shared = { source: "dataset" };
assert.doesNotThrow(() => assertPlainSerializable([{ attributes: shared }, { attributes: shared }]));
const self = {};
self.self = self;
assert.throws(() => assertPlainSerializable(self), /cyclic reference/);
const a = {};
const b = { a };
a.b = b;
assert.throws(() => assertPlainSerializable(a), /cyclic reference/);

console.log("v7.3.12 data/resource integrity tests passed.");
