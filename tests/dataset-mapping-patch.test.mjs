import assert from "node:assert/strict";
import { profileDatasetFiles } from "../src/agent/datasetProfiler.js";
import { profileDatasetRelationships } from "../src/agent/datasetRelationshipProfiler.js";
import { buildDatasetGroupingDraft } from "../src/agent/datasetGrouping.js";
import { buildDatasetMappingSpecV2FromProfile } from "../src/agent/deterministicMappingV2.js";
import { validateDatasetMappingPatchDraft } from "../src/agent/datasetMappingPatchValidator.js";
import { applyDatasetMappingPatch } from "../src/agent/datasetMappingPatchApplier.js";
import { planDatasetMappingPatch } from "../src/agent/datasetMappingPatchPlanner.js";

const datasetProfile = profileDatasetFiles([{ name: "papers.csv", text: "paper_id,authors,year\np1,Ada;Bob,2020\n" }]);
const evidence = profileDatasetRelationships(datasetProfile);
const spec = buildDatasetMappingSpecV2FromProfile({ batchId: "b", datasetProfile, relationshipEvidence: evidence, groupingDraft: buildDatasetGroupingDraft(datasetProfile, evidence) });
const headersByFile = { "papers.csv": ["paper_id", "authors", "year"] };
const patch = {
  task: "plan_dataset_mapping_patch",
  classification: "patch",
  summary: "Split authors.",
  operations: [
    { type: "SET_FILE_ROLE", fileName: "papers.csv", role: "membership" },
    { type: "SET_FILE_LIST_COLUMN", fileName: "papers.csv", listColumn: "authors", listDelimiter: ";" },
    { type: "SET_POLICY", policy: "emptyHyperedges", value: "keep" },
    { type: "ADD_ASSUMPTION", assumption: "Authors column is semicolon-delimited." },
  ],
  clarificationQuestion: null,
  confidence: "high",
};
assert.equal(validateDatasetMappingPatchDraft(patch, { fileNames: ["papers.csv"], headersByFile, groupIds: spec.groups.map(g => g.id) }).ok, true);
assert.equal(validateDatasetMappingPatchDraft({ ...patch, operations: [{ type: "SET_FILE_LIST_COLUMN", fileName: "papers.csv", listColumn: "missing" }] }, { fileNames: ["papers.csv"], headersByFile }).ok, false);
const applied = applyDatasetMappingPatch(spec, patch, { fileProfiles: datasetProfile.files });
assert.equal(applied.ok, true, applied.errors?.join("; "));
assert.equal(applied.spec.mappingRevision, spec.mappingRevision + 1);
assert.ok(applied.diff.some(line => line.includes("Split")));

const planned = await planDatasetMappingPatch({
  config: { model: "mock" },
  mappingSpec: spec,
  datasetProfile,
  generate: async () => JSON.stringify(patch),
});
assert.equal(planned.ok, true);
assert.ok(planned.applied);

console.log("dataset mapping patch tests passed.");
