import assert from "node:assert/strict";
import { deterministicNluSemanticCorpus } from "./fixtures/deterministic-nlu/semantic-corpus.mjs";
import { evaluateDeterministicNluCorpus, assertCorpusRecord } from "./helpers/evaluateDeterministicNluCorpus.mjs";

const report = await evaluateDeterministicNluCorpus(deterministicNluSemanticCorpus);
for (const record of report.records) assertCorpusRecord(record);

assert.ok(report.metrics.domainAccuracy.rate >= 0.98, JSON.stringify(report.metrics.domainAccuracy));
assert.ok(report.metrics.intentAccuracy.rate >= 0.95, JSON.stringify(report.metrics.intentAccuracy));
assert.ok(report.metrics.modeAccuracy.rate >= 0.98, JSON.stringify(report.metrics.modeAccuracy));
assert.ok(report.metrics.handledAccuracy.rate >= 0.98, JSON.stringify(report.metrics.handledAccuracy));
assert.ok(report.metrics.typedKindAccuracy.rate >= 0.98, JSON.stringify(report.metrics.typedKindAccuracy));
assert.ok(report.metrics.operationTypeExactMatch.rate >= 0.95, JSON.stringify(report.metrics.operationTypeExactMatch));
assert.ok(report.metrics.operationObjectExactMatch.rate >= 0.93, JSON.stringify(report.metrics.operationObjectExactMatch));
assert.ok(report.metrics.operationObjectPartialMatch.rate === null || report.metrics.operationObjectPartialMatch.rate >= 0.80, JSON.stringify(report.metrics.operationObjectPartialMatch));
assert.ok(report.metrics.entityResolutionExactMatch.rate >= 0.97, JSON.stringify(report.metrics.entityResolutionExactMatch));

console.log("deterministic NLU semantic evaluation passed.");
