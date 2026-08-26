import assert from "node:assert/strict";
import { join } from "node:path";
import { deterministicNluHeldoutCorpus } from "./fixtures/deterministic-nlu/semantic-corpus.mjs";
import { evaluateIntegratedRouting } from "./helpers/evaluateIntegratedRouting.mjs";

const sample = deterministicNluHeldoutCorpus.slice(0, 80);
const reportPath = join(process.cwd(), "artifacts", "deterministic-nlu-integrated-routing-report.json");
const report = await evaluateIntegratedRouting(sample, { writeReportPath: reportPath });

assert.equal(report.rates.duplicateAnalysisRate.rate, 0);
assert.equal(report.rates.duplicateCompilationRate.rate, 0);
assert.equal(report.rates.unexpectedModelCallRate.rate, 0);
assert.equal(report.rates.genericActionPlanTheftRate.rate, 0);
assert.equal(report.rates.legacyParserCallRate.rate, 0);
assert.equal(report.rates.rawDashboardClassifierFallbackRate.rate, 0);

console.log(`deterministic NLU integrated call metrics tests passed; report written to ${reportPath}.`);
