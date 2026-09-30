import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { createServer } from "vite";
import { controlsHarness } from "./fixtures/candy-scope5d-controls.mjs";
import { compileGraphMutationGrammar } from "../src/agent/deterministicNlu/domains/graphMutationGrammar.js";
import { graphIdentityFromState } from "../src/graph/graphState.js";
import { previewGraphMutation } from "../src/graph/graphMutationPreview.js";
import { validateReactActionArguments, availableReactActions } from "../src/agent/orchestratorCapabilities.js";
import { buildAuthoritativeOrchestratorObservation, observationStillCurrent } from "../src/agent/orchestratorObservation.js";
import { runBoundedOrchestrator } from "../src/agent/orchestratorLoop.js";
import { authorizeDynamicUpdateAction } from "../src/agent/dynamicUpdatePolicy.js";
import { motifApplicationBinding } from "../src/candy/motifPreflight.js";

const { h, controls, getCandy, selector } = await controlsHarness();
controls.discard(selector());
let modelCalls = 0, navigations = 0;
const state = () => ({ fmt: "simple", formatLabel: "H2V / Simple", activeSection: "mappings", expId: "h2v_txt",
  graphView: "hypergraph", graphLayout: "force", graphSearch: "", vizLimit: 50, hasGraph: true,
  ...graphIdentityFromState(h.graph), graphType: h.graph.graphType, graphHyperedges: h.graph.hyperedges,
  hyperedgeCount: h.graph.hyperedges.length, vertexCount: 4, incidenceCount: 6,
  batchVersion: 0, customCodeVersion: 0, customResultId: null, activeBatchId: null, activeBatch: null,
  agentFiles: [], agentBatches: [], agentFileCount: 0, graphHistoryCount: 0, pendingDynamicUpdate: controls.observe(),
  reactOrchestratorEnabled: false, candy: { ...getCandy().state, status: "ready", graphType: h.graph.graphType,
    applicationBinding: motifApplicationBinding(h.graph, h.pending.getCurrent()), edgeCount: h.graph.hyperedges.length,
    pendingUpdateContext: h.pending.getCurrent()?.status === "VALIDATED" ? { updateId: h.pending.getCurrent().updateId } : null },
  localModel: { status: "disconnected", banner: "Disconnected", request: {}, generation: {}, requestHistory: [], diagnostics: { commands: {} },
    config: { enabled: false, model: "qwen3:8b", runtime: "ollama" } },
});
const observation = () => buildAuthoritativeOrchestratorObservation({ state: state() });
for (const action of ["DISCARD_DYNAMIC_HYPERGRAPH_UPDATE", "ANALYZE_DYNAMIC_HYPERGRAPH_UPDATE", "APPLY_DYNAMIC_HYPERGRAPH_UPDATE"]) {
  for (const value of [{}, { updateId: "x", revision: 1 }, { updateId: "pending-abc", revision: 0 }, { updateId: "pending-abc", revision: 1, token: "x" }]) assert.ok(validateReactActionArguments(action, value).length);
}
for (const field of ["plan", "pendingUpdate", "motifUpdate", "updateDigest", "proposedGraphFingerprint", "runtimeRequest", "artifactId", "requestDigest", "nativePath", "credentials", "candidateSets"]) {
  assert.ok(validateReactActionArguments("STAGE_DYNAMIC_HYPERGRAPH_UPDATE", { [field]: "forged" }).length);
}
assert.equal(availableReactActions({ graph: { available: true, graphType: "Hypergraph" } }).some(name => name.includes("DYNAMIC_HYPERGRAPH")), false);
assert.equal(authorizeDynamicUpdateAction("APPLY_DYNAMIC_HYPERGRAPH_UPDATE", "do not apply the pending update").allowed, false);

// AS10: stale observation is rejected and re-observed before one bounded action.
await controls.stageBatch("DELETE h2");
const before = observation();
await controls.stageBatch("DELETE h1"); const after = observation();
assert.equal(observationStillCurrent(before, after), false);
assert.doesNotMatch(JSON.stringify(after.pendingDynamicUpdate), /vertices|digest|artifact|token|plan|path/i);
let observations = 0, dispatched = 0;
const outcome = await runBoundedOrchestrator({ userQuery: "discard the pending update", preflight: false,
  getObservation: () => ++observations < 3 ? before : after,
  callModel: () => ({ ok: true, step: { outcome: "PROPOSE_ACTION", action: "DISCARD_DYNAMIC_HYPERGRAPH_UPDATE",
    arguments: { updateId: "pending-stale", revision: 1 }, requiresUserInput: false, userMessage: null, finish: false } }),
  authorizeAction: () => ({ allowed: true }), stageConfirmation() {}, executeAction: () => { dispatched++; return { ok: false, stop: true }; }, maxSteps: 2,
});
assert.equal(dispatched, 1); assert.ok(observations >= 5); assert.equal(outcome.metrics.iterations, 2);
controls.discard(selector());

