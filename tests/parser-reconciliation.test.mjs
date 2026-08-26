import assert from "node:assert/strict";
import { buildParserReconciliationReport, parserReconciliationAllowsApply } from "../src/agent/parserReconciliation.js";

const report = buildParserReconciliationReport({
  batchId: "batch",
  groupId: "group-main",
  mappingRevision: 2,
  planFingerprint: "plan-1",
  parserResult: {
    canonicalHyperedges: [{ id: "h1", vertices: ["a", "b"] }],
    diagnostics: { sourceRows: { "m.csv": 2 }, filteredRows: { "m.csv": 0 }, duplicateMembershipsRemoved: 1 },
  },
});
assert.equal(report.status, "clean");
assert.equal(report.emitted.hyperedges, 1);
assert.equal(report.duplicateMembershipsRemoved, 1);
assert.equal(parserReconciliationAllowsApply(report), true);
const failed = buildParserReconciliationReport({ parserResult: { canonicalHyperedges: [] }, errors: ["bad"] });
assert.equal(parserReconciliationAllowsApply(failed), false);

console.log("parser reconciliation tests passed.");
