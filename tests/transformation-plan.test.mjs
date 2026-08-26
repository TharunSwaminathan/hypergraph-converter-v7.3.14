import assert from "node:assert/strict";
import { profileDatasetFiles } from "../src/agent/datasetProfiler.js";
import { profileDatasetRelationships } from "../src/agent/datasetRelationshipProfiler.js";
import { buildDatasetGroupingDraft } from "../src/agent/datasetGrouping.js";
import { buildDatasetMappingSpecV2FromProfile } from "../src/agent/deterministicMappingV2.js";
import { buildTransformationPlanFromMapping, describeTransformationPlan } from "../src/agent/transformationPlan.js";
import { validateTransformationPlan } from "../src/agent/transformationPlanValidator.js";

const datasetProfile = profileDatasetFiles([
  { name: "papers.csv", text: "paper_id,title\np1,One\np2,Two\n" },
  { name: "authorships.csv", text: "paper_id,author_id\np1,a1\np1,a2\n" },
]);
const evidence = profileDatasetRelationships(datasetProfile);
const spec = buildDatasetMappingSpecV2FromProfile({ batchId: "batch", datasetProfile, relationshipEvidence: evidence, groupingDraft: buildDatasetGroupingDraft(datasetProfile, evidence) });
const result = buildTransformationPlanFromMapping(spec);
assert.equal(result.ok, true);
assert.ok(result.plan.steps.some(step => step.type === "GROUP_MEMBERSHIP"));
assert.ok(result.plan.steps.some(step => step.type === "EMIT_CANONICAL"));
assert.equal(validateTransformationPlan(result.plan).ok, true);
assert.ok(describeTransformationPlan(result.plan).some(line => line.includes("Group")));
const changed = buildTransformationPlanFromMapping({ ...spec, mappingRevision: spec.mappingRevision + 1 });
assert.notEqual(changed.plan.planFingerprint, result.plan.planFingerprint);

console.log("transformation plan tests passed.");
