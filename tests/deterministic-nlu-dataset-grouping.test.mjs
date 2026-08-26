import assert from "node:assert/strict";
import { buildDatasetMappingSpecV2FromBatch } from "../src/agent/deterministicMappingV2.js";
import { buildDeterministicDatasetMappingPatch } from "../src/agent/deterministicDatasetMappingPatch.js";
import { validateDatasetMappingPatchDraft } from "../src/agent/datasetMappingPatchValidator.js";

const files = [
  { fileId: "f1", fileName: "graph_2024.csv", format: "csv", columns: [{ name: "h" }, { name: "v" }] },
  { fileId: "f2", fileName: "graph_2025.csv", format: "csv", columns: [{ name: "h" }, { name: "v" }] },
  { fileId: "f3", fileName: "graph_2026.csv", format: "csv", columns: [{ name: "h" }, { name: "v" }] },
  { fileId: "f4", fileName: "expected.json", format: "json", columns: [] },
];
const batch = {
  id: "grouping-batch",
  version: 1,
  parseMode: "grouped",
  files: files.map(file => ({ name: file.fileName })),
  datasetProfile: { files },
  datasetGroups: [{ id: "group-main", label: "main", kind: "static_graph", fileNames: files.map(file => file.fileName), status: "draft" }],
  relationshipEvidence: [],
};
const mappingSpec = buildDatasetMappingSpecV2FromBatch(batch);
const result = buildDeterministicDatasetMappingPatch("The first two CSVs belong together. graph_2026.csv is separate, and expected.json is only for validation.", {
  batch,
  mappingSpec,
  datasetProfile: batch.datasetProfile,
});
const ops = result.draft.operations.map(operation => operation.type);
assert(ops.includes("SET_PARSE_MODE"));
assert(ops.includes("CREATE_GROUP"));
assert(ops.includes("MOVE_FILE_TO_GROUP"));
assert(ops.includes("MARK_VALIDATION_FILE"));
assert.equal(validateDatasetMappingPatchDraft(result.draft, {
  fileNames: files.map(file => file.fileName),
  headersByFile: Object.fromEntries(files.map(file => [file.fileName, file.columns.map(column => column.name)])),
  groupIds: ["group-main"],
}).ok, true);

console.log("deterministic NLU dataset grouping tests passed.");
