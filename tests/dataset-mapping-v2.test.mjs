import assert from "node:assert/strict";
import { profileDatasetFiles } from "../src/agent/datasetProfiler.js";
import { profileDatasetRelationships } from "../src/agent/datasetRelationshipProfiler.js";
import { buildDatasetGroupingDraft } from "../src/agent/datasetGrouping.js";
import { buildDatasetMappingSpecV2FromProfile } from "../src/agent/deterministicMappingV2.js";
import { validateDatasetMappingSpecV2 } from "../src/agent/datasetMappingSpecV2Validator.js";

const datasetProfile = profileDatasetFiles([
  { name: "authors.csv", text: "author_id,name\na1,Ada\na2,Bob\n" },
  { name: "papers.csv", text: "paper_id,title,year\np1,One,2020\np2,Two,2021\n" },
  { name: "authorships.csv", text: "paper_id,author_id,position\np1,a1,1\np1,a2,2\n" },
  { name: "expected.json", text: "{\"canonicalHyperedges\":[]}" },
]);
const relationshipEvidence = profileDatasetRelationships(datasetProfile);
const groupingDraft = buildDatasetGroupingDraft(datasetProfile, relationshipEvidence);
const spec = buildDatasetMappingSpecV2FromProfile({ batchId: "batch-1", batchVersion: 1, datasetProfile, relationshipEvidence, groupingDraft });
assert.equal(spec.version, 2);
assert.equal(spec.parseMode, "grouped");
assert.ok(spec.relationships.some(rel => rel.type === "membership"));
assert.ok(spec.files.some(file => file.role === "validation_expected_output" && file.useAsInput === false));
const validation = validateDatasetMappingSpecV2(spec, { batchId: "batch-1", batchVersion: 1, groupingRevision: 0, fileProfiles: datasetProfile.files });
assert.equal(validation.ok, true, validation.errors.join("; "));

const stale = validateDatasetMappingSpecV2({ ...spec, batchVersion: 0 }, { batchId: "batch-1", batchVersion: 1, fileProfiles: datasetProfile.files });
assert.equal(stale.ok, false);
const badColumn = structuredClone(spec);
badColumn.relationships[0].sourceColumns = ["missing"];
assert.equal(validateDatasetMappingSpecV2(badColumn, { fileProfiles: datasetProfile.files }).ok, false);

console.log("dataset mapping v2 tests passed.");
