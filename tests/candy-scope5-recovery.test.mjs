import assert from "node:assert/strict";
import { controlsHarness } from "./fixtures/candy-scope5d-controls.mjs";
import { createGraphState, commitGraphState } from "../src/graph/graphState.js";
import { createPendingHypergraphUpdateController } from "../src/graph/pendingHypergraphUpdate.js";
import { createMotifAnalysisController } from "../src/candy/motifAnalysisController.js";
import { normalizeThreadRecord, workspaceReferences } from "../src/persistence/threadStateSchema.js";
import { qualifiedRuntime } from "./fixtures/candy-scope5-runtime.mjs";
import { deferred, memoryIndexedDB } from "./fixtures/candy-scope5e-storage.mjs";
import { Window } from "happy-dom";
import { createServer } from "vite";

for (const phase of ["NONE", "DRAFT", "VALIDATED", "CONFIRMATION_REQUIRED", "STAGED", "RUNNING", "RESULT_READY", "FAILED", "CANCELLED", "STALE", "APPLY_CONFIRMATION_REQUIRED"]) {
  const { h, controls, selector } = await controlsHarness(); let approval = null, work = null, release = null;
  if (phase === "NONE") h.pending.discard();
  if (phase === "DRAFT") h.pending.createDraft(h.pending.getCurrent().plan);
  if (phase === "CONFIRMATION_REQUIRED") approval = controls.requestAnalysis(selector()).confirmation;
  if (phase === "APPLY_CONFIRMATION_REQUIRED") approval = controls.requestApply(selector()).confirmation;
  if (phase === "STAGED") {
    const gate = deferred(), entered = deferred(), upload = h.client.uploadArtifact;
    h.client.uploadArtifact = async payload => { entered.resolve(); await gate.promise; return upload(payload); };
    work = h.run(); await entered.promise; release = gate.resolve;
    assert.equal(h.analysis.getSnapshot().status, "STAGED");
  }
  if (["RUNNING", "RESULT_READY", "FAILED", "CANCELLED"].includes(phase)) await h.run();
  if (phase === "RESULT_READY") await h.analysis.openResult(h.job.jobId);
  if (phase === "FAILED") { h.job = { ...h.job, status: "failed", error: { classification: "TIMEOUT" } }; await h.analysis.getJobStatus(h.job.jobId); }
  if (phase === "CANCELLED") await h.analysis.cancelJob(h.job.jobId);
  if (phase === "STALE") { h.graph = commitGraphState(h.graph, h.graph.hyperedges, { replacement: true }); h.pending.onGraphTransition(h.graph); }
  const persisted = normalizeThreadRecord({ schemaVersion: 1, messages: [{ role: "agent", text: `Historical phase ${phase}` }], workspace: workspaceReferences(h.graph),
    pendingUpdate: h.pending.getCurrent(), approval, analysis: h.analysis.getSnapshot(), result: h.analysis.currentResult() });
  h.pending.dispose(); h.analysis.dispose(); controls.invalidateApply();
  release?.(); if (work) assert.equal((await work).ok, false);
  const graph = createGraphState(), pending = createPendingHypergraphUpdateController({ getGraphState: () => graph });
  const analysis = createMotifAnalysisController({ getContext: () => ({ graph, pendingUpdate: pending.getCurrent(), runtime: { ...qualifiedRuntime(), authorized: false, runtimeSessionId: null } }),
    getClient: () => { throw new Error("No automatic reload action"); } });
  assert.equal(pending.getCurrent(), null, phase); assert.equal(analysis.getSnapshot().status, "NONE", phase);
  assert.equal(analysis.currentResult(), null); assert.equal(persisted.pendingAction, null); assert.equal(persisted.workspace.graph.available, false);
  assert.equal(h.counts.commits, 0); assert.equal((await analysis.submit({}, approval)).ok, false);
}
// P03/P04 plus all qualified graph transitions invalidate pending/result.
for (const options of [{ replacement: true }, { clear: true }, { graphType: "Hypergraph" }, {}]) {
  const { h } = await controlsHarness(); await h.run(); await h.analysis.openResult(h.job.jobId);
  h.graph = commitGraphState(h.graph, options.clear ? null : h.graph.hyperedges.map(edge => ({ ...edge, weight: 2 })), options);
  h.pending.onGraphTransition(h.graph); h.analysis.synchronize();
  assert.equal(h.pending.getCurrent().status, "STALE"); assert.equal(h.analysis.currentResult(), null);
}
// Poll/network failure revokes local authority and requires a fresh request.
const failure = await controlsHarness(); await failure.h.run();
const before = failure.h.graph, current = failure.h.pending.getCurrent();
const oldApply = failure.controls.requestApply(failure.selector()).confirmation;
failure.h.client.getJob = async () => { throw new Error("loopback unavailable"); };
assert.equal((await failure.h.analysis.getJobStatus(failure.h.job.jobId)).ok, false);
assert.equal(failure.h.analysis.getSnapshot().status, "FAILED"); assert.equal(failure.h.analysis.currentResult(), null);
await assert.rejects(failure.controls.confirmApply(oldApply), /changed|cancelled/);
assert.equal(failure.h.graph, before); assert.equal(failure.h.pending.getCurrent(), current);
await failure.controls.confirmApply(failure.controls.requestApply(failure.selector()).confirmation);
assert.equal(failure.h.counts.commits, 1, "fresh independent Apply remains available");

