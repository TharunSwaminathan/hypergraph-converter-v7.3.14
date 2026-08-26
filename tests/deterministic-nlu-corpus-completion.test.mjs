import assert from "node:assert/strict";
import { deterministicNluHeldoutCorpus } from "./fixtures/deterministic-nlu/semantic-corpus.mjs";

const counts = {};
for (const fixture of deterministicNluHeldoutCorpus) counts[fixture.category] = (counts[fixture.category] ?? 0) + 1;

assert.equal(deterministicNluHeldoutCorpus.length, 840);
assert.equal(counts.dataset_mapping_actions, 150);
assert.equal(counts.dataset_mapping_questions, 50);
assert.equal(counts.dataset_grouping_actions, 70);
assert.equal(counts.dataset_grouping_questions, 20);
assert.equal(counts.graph_mutation_actions, 150);
assert.equal(counts.graph_mutation_questions, 40);
assert.equal(counts.parser_workflow, 100);
assert.equal(counts.dashboard_control, 100);
assert.equal(counts.corrections, 60);
assert.equal(counts.negative_ambiguous_adversarial, 100);

console.log("deterministic NLU corpus completion tests passed.");
