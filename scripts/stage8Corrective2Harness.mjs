import { dispatchCompiledAction } from "../src/agent/deterministicNlu/dispatchCompiledAction.js";
import { analyzeRequestSemantics } from "../src/agent/deterministicNlu/requestSemantics.js";

export const CORRECTIVE2_PARENT = "ea6c442b5219f7452fd1dc32663cec580790911e";

const FAMILIES = Object.freeze([
  {
    id: "graph",
    domain: "graph_mutation",
    typedKind: "GraphMutationPlan",
    typedValue: { operations: [{ type: "CLEAR_GRAPH" }] },
    actualSideEffectClass: "graph_edit_preview",
    correctQuery: "Clear the graph.",
    unrelatedQuery: "Use CSR.",
    wrongClass: "navigation",
    handler: "graphMutation",
  },
  {
    id: "mapping",
    domain: "dataset_mapping",
    typedKind: "DatasetMappingPatch",
    typedValue: { operations: [{ type: "SET_FILE_ROLE", fileName: "papers.csv", role: "hyperedge_table" }] },
    actualSideEffectClass: "reversible_mapping_edit",
    correctQuery: "Map papers.csv to authors.csv.",
    unrelatedQuery: "Use CSR.",
    wrongClass: "navigation",
    handler: "datasetMapping",
  },
  {
    id: "parser",
    domain: "parser_workflow",
    typedKind: "ParserWorkflowOperation",
    typedValue: { operations: [{ type: "GENERATE_TRANSFORMATION_PLAN" }] },
    actualSideEffectClass: "workflow_preparation",
    correctQuery: "Generate the transformation plan.",
    unrelatedQuery: "Use CSR.",
    wrongClass: "navigation",
    handler: "parserWorkflow",
  },
  {
    id: "dashboard",
    domain: "dashboard_control",
    typedKind: "DashboardControlIntent",
    typedValue: { canonicalIntent: "NAVIGATE_STATS", slots: {} },
    actualSideEffectClass: "navigation",
    correctQuery: "Show statistics.",
    unrelatedQuery: "Clear the graph.",
    wrongClass: "graph_edit_preview",
    handler: "dashboardControl",
  },
  {
    id: "legacy",
    domain: "legacy_action",
    typedKind: "LegacyActionIntent",
    typedValue: { kind: "open_file_picker", sideEffect: "file_picker", requiredContext: [] },
    actualSideEffectClass: "file_picker",
    correctQuery: "Upload files.",
    unrelatedQuery: "Use CSR.",
    wrongClass: "navigation",
    handler: "legacyAction",
  },
]);

const DECLARATIONS = Object.freeze([
  { id: "correct", value: family => family.actualSideEffectClass },
  { id: "read_only", value: () => "read_only" },
  { id: "wrong_valid", value: family => family.wrongClass },
  { id: "unknown", value: () => "unknown" },
  { id: "missing", value: () => undefined },
]);

const AUTHORIZATIONS = Object.freeze([
  { id: "correct", query: family => family.correctQuery, semantics: query => analyzeRequestSemantics(query) },
  { id: "unrelated", query: family => family.unrelatedQuery, semantics: query => analyzeRequestSemantics(query) },
  { id: "read_only", query: () => "Explain what this action would do without changing anything.", semantics: query => analyzeRequestSemantics(query) },
  {
    id: "truncated",
    query: family => `${family.correctQuery} ${"context ".repeat(630)}Do not perform that action.`,
    semantics: query => analyzeRequestSemantics(query),
  },
  { id: "missing_contract", query: () => "", semantics: () => undefined },
]);

function preparedFor(family, declaredClass, semantics) {
  const compilation = {
    handled: true,
    domain: family.domain,
    typedKind: family.typedKind,
    typedValue: structuredClone(family.typedValue),
    dispatchAuthorized: true,
    semanticConfidence: { level: "high", score: 1 },
  };
  if (declaredClass !== undefined) compilation.sideEffectClass = declaredClass;
  if (semantics !== undefined) compilation.requestSemantics = semantics;
  return {
    handled: true,
    nlu: {
      primaryDomain: family.domain,
      ambiguities: [],
      confidence: { level: "high", score: 1 },
      limits: { truncated: false },
    },
    compilation,
    runtimeTrace: {
      requestId: `stage8-corrective2-${family.id}`,
      status: "prepared",
      sideEffectClass: declaredClass ?? "unknown",
      modelCalls: [],
      validatorCalls: [],
    },
  };
}