const window = new Window({ url: "http://localhost:5173/" });
Object.assign(globalThis, { window, document: window.document, HTMLElement: window.HTMLElement, Event: window.Event,
  InputEvent: window.InputEvent, MouseEvent: window.MouseEvent, HTMLTextAreaElement: window.HTMLTextAreaElement,
  requestAnimationFrame: callback => setTimeout(() => callback(Date.now()), 0), cancelAnimationFrame: clearTimeout,
  IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
try {
  const React = await import("react"), { act } = React, { createRoot } = await import("react-dom/client");
  const { default: Chat } = await vite.ssrLoadModule("/src/components/AgentChatPanel.jsx");
  const { prepareDeterministicTurn } = await vite.ssrLoadModule("/src/agent/deterministicNlu/prepareDeterministicTurn.js");
  const actions = new Proxy({
    prepareGraphMutation(query) {
      const result = compileGraphMutationGrammar(query, { hyperedges: h.graph.hyperedges, graphIdentity: graphIdentityFromState(h.graph) });
      if (!result.ok) return result;
      const preview = previewGraphMutation(h.graph.hyperedges, result.plan, graphIdentityFromState(h.graph));
      return { ...result, preview, graphChanged: preview.graphChanged };
    },
    compileDeterministicTurn(query, options = {}) { return prepareDeterministicTurn({ query, analysisContext: { pendingAction: options.pendingAction },
      compileContext: { hyperedges: h.graph.hyperedges, graphIdentity: graphIdentityFromState(h.graph), pendingAction: options.pendingAction } }); },
    stageDynamicUpdatePlan: controls.stagePlan, discardDynamicUpdate: controls.discard,
    requestDynamicUpdateApply: controls.requestApply, confirmDynamicUpdateApply: controls.confirmApply, cancelDynamicUpdateApply: controls.cancelApply,
    requestDynamicUpdateAnalysis: controls.requestAnalysis, stageCandyMotifAnalysis: h.analysis.stage, submitCandyJob: h.analysis.submit,
    runReactOrchestratorStep() { modelCalls++; return { ok: false }; },
    openDynamicUpdatePanel() { navigations++; },
    runLocalConversation() { return { ok: false, error: "Disabled for deterministic test" }; },
  }, { get(target, key) { return target[key] ?? (() => ({ ok: false, noMatch: true })); } });
  function Host() {
    React.useSyncExternalStore(h.pending.subscribe, h.pending.getCurrent, h.pending.getCurrent);
    React.useSyncExternalStore(h.analysis.subscribe, h.analysis.getSnapshot, h.analysis.getSnapshot);
    return React.createElement(Chat, { agentState: state(), agentActions: actions });
  }
  const root = createRoot(document.body.appendChild(document.createElement("div")));
  await act(async () => { root.render(React.createElement(Host)); await new Promise(resolve => setTimeout(resolve, 30)); });
  async function submit(query) {
    await act(async () => {
      const input = document.querySelector("#hypergraph-agent-composer");
      Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set.call(input, query);
      input.dispatchEvent(new window.InputEvent("input", { bubbles: true, inputType: "insertText", data: query }));
      input.dispatchEvent(new window.Event("change", { bubbles: true }));
    });
    await act(async () => { document.querySelector("form.agent-composer").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); await new Promise(resolve => setTimeout(resolve, 50)); });
  }
  assert.equal(h.counts.commits, 0); assert.equal(h.counts.submissions, 0);
  await act(async () => [...document.querySelectorAll("nav[aria-label='Quick Links'] button")].find(button => button.textContent === "Pending update").click());
  assert.equal(navigations, 1); assert.equal(h.pending.getCurrent(), null);
  await submit("delete h1"); // AS01
  assert.equal(h.pending.getCurrent()?.motifUpdate.deletions[0], "h1"); assert.equal(h.counts.commits, 0);
  await submit("replace h2 with a, c"); // AS02
  assert.equal(h.pending.getCurrent().motifUpdate.insertions[0].id, "h2");
  const second = h.pending.getCurrent();
  await submit("add hyperedge h4 with a, b and add hyperedge h5 with b, c"); // AS03
  assert.equal(h.pending.getCurrent().motifUpdate.insertions.length, 2);
  assert.equal(h.pending.getCurrent().revision, second.revision + 1, "multi-add one revision");
  const multi = h.pending.getCurrent();
  await submit("instead, replace h2 with x, y"); // AS09
  assert.equal(h.pending.getCurrent().revision, multi.revision + 1); assert.notEqual(h.pending.getCurrent().updateId, multi.updateId);
  const pending = h.pending.getCurrent();
  for (const query of ['Explain "delete h1"', "do not delete h1", "what if I delete h1?", 'Explain "apply the pending update"', "do not apply the pending update", "suppose I apply the pending update"]) { // AS07
    await submit(query); assert.equal(h.pending.getCurrent(), pending); assert.equal(h.counts.commits, 0); assert.equal(h.counts.submissions, 0);
  }
  await submit("show how motifs would change"); // AS04
  assert.ok(document.querySelector(".agent-confirmation")); assert.equal(h.counts.submissions, 0);
  await submit("Cancel pending action");
  await submit("run incremental motif analysis"); // AS05
  await submit("Confirm pending action");
  assert.equal(h.payload.request.mode, "INCREMENTAL"); assert.equal(h.payload.request.backend, "CUDA_INCREMENTAL");
  assert.equal(h.counts.commits, 0);
  await submit("apply the pending update"); // AS06
  assert.match(document.querySelector(".agent-confirmation").textContent, /does not run CANDY analysis/);
  assert.equal(h.counts.commits, 0);
  await submit("Confirm pending action");
  assert.equal(h.counts.commits, 1); assert.equal(h.counts.submissions, 1); assert.equal(h.pending.getCurrent(), null);
  assert.equal(modelCalls, 0, "deterministic lifecycle needs no model");
  await act(async () => root.unmount());
  console.log("Scope 5D mounted Assistant AS01–AS10, bounded schemas, fresh corrections, distinct approvals and inert Quick Link passed.");
} finally { await vite.close(); window.close(); }
