import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { availableReactActions } from "../src/agent/orchestratorCapabilities.js";
import { reactOrchestratorEnabled } from "../src/agent/reactOrchestratorConfig.js";

const panel = await readFile(new URL("../src/components/AgentChatPanel.jsx", import.meta.url), "utf8");
const app = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
const legacyPrompt = await readFile(new URL("../src/agent/prompts/ollamaOrchestratorPrompt.js", import.meta.url), "utf8");

// Additive ownership boundaries remain visible: App owns Ollama, the panel owns
// typed dispatch/confirmation, and the legacy plan path remains available.
assert.match(app, /runExclusiveLocalModelTask\(\{/);
assert.match(app, /runReactOrchestratorStep/);
assert.match(panel, /dispatchOllamaActionPlan\(capabilityActionPlan/);
assert.match(panel, /stageConfirmation: step => executeReactCapability/);
assert.match(panel, /runOllamaOrchestrator/);
assert.match(panel, /if \(canUseOllamaOrchestrator\)/, "legacy ActionPlan migration path must remain present");
assert.match(legacyPrompt, /ORCHESTRATOR_POLICY_PROMPT/, "legacy and ReAct planning must share the hardened policy");

// Feature-off is explicit and does not remove the legacy route.
assert.equal(reactOrchestratorEnabled("false"), false);
assert.equal(reactOrchestratorEnabled("0"), false);
assert.equal(reactOrchestratorEnabled("true"), true);

// Live capability filtering is fail-closed around files, graph, pending consent,
// known formats, and the specialist review/apply boundary.
const base = {
  upload: { fileCount: 2, requiresReupload: false },
  dataset: { available: true },
  formatDetection: { status: "unsupported" },
  grouping: { status: "together" },
  customParser: { triggerPolicy: "specialist", runReady: false, applyReady: false },
  graph: { available: false },
  pendingConfirmation: null,
};
const unsupported = availableReactActions(base);
assert.ok(unsupported.includes("START_CUSTOM_PARSER_WORKFLOW"));
assert.equal(unsupported.includes("PARSE_ACTIVE_BATCH"), false);
assert.equal(unsupported.includes("RUN_CUSTOM_PARSER"), false);
assert.equal(unsupported.includes("APPLY_CUSTOM_RESULT"), false);
assert.equal(unsupported.includes("CLEAR_GRAPH"), false);
assert.deepEqual(availableReactActions({ ...base, pendingConfirmation: { actionType: "RUN_CUSTOM_PARSER" } }), []);
assert.equal(availableReactActions({ ...base, upload: { fileCount: 0, requiresReupload: true } }).includes("START_CUSTOM_PARSER_WORKFLOW"), false);
assert.equal(availableReactActions({ ...base, formatDetection: { status: "supported" }, customParser: { ...base.customParser, triggerPolicy: "builtin" } }).includes("START_CUSTOM_PARSER_WORKFLOW"), false);

// The transient continuation validates both dataset identity and the exact
// pre-clarification state token before dispatching a grouping mutation.
assert.match(panel, /continuation\.datasetId !== current\.activeBatchId/);
assert.match(panel, /currentReactObservation\(\)\.stateVersionToken !== continuation\.stateVersionToken/);
assert.doesNotMatch(panel, /sessionStorage.*reactContinuation|localStorage.*reactContinuation/);

console.log("Scope 2 additive integration, feature flag, legacy coexistence, capability filtering, and transient continuation tests passed.");
