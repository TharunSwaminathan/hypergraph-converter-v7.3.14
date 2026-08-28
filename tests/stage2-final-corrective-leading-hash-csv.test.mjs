import assert from "node:assert/strict";
import { expIncidence } from "../src/utils/mappings.js";
import {
  autoDetect,
  parseCSVFmt,
  parseCsvDocument,
  parseIncidence,
  parseInputFormat,
} from "../src/utils/parsers.js";

const rowText = '"#payload",x\nsecond,row';
assert.deepEqual(
  parseCSVFmt(rowText).map(item => item.vertices),
  [["#payload", "x"], ["second", "row"]],
);
assert.deepEqual(parseCSVFmt('  "#payload",x')[0].vertices, ["#payload", "x"]);
assert.deepEqual(parseCSVFmt('"# comment",a')[0].vertices, ["# comment", "a"]);
assert.deepEqual(parseCSVFmt("# comment\nh1,a")[0].vertices, ["h1", "a"]);
assert.deepEqual(parseCSVFmt("h1,#inline")[0].vertices, ["h1", "#inline"]);

const incidenceText = [
  "hyperedge_id,vertex_id",
  '"#h1",a',
  '"#h1",b',
].join("\n");
const expectedHashIncidence = [{
  id: "#h1",
  vertices: ["a", "b"],
  time: null,
  weight: 1,
}];
assert.equal(autoDetect(incidenceText), "incidence");
assert.deepEqual(parseIncidence(incidenceText), expectedHashIncidence);
assert.deepEqual(parseInputFormat(autoDetect(incidenceText), { text: incidenceText }), expectedHashIncidence);

const multilineFirstCell = '"line 1\n# payload\nline 3",x\nsecond,row';
assert.deepEqual(
  parseCSVFmt(multilineFirstCell).map(item => item.vertices),
  [["line 1\n# payload\nline 3", "x"], ["second", "row"]],
);

const reservedSource = [
  { id: "#h1", vertices: ["a", "b"], time: null, weight: 1 },
  { id: "__proto__", vertices: ["constructor"], time: null, weight: 1 },
  { id: "constructor", vertices: ["toString"], time: null, weight: 1 },
  { id: "toString", vertices: ["null"], time: null, weight: 1 },
  { id: "null", vertices: [0], time: null, weight: 1 },
  { id: "0", vertices: [0], time: null, weight: 1 },
];
const incidenceExport = expIncidence(reservedSource);
assert.match(incidenceExport, /^hyperedge_id,vertex_id,time,weight\r\n"#h1",a,,1/m);
assert.equal(autoDetect(incidenceExport), "incidence");
assert.deepEqual(parseIncidence(incidenceExport), reservedSource);
assert.deepEqual(parseInputFormat(autoDetect(incidenceExport), { text: incidenceExport }), reservedSource);

assert.throws(() => parseCsvDocument('# comment "quoted"\nh1,a'), /quote appears inside an unquoted field/);
assert.throws(() => parseCsvDocument('"unterminated'), /unterminated quoted field/);

console.log("v7.3.14 Stage 2 final corrective leading-# CSV preservation passed.");
