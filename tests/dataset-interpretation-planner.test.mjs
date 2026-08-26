import assert from "node:assert/strict";
import { profileDatasetFiles } from "../src/agent/datasetProfiler.js";
import { profileDatasetRelationships } from "../src/agent/datasetRelationshipProfiler.js";
import { validateDatasetInterpretationDraft } from "../src/agent/datasetInterpretationDraftValidator.js";
import { buildDatasetInterpretationPrompt } from "../src/agent/prompts/datasetInterpretationPrompt.js";
import { planDatasetInterpretation } from "../src/agent/datasetInterpretationPlanner.js";

const datasetProfile = profileDatasetFiles([
  { name: "papers.csv", text: "paper_id,title\np1,One\n" },
  { name: "authorships.csv", text: "paper_id,author_id\np1,a1\n" },
]);
const relationshipEvidence = profileDatasetRelationships(datasetProfile);
const validDraft = {
  task: "plan_dataset_interpretation",
  classification: "interpretation",
  summary: "Authorships links authors to papers.",
  parseModeRecommendation: "grouped",
  groups: [{ label: "Authorship", kind: "static_graph", fileNames: ["papers.csv", "authorships.csv"], confidence: "high", reason: "Shared paper_id.", evidenceIds: relationshipEvidence.slice(0, 1).map(e => e.id) }],
  fileRoles: [
    { fileName: "papers.csv", groupLabel: "Authorship", role: "hyperedge_table", useAsInput: true, confidence: "high", reason: "paper_id key." },
    { fileName: "authorships.csv", groupLabel: "Authorship", role: "membership", useAsInput: true, confidence: "high", reason: "paper_id and author_id." },
  ],
  relationships: [],
  entitySuggestions: [{ entityType: "hyperedge", sourceFile: "papers.csv", keyColumns: ["paper_id"], labelColumn: "title", confidence: "high" }],
  clarifications: [],
  warnings: [],
  assumptions: [],
  confidence: "high",
};
assert.equal(validateDatasetInterpretationDraft(validDraft, { datasetProfile, relationshipEvidence }).ok, true);
assert.equal(validateDatasetInterpretationDraft({ ...validDraft, fileRoles: [{ ...validDraft.fileRoles[0], fileName: "invented.csv" }] }, { datasetProfile, relationshipEvidence }).ok, false);
assert.ok(buildDatasetInterpretationPrompt({ datasetProfile, relationshipEvidence }).promptChars > 0);

const planned = await planDatasetInterpretation({
  config: { model: "mock" },
  datasetProfile,
  relationshipEvidence,
  generate: async () => JSON.stringify(validDraft),
});
assert.equal(planned.ok, true);
assert.equal(planned.draft.summary, validDraft.summary);

const aborted = await planDatasetInterpretation({
  config: { model: "mock" },
  datasetProfile,
  generate: async () => { const error = new Error("stopped"); error.name = "AbortError"; throw error; },
});
assert.equal(aborted.ok, false);
assert.equal(aborted.aborted, true);

console.log("dataset interpretation planner tests passed.");
