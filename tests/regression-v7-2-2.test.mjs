import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = path => readFile(join(root, path), "utf8");

const packageJson = JSON.parse(await read("package.json"));
assert.equal(packageJson.name, "hypergraph-converter-studio");
assert.equal(packageJson.version, "7.3.14");

for (const file of [
  "src/agent/localModelRequestCoordinator.js",
  "src/agent/localModelRuntimeState.js",
  "src/agent/ollamaMetrics.js",
  "src/agent/graphConversationReferences.js",
  "docs/V7_2_2_REMEDIATION.md",
  "docs/LOCAL_MODEL_RUNTIME_RELIABILITY.md",
  "docs/V7_2_2_TEST_REPORT.md",
]) {
  assert.equal(existsSync(join(root, file)), true, `${file} must exist`);
}

const app = await read("src/App.jsx");
assert.match(app, /createLocalModelRequestCoordinator/);
assert.match(app, /runExclusiveLocalModelTask/);
assert.match(app, /stopLocalModelRequest/);
assert.match(app, /localModelGeneration/);
assert.match(app, /recentReferenceContext\(graphConversationReferences\)/);
assert.match(app, /runGraphPlannerReadinessDiagnostic/);

const panel = await read("src/components/AgentChatPanel.jsx");
assert.match(panel, /submissionCoordinatorRef/);
assert.match(panel, /createSubmissionRequestCoordinator/);
assert.doesNotMatch(panel, /requestInFlightRef/);
assert.match(panel, /The local assistant is already working/);
assert.match(panel, /agentActions\.stopLocalModelRequest/);
assert.match(panel, /Selection <strong>/);

const prompt = await read("src/agent/prompts/graphMutationPlannerPrompt.js");
assert.doesNotMatch(prompt, /responseSchema:\s*GRAPH_MUTATION_DRAFT_SCHEMA[^,]*,/);
assert.doesNotMatch(prompt, /Schema:\s*\$\{JSON\.stringify\(GRAPH_MUTATION_DRAFT_SCHEMA\)\}/);
assert.match(prompt, /MAX_RECENT_CONVERSATION = 4/);

const planner = await read("src/agent/graphMutationModelPlanner.js");
assert.match(planner, /graph_mutation_planner_total/);
assert.match(planner, /skipped_insufficient_budget/);
assert.match(planner, /request_aborted/);
assert.match(planner, /fallbackAllowed: classification !== "request_aborted"/);
assert.doesNotMatch(planner, /Schema:\s*\$\{JSON\.stringify\(GRAPH_MUTATION_DRAFT_SCHEMA\)\}/);

const client = await read("src/agent/localModelClient.js");
assert.match(client, /onMetrics/);
assert.match(client, /keep_alive/);
assert.match(client, /request_aborted/);
assert.match(client, /model_generation_timeout/);
assert.match(client, /think: false/);

const schema = await read("src/agent/graphMutationDraftSchema.js");
assert.doesNotMatch(schema, /operations:[\s\S]*oneOf:/);
assert.match(schema, /GRAPH_MUTATION_DRAFT_SUPPORTED_OPS/);

assert.doesNotMatch(`${app}\n${panel}\n${planner}\n${client}`, /openai|gemini|apiKey|api_key|LangGraph/i);

console.log("v7.2.2 regression source tests passed.");
