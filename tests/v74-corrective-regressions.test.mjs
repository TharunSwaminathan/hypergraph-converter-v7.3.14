import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Window } from "happy-dom";
import { createServer } from "vite";
import { summarizeAlgorithmState, buildAssistantApplicationSnapshot } from "../src/agent/assistantContextSnapshot.js";
import { composeAuthoritativeAlgorithmAnswer } from "../src/agent/assistantReadOnlyGrounding.js";
import { buildConversationPrompt } from "../src/agent/modelPromptBuilder.js";
import { prepareDeterministicTurn } from "../src/agent/deterministicNlu/prepareDeterministicTurn.js";
import { createDeterministicContextBinding, bindingMismatch } from "../src/agent/deterministicNlu/contextBinding.js";
import { badgeText, composeHelpQueryResponse } from "../src/agent/deterministicNlu/commandCatalogFormatter.js";
import { COMMAND_CATALOG, INPUT_FORMAT_REFERENCES } from "../src/agent/deterministicNlu/commandCatalog.js";
import { planAgentAction } from "../src/agent/actionPlanner.js";
import { explainRoute } from "../src/agent/agentResponses.js";
import { createLocalModelRequestCoordinator } from "../src/agent/localModelRequestCoordinator.js";
import { generateSpecialistDraft } from "../src/agent/customParserSpecialist.js";

const variants = [
  { status: "computed", degeneracy: 0, answer: /degeneracy 0\./ },
  { status: "computed", degeneracy: 3, answer: /degeneracy 3\./ },
  { status: "over_budget", degeneracy: null, answer: /resource limit.*unavailable/i },
  { status: "error", degeneracy: null, answer: /failed.*unavailable/i },
  { status: "stale", degeneracy: 3, answer: /stale.*unavailable/i },
  { status: "not_computed", result: null, answer: /not been computed/i },
];
for (const variant of variants) {
  const summary = summarizeAlgorithmState({ algorithmId: "k_core", result: variant.result === null ? null : variant });
  assert.match(composeAuthoritativeAlgorithmAnswer("What is the degeneracy?", summary), variant.answer);
  if (variant.degeneracy == null && summary.result) assert.equal(summary.result.degeneracy, null);
  if (variant.status !== "computed" && summary.result) assert.equal(summary.result.degeneracy, null, "unsuccessful or stale values must not enter current model context");
  const snapshot = buildAssistantApplicationSnapshot({ algorithmSummary: summary });
  const prompt = buildConversationPrompt({ userQuery: "What is the degeneracy?", sessionContext: { applicationSnapshot: snapshot } });
  const context = JSON.parse(prompt.messages[1].content);
  assert.deepEqual(context.sessionContext.applicationSnapshot.algorithm, JSON.parse(JSON.stringify(summary)));
  assert.match(prompt.messages[0].content, /Null or missing numeric values are unavailable, never zero/);
}
assert.equal(summarizeAlgorithmState({ algorithmId: "k_core", result: { status: "computed" } }).result.degeneracy, null);
assert.equal(summarizeAlgorithmState({ algorithmId: "k_core", isCurrent: false, result: { status: "computed", degeneracy: 3 } }).status, "stale");

