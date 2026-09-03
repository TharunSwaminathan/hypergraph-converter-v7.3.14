import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { classifyDatasetMappingIntent } from "../src/agent/datasetMappingIntent.js";
import { ensureDatasetMappingV2ForBatch } from "../src/agent/datasetMappingBootstrap.js";
import { buildDeterministicDatasetMappingPatch } from "../src/agent/deterministicDatasetMappingPatch.js";
import { applyDatasetMappingPatch } from "../src/agent/datasetMappingPatchApplier.js";
import { buildRegressionFixture, regressionRequest } from "./deterministic-dataset-mapping-patch.test.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
assert.equal(packageJson.name, "hypergraph-converter-studio");
assert.equal(packageJson.version, "7.3.14");

for (const file of [
  "src/agent/datasetMappingIntent.js",
  "src/agent/datasetMappingReferenceResolver.js",
  "src/agent/deterministicDatasetMappingPatch.js",
  "src/agent/datasetMappingBootstrap.js",
  "docs/V7_3_1_REMEDIATION.md",
  "docs/DATASET_MAPPING_CHAT_ROUTING.md",
  "docs/V7_3_1_TEST_REPORT.md",
]) {
  assert.equal(existsSync(join(root, file)), true, `${file} must exist`);
}

const fixture = buildRegressionFixture();
const context = {
  hasActiveBatch: true,
  route: "custom",
  parseMode: "together",
  fileNames: fixture.batch.files.map(file => file.name),
  profiledColumnsByFile: Object.fromEntries(fixture.datasetProfile.files.map(file => [file.fileName, file.columns.map(column => column.name)])),
  hasMappingSpec: false,
  mappingRevision: 0,
};
assert.equal(classifyDatasetMappingIntent(regressionRequest, context).kind, "explicit_patch");

const bootstrap = ensureDatasetMappingV2ForBatch({ batch: fixture.batch, allowDeterministicGeneration: true });
assert.equal(bootstrap.ok, true);
assert.equal(bootstrap.generated, true);

const fallback = buildDeterministicDatasetMappingPatch(regressionRequest, {
  batch: fixture.batch,
  mappingSpec: bootstrap.spec,
  datasetProfile: fixture.datasetProfile,
});
assert.equal(fallback.ok, true);
assert.equal(fallback.draft.classification, "patch");

const applied = applyDatasetMappingPatch(bootstrap.spec, fallback.draft, { fileProfiles: fixture.datasetProfile.files });
assert.equal(applied.ok, true, applied.errors?.join("; "));
assert.equal(applied.spec.mappingRevision, 1);
assert.equal(applied.history.length, 1);
assert.equal(applied.spec.parseMode, "together");
assert.equal(applied.spec.policies.emptyHyperedges, "keep");
assert.equal(applied.spec.policies.unmatchedHyperedgeRows, "preserve_empty");

const panel = await readFile(join(root, "src/components/AgentChatPanel.jsx"), "utf8");
const app = await readFile(join(root, "src/App.jsx"), "utf8");
assert.doesNotMatch(panel, /local model ActionPlan was invalid[\s\S]{0,240}dataset mapping/i);
assert.match(app, /genericActionPlannerCalled:\s*false/);
assert.match(app, /routePlannerCalled:\s*false/);

console.log("v7.3.1 regression tests passed.");
