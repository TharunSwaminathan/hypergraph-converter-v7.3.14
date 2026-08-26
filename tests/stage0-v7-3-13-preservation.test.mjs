import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildWeightedAdjacency } from "../src/algorithms/graphModel.js";
import { buildTwoSectionProjectionSafely } from "../src/algorithms/projection.js";
import { authorizeCompiledSideEffect } from "../src/agent/deterministicNlu/sideEffectPolicy.js";
import { validateParserCodeSafety } from "../src/utils/customParser.js";
import { shouldRequestH2H, shouldRequestV2V } from "../src/utils/derivedRequests.js";
import { csvDocument, expH2V, expIncidence } from "../src/utils/mappings.js";
import { parseCsvDocument, parseIncidence, parseJSON } from "../src/utils/parsers.js";
import { CSVQuoted, OneHugeEdge1K, WeightZero } from "./fixtures/v7.3.14/stage0-regression-fixtures.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

// RFC-aware CSV correctness must survive the later whitespace-row repair.
assert.deepEqual(parseCsvDocument(CSVQuoted.text), CSVQuoted.expectedRows);
const csvRoundTrip = csvDocument(CSVQuoted.expectedRows);
assert.deepEqual(parseCsvDocument(csvRoundTrip), CSVQuoted.expectedRows);
assert.deepEqual(parseCsvDocument('"a,b","a""b"\r\n"line 1\nline 2",tail'), [
  ["a,b", 'a"b'],
  ["line 1\nline 2", "tail"],
]);
assert.throws(() => parseCsvDocument('"unterminated'), /unterminated quoted field/);

// Zero is a valid time/weight throughout canonical parsing, algorithms, and exports.
const canonicalZero = parseJSON(JSON.stringify(WeightZero));
assert.equal(canonicalZero[0].time, 0);
assert.equal(canonicalZero[0].weight, 0);
assert.match(expH2V(canonicalZero.map(edge => ({ hid: edge.id, ...edge }))), /@weight=0/);
assert.match(expIncidence(canonicalZero), /,0,0$/m);
assert.equal(parseIncidence(expIncidence(canonicalZero))[0].weight, 0);
assert.equal(buildWeightedAdjacency(canonicalZero).adjacency.get("a").get("b"), 0);

// Projection limits and demand-driven derived-state direction are protected.
const hugeProjection = buildTwoSectionProjectionSafely(OneHugeEdge1K());
assert.equal(hugeProjection.ok, false);
assert.equal(hugeProjection.overBudget, true);
assert.equal(shouldRequestH2H({ activeSection: "mappings", selectedMappingId: "h2v", expId: "h2v_txt" }), false);
assert.equal(shouldRequestV2V({ activeSection: "mappings", selectedMappingId: "h2v", expId: "h2v_txt" }), false);
assert.equal(shouldRequestH2H({ activeSection: "mappings", selectedMappingId: "h2h" }), true);
assert.equal(shouldRequestV2V({ activeSection: "mappings", selectedMappingId: "v2v" }), true);

// Custom-parser host/network/prototype protections remain mandatory.
for (const source of [
  'return fetch("http://localhost");',
  "return window.location.href;",
  "return process.exit(1);",
  "return Object.getPrototypeOf({});",
  'return (() => {}).constructor("return globalThis")();',
]) {
  assert.equal(validateParserCodeSafety(source).ok, false, source);
}
assert.equal(validateParserCodeSafety('const process = "annealing"; return [{ id: "h1", vertices: [process] }];').ok, true);

// Downstream authorization remains fail-closed even while upstream semantics evolve.
const blocked = authorizeCompiledSideEffect({
  semantics: { mode: "question", executionAuthorized: false, readOnlyScope: true, clauses: [] },
  sideEffectClass: "graph_edit_preview",
});
assert.equal(blocked.allowed, false);
assert.match(blocked.reason, /do_not_authorize|read_only_scope/);
assert.equal(authorizeCompiledSideEffect({ semantics: null, sideEffectClass: "graph_edit_preview" }).allowed, false);

// The existing repository packager remains the authority for normalized paths/modes.
const packager = await readFile(join(root, "scripts", "package-portable-source.py"), "utf8");
assert.match(packager, /EXECUTABLE_FILE_MODE\s*=\s*0o755/);
assert.match(packager, /REGULAR_FILE_MODE\s*=\s*0o644/);
assert.match(packager, /info\.create_system\s*=\s*3/);
assert.match(packager, /EXCLUDED_DIRS/);
assert.match(packager, /node_modules/);
assert.match(packager, /dist/);

console.log("v7.3.14 Stage 0 preservation gate passed for protected v7.3.13 behavior.");
