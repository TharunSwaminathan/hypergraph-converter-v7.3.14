import assert from "node:assert/strict";
import { csvDocument } from "../src/utils/mappings.js";
import { normalizeHyperedges, normalizeParsedHyperedges, parseCSVFmt, parseCsvDocument } from "../src/utils/parsers.js";

// The RFC document grammar stays strict and whole-document aware.
const payloads = ["  spaced identifier  ", "comma,value", 'quote"value', "line 1\nline 2", "日本語", "🎉"];
const document = csvDocument([payloads]);
assert.deepEqual(parseCsvDocument(document), [payloads]);
assert.deepEqual(parseCsvDocument("a,b,c"), [["a", "b", "c"]]);
assert.deepEqual(parseCsvDocument('"a,b",c'), [["a,b", "c"]]);
assert.deepEqual(parseCsvDocument('"a""b",c'), [['a"b', "c"]]);
assert.deepEqual(parseCsvDocument('"a\nb",c'), [["a\nb", "c"]]);
assert.deepEqual(parseCsvDocument("a,b\r\nc,d\r\ne,f\rg,h"), [["a", "b"], ["c", "d"], ["e", "f"], ["g", "h"]]);

// S2-N01: downstream row-hypergraph parsing must not discard whitespace that
// parseCsvDocument preserved specifically because the source field was quoted.
assert.deepEqual(parseCSVFmt(document)[0].vertices, payloads);
assert.deepEqual(normalizeParsedHyperedges("csv", parseCSVFmt(document)).hyperedges[0].vertices, payloads);
assert.deepEqual(normalizeParsedHyperedges("csr_csv", [{
  id: " h1 ", vertices: [" v1 ", '"quoted"'], time: null, weight: 1,
}]).hyperedges[0], {
  id: " h1 ", vertices: [" v1 ", '"quoted"'], time: null, weight: 1, attributes: {},
});

// Stage 1's default raw/text cleanup remains a separate protected contract.
assert.deepEqual(normalizeHyperedges([{ id: ' "h1" ', vertices: [' "v1" '] }]).hyperedges[0], {
  id: "h1", vertices: ["v1"], time: null, weight: 1, attributes: {},
});

assert.throws(() => parseCsvDocument('"unterminated'), /unterminated quoted field/);
assert.throws(() => parseCsvDocument('a"bad",b'), /quote appears inside an unquoted field/);
assert.throws(() => parseCsvDocument('"closed"trailing,b'), /unexpected .* after closing quote/);

console.log("v7.3.14 Stage 2 RFC CSV preservation regressions passed.");
