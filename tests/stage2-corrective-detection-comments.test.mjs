import assert from "node:assert/strict";
import { autoDetect, parseCSVFmt, parseCsvDocument, parseH2HText } from "../src/utils/parsers.js";

// S2-R03A: H2H-looking text inside RFC-quoted fields is payload, not syntax.
const quotedShared = '"foo[shared: bar]",x\nsecond,row';
const quotedWholeH2H = '"h1: h2[shared: x]",other';
const quotedMultilineH2H = '"line1\nh1: h2[shared: x]",foo\nsecond,row';
assert.equal(autoDetect(quotedShared), "csv");
assert.equal(autoDetect(quotedWholeH2H), "csv");
assert.equal(autoDetect(quotedMultilineH2H), "csv");
assert.equal(autoDetect("foo[shared: bar],x\nsecond,row"), "csv");

assert.equal(autoDetect("h1: h2[shared: x]"), "h2h");
assert.equal(autoDetect("h1: h2[shared: x,y]"), "h2h");
assert.equal(autoDetect('"quoted-edge": h2[shared: x]'), "h2h");
assert.equal(autoDetect("h1: (none)"), "h2h");
assert.equal(autoDetect("h1: garbage"), "simple");
const malformedStructuralH2H = "h1: h2[shared: x] trailing";
assert.equal(autoDetect(malformedStructuralH2H), "h2h");
assert.throws(() => parseH2HText(malformedStructuralH2H), /H2H line/);

// S2-R03B: punctuation in ignored full-line legacy comments cannot choose
// the row grammar. Leading whitespace and CRLF retain the same comment rule.
const commentCases = [
  "# comment, containing comma\n1 2 3\n2 4",
  "   # comment, containing comma\n1 2 3\n2 4",
  '# comment "with quotes"\n1 2 3\n2 4',
  "1 2 3\n# comment, punctuation\n2 4",
  "# comment, containing comma\r\n1 2 3\r\n2 4",
  '# "quoted", comment\n1 2 3',
];
for (const [index, text] of commentCases.entries()) {
  const expected = index === commentCases.length - 1 ? [[1, 2, 3]] : [[1, 2, 3], [2, 4]];
  assert.deepEqual(parseCSVFmt(text).map(edge => edge.vertices), expected, `comment case ${index + 1}`);
}
assert.equal(autoDetect("# comment, punctuation\nA:B"), autoDetect("A:B"));

assert.deepEqual(parseCSVFmt("a,b\nc,d").map(edge => edge.vertices), [["a", "b"], ["c", "d"]]);
assert.deepEqual(parseCSVFmt('"a,b",c')[0].vertices, ["a,b", "c"]);
assert.deepEqual(parseCSVFmt('# "ignored", comment\na,b')[0].vertices, ["a", "b"]);

const multilineHashPayload = '"line one\n# not a comment because this is inside the quoted field\nline three",x';
const expectedMultilineHash = [["line one\n# not a comment because this is inside the quoted field\nline three", "x"]];
assert.deepEqual(parseCsvDocument(multilineHashPayload), expectedMultilineHash);
assert.deepEqual(parseCSVFmt(multilineHashPayload).map(edge => edge.vertices), expectedMultilineHash);
assert.equal(autoDetect(multilineHashPayload), "csv");

console.log("v7.3.14 Stage 2 corrective quote-aware detection/comment dispatch passed.");
