import assert from "node:assert/strict";
import {
  parseCSVFmt,
  parseCsvDocument,
  parseEdgeList,
  parseIncidence,
  parseJSON,
  parseSimple,
  parseV2HText,
} from "../src/utils/parsers.js";

assert.throws(
  () => parseJSON('[{"id":"h1","vertices":[{"x":1}]}]'),
  /hyperedges\[0\]\.vertices\[0\] must be a string or finite number identifier; received object/,
);
assert.throws(
  () => parseJSON('[{"id":"h1","vertices":[["a","b"]]}]'),
  /hyperedges\[0\]\.vertices\[0\] must be a string or finite number identifier; received array/,
);
assert.throws(
  () => parseJSON('[{"id":"h1","vertices":[true]}]'),
  /hyperedges\[0\]\.vertices\[0\] must be a string or finite number identifier; received boolean/,
);
assert.throws(
  () => parseJSON('[{"id":"h1","vertices":[null]}]'),
  /hyperedges\[0\]\.vertices\[0\] must be a string or finite number identifier; received null/,
);
assert.throws(
  () => parseJSON('[{"id":"h1","vertices":["a"],"time":{"year":2026}}]'),
  /hyperedges\[0\]\.time must be string, number, or null; received object/,
);
assert.throws(
  () => parseJSON('[{"id":"x","vertices":["a"]},{"id":"x","vertices":["b"]}]'),
  /hyperedges\[1\]\.id duplicates hyperedges\[0\]\.id: "x"/,
);
assert.deepEqual(parseJSON('[{"id":7,"vertices":[1,"002"],"time":0,"weight":0}]'), [{
  id: "7",
  vertices: ["1", "002"],
  time: 0,
  weight: 0,
  attributes: {},
}]);

assert.throws(() => parseSimple("h1: a b @weight=bad"), /Line 1 weight must be a finite number/);
assert.equal(parseSimple("h1: a b @weight=0")[0].weight, 0);

assert.throws(
  () => parseIncidence("hyperedge_id,vertex_id,time,weight\r\nh1,a,,bad"),
  /Incidence row 2 weight must be a finite number/,
);
assert.throws(
  () => parseIncidence("hyperedge_id,vertex_id\r\nh1,"),
  /Incidence row 2: missing vertex_id/,
);
assert.equal(parseIncidence("hyperedge_id,vertex_id,time,weight\r\nh1,a,,0")[0].weight, 0);

assert.throws(() => parseEdgeList("a b c"), /Edge List line 1: expected exactly 2 vertex columns, received 3/);
assert.deepEqual(parseEdgeList("日本語 🎉")[0].vertices, ["日本語", "🎉"]);

assert.throws(() => parseV2HText("v1 h1 h2"), /V2H line is missing a colon/);
assert.throws(() => parseV2HText("v1:"), /V2H line has no hyperedge ids/);
assert.deepEqual(parseV2HText("v1: h1 h2").map(h => h.id), ["h1", "h2"]);

assert.throws(() => parseCsvDocument('"unterminated,a,b'), /unterminated quoted field/);
assert.throws(() => parseCsvDocument('a"bad",b'), /quote appears inside an unquoted field/);
assert.deepEqual(parseCSVFmt('"a,b",c')[0].vertices, ["a,b", "c"]);

console.log("v7.3.13 parser validation tests passed.");
