import assert from "node:assert/strict";
import { buildDatasetMappingSpecV2FromBatch } from "../src/agent/deterministicMappingV2.js";
import { buildDeterministicDatasetMappingPatch } from "../src/agent/deterministicDatasetMappingPatch.js";
import { validateDatasetMappingPatchDraft } from "../src/agent/datasetMappingPatchValidator.js";
import { applyDatasetMappingPatch } from "../src/agent/datasetMappingPatchApplier.js";

export function authorshipFixture() {
  const files = [
    { fileId: "f1", fileName: "authors.csv", format: "csv", columns: [{ name: "author_id" }, { name: "name" }, { name: "institution" }] },
    { fileId: "f2", fileName: "papers.csv", format: "csv", columns: [{ name: "paper_id" }, { name: "title" }, { name: "year" }] },
    { fileId: "f3", fileName: "authorships.csv", format: "csv", columns: [{ name: "paper_id" }, { name: "author_id" }] },
  ];
  const datasetGroups = [{ id: "group-main", label: "main", kind: "static_graph", fileNames: files.map(file => file.fileName), status: "draft" }];
  const batch = {
    id: "batch-authorship",
    version: 1,
    parseMode: "together",
    files: files.map(file => ({ name: file.fileName })),
    datasetProfile: { files },
    datasetGroups,
    relationshipEvidence: [],
  };
  return { files, batch, mappingSpec: buildDatasetMappingSpecV2FromBatch(batch) };
}

const { files, batch, mappingSpec } = authorshipFixture();
const request = `Make authors.csv the node table and papers.csv the groups.
Authorships tells which authors belong to which paper.
Use author_id for the nodes and paper_id for the papers.
Keep papers that do not have any authors.`;
const result = buildDeterministicDatasetMappingPatch(request, { batch, mappingSpec, datasetProfile: batch.datasetProfile });
assert.equal(result.ok, true);
assert.equal(result.draft.classification, "patch");
assert.equal(result.diagnostics.plannerPath, "deterministic_nlu");
assert(result.draft.operations.some(operation => operation.type === "ADD_RELATIONSHIP"));
assert(result.draft.operations.some(operation => operation.type === "SET_POLICY" && operation.policy === "unmatchedHyperedgeRows" && operation.value === "preserve_empty"));

const validation = validateDatasetMappingPatchDraft(result.draft, {
  fileNames: files.map(file => file.fileName),
  headersByFile: Object.fromEntries(files.map(file => [file.fileName, file.columns.map(column => column.name)])),
  groupIds: ["group-main"],
});
assert.equal(validation.ok, true);
const applied = applyDatasetMappingPatch(mappingSpec, validation.draft, { fileProfiles: files });
assert.equal(applied.ok, true);
assert.equal(applied.spec.files.find(file => file.fileName === "authors.csv").role, "vertex_table");
assert.deepEqual(applied.spec.files.find(file => file.fileName === "papers.csv").keyColumns, ["paper_id"]);
assert.equal(applied.spec.policies.unmatchedHyperedgeRows, "preserve_empty");

const missing = structuredClone(batch);
missing.datasetProfile = {
  files: [
    { fileId: "f1", fileName: "authors.csv", format: "csv", columns: [{ name: "id" }, { name: "name" }, { name: "institution" }] },
  ],
};
missing.files = [{ name: "authors.csv" }];
missing.datasetGroups = [{ id: "group-main", label: "main", kind: "static_graph", fileNames: ["authors.csv"], status: "draft" }];
const missingSpec = buildDatasetMappingSpecV2FromBatch(missing);
const clarification = buildDeterministicDatasetMappingPatch("Use author_id for authors.csv.", { batch: missing, mappingSpec: missingSpec, datasetProfile: missing.datasetProfile });
assert.equal(clarification.ok, true);
assert.equal(clarification.draft.classification, "clarification");
assert.match(clarification.clarification, /does not contain author_id/i);

console.log("deterministic NLU dataset mapping tests passed.");