export async function dispatchAdversarialCase({ family, declaration, authorization }) {
  const declaredSideEffectClass = declaration.value(family);
  const query = authorization.query(family);
  const semantics = authorization.semantics(query);
  const handlerCalls = {
    graphMutation: 0,
    dashboardControl: 0,
    datasetMapping: 0,
    parserWorkflow: 0,
    legacyAction: 0,
    blockedSideEffect: 0,
  };
  const state = {
    graphVersion: 7,
    pendingAction: { id: "pending-stage8-corrective2" },
    navigationVersion: 4,
    mappingRevision: 3,
    parserRevision: 2,
  };
  const before = JSON.stringify(state);
  const call = name => async () => {
    handlerCalls[name] += 1;
    if (name !== "blockedSideEffect") state[`${family.id}MutationCount`] = (state[`${family.id}MutationCount`] ?? 0) + 1;
    return {
      handled: true,
      outcome: name === "blockedSideEffect" ? "authorization_blocked" : "synthetic_handler_called",
      stateMutationCommitted: name !== "blockedSideEffect",
      confirmationStaged: name === "graphMutation",
    };
  };
  const result = await dispatchCompiledAction({
    prepared: preparedFor(family, declaredSideEffectClass, semantics),
    query,
    state,
    pendingAction: state.pendingAction,
    handlers: {
      graphMutation: call("graphMutation"),
      dashboardControl: call("dashboardControl"),
      datasetMapping: call("datasetMapping"),
      parserWorkflow: call("parserWorkflow"),
      legacyAction: call("legacyAction"),
      blockedSideEffect: call("blockedSideEffect"),
    },
  });
  const expectedExecution = declaration.id === "correct" && authorization.id === "correct";
  return {
    id: `${family.id}:${declaration.id}:${authorization.id}`,
    family: family.id,
    typedKind: family.typedKind,
    operationTypes: result.runtimeTrace.operationTypes ?? [],
    declaredSideEffectClass: declaredSideEffectClass ?? null,
    actualSideEffectClass: result.runtimeTrace.actualSideEffectClass ?? null,
    authorization: authorization.id,
    authorizationTruncated: semantics?.authorization?.truncated ?? false,
    requestSemanticsPresent: semantics !== undefined,
    expectedExecution,
    actualHandlerCalls: handlerCalls[family.handler],
    blockedHandlerCalls: handlerCalls.blockedSideEffect,
    anyStateChangingHandlerCalls: Object.entries(handlerCalls)
      .filter(([name]) => name !== "blockedSideEffect")
      .reduce((sum, [, count]) => sum + count, 0),
    protectedStateChanged: before !== JSON.stringify(state),
    dispatchPath: result.runtimeTrace.dispatchPath,
    dispatchBlockReason: result.runtimeTrace.dispatchBlockReason ?? null,
    authorizationDecision: result.runtimeTrace.authorizationDecision ?? null,
    confirmationStaged: Boolean(result.runtimeTrace.confirmationStaged),
  };
}

export async function runFinalGateMatrix() {
  const records = [];
  for (const family of FAMILIES) {
    for (const declaration of DECLARATIONS) {
      for (const authorization of AUTHORIZATIONS) {
        records.push(await dispatchAdversarialCase({ family, declaration, authorization }));
      }
    }
  }
  const violations = records.filter(record => record.expectedExecution
    ? record.actualHandlerCalls !== 1 || record.protectedStateChanged !== true
    : record.anyStateChangingHandlerCalls !== 0 || record.protectedStateChanged !== false);
  return {
    cases: records.length,
    expectedExecutions: records.filter(record => record.expectedExecution).length,
    actualExecutions: records.filter(record => record.anyStateChangingHandlerCalls > 0).length,
    violations: violations.length,
    mismatchBlocks: records.filter(record => record.dispatchBlockReason === "side_effect_class_mismatch").length,
    missingSemanticsBlocks: records.filter(record => record.dispatchBlockReason === "missing_request_semantics").length,
    truncatedBlocks: records.filter(record => record.authorization === "truncated" && record.anyStateChangingHandlerCalls === 0).length,
    records,
  };
}

export function finalGateFamilies() {
  return FAMILIES;
}
