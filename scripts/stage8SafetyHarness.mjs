import { analyzeDeterministicNlu } from "../src/agent/deterministicNlu/deterministicNlu.js";
import { compileDeterministicAction } from "../src/agent/deterministicNlu/compileDeterministicAction.js";
import { dispatchCompiledAction } from "../src/agent/deterministicNlu/dispatchCompiledAction.js";
import { createRuntimeTrace } from "../src/agent/deterministicNlu/runtimeInstrumentation.js";
import { sideEffectIsStateChanging } from "../src/agent/deterministicNlu/sideEffectPolicy.js";

export function createProtectedState() {
  return {
    canonicalGraph: [{ id: "h2", vertices: ["6", "8"] }],
    graphVersion: 7,
    graphFingerprint: "graph-stage8",
    graphHistory: ["graph-stage8"],
    pendingAction: {
      actionType: "apply_graph_mutation",
      version: 3,
      nonce: "pending-stage8",
      timestamp: 1_700_000_000_000,
      plan: { operations: [{ type: "ADD_INCIDENCE", hyperedgeId: "h2", vertexId: "6" }] },
    },
    mappingSpec: { version: "2", files: [] },
    mappingRevision: 4,
    datasetGroups: [{ id: "group-main", files: ["papers.csv"] }],
    groupingRevision: 2,
    parser: { status: "ready", resultId: "parser-result-stage8", codeBinding: "code-stage8" },
    activeBatch: { id: "batch-stage8", version: 5 },
    navigation: { section: "input", view: "H2V" },
    runtime: { provider: "ollama", enabled: true },
    selectedEntity: { kind: "hyperedge", id: "h2" },
    downloadRecord: [],
    confirmation: { pending: true, owner: "pending-stage8" },
  };
}

export function stateFingerprint(value) {
  return JSON.stringify(value);
}

export async function compileAndDispatch(query, contexts, {
  pendingAction = null,
  mutate = true,
} = {}) {
  const state = createProtectedState();
  if (pendingAction) state.pendingAction = structuredClone(pendingAction);
  const before = stateFingerprint(state);
  const nlu = analyzeDeterministicNlu(query, contexts.analysisContext);
  const compilation = compileDeterministicAction(nlu, contexts.compileContext);
  const prepared = {
    ok: true,
    handled: Boolean(compilation?.handled),
    nlu,
    compilation,
    contextBinding: null,
    runtimeTrace: createRuntimeTrace({ requestId: "stage8-harness" }),
  };
  prepared.runtimeTrace.analysisCount = 1;
  prepared.runtimeTrace.compilationCount = 1;
  prepared.runtimeTrace.speechAct = compilation.speechAct;
  prepared.runtimeTrace.sideEffectClass = compilation.sideEffectClass;
  prepared.runtimeTrace.dispatchAuthorized = compilation.dispatchAuthorized !== false;
  const touch = domain => {
    if (mutate) {
      state[domain] = (state[domain] ?? 0) + 1;
      state.graphVersion += domain === "graphCalls" ? 1 : 0;
    }
    return { handled: true, outcome: "synthetic_state_change", stateMutationCommitted: mutate };
  };
  const dispatch = await dispatchCompiledAction({
    prepared,
    query,
    state,
    pendingAction: state.pendingAction,
    handlers: {
      clarification: async () => ({ handled: true, outcome: "clarification" }),
      blockedSideEffect: async () => ({ handled: true, outcome: "authorization_blocked", stateMutationCommitted: false }),
      stale: async () => ({ handled: true, outcome: "stale" }),
      contextMissing: async () => ({ handled: true, outcome: "clarification" }),
      groundedQuestion: async () => ({ handled: true, outcome: "responded", stateMutationCommitted: false }),
      helpQuery: async () => ({ handled: true, outcome: "responded", stateMutationCommitted: false }),
      datasetMapping: async () => touch("mappingCalls"),
      parserWorkflow: async () => touch("parserCalls"),
      graphMutation: async () => touch("graphCalls"),
      dashboardControl: async () => touch("navigationCalls"),
      legacyAction: async () => touch("legacyCalls"),
    },
  });
  const after = stateFingerprint(state);
  return {
    query,
    productionRoute: dispatch.runtimeTrace?.dispatchPath ?? "not_dispatched",
    speechAct: compilation.speechAct,
    domain: compilation.domain,
    intent: compilation.intent,
    authorizationDecision: compilation.requestSemantics?.authorization?.mode
      ?? (compilation.dispatchAuthorized === false ? "blocked" : "legacy_allowed"),
    dispatchAuthorized: compilation.dispatchAuthorized !== false,
    sideEffectClass: compilation.sideEffectClass,
    stateChangingSideEffect: sideEffectIsStateChanging(compilation.sideEffectClass),
    stateMutationCommitted: Boolean(dispatch.runtimeTrace?.stateMutationCommitted),
    beforeFingerprint: before,
    afterFingerprint: after,
    stateChanged: before !== after,
    dispatchBlockReason: compilation.dispatchBlockReason ?? dispatch.runtimeTrace?.dispatchBlockReason ?? null,
    requestSemantics: compilation.requestSemantics ?? null,
  };
}

