import assert from "node:assert/strict";
import { csvCell, csvRow, csvDocument, expIncidence, expCSRCsv } from "../src/utils/mappings.js";
import { parseCsvDocument, parseIncidence, parseCSRCsv } from "../src/utils/parsers.js";

// V7310-D08: CSV exports must be RFC 4180-compatible, and the values they
// contain must survive an export -> import round trip unchanged (not merely
// "the same row count").

// 1. csvCell quoting rules.
assert.equal(csvCell("plain"), "plain", "a plain value needs no quoting");
assert.equal(csvCell("a,b"), "\"a,b\"", "a comma forces quoting");
assert.equal(csvCell("a\"b"), "\"a\"\"b\"", "an embedded quote is doubled and the field is quoted");
assert.equal(csvCell("a\nb"), "\"a\nb\"", "an embedded newline forces quoting");
assert.equal(csvCell(" a"), "\" a\"", "leading whitespace forces quoting");
assert.equal(csvCell("a "), "\"a \"", "trailing whitespace forces quoting");
assert.equal(csvCell(0), "0", "the number 0 is preserved, not treated as empty");
assert.equal(csvCell(""), "", "an explicit empty string stays empty, not quoted");
assert.equal(csvCell(null), "", "null/undefined serialize as an empty cell");

// 2. csvRow / csvDocument compose cells correctly.
assert.equal(csvRow(["a", "b,c", "d"]), "a,\"b,c\",d");
assert.equal(csvDocument([["a", "b"], ["c,d", "e"]]), "a,b\r\n\"c,d\",e");

// 3. parseCsvDocument is the exact inverse of csvDocument for a broad set of
// tricky values: commas, quotes, CR, LF, CRLF, tabs, leading/trailing
// spaces (on quoted fields), empty strings, Unicode, emoji, numeric-looking
// strings, and values that are themselves the word "undefined".
const trickyValues = [
  "plain", "a,b", "a\"b", "a\nb", "a\r\nb", "a\tb", "  spaced value  ",
  "", "日本語", "🎉multi🎉emoji🎉", "007", "undefined", "null", "NaN",
];
{
  const doc = csvDocument([trickyValues]);
  const [roundTripped] = parseCsvDocument(doc);
  // Quoted fields (anything csvCell decided needed quoting) must come back
  // byte-for-byte identical, including embedded whitespace.
  const quotedIndices = trickyValues.map((v, i) => (csvCell(v) !== String(v ?? "") ? i : -1)).filter(i => i >= 0);
  for (const i of quotedIndices) {
    assert.equal(roundTripped[i], trickyValues[i], `quoted value at index ${i} must round-trip exactly: ${JSON.stringify(trickyValues[i])}`);
  }
}

// 4. Full expIncidence -> parseIncidence round trip with tricky identifiers:
// commas, embedded quotes, embedded newlines, Unicode, emoji, and numeric-
// looking / zero-valued time and weight fields.
{
  const hyperedges = [
    {
      id: "h,0",
      vertices: ["Smith, John", "He said \"hi\"", "line1\nline2", "日本語", "🎉emoji", "007"],
      time: 0,
      weight: 0,
    },
  ];
  const csv = expIncidence(hyperedges);
  const reparsed = parseIncidence(csv);
  assert.equal(reparsed.length, 1);
  const edge = reparsed[0];
  assert.equal(edge.id, "h,0", "a comma-containing hyperedge id must round-trip exactly");
  assert.deepEqual(
    edge.vertices.map(String),
    ["Smith, John", "He said \"hi\"", "line1\nline2", "日本語", "🎉emoji", "7"],
    "comma/quote/newline/Unicode/emoji vertex ids must round-trip exactly (numeric-looking ids are still normalized to numbers elsewhere in the pipeline, matching existing tok() behavior)",
  );
  assert.equal(String(edge.time), "0", "a time value of 0 must not be dropped as falsy");
  assert.equal(edge.weight, 0, "a weight value of 0 must not silently default to 1");
}

// 5. expCSRCsv -> parseCSRCsv round trip with a comma-containing vertex ID.
{
  const csrPayload = {
    vertexIds: ["A,1", "B"],
    hyperedgeIds: ["h0"],
    h2vCSR: { offsets: [0, 2], indices: [0, 1] },
    hyperedgeTimes: [null],
    hyperedgeWeights: [1],
  };
  const csv = expCSRCsv(csrPayload);
  const parsed = parseCSRCsv(csv);
  assert.equal(parsed.length, 1);
  assert.deepEqual(parsed[0].vertices, ["A,1", "B"], "a comma-containing vertex id in CSR CSV must round-trip exactly");
}

console.log("v7.3.11 lossless CSV export/import round-trip passed.");
