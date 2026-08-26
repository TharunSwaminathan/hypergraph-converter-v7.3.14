import assert from "node:assert/strict";
import { ensureDatasetMappingV2ForBatch } from "../src/agent/datasetMappingBootstrap.js";
import { buildRegressionFixture } from "./deterministic-dataset-mapping-patch.test.mjs";

const fixture = buildRegressionFixture();
const bootstrapped = ensureDatasetMappingV2ForBatch({
  batch: fixture.batch,
  reason: "test",
  allowDeterministicGeneration: true,
});
assert.equal(bootstrapped.ok, true, bootstrapped.error);
assert.equal(bootstrapped.generated, true);
assert.equal(bootstrapped.spec.version, 2);
assert.equal(bootstrapped.spec.mappingRevision, 0);
assert.equal(bootstrapped.spec.batchId, fixture.batch.id);
assert.equal(bootstrapped.spec.parseMode, "together");

const existing = ensureDatasetMappingV2ForBatch({
  batch: { ...fixture.batch, mappingSpec: bootstrapped.spec },
});
assert.equal(existing.ok, true);
assert.equal(existing.generated, false);
assert.equal(existing.source, "existing_v2");

const missingProfile = ensureDatasetMappingV2ForBatch({
  batch: { id: "b", version: 1, files: [], parseMode: "together" },
});
assert.equal(missingProfile.ok, false);
assert.equal(missingProfile.source, "profile_missing");

console.log("dataset mapping bootstrap tests passed.");
