import assert from "node:assert/strict";
import { buildH2H } from "../src/utils/mappings.js";
import * as mappingExports from "../src/utils/mappings.js";
import { autoDetect, parseH2HText, parseInputFormat } from "../src/utils/parsers.js";

const edge = (id, vertices = ["shared"]) => ({ id, vertices, time: null, weight: 1 });

const explicitCases = [
  ['"quoted-edge": h2[shared: x]', "h2h"],
  ['"odd: h2[shared: x]', "h2h"],
  ['h1: h2"odd[shared: x]', "h2h"],
  ['foo"bar"baz: h2[shared: x]', "h2h"],
  ['h1: h2[shared: "odd]', "h2h"],
  ['"h1: h2[shared: x]",other', "csv"],
  ['"line 1\nh1: h2[shared: x]",other', "csv"],
  ['"unterminated CSV payload', "csv"],
];
for (const [text, expected] of explicitCases) {
  assert.equal(autoDetect(text), expected, JSON.stringify(text));
}
assert.equal(typeof mappingExports.expH2HResult, "function");
const { expH2HResult } = mappingExports;
assert.deepEqual(parseH2HText('h1: h2[shared: "odd]').map(item => item.id), ["h1", "h2"]);
assert.throws(
  () => parseInputFormat("csv", { text: '"unterminated CSV payload' }),
  /unterminated quoted field/,
);

const representableHyperedgeIds = [
  "plain",
  "internal space",
  "edge,comma",
  "edge]bracket",
  '"literal-quote"',
  '"odd',
  'odd"',
  'foo"bar"baz',
  "__proto__",
  "constructor",
  "toString",
  "null",
];
for (const id of representableHyperedgeIds) {
  const result = expH2HResult(buildH2H([edge(id), edge("other")]));
  assert.equal(result.ok, true, "export " + JSON.stringify(id));
  assert.equal(autoDetect(result.text), "h2h", "detect exported " + JSON.stringify(id));
  const parsed = parseInputFormat("h2h", { text: result.text });
  assert.deepEqual(
    parsed.map(item => item.id).sort(),
    [id, "other"].sort(),
    "round-trip IDs " + JSON.stringify(id),
  );
  assert.ok(parsed.every(item => item.vertices.map(String).includes("shared")));
}

const representableSharedIds = [
  "v:1",
  "left[open",
  '"quoted"',
  '"odd',
  'odd"',
  "__proto__",
  "constructor",
  "toString",
  "null",
  "0",
];
for (const id of representableSharedIds) {
  const result = expH2HResult(buildH2H([edge("h1", [id]), edge("h2", [id])]));
  assert.equal(result.ok, true, "shared export " + JSON.stringify(id));
  assert.equal(autoDetect(result.text), "h2h", "detect shared export " + JSON.stringify(id));
  const parsed = parseInputFormat("h2h", { text: result.text });
  assert.ok(parsed.every(item => item.vertices.map(String).includes(id)), "shared round-trip " + JSON.stringify(id));
}

const guarded = expH2HResult(buildH2H([edge("edge:colon"), edge("other")]));
assert.equal(guarded.ok, false);
assert.match(guarded.reason, /unrepresentable hyperedge identifier/i);

console.log("v7.3.14 Stage 2 corrective #2 H2H quote/export invariant passed.");
