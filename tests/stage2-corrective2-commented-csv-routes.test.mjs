import assert from "node:assert/strict";
import {
  autoDetect,
  parseCsvDocument,
  parseCSRCsv,
  parseIncidence,
  parseInputFormat,
} from "../src/utils/parsers.js";

const expectedIncidence = [{
  id: "h1",
  vertices: ["a", "b"],
  time: null,
  weight: 1,
}];
const incidenceCases = [
  '# comment "quoted"\nh1,a\nh1,b',
  '   # comment "quoted", punctuation\nh1,a\nh1,b',
  '# comment "quoted"\r\nh1,a\r\nh1,b',
  '# comment "quoted"\rh1,a\rh1,b',
];
for (const [index, text] of incidenceCases.entries()) {
  assert.equal(autoDetect(text), "incidence", "incidence detection case " + (index + 1));
  assert.deepEqual(parseIncidence(text), expectedIncidence, "incidence parse case " + (index + 1));
  assert.deepEqual(
    parseInputFormat(autoDetect(text), { text }),
    expectedIncidence,
    "incidence detect/dispatch case " + (index + 1),
  );
}

const csrText = [
  '# comment "quoted"',
  "vertexIds,v1",
  "hyperedgeIds,h1",
  "rowOffsets,0,1",
  "columnIndices,0",
].join("\n");
const cscText = [
  '   # comment "quoted", punctuation',
  "vertexIds,v1",
  "hyperedgeIds,h1",
  "columnPointers,0,1",
  "rowIndices,0",
].join("\r\n");
const expectedSparse = [{
  id: "h1",
  vertices: ["v1"],
  time: null,
  weight: 1,
}];
for (const [label, text] of [["CSR", csrText], ["CSC", cscText]]) {
  assert.equal(autoDetect(text), "csr_csv", label + " detection");
  assert.deepEqual(parseCSRCsv(text), expectedSparse, label + " parse");
  assert.deepEqual(parseInputFormat(autoDetect(text), { text }), expectedSparse, label + " detect/dispatch");
}

const multilinePayload = [
  "hyperedge_id,vertex_id",
  'h1,"line 1',
  "# payload",
  'line 3"',
  "h1,x",
].join("\n");
assert.equal(autoDetect(multilinePayload), "incidence");
assert.deepEqual(parseIncidence(multilinePayload)[0].vertices, ["line 1\n# payload\nline 3", "x"]);

assert.deepEqual(parseIncidence("h1,#inline")[0].vertices, ["#inline"]);
assert.throws(() => parseIncidence('h1,a"bad"'), /quote appears inside an unquoted field/);
assert.throws(
  () => parseCSRCsv('vertexIds,v1"bad"\nhyperedgeIds,h1\nrowOffsets,0,1\ncolumnIndices,0'),
  /quote appears inside an unquoted field/,
);
assert.throws(
  () => parseCsvDocument('# comment "quoted"\nh1,a'),
  /quote appears inside an unquoted field/,
  "strict RFC parser must not gain comment semantics",
);

console.log("v7.3.14 Stage 2 corrective #2 shared CSV comment masking passed.");
