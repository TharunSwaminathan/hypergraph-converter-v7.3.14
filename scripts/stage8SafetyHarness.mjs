import { analyzeDeterministicNlu } from "../src/agent/deterministicNlu/deterministicNlu.js";
import { compileDeterministicAction } from "../src/agent/deterministicNlu/compileDeterministicAction.js";
import { dispatchCompiledAction } from "../src/agent/deterministicNlu/dispatchCompiledAction.js";
import { createRuntimeTrace } from "../src/agent/deterministicNlu/runtimeInstrumentation.js";
import { sideEffectIsStateChanging } from "../src/agent/deterministicNlu/sideEffectPolicy.js";
import { extractOperations, extractOperationTypes } from "../tests/helpers/evaluateDeterministicNluCorpus.mjs";

export function createProtectedState() {
  const mappingSpec = { version: "2", files: [{ fileName: "papers.csv", role: "hyperedge_table" }] };
  const transformationPlan = { steps: [{ type: "map_rows" }] };
  const activeBatch = {
    id: "batch-2",
    version: 5,
    mappingSpec,
    mappingSpecStatus: "valid",
    transformationPlan,
    generatedParserFromMapping: "async function parseHypergraph(){ return []; }",
  };
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
    hasGraph: true,
    hyperedgeCount: 1,
    vertexCount: 2,
    mappingSpec,
    mappingRevision: 4,
    datasetGroups: [{ id: "group-main", files: ["papers.csv"] }],
    groupingRevision: 2,
    parser: { status: "ready", resultId: "parser-result-stage8", codeBinding: "code-stage8" },
    activeBatch,
    activeBatchId: activeBatch.id,
    agentFileCount: 3,
    agentBatches: [1, 2, 3].map(number => ({
      id: `batch-${number}`,
      label: `Batch ${number}`,
      mappingSpec,
      mappingSpecStatus: "valid",
    })),
    transformationPlan,
    customCodeExists: true,
    customCode: "async function parseHypergraph(){ return []; }",
    customResultId: "result-stage8",
    localModel: { request: { busy: true } },
    localModelRequestActive: true,
    activeCancellableWork: true,
    activeRequestCount: 1,
    recentInterpretation: { id: "interpretation-stage8" },
    reversibleHistory: [{ id: "history-stage8" }],
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
  const beforeState = structuredClone(state);
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
  const handlerCalls = {
    clarification: 0,
    blockedSideEffect: 0,
    stale: 0,
    contextMissing: 0,
    groundedQuestion: 0,
    helpQuery: 0,
    datasetMapping: 0,
    parserWorkflow: 0,
    graphMutation: 0,
    dashboardControl: 0,
    legacyAction: 0,
  };
  const touch = (handler, domain) => {
    handlerCalls[handler] += 1;
    if (mutate) {
      state[domain] = (state[domain] ?? 0) + 1;
    }
    return { handled: true, outcome: "synthetic_state_change", stateMutationCommitted: mutate };
  };
  const dispatch = await dispatchCompiledAction({
    prepared,
    query,
    state,
    pendingAction: state.pendingAction,
    handlers: {
      clarification: async () => {
        handlerCalls.clarification += 1;
        return { handled: true, outcome: "clarification" };
      },
      blockedSideEffect: async () => {
        handlerCalls.blockedSideEffect += 1;
        return { handled: true, outcome: "authorization_blocked", stateMutationCommitted: false };
      },
      stale: async () => {
        handlerCalls.stale += 1;
        return { handled: true, outcome: "stale" };
      },
      contextMissing: async () => {
        handlerCalls.contextMissing += 1;
        return { handled: true, outcome: "clarification" };
      },
      groundedQuestion: async () => {
        handlerCalls.groundedQuestion += 1;
        return { handled: true, outcome: "responded", stateMutationCommitted: false };
      },
      helpQuery: async () => {
        handlerCalls.helpQuery += 1;
        return { handled: true, outcome: "responded", stateMutationCommitted: false };
      },
      datasetMapping: async () => touch("datasetMapping", "mappingCalls"),
      parserWorkflow: async () => touch("parserWorkflow", "parserCalls"),
      graphMutation: async () => touch("graphMutation", "graphCalls"),
      dashboardControl: async () => touch("dashboardControl", "navigationCalls"),
      legacyAction: async () => touch("legacyAction", "legacyCalls"),
    },
  });
  const after = stateFingerprint(state);
  const operations = extractOperations(compilation);
  const changedProtectedKeys = [...new Set([...Object.keys(beforeState), ...Object.keys(state)])]
    .filter(key => stateFingerprint(beforeState[key]) !== stateFingerprint(state[key]));
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
    changedProtectedKeys,
    handlerCalls,
    operationTypes: extractOperationTypes(compilation),
    operations,
    explicitClarification: Boolean(
      compilation.compiled?.needsClarification
      || compilation.compiled?.classification === "clarification"
      || compilation.typedValue?.needsResolution
      || compilation.typedValue?.classification === "clarification"
    ),
    dispatchBlockReason: compilation.dispatchBlockReason ?? dispatch.runtimeTrace?.dispatchBlockReason ?? null,
    requestSemantics: compilation.requestSemantics ?? null,
  };
}