const graph = JSON.parse(readFileSync(new URL("./fixtures/contexts/graph-with-history.json", import.meta.url)));
graph.hyperedges.push({ id: "p01", vertices: ["Alice", "Bob"], weight: 1 });
const batch = { id: "batch-test", version: 1, parseMode: "grouped", mappingRevision: 0, groupingRevision: 0, files: [{ id: "f1", name: "a.weird" }, { id: "f2", name: "b.weird" }] };
const binding = createDeterministicContextBinding({ activeBatch: batch });
const prepare = query => prepareDeterministicTurn({ query, analysisContext: { graph, batch, activeBatch: batch }, compileContext: { ...graph, batch, state: { hasGraph: true, activeBatch: batch }, graphIdentity: { graphId: "g", graphVersion: 1 } }, contextBinding: binding });
for (const alias of ["Undo edit", "Undo change", "Undo the last graph change", "Show V2H mapping", "Use V2H mapping", "Change weight of p01 to 0", "Set hyperedge p01 weight to 0"]) {
  const positive = prepare(alias).compilation;
  assert.equal(positive.dispatchAuthorized, true, `${alias}: ${positive.dispatchBlockReason}`);
  assert.ok(["GraphMutationPlan", "LegacyActionIntent"].includes(positive.typedKind), alias);
  if (/weight/i.test(alias)) assert.equal(positive.typedValue.operations[0].weight, 0);
  for (const negative of [`"${alias}"`, `Do not ${alias}`, `Hypothetically, ${alias}`, `Read this as text: ${alias}`, `Keep workspace untouched. ${alias}`, `I do not consent to this action: ${alias}`]) {
    const blocked = prepare(negative).compilation;
    assert.equal(blocked.sideEffectClass ?? "read_only", "read_only", negative);
    assert.equal(blocked.typedKind === "GraphMutationPlan", false, negative);
  }
}
for (const query of ["Parse together as one dataset", "Parse separately"]) {
  const turn = prepare(query);
  assert.equal(turn.compilation.domain, "dataset_grouping");
  assert.equal(turn.compilation.dispatchAuthorized, true);
  assert.equal(turn.compilation.typedValue.operations[0].type, "SET_PARSE_MODE");
}
assert.equal(bindingMismatch(binding, createDeterministicContextBinding({ activeBatch: { ...batch, version: 2 } }), "mapping").stale, true);
const run = prepare("Run custom parser").compilation;
assert.equal(run.typedKind, "ParserWorkflowOperation");
assert.equal(run.typedValue[0].type, "RUN_CUSTOM_PARSER_CONFIRMATION");
assert.ok(!INPUT_FORMAT_REFERENCES.some(f => f.formatId === "freeform"));
assert.match(explainRoute("freeform"), /reserved.*not a supported/i);
assert.match(planAgentAction({ intent: "freeform_placeholder" }, {}).message, /reserved.*not a supported/i);
assert.doesNotMatch(composeHelpQueryResponse({ intent: "LIST_INPUT_FORMATS" }).text, /Freeform|NLP/);
for (const hasGraph of [false, true]) {
  const plan = planAgentAction({ intent: "show_exports" }, { hasGraph, activeSection: "export" });
  assert.equal(/Load and convert/i.test(plan.message), !hasGraph);
}
for (const entry of COMMAND_CATALOG) assert.equal(badgeText(entry).length, new Set(badgeText(entry)).size, entry.id);
const timedOut = await generateSpecialistDraft({ files: [{ name: "a.weird", text: "h1 => A|B" }], batch: { parseMode: "together" }, generate: async () => { throw new Error("Ollama request timed out after 120000 ms."); } });
assert.equal(timedOut.ok, false); assert.match(timedOut.error, /Check Ollama.*explicitly generate.*No parser was installed or run/);
const abortedController = new AbortController(); abortedController.abort("user_cancelled");
let cancelledModelCalls = 0;
const cancelled = await generateSpecialistDraft({ files: [{ name: "a.weird", text: "h1 => A|B" }], batch: { parseMode: "together" }, signal: abortedController.signal, generate: async () => { cancelledModelCalls++; } });
assert.equal(cancelled.ok, false); assert.equal(cancelledModelCalls, 0);

