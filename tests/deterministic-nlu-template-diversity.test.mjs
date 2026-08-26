import assert from "node:assert/strict";
import { deterministicNluHeldoutCorpus } from "./fixtures/deterministic-nlu/semantic-corpus.mjs";
import { inspectCorpusIntegrity } from "./helpers/nluCorpusIntegrity.mjs";

const integrity = inspectCorpusIntegrity(deterministicNluHeldoutCorpus);

assert.equal(integrity.duplicateNormalizedUtterances, 0);
assert.ok(integrity.repeatedSkeletons.length < deterministicNluHeldoutCorpus.length / 2, "skeleton clustering should be reported but not dominate the corpus");
assert.ok(integrity.highSimilarityClusters.length < deterministicNluHeldoutCorpus.length, JSON.stringify(integrity.highSimilarityClusters.slice(0, 5)));

console.log(`deterministic NLU template diversity passed; repeated skeletons=${integrity.repeatedSkeletons.length}; high-similarity pairs=${integrity.highSimilarityClusters.length}.`);
