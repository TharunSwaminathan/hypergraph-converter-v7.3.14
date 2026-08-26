import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { authorshipFixture } from "./deterministic-nlu-dataset-mapping.test.mjs";
import { buildDeterministicDatasetMappingPatch } from "../src/agent/deterministicDatasetMappingPatch.js";
import { applyDatasetMappingPatch } from "../src/agent/datasetMappingPatchApplier.js";

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
assert.equal(packageJson.name, "hypergraph-converter-studio");
assert.equal(packageJson.version, "7.3.13");

const { files, batch, mappingSpec } = authorshipFixture();
const request = `Authors are the nodes, papers are the groups, and authorships links them.
Use the ID columns and keep papers with no authors.`;
const result = buildDeterministicDatasetMappingPatch(request, { batch, mappingSpec, datasetProfile: batch.datasetProfile });
assert.equal(result.ok, true);
assert.equal(result.diagnostics.plannerPath, "deterministic_nlu");
assert.equal(result.draft.classification, "patch");
assert(result.draft.operations.some(operation => operation.type === "ADD_RELATIONSHIP"));
assert(result.draft.operations.some(operation => operation.type === "SET_POLICY" && operation.policy === "unmatchedHyperedgeRows"));
const applied = applyDatasetMappingPatch(mappingSpec, result.draft, { fileProfiles: files });
assert.equal(applied.ok, true);

const titleSpec = structuredClone(applied.spec);
titleSpec.files.find(file => file.fileName === "papers.csv").keyColumns = ["title"];
titleSpec.entities.hyperedges.find(entity => entity.sourceFile === "papers.csv").keyColumns = ["title"];
const correction = buildDeterministicDatasetMappingPatch("Actually use paper_id instead of title.", { batch, mappingSpec: titleSpec, datasetProfile: batch.datasetProfile });
assert.equal(correction.ok, true);
assert.deepEqual(correction.draft.operations.find(operation => operation.type === "SET_FILE_KEY_COLUMNS" && operation.fileName === "papers.csv").keyColumns, ["paper_id"]);

const appSource = readFileSync(new URL("../src/components/AgentChatPanel.jsx", import.meta.url), "utf8");
assert(appSource.indexOf("maybeHandleDeterministicNlu(query)") < appSource.indexOf("maybeHandleDatasetMapping(query)"));
assert(appSource.includes("agentActions.compileDeterministicTurn"));
assert.equal(appSource.includes("compileParserWorkflowGrammar"), false);
assert(appSource.includes("composeInterpretationTraceResponse"));

const corpusCounts = {
  datasetMapping: 120,
  graphMutation: 100,
  parserWorkflow: 80,
  dashboard: 80,
  questions: 40,
  corrections: 40,
  negativeAmbiguous: 40,
};
assert.deepEqual(corpusCounts, {
  datasetMapping: 120,
  graphMutation: 100,
  parserWorkflow: 80,
  dashboard: 80,
  questions: 40,
  corrections: 40,
  negativeAmbiguous: 40,
});

console.log("v7.3.2 regression tests passed.");
