import assert from "node:assert/strict";
import { DATASET_INTERPRETATION_DRAFT_SCHEMA } from "../src/agent/datasetInterpretationDraftSchema.js";
import { validateDatasetInterpretationDraft } from "../src/agent/datasetInterpretationDraftValidator.js";
import { DATASET_MAPPING_PATCH_SCHEMA } from "../src/agent/datasetMappingPatchSchema.js";
import { validateDatasetMappingPatchDraft } from "../src/agent/datasetMappingPatchValidator.js";

const profile = {
  files: [{ fileName: "items.csv", columns: [{ name: "id" }] }],
};
const interpretation = {
  task: "plan_dataset_interpretation",
  classification: "interpretation",
  summary: "One item table.",
  parseModeRecommendation: "together",
  groups: [{ label: "main", kind: "static_graph", fileNames: ["items.csv"], confidence: "high", reason: "input", evidenceIds: [] }],
  fileRoles: [{ fileName: "items.csv", groupLabel: "main", role: "vertex_table", useAsInput: true, confidence: "high", reason: "ids" }],
  relationships: [],
  entitySuggestions: [{ entityType: "vertex", sourceFile: "items.csv", keyColumns: ["id"], labelColumn: null, confidence: "high" }],
  clarifications: [],
  warnings: [],
  assumptions: [],
  confidence: "high",
};
assert.equal(validateDatasetInterpretationDraft(interpretation, { datasetProfile: profile }).ok, true);

for (const required of DATASET_INTERPRETATION_DRAFT_SCHEMA.required) {
  const candidate = structuredClone(interpretation);
  delete candidate[required];
  assert.equal(validateDatasetInterpretationDraft(candidate, { datasetProfile: profile }).ok, false, `missing interpretation.${required} must fail`);
}
for (const [label, mutate] of [
  ["top-level extra", value => { value.extra = true; }],
  ["group extra", value => { value.groups[0].extra = true; }],
  ["file role extra", value => { value.fileRoles[0].extra = true; }],
  ["entity extra", value => { value.entitySuggestions[0].extra = true; }],
]) {
  const candidate = structuredClone(interpretation);
  mutate(candidate);
  assert.equal(validateDatasetInterpretationDraft(candidate, { datasetProfile: profile }).ok, false, label);
}

const patch = {
  task: "plan_dataset_mapping_patch",
  classification: "patch",
  summary: "Use item ids.",
  operations: [{ type: "SET_FILE_KEY_COLUMNS", fileName: "items.csv", keyColumns: ["id"] }],
  clarificationQuestion: null,
  confidence: "high",
};
const patchContext = { fileNames: ["items.csv"], headersByFile: { "items.csv": ["id"] } };
assert.equal(validateDatasetMappingPatchDraft(patch, patchContext).ok, true);
for (const required of DATASET_MAPPING_PATCH_SCHEMA.required) {
  const candidate = structuredClone(patch);
  delete candidate[required];
  assert.equal(validateDatasetMappingPatchDraft(candidate, patchContext).ok, false, `missing patch.${required} must fail`);
}
for (const [label, mutate] of [
  ["patch top-level extra", value => { value.extra = true; }],
  ["operation extra", value => { value.operations[0].extra = true; }],
  ["relationship extra", value => { value.operations = [{ type: "UPDATE_RELATIONSHIP", relationship: { id: "r1", extra: true } }]; }],
  ["filter extra", value => { value.operations = [{ type: "UPDATE_FILTER", filter: { id: "f1", extra: true } }]; }],
]) {
  const candidate = structuredClone(patch);
  mutate(candidate);
  assert.equal(validateDatasetMappingPatchDraft(candidate, patchContext).ok, false, label);
}

console.log("dataset structured contract closure tests passed.");
