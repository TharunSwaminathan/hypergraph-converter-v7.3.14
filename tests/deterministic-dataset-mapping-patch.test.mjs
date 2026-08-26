import assert from "node:assert/strict";
import { profileDatasetFiles } from "../src/agent/datasetProfiler.js";
import { profileDatasetRelationships } from "../src/agent/datasetRelationshipProfiler.js";
import { buildDatasetGroupingDraft } from "../src/agent/datasetGrouping.js";
import { buildDatasetMappingSpecV2FromBatch } from "../src/agent/deterministicMappingV2.js";
import { buildDeterministicDatasetMappingPatch } from "../src/agent/deterministicDatasetMappingPatch.js";
import { validateDatasetMappingPatchDraft } from "../src/agent/datasetMappingPatchValidator.js";
import { applyDatasetMappingPatch } from "../src/agent/datasetMappingPatchApplier.js";

export const regressionFiles = [
  { name: "authors.csv", text: "author_id,name,institution\na1,Alice,UNT\na2,Bob,UT Austin\na3,Carol,UNT\n" },
  { name: "papers.csv", text: "paper_id,title,year,venue\np1,Dynamic Networks,2024,SC\np2,Hypergraph Analysis,2025,IPDPS\np3,Graph Systems,2026,HiPC\n" },
  { name: "authorships.csv", text: "paper_id,author_id,position\np1,a1,1\np1,a2,2\np2,a1,1\np2,a3,2\n" },
];

export const regressionRequest = [
  "Set authors.csv as the vertex table using author_id.",
  "Set papers.csv as the hyperedge table using paper_id.",
  "Set authorships.csv as the membership table, joining author_id to authors.csv and paper_id to papers.csv.",
  "Use papers.csv year as hyperedge time.",
  "Preserve papers with no membership rows as empty hyperedges.",
].join("\n");

export function buildRegressionFixture(files = regressionFiles) {
  const datasetProfile = profileDatasetFiles(files);
  const relationshipEvidence = profileDatasetRelationships(datasetProfile);
  const grouping = buildDatasetGroupingDraft(datasetProfile, relationshipEvidence, { parseMode: "together" });
  const batch = {
    id: "batch-regression",
    version: 1,
    files,
    parseMode: "together",
    datasetProfile,
    relationshipEvidence,
    datasetGroups: grouping.groups,
    groupingRevision: 0,
    groupingQuestions: grouping.questions,
    mappingRevision: 0,
    mappingHistory: [],
  };
  const mappingSpec = buildDatasetMappingSpecV2FromBatch(batch);
  return { datasetProfile, relationshipEvidence, grouping, batch, mappingSpec };
}

const { datasetProfile, batch, mappingSpec } = buildRegressionFixture();
const fallback = buildDeterministicDatasetMappingPatch(regressionRequest, { batch, mappingSpec, datasetProfile });
assert.equal(fallback.ok, true);
assert.equal(fallback.draft.classification, "patch");

const operationTypes = fallback.draft.operations.map(operation => operation.type);
for (const type of [
  "SET_FILE_ROLE",
  "SET_FILE_KEY_COLUMNS",
  "SET_VERTEX_ENTITY_RULE",
  "SET_HYPEREDGE_ENTITY_RULE",
  "ADD_RELATIONSHIP",
  "SET_POLICY",
]) {
  assert.ok(operationTypes.includes(type), type);
}
assert.ok(fallback.draft.operations.some(operation => operation.type === "SET_FILE_ROLE" && operation.fileName === "authorships.csv" && operation.role === "membership"));

const headersByFile = Object.fromEntries(datasetProfile.files.map(file => [file.fileName, file.columns.map(column => column.name)]));
const validation = validateDatasetMappingPatchDraft(fallback.draft, {
  fileNames: datasetProfile.files.map(file => file.fileName),
  headersByFile,
  groupIds: mappingSpec.groups.map(group => group.id),
});
assert.equal(validation.ok, true, validation.errors.join("; "));

const applied = applyDatasetMappingPatch(mappingSpec, fallback.draft, { fileProfiles: datasetProfile.files });
assert.equal(applied.ok, true, applied.errors?.join("; "));
assert.equal(applied.spec.mappingRevision, 1);
assert.equal(applied.history.length, 1);
assert.equal(applied.spec.files.find(file => file.fileName === "authors.csv").role, "vertex_table");
assert.deepEqual(applied.spec.files.find(file => file.fileName === "authors.csv").keyColumns, ["author_id"]);
assert.equal(applied.spec.files.find(file => file.fileName === "papers.csv").role, "hyperedge_table");
assert.deepEqual(applied.spec.files.find(file => file.fileName === "papers.csv").keyColumns, ["paper_id"]);
assert.equal(applied.spec.files.find(file => file.fileName === "authorships.csv").role, "membership");
assert.equal(applied.spec.entities.hyperedges.find(entity => entity.sourceFile === "papers.csv").timeColumn, "year");
assert.equal(applied.spec.policies.unmatchedHyperedgeRows, "preserve_empty");
assert.equal(applied.spec.policies.emptyHyperedges, "keep");
assert.equal(applied.spec.policies.duplicateMembership, "deduplicate");
assert.ok(applied.spec.relationships.some(rel => rel.sourceFile === "authorships.csv" && rel.targetFile === "papers.csv" && rel.vertexColumns.includes("author_id")));

const noChange = applyDatasetMappingPatch(applied.spec, fallback.draft, { fileProfiles: datasetProfile.files, history: applied.history });
assert.equal(noChange.ok, true);
assert.equal(noChange.noChange, true);
assert.equal(noChange.spec.mappingRevision, 1);
assert.equal(noChange.history.length, 1);

const missingColumnFixture = buildRegressionFixture([
  { name: "authors.csv", text: "id,name,institution\na1,Alice,UNT\n" },
  regressionFiles[1],
  regressionFiles[2],
]);
const missing = buildDeterministicDatasetMappingPatch(regressionRequest, {
  batch: missingColumnFixture.batch,
  mappingSpec: missingColumnFixture.mappingSpec,
  datasetProfile: missingColumnFixture.datasetProfile,
});
assert.equal(missing.ok, true);
assert.equal(missing.draft.classification, "clarification");
assert.match(missing.clarification, /authors\.csv.*does not contain author_id/i);
assert.match(missing.clarification, /id, name, institution/i);

console.log("deterministic dataset mapping patch tests passed.");