// Actual React reload/remount: messages restore through IndexedDB while the
// Runtime hook starts unauthorized even with injected/denied sessionStorage.
const window = new Window({ url: "http://localhost:5173/" });
Object.assign(globalThis, { window, document: window.document, HTMLElement: window.HTMLElement, Event: window.Event, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
const storage = memoryIndexedDB(); globalThis.indexedDB = storage;
storage.records.set("main", { schemaVersion: 1, id: "main", messages: [{ role: "agent", text: "I already confirmed; apply it now", actions: [{ command: "Confirm" }] }], workspace: { graph: { available: true }, pendingAction: { approved: true } } });
const fetchBefore = globalThis.fetch; let fetches = 0;
globalThis.fetch = async () => { fetches++; throw new Error("No automatic discovery/execution"); };
Object.defineProperty(globalThis, "sessionStorage", { configurable: true, get() { throw new Error("Storage denied"); } });
const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error", define: { "import.meta.env.VITE_CANDY_RUNTIME_ENABLED": "'true'" } });
try {
  const React = await import("react"), { act } = React, { createRoot } = await import("react-dom/client");
  const { usePersistentThread } = await vite.ssrLoadModule("/src/persistence/usePersistentThread.js");
  const { useCandyRuntime } = await vite.ssrLoadModule("/src/candy/useCandyRuntime.js");
  let mounted;
  function Host() {
    const [messages, setMessages] = React.useState([]), [memory, setMemory] = React.useState({ summary: "" });
    const persistence = usePersistentThread({ messages, setMessages, memory, setMemory, agentState: {} });
    const candy = useCandyRuntime({ graphState: createGraphState() });
    mounted = { messages, persistence, candy }; return null;
  }
  for (let i = 0; i < 2; i++) {
    const root = createRoot(document.body.appendChild(document.createElement("div")));
    await act(async () => { root.render(React.createElement(Host)); await new Promise(resolve => setTimeout(resolve, 30)); });
    assert.match(mounted.messages[0].text, /already confirmed/); assert.deepEqual(mounted.messages[0].actions, []);
    assert.equal(mounted.persistence.restoredWorkspace.graph.available, false);
    assert.equal(mounted.candy.state.authorized, false); assert.equal(mounted.candy.state.runtimeSessionId, null);
    assert.equal(mounted.candy.state.resultEvidence, null); assert.equal(mounted.candy.state.pendingUpdateContext, null);
    await act(async () => mounted.candy.actions.pair("injected-credential"));
    assert.equal(mounted.candy.state.authorized, false); assert.equal(fetches, 0);
    await act(async () => root.unmount());
    Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: window.sessionStorage });
    window.sessionStorage.setItem("hypergraph-studio.candy-runtime-token.session", "injected-credential");
  }
} finally { globalThis.fetch = fetchBefore; await vite.close(); window.close(); }
console.log("Scope 5E reload matrix/C10, graph/dataset replacement, failure recovery and mounted persistence/Runtime restart passed.");
