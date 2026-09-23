import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildGraphResultSummaryMessage, derivedResultSummaryText } from "../src/agent/resultSummary.js";
import { hasNonEmptyCustomParserResult } from "../src/utils/customParser.js";
import { countTriadsBounded, DERIVED_STATUS } from "../src/utils/mappings.js";

const graph = [
  { id: "h0", vertices: ["a", "b"] },
  { id: "h1", vertices: ["b", "c"] },
  { id: "h2", vertices: ["a", "c"] },
];
const triads = countTriadsBounded(graph);
assert.equal(triads.status, DERIVED_STATUS.COMPUTED);
assert.equal(triads.value, 1);
const summary = buildGraphResultSummaryMessage({
  hasGraph: true,
  fmt: "simple",
  hyperedgeCount: 3,
  vertexCount: 3,
  incidenceCount: 6,
  resultSummary: { triads: triads.value, triadsStatus: triads.status },
});
assert.match(summary.text, /Line-graph triangles: 1/);
assert.doesNotMatch(summary.text, /too large/i);
assert.equal(derivedResultSummaryText({ status: "not_requested", value: null }), "not requested");
assert.equal(derivedResultSummaryText({ status: "over_budget", value: null }), "resource/budget exceeded");
assert.equal(derivedResultSummaryText({ status: "error", value: null }), "failed");
assert.equal(derivedResultSummaryText({ status: "cancelled", value: null }), "unavailable");

assert.equal(hasNonEmptyCustomParserResult(null), false);
assert.equal(hasNonEmptyCustomParserResult({ hyperedges: [] }), false);
assert.equal(hasNonEmptyCustomParserResult({ hyperedges: graph }), true);
const appSource = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
assert.match(appSource, /disabled=\{!hasNonEmptyCustomParserResult\(customResult\)\}/);
assert.match(appSource, /No graph preview was created because the parser returned zero hyperedges/);

console.log("result summary and custom parser UI semantics tests passed.");
