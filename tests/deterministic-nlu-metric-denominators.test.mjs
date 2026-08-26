import assert from "node:assert/strict";
import { evaluateDeterministicNluCorpus } from "./helpers/evaluateDeterministicNluCorpus.mjs";

const report = await evaluateDeterministicNluCorpus([{
  id: "zero-denominator-check",
  family: "metrics.zero",
  category: "negative_ambiguous_adversarial",
  context: "dashboard-workspace",
  text: "Hello there, just a note.",
  expected: {},
}]);

assert.equal(report.metrics.intentAccuracy.evaluated, 0);
assert.equal(report.metrics.intentAccuracy.rate, null);
assert.equal(report.metrics.intentAccuracy.status, "not_evaluated");

console.log("deterministic NLU metric denominator tests passed.");