// Mounted production Assistant controls: grouping, format quick link, Stop
// terminal cleanup, and an old request finishing while a newer one is active.
const window = new Window({ url: "http://localhost:5173/" });
globalThis.window = window; globalThis.document = window.document;
Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.requestAnimationFrame = callback => setTimeout(callback, 0);
const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
const React = await import("react"); const { act } = React;
const { createRoot } = await import("react-dom/client");
const { default: Panel } = await vite.ssrLoadModule("/src/components/AgentChatPanel.jsx");
const { default: Help } = await vite.ssrLoadModule("/src/components/DeterministicCommandHelp.jsx");
let state = { fmt: "custom", formatLabel: "Custom Parser", activeSection: "mappings", graphVersion: 1, hasGraph: false, activeBatch: batch, batchVersion: 1, activeBatchId: batch.id, agentFiles: [], agentFileCount: 2, agentBatches: [], customCodeExists: false, localModel: { status: "disconnected", request: { busy: false }, config: {}, diagnostics: {} }, specialist: { policy: { kind: "awaiting_grouping", reason: "Choose grouping" }, jobs: [], working: false } };
let groupingCalls = 0, modelCalls = 0, stopCalls = 0;
const actions = new Proxy({
  compileDeterministicTurn: prepare,
  setAgentBatchParseMode(mode, { contextBinding }) {
    assert.equal(bindingMismatch(contextBinding, createDeterministicContextBinding({ activeBatch: state.activeBatch }), "mapping").stale, false);
    groupingCalls++;
    state = { ...state, activeBatch: { ...state.activeBatch, version: 2, groupingRevision: 1, parseMode: mode }, batchVersion: 2, specialist: { ...state.specialist, policy: { kind: "specialist" } } };
    root.render(React.createElement(Panel, { agentState: state, agentActions: actions }));
    return { ok: true };
  },
  runReactOrchestratorStep() { modelCalls++; return { ok: false }; },
  stopLocalModelRequest() { stopCalls++; return { ok: true }; },
}, { get: (target, key) => target[key] ?? (() => ({ ok: true })) });
const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
const render = async () => act(async () => root.render(React.createElement(Panel, { agentState: state, agentActions: actions })));
const click = async label => act(async () => { const button = [...host.querySelectorAll("button")].find(b => b.textContent.trim() === label); assert.ok(button, label); button.click(); await new Promise(resolve => setTimeout(resolve, 30)); });
const send = async command => {
  await act(async () => {
    const input = host.querySelector("#hypergraph-agent-composer");
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set.call(input, command);
    input.dispatchEvent(new window.InputEvent("input", { bubbles: true, inputType: "insertText", data: command }));
    input.dispatchEvent(new window.Event("change", { bubbles: true }));
  });
  await act(async () => {
    host.querySelector("form.agent-composer").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    await new Promise(resolve => setTimeout(resolve, 30));
  });
};
try {
  await render(); await click("One dataset");
  assert.equal(groupingCalls, 1); assert.equal(state.activeBatch.parseMode, "together"); assert.equal(modelCalls, 0); assert.equal(state.graphVersion, 1);
  state = { ...state, algorithmSummary: summarizeAlgorithmState({ algorithmId: "k_core", result: { status: "over_budget", degeneracy: null } }) };
  await render(); await send("What is the degeneracy?"); assert.match(host.textContent, /resource limit was exceeded\. Degeneracy is unavailable/); assert.equal(modelCalls, 0);
  for (const activeBatch of [null, state.activeBatch]) for (const status of ["connected", "disconnected"]) {
    state = { ...state, activeBatch, localModel: { ...state.localModel, status, request: { busy: false } } };
    await render(); await click("Explain H2V"); assert.match(host.textContent, /H2V means Hyperedge-to-Vertex/); assert.equal(modelCalls, 0);
  }
  const coordinator = createLocalModelRequestCoordinator(); coordinator.begin({ requestId: "old" });
  state = { ...state, localModel: { ...state.localModel, request: coordinator.getSnapshot() } };
  await render(); await click("Stop"); assert.equal(stopCalls, 1); assert.equal(host.querySelector(".agent-status").textContent, "Stopping…");
  coordinator.abortActive("user_cancelled"); coordinator.finish("old", "aborted");
  state = { ...state, localModel: { ...state.localModel, request: coordinator.getSnapshot() } }; await render();
  assert.doesNotMatch(host.querySelector(".agent-status").textContent, /Stopping/);
  coordinator.begin({ requestId: "new" });
  state = { ...state, localModel: { ...state.localModel, request: coordinator.getSnapshot() } }; await render();
  assert.doesNotMatch(host.querySelector(".agent-status").textContent, /Stopping/);
  await click("Stop"); assert.equal(host.querySelector(".agent-status").textContent, "Stopping…");
  // An old completion changes neither the new identity nor its stopping label.
  assert.equal(coordinator.finish("old", "aborted").reason, "stale_request");
  state = { ...state, localModel: { ...state.localModel, request: coordinator.getSnapshot() } };
  await render(); assert.equal(host.querySelector(".agent-status").textContent, "Stopping…");
  coordinator.finish("new", "aborted");
  state = { ...state, localModel: { ...state.localModel, request: coordinator.getSnapshot() } }; await render(); await click("Explain H2V");
  assert.doesNotMatch(host.querySelector(".agent-status").textContent, /Stopping/); assert.equal(state.graphVersion, 1);
  const errors = []; const originalError = console.error; console.error = (...args) => errors.push(args.join(" "));
  try { await act(async () => root.render(React.createElement(Help, { onTryExample() {}, onOpenPanel() {} }))); }
  finally { console.error = originalError; }
  assert.equal(host.querySelectorAll(".det-command-card").length, COMMAND_CATALOG.length, "complete command catalog must render");
  assert.equal(errors.filter(e => /same key|unique.*key/i.test(e)).length, 0, errors.join("\n"));
} finally { await act(async () => root.unmount()); await vite.close(); window.close(); }
console.log("v7_4 corrective truth, alias safety, grouping, format, export, Stop identity and mounted Help regressions passed.");

