import assert from "node:assert/strict";
import { parseCornell, parseCSRJson, parseCSRCsv } from "../src/utils/parsers.js";

// ── V7310-D05: Cornell/SNAP malformed cardinality vectors ──────────────────

// Valid, no times.
{
  const result = parseCornell("2 3", "A B C D E", null);
  assert.equal(result.length, 2);
  assert.deepEqual(result[0].vertices, ["A", "B"]);
  assert.deepEqual(result[1].vertices, ["C", "D", "E"]);
  assert.equal(result[0].time, null);
}

// Valid, exact times.
{
  const result = parseCornell("2 3", "A B C D E", "10 20");
  assert.equal(result[0].time, 10);
  assert.equal(result[1].time, 20);
}

const cornellFailureCases = [
  ["extra simplex vertices", () => parseCornell("2 3", "A B C D E F", null)],
  ["insufficient simplex vertices", () => parseCornell("2 3", "A B C D", null)],
  ["negative size", () => parseCornell("2 -3", "A B C D E", null)],
  ["fractional size", () => parseCornell("2 3.5", "A B C D E", null)],
  ["non-finite token (NaN)", () => parseCornell("2 abc", "A B C D E", null)],
  ["empty nverts", () => parseCornell("", "A B C", null)],
  ["short times", () => parseCornell("2 3", "A B C D E", "10")],
  ["long times", () => parseCornell("2 3", "A B C D E", "10 20 30")],
  ["huge overflow sum", () => parseCornell("9007199254740991 9007199254740991", "A", null)],
];
for (const [label, fn] of cornellFailureCases) {
  assert.throws(fn, undefined, `expected parseCornell to reject: ${label}`);
}

// Zero-size hyperedges are valid at the parser level (documented policy:
// normalizeHyperedges() warns about empty-vertex hyperedges downstream
// rather than the parser rejecting them outright).
{
  const result = parseCornell("0 2", "A B", null);
  assert.equal(result.length, 2);
  assert.deepEqual(result[0].vertices, []);
}

// No graph commit on failure: parseCornell must throw *before* returning
// anything for every failure case above — already asserted via assert.throws
// (a thrown error never reaches the caller's commitGraph() call).

console.log("v7.3.11 Cornell/SNAP cardinality validation passed.");

// ── V7310-D06: CSR/CSC invalid structures ───────────────────────────────────

const validCsrJson = JSON.stringify({
  vertexIds: ["A", "B", "C"],
  hyperedgeIds: ["h0", "h1"],
  csr: { offsets: [0, 2, 4], indices: [0, 1, 1, 2] },
});
{
  const result = parseCSRJson(validCsrJson);
  assert.deepEqual(result.map(h => h.vertices), [["A", "B"], ["B", "C"]]);
}

const validCscJson = JSON.stringify({
  vertexIds: ["A", "B", "C"],
  hyperedgeIds: ["h0", "h1"],
  csc: { columnPointers: [0, 1, 3, 4], rowIndices: [0, 0, 1, 1] },
});
{
  const result = parseCSRJson(validCscJson);
  assert.deepEqual(result.map(h => h.vertices), [["A", "B"], ["B", "C"]]);
}

const csrFailureCases = [
  ["wrong pointer length", () => parseCSRJson(JSON.stringify({
    vertexIds: ["A", "B"], hyperedgeIds: ["h0", "h1"], csr: { offsets: [0, 2], indices: [0, 1] },
  }))],
  ["first pointer not zero", () => parseCSRJson(JSON.stringify({
    vertexIds: ["A", "B"], hyperedgeIds: ["h0", "h1"], csr: { offsets: [1, 2, 2], indices: [0, 1] },
  }))],
  ["non-monotonic pointers", () => parseCSRJson(JSON.stringify({
    vertexIds: ["A", "B"], hyperedgeIds: ["h0", "h1"], csr: { offsets: [0, 2, 1], indices: [0, 1] },
  }))],
  ["terminal pointer mismatch", () => parseCSRJson(JSON.stringify({
    vertexIds: ["A", "B"], hyperedgeIds: ["h0", "h1"], csr: { offsets: [0, 1, 3], indices: [0, 1] },
  }))],
  ["out-of-range column index", () => parseCSRJson(JSON.stringify({
    vertexIds: ["A", "B"], hyperedgeIds: ["h0", "h1"], csr: { offsets: [0, 1, 2], indices: [0, 5] },
  }))],
  ["non-integer index", () => parseCSRJson(JSON.stringify({
    vertexIds: ["A", "B"], hyperedgeIds: ["h0", "h1"], csr: { offsets: [0, 1, 2], indices: [0, 1.5] },
  }))],
  ["duplicate vertex IDs", () => parseCSRJson(JSON.stringify({
    vertexIds: ["A", "A"], hyperedgeIds: ["h0", "h1"], csr: { offsets: [0, 1, 2], indices: [0, 1] },
  }))],
  ["duplicate hyperedge IDs", () => parseCSRJson(JSON.stringify({
    vertexIds: ["A", "B"], hyperedgeIds: ["h0", "h0"], csr: { offsets: [0, 1, 2], indices: [0, 1] },
  }))],
  ["missing hyperedgeIds", () => parseCSRJson(JSON.stringify({
    vertexIds: ["A", "B"], csr: { offsets: [0, 1, 2], indices: [0, 1] },
  }))],
];
for (const [label, fn] of csrFailureCases) {
  assert.throws(fn, undefined, `expected parseCSRJson (CSR) to reject: ${label}`);
}

const cscFailureCases = [
  ["CSC out-of-range row index", () => parseCSRJson(JSON.stringify({
    vertexIds: ["A", "B", "C"], hyperedgeIds: ["h0", "h1"],
    csc: { columnPointers: [0, 1, 2, 3], rowIndices: [0, 0, 9] },
  }))],
  ["CSC non-monotonic pointers", () => parseCSRJson(JSON.stringify({
    vertexIds: ["A", "B", "C"], hyperedgeIds: ["h0", "h1"],
    csc: { columnPointers: [0, 2, 1, 3], rowIndices: [0, 0, 1] },
  }))],
];
for (const [label, fn] of cscFailureCases) {
  assert.throws(fn, undefined, `expected parseCSRJson (CSC) to reject: ${label}`);
}

// CSV path must enforce the same invariants as JSON.
{
  const result = parseCSRCsv("vertexIds,A,B,C\nhyperedgeIds,h0,h1\nrowOffsets,0,2,4\ncolumnIndices,0,1,1,2");
  assert.deepEqual(result.map(h => h.vertices), [["A", "B"], ["B", "C"]]);
}
assert.throws(
  () => parseCSRCsv("vertexIds,A,B,C\nhyperedgeIds,h0,h1\nrowOffsets,0,2\ncolumnIndices,0,1"),
  undefined,
  "CSV CSR must reject a malformed pointer length just like the JSON path",
);

console.log("v7.3.11 CSR/CSC structural validation passed.");
