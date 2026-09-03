import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = path => readFile(join(root, path), "utf8");

const packageJson = JSON.parse(await read("package.json"));
assert.equal(packageJson.name, "hypergraph-converter-studio");
assert.equal(packageJson.version, "7.3.14");

for (const file of [
  "src/agent/graphMutationDraftSchema.js",
  "src/agent/graphMutationDraftValidator.js",
  "src/agent/graphMutationModelPlanner.js",
  "src/agent/prompts/graphMutationPlannerPrompt.js",
]) {
  assert.equal(existsSync(join(root, file)), true, `${file} must exist`);
}

const app = await read("src/App.jsx");
assert.match(app, /planGraphMutationWithModel/, "App must call the model planner");
assert.match(app, /resolveGraphMutationDraftToPlan/, "App must resolve drafts deterministically");
assert.match(app, /compileGraphMutationGrammar/, "deterministic graph compiler remains integrated");
assert.doesNotMatch(app, /interpretGraphMutationRequest\(rawQuery/, "runtime must not hand raw graph text to the legacy interpreter");
assert.match(app, /previewGraphMutation\(hes \?\? \[\], resolved\.plan/, "model drafts are previewed by existing deterministic preview");

const chat = await read("src/components/AgentChatPanel.jsx");
const noopIndex = chat.indexOf("result.graphChanged === false");
const pendingIndex = chat.indexOf("setPendingAction({", noopIndex);
assert.ok(noopIndex > 0 && pendingIndex > noopIndex, "no-op branch must happen before graph-mutation confirmation staging");
assert.match(chat, /pendingAction\.actionType === "apply_graph_mutation"/, "pending graph mutations have a correction-aware gate");
assert.match(chat, /isPlausibleGraphMutationText\(query, \{ pendingAction \}\)/, "pending correction text can replace staged plans");
assert.match(chat, /describePendingMutationImpact/, "pending preview questions can be answered without replacement");

const planner = await read("src/agent/graphMutationModelPlanner.js");
assert.match(planner, /createMutationPlan/, "resolved model drafts must become existing GraphMutationPlans");
assert.match(planner, /source: "conversation_model_planner"/);
assert.doesNotMatch(planner, /commitGraph/, "model planner must not commit graph state");
assert.doesNotMatch(planner, /commitGraph\(.*draft/s, "raw draft must not be committed");

const prompt = await read("src/agent/prompts/graphMutationPlannerPrompt.js");
assert.match(prompt, /attached format schema/);
assert.match(prompt, /Modifiers such as/);
assert.match(prompt, /not_mutation/);
assert.match(prompt, /Set previewOnly/);

const client = await read("src/agent/localModelClient.js");
assert.match(client, /think: false/, "Ollama think:false is preserved");

const schemas = await read("src/agent/modelSchemas.js");
assert.match(schemas, /plan_graph_mutation/, "structured GraphMutationDraft schema is registered");

for (const doc of [
  "docs/V7_2_1_REMEDIATION.md",
  "docs/CONVERSATIONAL_MUTATION_PLANNER.md",
  "docs/V7_2_1_TEST_REPORT.md",
]) {
  assert.equal(existsSync(join(root, doc)), true, `${doc} must exist`);
}

assert.doesNotMatch(`${app}\n${chat}\n${planner}`, /openai|gemini|apiKey|api_key|LangGraph/i, "no cloud/API/LangGraph shortcut added");

console.log("v7.2.1 regression source tests passed.");
