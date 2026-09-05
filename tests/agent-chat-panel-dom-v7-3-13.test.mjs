import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { createServer } from "vite";

const window = new Window({ url: "http://localhost:5173/" });
globalThis.window = window;
globalThis.document = window.document;
Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
globalThis.HTMLElement = window.HTMLElement;
globalThis.HTMLTextAreaElement = window.HTMLTextAreaElement;
globalThis.Event = window.Event;
globalThis.InputEvent = window.InputEvent;
globalThis.KeyboardEvent = window.KeyboardEvent;
globalThis.MouseEvent = window.MouseEvent;
globalThis.requestAnimationFrame = callback => setTimeout(() => callback(Date.now()), 0);
globalThis.cancelAnimationFrame = id => clearTimeout(id);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const vite = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
});

try {
  const React = await import("react");
  const { act } = React;
  const { createRoot } = await import("react-dom/client");
  const { default: AgentChatPanel } = await vite.ssrLoadModule("/src/components/AgentChatPanel.jsx");
  const { analyzeDeterministicNlu } = await vite.ssrLoadModule("/src/agent/deterministicNlu/deterministicNlu.js");
  const { compileDeterministicAction } = await vite.ssrLoadModule("/src/agent/deterministicNlu/compileDeterministicAction.js");
  const { prepareDeterministicTurn } = await vite.ssrLoadModule("/src/agent/deterministicNlu/prepareDeterministicTurn.js");

  const probe = {
    traces: [],
    prepareCalls: [],
    commitCalls: [],
    settingUpdates: [],
    latestState: null,
  };

  function baseState(overrides = {}) {
    return {
      fmt: "simple",
      formatLabel: "H2V / Simple",
      activeSection: "mappings",
      expId: "h2v_txt",
      vizLimit: 50,
      graphView: "hypergraph",
      graphLayout: "force",
      graphSearch: "",
      graphId: "graph-dom",
      graphVersion: 1,
      graphFingerprint: "fp-1",
      selectedGraphEntity: null,
      selectionLabel: "",
      selectionNotice: "",
      hasGraph: true,
      hyperedgeCount: 2,
      vertexCount: 4,
      incidenceCount: 4,
      customResultId: null,
      customCodeVersion: 1,
      customRunning: false,
      batchVersion: 0,
      activeBatchId: null,
      activeBatch: null,
      previousBatchId: null,
      agentFiles: [],
      agentFileCount: 0,
      agentBatches: [],
      agentDetection: null,
      localModel: {
        banner: "Ollama disconnected",
        status: "disconnected",
        busy: false,
        message: "Ollama is not connected.",
        generation: { status: "idle", task: "" },
        request: { busy: false },
        requestHistory: [],
        hasTrainingExample: false,
        debug: null,
        config: {
          enabled: true,
          runtime: "ollama",
          model: "qwen3:8b",
          activeBaseUrl: "",
          activeTransport: null,
          lastSuccessfulTransport: null,
          temperature: 0.1,
          timeoutMs: 60_000,
        },
        diagnostics: {
          overallStatus: "not_tested",
          deploymentInfo: {
            origin: "http://localhost:5173",
            protocol: "http:",
            hostname: "localhost",
            mode: "local_dev",
            message: "Local development mode detected.",
          },
          commands: {},
        },
        lastProbe: null,
      },
      ...overrides,
    };
  }

  function makePlan(id, query, extra = {}) {
    const changed = extra.changed !== false;
    return {
      ok: true,
      graphChanged: changed,
      pendingPlanReplaced: Boolean(extra.pendingPlanReplaced),
      acknowledgement: extra.pendingPlanReplaced
        ? "Revised graph mutation preview"
        : "Graph mutation preview",
      summary: `Plan ${id} for ${query}`,
      plan: {
        planId: id,
        planHash: `hash-${id}`,
        summary: `Plan ${id}`,
        operations: [{ type: extra.operationType ?? "ADD_VERTEX_TO_HYPEREDGE", hyperedgeId: "h2", vertexId: id }],
        metadata: {},
      },
      preview: {
        beforeFingerprint: `before-${id}`,
        afterFingerprint: changed ? `after-${id}` : `before-${id}`,
        before: { hyperedges: 2, vertices: 4, incidences: 4 },
        after: { hyperedges: 2, vertices: 5, incidences: 5 },
        delta: { hyperedges: 0, vertices: 1, incidences: 1 },
        affected: { hyperedges: ["h2"], vertices: [id] },
        warnings: [],
      },
      plannerDiagnostics: { deterministicDomProbe: true },
    };
  }

  function TestHarness() {
    const [state, setState] = React.useState(() => baseState());
    const stateRef = React.useRef(state);
    React.useEffect(() => {
      stateRef.current = state;
      probe.latestState = state;
    }, [state]);

    const actions = React.useMemo(() => new Proxy({
      compileDeterministicTurn(query, options = {}) {
        return prepareDeterministicTurn({
          query,
          analysisContext: {
            pendingAction: options.pendingAction ?? null,
            activeBatch: stateRef.current.activeBatch,
          },
          compileContext: {
            pendingAction: options.pendingAction ?? null,
            hyperedges: [
              { id: "h1", vertices: ["1", "2"] },
              { id: "h2", vertices: ["3", "4"] },
            ],
          },
          contextBinding: null,
          analyze: analyzeDeterministicNlu,
          compile: compileDeterministicAction,
        });
      },
      recordCompletedDeterministicTrace(trace) {
        probe.traces.push(trace);
        return { ok: true };
      },
      prepareGraphMutation(query, options = {}) {
        probe.prepareCalls.push({ query, hasPending: Boolean(options.pendingAction), deterministicFirst: Boolean(options.deterministicFirst) });
        if (/explain|what would|help|stop|local model|local assistant|ollama|disconnect|disable|enable/i.test(query)) {
          return { ok: false, noMatch: true };
        }
        const replacing = Boolean(options.pendingAction) && /change the pending vertex from 6 to 7/i.test(query);
        return makePlan(replacing ? "7" : "6", query, { pendingPlanReplaced: replacing });
      },
      commitGraphMutation(plan) {
        probe.commitCalls.push(plan);
        setState(current => ({
          ...current,
          graphVersion: current.graphVersion + 1,
          graphFingerprint: `fp-${current.graphVersion + 1}`,
          hyperedgeCount: 2,
          vertexCount: 5,
          incidenceCount: 5,
          hasGraph: true,
        }));
        return { ok: true, hyperedgeCount: 2, vertexCount: 5, incidenceCount: 5, warnings: [] };
      },
      updateLocalModelSettings(patch = {}) {
        let changedState = false;
        setState(current => {
          const nextConfig = { ...current.localModel.config, ...patch };
          changedState = JSON.stringify(nextConfig) !== JSON.stringify(current.localModel.config);
          if (!changedState) return current;
          return {
            ...current,
            localModel: {
              ...current.localModel,
              config: nextConfig,
              status: nextConfig.enabled === false ? "disabled" : current.localModel.status,
            },
          };
        });
        probe.settingUpdates.push({ patch, changedState });
        return { ok: true, changedState };
      },
      runLocalConversation() {
        return { ok: false, error: "Local conversation disabled in DOM probe." };
      },
      getGitHubPagesRuntimeHelp() {
        return { ok: true, message: "GitHub Pages setup help is available in README.md." };
      },
      runLocalRuntimeDiagnostics() {
        return { ok: true, message: "Diagnostics probe completed." };
      },
      copyRuntimeDiagnosticCommand() {
        return { ok: true, message: "Copied diagnostic command." };
      },
    }, {
      get(target, prop) {
        if (prop in target) return target[prop];
        return () => ({ ok: false, changedState: false, noMatch: true, error: `${String(prop)} is not implemented in this DOM probe.` });
      },
    }), []);

    return React.createElement(AgentChatPanel, { agentState: state, agentActions: actions });
  }

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(React.createElement(TestHarness));
  });

  function text() {
    return document.body.textContent.replace(/\s+/g, " ");
  }

  function textarea() {
    const node = document.querySelector("#hypergraph-agent-composer");
    assert.ok(node, "composer textarea must render");
    return node;
  }

  async function waitFor(predicate, label, timeoutMs = 1600) {
    const start = Date.now();
    let lastText = "";
    while (Date.now() - start < timeoutMs) {
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
      });
      lastText = text();
      if (predicate()) return;
    }
    assert.fail(`${label}\nLast DOM text: ${lastText.slice(-1200)}`);
  }

  async function submit(command) {
    const input = textarea();
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
      setter.call(input, command);
      input.dispatchEvent(new window.InputEvent("input", { bubbles: true, inputType: "insertText", data: command }));
      input.dispatchEvent(new window.Event("change", { bubbles: true }));
    });
    await waitFor(() => !document.querySelector("form.agent-composer button[type='submit']")?.disabled, `Send button enabled for ${command}`);
    await act(async () => {
      document.querySelector("form.agent-composer").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    });
  }

  await submit("Add vertex 6 to hyperedge h2");
  await waitFor(() => document.querySelector(".agent-confirmation"), "graph mutation should stage a confirmation card");
  assert.equal(probe.commitCalls.length, 0, "staging must not commit the graph");

  await submit("Explain \"Change the pending vertex from 6 to 7\".");
  await waitFor(() => /Explain "Change the pending vertex from 6 to 7"/.test(text()) && document.querySelector(".agent-confirmation"), "read-only pending correction should preserve the staged action");
  assert.ok(document.querySelector(".agent-confirmation"), "read-only pending text must preserve the confirmation card");
  assert.equal(probe.commitCalls.length, 0, "read-only pending text must not commit");

  await submit("What can you do?");
  await waitFor(() => document.querySelector(".agent-confirmation"), "Help while pending should preserve staged action");
  assert.equal(probe.commitCalls.length, 0, "Help while pending must not commit");

  await submit("Stop");
  await waitFor(() => /Stop requested|preserved the pending action|No pending action/.test(text()) || document.querySelector(".agent-confirmation"), "Stop while pending should be handled without committing");
  assert.ok(document.querySelector(".agent-confirmation"), "Stop while pending must preserve staged action");
  assert.equal(probe.commitCalls.length, 0, "Stop while pending must not commit");

  await submit("Change the pending vertex from 6 to 7.");
  await waitFor(() => /discarded the earlier plan and prepared the revised change/i.test(text()), "valid pending correction should replace the pending preview");
  assert.ok(document.querySelector(".agent-confirmation"), "valid pending correction should keep a fresh confirmation card");
  assert.equal(probe.commitCalls.length, 0, "valid pending correction only stages a replacement");

  await submit("Cancel pending action");
  await waitFor(() => /Pending action cancelled|Action cancelled/i.test(text()) && !document.querySelector(".agent-confirmation"), "exact text cancel should clear pending action");
  assert.equal(probe.commitCalls.length, 0, "cancelling must not commit");

  await submit("Add vertex 6 to hyperedge h2");
  await waitFor(() => document.querySelector(".agent-confirmation"), "second graph mutation should stage");
  await submit("Confirm pending action");
  await waitFor(() => /graph mutation applied and verified/i.test(text()) && !document.querySelector(".agent-confirmation"), "exact text confirm should commit and clear pending action");
  assert.equal(probe.commitCalls.length, 1, "confirm should commit exactly once");
  assert.equal(probe.latestState.vertexCount, 5, "committed graph state must be observed through React props");

  const noOpTraceCount = probe.traces.length;
  await submit("Enable local assistant");
  await waitFor(() => probe.settingUpdates.some(update => update.patch.enabled === true && update.changedState === false), "model config no-op should be observed");
  assert.equal(probe.traces.slice(noOpTraceCount).some(trace => trace?.stateMutationCommitted === true), false, "model config no-op must not be traced as a committed mutation");

  await submit("Disconnect local assistant");
  await waitFor(() => probe.settingUpdates.some(update => update.patch.enabled === false && update.changedState === true), "model config mutation should be observed");
  assert.equal(probe.latestState.localModel.config.enabled, false, "model config mutation must update state");
  assert.ok(probe.traces.some(trace => trace?.stateMutationCommitted === true), "a true settings mutation should be recorded as committed");

  await act(async () => {
    root.unmount();
  });
} finally {
  await vite.close();
  window.close();
}

console.log("v7.3.13 AgentChatPanel DOM lifecycle test passed.");
