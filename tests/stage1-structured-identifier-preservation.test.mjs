import assert from "node:assert/strict";
import { buildCSR, csvDocument, expCSRCsv } from "../src/utils/mappings.js";
import {
  normalizeHyperedges,
  parseCSRCsv,
  parseCSRJson,
  validateSparseMatrixStructure,
} from "../src/utils/parsers.js";
import { normalizeGraphIdentifier } from "../src/utils/graphIdentifiers.js";

const vertexIds = [
  "v1",
  " v1 ",
  "v1 ",
  " v1",
  "foo",
  "\"foo\"",
  "A,1",
  "Δ😀",
  "__proto__",
  "constructor",
  "toString",
  "null",
  "0",
];
const hyperedgeIds = [
  "h1",
  " h1 ",
  "h1 ",
  " h1",
  "edge",
  "\"edge\"",
  "edge,comma",
  "邊😀",
  "__proto__",
  "constructor",
  "toString",
  "null",
  "0",
];
const sequentialPointers = Array.from({ length: vertexIds.length + 1 }, (_, index) => index);
const sequentialIndices = Array.from({ length: vertexIds.length }, (_, index) => index);

function assertIdentityPairs(parsed, message) {
  assert.deepEqual(parsed.map(edge => edge.id), hyperedgeIds, `${message}: hyperedge IDs`);
  assert.deepEqual(parsed.map(edge => edge.vertices[0]), vertexIds, `${message}: vertex IDs`);
}

// Direct RFC CSV examples from the corrective review preserve decoded payload.
assert.equal(parseCSRCsv('vertexIds," v1 "\nhyperedgeIds,h1\nrowOffsets,0,1\ncolumnIndices,0')[0].vertices[0], " v1 ");
assert.equal(parseCSRCsv('vertexIds,"v1 "\nhyperedgeIds,h1\nrowOffsets,0,1\ncolumnIndices,0')[0].vertices[0], "v1 ");
assert.equal(parseCSRCsv('vertexIds,"""foo"""\nhyperedgeIds,h1\nrowOffsets,0,1\ncolumnIndices,0')[0].vertices[0], "\"foo\"");

const csrCsv = csvDocument([
  ["vertexIds", ...vertexIds],
  ["hyperedgeIds", ...hyperedgeIds],
  ["rowOffsets", ...sequentialPointers],
  ["columnIndices", ...sequentialIndices],
]);
assertIdentityPairs(parseCSRCsv(csrCsv), "CSR CSV");

const cscCsv = csvDocument([
  ["vertexIds", ...vertexIds],
  ["hyperedgeIds", ...hyperedgeIds],
  ["columnPointers", ...sequentialPointers],
  ["rowIndices", ...sequentialIndices],
]);
assertIdentityPairs(parseCSRCsv(cscCsv), "CSC CSV");

const csrJson = JSON.stringify({
  vertexIds,
  hyperedgeIds,
  h2vCSR: { offsets: sequentialPointers, indices: sequentialIndices },
});
assertIdentityPairs(parseCSRJson(csrJson), "CSR JSON");

const cscJson = JSON.stringify({
  vertexIds,
  hyperedgeIds,
  h2vCSC: { columnPointers: sequentialPointers, rowIndices: sequentialIndices },
});
assertIdentityPairs(parseCSRJson(cscJson), "CSC JSON");

// Export/import round trips must preserve whitespace, quotes, comma, Unicode,
// reserved keys, literal null, and zero in both vertex and hyperedge IDs.
const canonicalSparseGraph = hyperedgeIds.map((id, index) => ({
  id,
  vertices: [vertexIds[index]],
  time: null,
  weight: 1,
}));
const builtCsr = buildCSR(canonicalSparseGraph);
assertIdentityPairs(parseCSRCsv(expCSRCsv(builtCsr)), "buildCSR -> expCSRCsv -> parseCSRCsv");
assertIdentityPairs(parseCSRJson(JSON.stringify(builtCsr)), "buildCSR -> JSON -> parseCSRJson");

// Structured string identity is exact: validation checks blankness but does
// not trim or strip data. Numeric/string zero retain one canonical identity.
for (const id of vertexIds) assert.equal(normalizeGraphIdentifier(id), id);
assert.equal(normalizeGraphIdentifier(0), "0");
assert.throws(() => validateSparseMatrixStructure({
  format: "test",
  pointers: [0, 0, 0],
  indices: [],
  primaryIds: [0, "0"],
  foreignIds: ["v"],
}), /duplicate/i);

for (const invalidId of [{}, [], null, Number.NaN, Infinity, -Infinity]) {
  assert.throws(() => validateSparseMatrixStructure({
    format: "test",
    pointers: [0, 0],
    indices: [],
    primaryIds: [invalidId],
    foreignIds: ["v"],
  }), /string or finite number|finite number/);
}
assert.throws(() => validateSparseMatrixStructure({
  format: "test",
  pointers: [0, 0],
  indices: [],
  primaryIds: ["   "],
  foreignIds: ["v"],
}), /non-empty|string or finite number/);

// Preserve the legacy canonical/raw-text cleaning behavior that existed in
// normalizeHyperedges before Stage 1.
const legacyCleaned = normalizeHyperedges([{ id: ' "h1" ', vertices: [' "v1" '] }]).hyperedges[0];
assert.equal(legacyCleaned.id, "h1");
assert.deepEqual(legacyCleaned.vertices, ["v1"]);

console.log("v7.3.14 Stage 1 structured sparse identifier preservation passed.");
