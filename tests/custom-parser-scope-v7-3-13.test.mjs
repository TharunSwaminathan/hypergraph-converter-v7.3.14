import assert from "node:assert/strict";
import { validateParserCodeSafety } from "../src/utils/customParser.js";

const positives = [
  `const location = "x"; return [{ id: "h1", vertices: [location] }];`,
  `const process = "annealing"; return [{ id: "h1", vertices: [process] }];`,
  `const { location } = row; return location;`,
  `const data = { location: "x", process: "p" }; return data.location + data.process;`,
  `const re = /location/; return re.test(row.location);`,
  `return rows.map(row => row.location + row.process);`,
];

for (const source of positives) {
  assert.equal(validateParserCodeSafety(source).ok, true, `expected local/data-only parser code to pass: ${source}`);
}

const negatives = [
  [`return fetch("http://localhost");`, /network/],
  [`return window.location.href;`, /global_access/],
  [`return globalThis["con" + "structor"];`, /global_access|computed_constructor/],
  [`return process.exit(1);`, /host_runtime/],
  [`return require("fs");`, /host_runtime/],
  [`return Object.getPrototypeOf({});`, /prototype_escape/],
  [`return (() => {}).constructor("return 1")();`, /prototype_escape|function_constructor/],
  [`delete helpers.splitLines; return [];`, /global_mutation/],
];

for (const [source, pattern] of negatives) {
  const result = validateParserCodeSafety(source);
  assert.equal(result.ok, false, `expected forbidden runtime access to fail: ${source}`);
  assert.match(result.error, pattern, source);
}

console.log("v7.3.13 custom parser AST/scope guard tests passed.");
