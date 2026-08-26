import assert from "node:assert/strict";
import { detectDelimiter, parseCSV, parseDelimited, splitDelimitedRows, splitLines } from "../src/utils/delimitedText.js";

const quoted = 'id,name,note\r\n1,"Ada, Lovelace","said ""hello"""\r\n2,Bob,\r\n';
const parsed = parseDelimited(quoted);
assert.equal(parsed.delimiter, ",");
assert.equal(parsed.hasHeader, true);
assert.equal(parsed.records[0].name, "Ada, Lovelace");
assert.equal(parsed.records[0].note, 'said "hello"');
assert.equal(parsed.records[1].note, "");
assert.equal(parsed.rowWidth.inconsistentRows, 0);

assert.equal(detectDelimiter("a\tb\n1\t2\n"), "\t");
assert.equal(detectDelimiter("a;b\n1;2\n"), ";");
assert.equal(detectDelimiter("a|b\n1|2\n"), "|");
assert.deepEqual(splitDelimitedRows("a,b\n1,2", ","), [["a", "b"], ["1", "2"]]);
assert.equal(parseDelimited("A|B\n1|2\n3|4", { maxRows: 1 }).records.length, 1);
assert.deepEqual(Object.keys(parseCSV("x,y\n1,2")[0]), ["x", "y"]);
assert.deepEqual(splitLines("# comment\na\n\nb", { comments: true }), ["a", "b"]);

console.log("delimited text tests passed.");
