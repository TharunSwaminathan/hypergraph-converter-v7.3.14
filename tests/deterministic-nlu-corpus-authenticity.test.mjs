import assert from "node:assert/strict";
import { deterministicNluHeldoutCorpus } from "./fixtures/deterministic-nlu/semantic-corpus.mjs";
import { inspectCorpusIntegrity } from "./helpers/nluCorpusIntegrity.mjs";

const good = inspectCorpusIntegrity(deterministicNluHeldoutCorpus);
assert.equal(good.opaqueSuffixViolations.length, 0);
assert.equal(good.fakeFamilyViolations.length, 0);
assert.equal(good.groundTruthViolations.length, 0);
assert.equal(good.categoryDomainViolations.length, 0);
assert.equal(good.dominatingFamilies.length, 0);
assert.equal(good.dominatingSkeletons.length, 0);
assert.equal(good.literalUnique, 840);
assert.equal(good.normalizedUnique, 840);

const synthetic = ["amber0", "fern0", "glacier0"].map((token, index) => ({
  id: `bad-${index}`,
  family: `dataset_mapping.action.${String(index + 1).padStart(2, "0")}`,
  category: "dataset_mapping_actions",
  context: "three-table-authorship",
  text: `Make papers.csv the hyperedge table for ${token}.`,
  expected: { domain: "dataset_mapping" },
  groundTruth: { reviewed: true, rationale: "deliberately bad fixture" },
}));
const bad = inspectCorpusIntegrity(synthetic, { maxFamilyShare: 1, maxSkeletonShare: 1 });
assert.ok(bad.opaqueSuffixViolations.length >= 3);
assert.ok(bad.fakeFamilyViolations.length >= 3);
assert.ok(bad.errors.length >= 6);

console.log("deterministic NLU corpus-authenticity tests passed.");
