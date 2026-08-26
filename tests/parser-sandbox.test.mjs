import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  CUSTOM_PARSER_LIMITS,
  assertPlainSerializable,
  enforceParserOutputLimits,
  sanitizeParserFiles,
  validateParserCodeSafety,
} from "../src/utils/customParser.js";

assert.equal(validateParserCodeSafety("async function parseHypergraph(){ return []; }").ok, true);
assert.equal(validateParserCodeSafety("async function parseHypergraph(){ return fetch('https://example.com'); }").ok, false);
assert.equal(validateParserCodeSafety("async function parseHypergraph(){ return new Function('return 1')(); }").ok, false);

for (const bypass of [
  `async function parseHypergraph(){ return self["fet" + "ch"]("https://example.com"); }`,
  `async function parseHypergraph(){ return (() => {}).constructor("return 1")(); }`,
  `async function parseHypergraph(){ return new EventSource("https://example.com"); }`,
  `async function parseHypergraph(){ return globalThis["con" + "structor"]; }`,
  `async function parseHypergraph(){ delete helpers.splitLines; return []; }`,
  `async function parseHypergraph(){ return Object.getPrototypeOf(()=>{}); }`,
  `async function parseHypergraph(){ return Object.getOwnPropertyNames(()=>{}); }`,
  `async function parseHypergraph(){ return Object.defineProperty({}, "x", { value: 1 }); }`,
  `async function parseHypergraph(){ return new Proxy({}, {}); }`,
  `async function parseHypergraph(){ return new WeakRef({}); }`,
  `async function parseHypergraph(){ return new FinalizationRegistry(() => {}); }`,
  `async function parseHypergraph(){ return [] ["ma" + "p"] ["con" + "structor"]; }`,
]) {
  assert.equal(validateParserCodeSafety(bypass).ok, false, `expected parser escape to be rejected: ${bypass}`);
}

assert.throws(() => sanitizeParserFiles(
  Array.from({ length: CUSTOM_PARSER_LIMITS.maxFiles + 1 }, (_, index) => ({ name: `f${index}.txt`, text: "" })),
), /at most 50 files/);

const safeFiles = sanitizeParserFiles([{ id: 1, name: "a.txt", text: "h0: A,B", size: 7, type: "text/plain", extra: "ignored" }]);
assert.deepEqual(Object.keys(safeFiles[0]).sort(), ["id", "name", "size", "text", "type"]);

assert.throws(() => assertPlainSerializable({ fn: () => null }), /non-serializable/);
const cyclic = {};
cyclic.self = cyclic;
assert.throws(() => assertPlainSerializable(cyclic), /cyclic/);

assert.throws(() => enforceParserOutputLimits(
  [{ id: "huge", vertices: Array.from({ length: 5 }, (_, index) => `v${index}`) }],
  { ...CUSTOM_PARSER_LIMITS, maxIncidences: 4 },
), /incidences/);
assert.throws(() => assertPlainSerializable({ a: { b: { c: 1 } } }, new WeakSet(), "result", { ...CUSTOM_PARSER_LIMITS, maxOutputDepth: 1 }), /nesting depth/);
assert.throws(() => assertPlainSerializable([{}, {}, {}], new WeakSet(), "result", { ...CUSTOM_PARSER_LIMITS, maxOutputNodes: 2 }), /node limit/);
assert.throws(() => assertPlainSerializable("12345", new WeakSet(), "result", { ...CUSTOM_PARSER_LIMITS, maxOutputStringChars: 4 }), /string is too large/);
assert.throws(() => assertPlainSerializable(["123", "456"], new WeakSet(), "result", {
  ...CUSTOM_PARSER_LIMITS,
  maxOutputStringChars: 10,
  maxTotalOutputChars: 5,
}), /too much text/);
assert.throws(() => enforceParserOutputLimits(
  Array.from({ length: 3 }, (_, index) => ({ id: `h${index}`, vertices: [] })),
  { ...CUSTOM_PARSER_LIMITS, maxHyperedges: 2 },
), /hyperedges/);
assert.throws(() => enforceParserOutputLimits(
  { incidences: [{}, {}, {}] },
  { ...CUSTOM_PARSER_LIMITS, maxIncidences: 2 },
), /incidences/);
assert.throws(() => enforceParserOutputLimits(
  { h2v: { h1: ["a", "b"], h2: ["c"] } },
  { ...CUSTOM_PARSER_LIMITS, maxIncidences: 2 },
), /incidences/);

const customParserSource = await readFile(new URL("../src/utils/customParser.js", import.meta.url), "utf8");
assert.ok(customParserSource.includes("hardenIntrinsicConstructors"), "the worker must neutralize constructor-chain escapes before running reviewed code");
assert.ok(customParserSource.includes("const safeObject=IntrinsicObject.freeze"), "the worker must expose only the reduced Object facade");
const boundedCloneIndex = customParserSource.indexOf("const bounded=boundedClone(result,limits)");
const workerPostMessageIndex = customParserSource.indexOf("self.postMessage({ok:true,result:bounded,logs})");
assert.ok(boundedCloneIndex >= 0 && workerPostMessageIndex > boundedCloneIndex, "the worker must bound and clone output before structured serialization");
assert.ok(customParserSource.includes("enforceShapeLimits(bounded,limits)"), "hyperedge/incidence limits must run before worker postMessage");
assert.ok(customParserSource.includes("disposable worker accepts only reviewed, trusted"), "the source must describe the parser as trusted-code execution rather than a hostile-code sandbox");

console.log("trusted-code custom parser guard tests passed.");
