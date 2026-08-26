import assert from "node:assert/strict";
import { deterministicNluHeldoutCorpus } from "./fixtures/deterministic-nlu/semantic-corpus.mjs";
import { evaluateDeterministicNluCorpus, assertCorpusRecord } from "./helpers/evaluateDeterministicNluCorpus.mjs";

const report = await evaluateDeterministicNluCorpus(deterministicNluHeldoutCorpus);
assert.equal(report.integrity.duplicateNormalizedUtterances, 0);
assert.equal(report.uniqueUtteranceCounts.total, deterministicNluHeldoutCorpus.length);
assert.ok(deterministicNluHeldoutCorpus.length >= 840);

for (const record of report.records) assertCorpusRecord(record);

console.log(`deterministic NLU static held-out corpus passed: ${deterministicNluHeldoutCorpus.length} held-out fixtures; ${report.uniqueUtteranceCounts.total} total unique utterances.`);
