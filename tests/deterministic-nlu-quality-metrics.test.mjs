import assert from "node:assert/strict";
import { copyFileSync } from "node:fs";
import { join } from "node:path";
import { deterministicNluHeldoutCorpus } from "./fixtures/deterministic-nlu/semantic-corpus.mjs";
import { evaluateDeterministicNluCorpus } from "./helpers/evaluateDeterministicNluCorpus.mjs";

const reportPath = join(process.cwd(), "artifacts", "deterministic-nlu-quality-report.json");
const compilerReportPath = join(process.cwd(), "artifacts", "deterministic-nlu-compiler-quality-report.json");
const report = await evaluateDeterministicNluCorpus(deterministicNluHeldoutCorpus, { writeReportPath: reportPath });
copyFileSync(reportPath, compilerReportPath);

for (const metric of Object.values(report.metrics)) {
  assert.ok(Object.hasOwn(metric, "correct") || Object.hasOwn(metric, "count"));
  assert.ok(Object.hasOwn(metric, "evaluated"));
  assert.ok(Object.hasOwn(metric, "excluded"));
  assert.ok(Object.hasOwn(metric, "rate"));
  assert.ok(Object.hasOwn(metric, "status"));
  if (metric.evaluated === 0) assert.equal(metric.rate, null);
}

assert.equal(report.metrics.falseStateChangingDispatchRate.rate, 0);
assert.equal(report.metrics.genericActionPlanTheftRate.rate, 0);
assert.equal(report.metrics.unexpectedModelCallRate.rate, 0);
assert.equal(report.metrics.legacyRawParserCallRate.rate, 0);
assert.equal(report.metrics.rawDashboardClassifierFallbackRate.rate, 0);
assert.equal(report.metrics.duplicateAnalysisRate.rate, 0);
assert.equal(report.metrics.duplicateCompilationRate.rate, 0);
assert.ok(report.metrics.clarificationRecall.rate === null || report.metrics.clarificationRecall.rate >= 0.95);
assert.ok(report.metrics.clarificationPrecision.rate === null || report.metrics.clarificationPrecision.rate >= 0.95);
assert.ok(report.metrics.domainAccuracy.rate >= 0.98);
assert.ok(report.metrics.intentAccuracy.rate >= 0.95);

console.log(`deterministic NLU quality metrics passed; reports written to ${reportPath} and ${compilerReportPath}.`);
