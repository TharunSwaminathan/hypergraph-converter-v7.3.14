import assert from "node:assert/strict";
import { deterministicNluSemanticCorpus } from "./fixtures/deterministic-nlu/semantic-corpus.mjs";
import { evaluateDeterministicNluCorpus } from "./helpers/evaluateDeterministicNluCorpus.mjs";

const report = await evaluateDeterministicNluCorpus(deterministicNluSemanticCorpus.filter(fixture => fixture.expected.noMutation));

assert.equal(report.falseMutationRate, 0);
assert.equal(report.records.every(record => !record.actual.modelCalled), true);
assert.equal(report.records.every(record => !record.actual.legacyParserCalled), true);

console.log(`deterministic NLU false-mutation safety passed for ${report.records.length} negative fixtures.`);
