import assert from "node:assert/strict";
import { deterministicNluHeldoutCorpus, deterministicNluSemanticCorpus } from "./fixtures/deterministic-nlu/semantic-corpus.mjs";
import { inspectCorpusIntegrity } from "./helpers/nluCorpusIntegrity.mjs";

const heldoutIntegrity = inspectCorpusIntegrity(deterministicNluHeldoutCorpus);

const coreIds = new Set();
for (const fixture of deterministicNluSemanticCorpus.filter(item => item.category === "core_regressions")) {
  assert.ok(fixture.id, "core regression fixture must have an id");
  assert.equal(coreIds.has(fixture.id), false, `duplicate core regression id ${fixture.id}`);
  coreIds.add(fixture.id);
  assert.ok(fixture.text?.trim(), `${fixture.id} must contain text`);
  assert.equal(fixture.groundTruth?.reviewed, true, `${fixture.id} must have reviewed ground truth`);
}

assert.equal(heldoutIntegrity.errors.length, 0, heldoutIntegrity.errors.join("; "));
assert.equal(heldoutIntegrity.duplicateNormalizedUtterances, 0);
assert.ok(heldoutIntegrity.uniqueCount >= 840, "held-out corpus should contain at least 840 unique utterances");

const expectedCounts = {
  dataset_mapping_actions: 150,
  dataset_mapping_questions: 50,
  dataset_grouping_actions: 70,
  dataset_grouping_questions: 20,
  graph_mutation_actions: 150,
  graph_mutation_questions: 40,
  parser_workflow: 100,
  dashboard_control: 100,
  corrections: 60,
  negative_ambiguous_adversarial: 100,
};
const categoryCounts = {};
for (const fixture of deterministicNluHeldoutCorpus) categoryCounts[fixture.category] = (categoryCounts[fixture.category] ?? 0) + 1;
for (const [category, count] of Object.entries(expectedCounts)) {
  assert.equal(categoryCounts[category], count, `${category} count mismatch`);
}

const familyRequirements = {
  dataset_mapping_actions: 25,
  dataset_mapping_questions: 25,
  dataset_grouping_actions: 12,
  dataset_grouping_questions: 12,
  graph_mutation_actions: 25,
  parser_workflow: 15,
  dashboard_control: 15,
  corrections: 12,
  negative_ambiguous_adversarial: 20,
};
for (const [category, minimumFamilies] of Object.entries(familyRequirements)) {
  const categoryFixtures = deterministicNluHeldoutCorpus.filter(fixture => fixture.category === category);
  const families = new Map();
  for (const fixture of categoryFixtures) families.set(fixture.family, (families.get(fixture.family) ?? 0) + 1);
  assert.ok(families.size >= minimumFamilies, `${category} family count ${families.size} < ${minimumFamilies}`);
  const maxShare = Math.max(...families.values()) / categoryFixtures.length;
  assert.ok(maxShare <= 0.05, `${category} family share ${maxShare} exceeds 5%`);
}

console.log(`deterministic NLU corpus integrity passed: ${heldoutIntegrity.uniqueCount} held-out utterances across ${Object.keys(heldoutIntegrity.familyCounts).length} families.`);
