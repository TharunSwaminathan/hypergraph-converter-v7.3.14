import { dispatchCompiledAction } from "../src/agent/deterministicNlu/dispatchCompiledAction.js";
import { analyzeRequestSemantics } from "../src/agent/deterministicNlu/requestSemantics.js";
import {
  ACTION_INTENT_REGISTRY,
  ACTION_INTENT_VISIBILITY,
  extractActionArguments,
} from "../src/agent/actionIntentRegistry.js";

export const CORRECTIVE3_PARENT = "6b0af8a8a33e5dccc0a9cb7f336d82e1bddaa1e7";

export const REGISTERED_IDENTITIES = Object.freeze([
  ["graph_mutation", "GraphMutationPlan"],
  ["graph_mutation", "GraphMutationDraft"],
  ["dataset_mapping", "DatasetMappingPatch"],
  ["dataset_grouping", "DatasetMappingPatch"],
  ["parser_workflow", "ParserWorkflowOperation"],
  ["dashboard_control", "DashboardControlIntent"],
  ["legacy_action", "LegacyActionIntent"],
  ["grounded_question", "GroundedQuestion"],
  ["help_query", "DeterministicHelpQuery"],
]);

const ALL_TYPED_KINDS = Object.freeze([...new Set(REGISTERED_IDENTITIES.map(([, kind]) => kind))]);

const PROTECTED_FAMILIES = Object.freeze([
  {
    id: "graph",
    domain: "graph_mutation",
    typedKind: "GraphMutationPlan",
    typedValue: { operations: [{ type: "CLEAR_GRAPH" }] },
    sideEffectClass: "graph_edit_preview",
    query: "Clear the graph.",
  },
  {
    id: "mapping",
    domain: "dataset_mapping",
    typedKind: "DatasetMappingPatch",
    typedValue: { operations: [{ type: "SET_FILE_ROLE", fileName: "papers.csv", role: "hyperedge_table" }] },
    sideEffectClass: "reversible_mapping_edit",
    query: "Map papers.csv as the hyperedge table.",
  },
  {
    id: "grouping",
    domain: "dataset_grouping",
    typedKind: "DatasetMappingPatch",
    typedValue: { operations: [{ type: "SET_PARSE_MODE", value: "separate" }] },
    sideEffectClass: "reversible_grouping_edit",
    query: "Parse these files separately.",
  },
  {
    id: "parser",
    domain: "parser_workflow",
    typedKind: "ParserWorkflowOperation",
    typedValue: { operations: [{ type: "GENERATE_TRANSFORMATION_PLAN" }] },
    sideEffectClass: "workflow_preparation",
    query: "Generate the transformation plan.",
  },
  {
    id: "dashboard",
    domain: "dashboard_control",
    typedKind: "DashboardControlIntent",
    typedValue: { canonicalIntent: "NAVIGATE_STATS", slots: {} },
    sideEffectClass: "navigation",
    query: "Show statistics.",
  },
  {
    id: "legacy",
    domain: "legacy_action",
    typedKind: "LegacyActionIntent",
    typedValue: {
      intent: "upload_files",
      registryId: "files.upload",
      handlerKind: "open_file_picker",
      sideEffect: "file_picker",
      requiredContext: [],
    },
    sideEffectClass: "file_picker",
    query: "Upload files.",
  },
]);

function richState() {
  const batch = {
    id: "batch-1",
    label: "Batch 1",
    mappingSpec: { version: 1 },
    mappingSpecStatus: "valid",
    transformationPlan: { version: 1 },
  };
  const secondBatch = {
    ...batch,
    id: "batch-2",
    label: "Batch 2",
  };
  return {
    graphVersion: 7,
    hasGraph: true,
    hyperedgeCount: 3,
    vertexCount: 5,
    graphHistory: [{ version: 6 }],
    reversibleHistory: [{ version: 6 }],
    navigationVersion: 2,
    mappingRevision: 4,
    parserRevision: 3,
    agentFileCount: 2,
    agentBatches: [batch, secondBatch],
    activeBatch: batch,
    activeBatchId: batch.id,
    transformationPlan: { version: 1 },
    customCodeExists: true,
    customCode: "return [];",
    customResultId: "result-1",
    customResult: { id: "result-1" },
    localModel: { request: { busy: true } },
    localModelRequestActive: true,
    activeModelRequest: true,
    activeCancellableWork: true,
    activeRequestCount: 1,
    lastNluDiagnostic: { id: "recent" },
    recentInterpretation: { id: "recent" },
  };
}

function preparedFor(fixture) {
  const compilation = {
    handled: true,
    domain: fixture.domain,
    typedKind: fixture.typedKind,
    typedValue: structuredClone(fixture.typedValue),
    dispatchAuthorized: true,
    semanticConfidence: { level: "high", score: 1 },
  };
  if (fixture.sideEffectClass !== undefined) compilation.sideEffectClass = fixture.sideEffectClass;
  if (fixture.requestSemantics !== undefined) compilation.requestSemantics = fixture.requestSemantics;
  if (fixture.compiled !== undefined) compilation.compiled = structuredClone(fixture.compiled);
  return {
    handled: true,
    nlu: {
      primaryDomain: fixture.domain,
      ambiguities: [],
      confidence: { level: "high", score: 1 },
      limits: { truncated: false },
    },
    compilation,
    runtimeTrace: {
      requestId: `stage8-corrective3-${fixture.id}`,
      status: "prepared",
      sideEffectClass: fixture.sideEffectClass ?? "unknown",
      modelCalls: fixture.modelSource ? [{ task: "action_planner", source: "adversarial_fixture" }] : [],
      validatorCalls: [],
    },
  };
}

async function dispatchFixture(fixture) {
  const handlerCalls = {
    graphMutation: 0,
    dashboardControl: 0,
    datasetMapping: 0,
    parserWorkflow: 0,
    legacyAction: 0,
    groundedQuestion: 0,
    helpQuery: 0,
    blockedSideEffect: 0,
  };
  const state = richState();
  const pendingAction = { kind: "confirmation", actionType: "apply_graph_mutation", id: "pending-1" };
  const before = JSON.stringify(state);
  const call = name => async () => {
    handlerCalls[name] += 1;
    if (name !== "blockedSideEffect") state[`${name}ExecutionCount`] = handlerCalls[name];
    return {
      handled: true,
      outcome: name === "blockedSideEffect" ? "authorization_blocked" : "synthetic_handler_called",
      stateMutationCommitted: name !== "blockedSideEffect",
      confirmationStaged: name === "graphMutation",
    };
  };
  const query = fixture.query ?? "";
  const result = await dispatchCompiledAction({
    prepared: preparedFor(fixture),
    query,
    state,
    pendingAction,
    handlers: {
      graphMutation: call("graphMutation"),
      dashboardControl: call("dashboardControl"),
      datasetMapping: call("datasetMapping"),
      parserWorkflow: call("parserWorkflow"),
      legacyAction: call("legacyAction"),
      groundedQuestion: call("groundedQuestion"),
      helpQuery: call("helpQuery"),
      blockedSideEffect: call("blockedSideEffect"),
    },
  });
  const protectedHandlerCalls = Object.entries(handlerCalls)
    .filter(([name]) => name !== "blockedSideEffect")
    .reduce((sum, [, count]) => sum + count, 0);
  return {
    id: fixture.id,
    family: fixture.family ?? null,
    payloadFamily: fixture.payloadFamily ?? fixture.family ?? null,
    domain: fixture.domain,
    typedKind: fixture.typedKind,
    declaredSideEffectClass: fixture.sideEffectClass ?? null,
    query,
    authorizationScopes: analyzeRequestSemantics(query).authorization?.sideEffectScopes ?? [],
    handlerCalls,
    protectedHandlerCalls,
    protectedStateChanged: before !== JSON.stringify(state),
    confirmationStaged: Boolean(result.runtimeTrace.confirmationStaged),
    resolvedDomain: result.runtimeTrace.actualDomain ?? null,
    resolvedTypedKind: result.runtimeTrace.typedKind ?? null,
    actualSideEffectClass: result.runtimeTrace.actualSideEffectClass ?? null,
    operationTypes: result.runtimeTrace.operationTypes ?? [],
    legacyRegistryId: result.runtimeTrace.legacyRegistryId ?? null,
    dispatchPath: result.runtimeTrace.dispatchPath ?? null,
    dispatchBlockReason: result.runtimeTrace.dispatchBlockReason ?? null,
    authorizationDecision: result.runtimeTrace.authorizationDecision ?? null,
  };
}

function alternateSideEffect(index, family) {
  if (index % 3 === 0) return family.sideEffectClass;
  if (index % 3 === 1) return "read_only";
  return family.sideEffectClass === "navigation" ? "graph_edit_preview" : "navigation";
}

function alternateQuery(index, family) {
  if (index % 3 === 0) return family.query;
  if (index % 3 === 1) return "Explain what this would do without changing anything.";
  return "Use CSR.";
}

export async function runIdentityCorruptionMatrix() {
  const identityRecords = [];
  for (const family of PROTECTED_FAMILIES) {
    const validKinds = REGISTERED_IDENTITIES
      .filter(([domain]) => domain === family.domain)
      .map(([, kind]) => kind);
    const wrongKinds = ALL_TYPED_KINDS.filter(kind => !validKinds.includes(kind));
    for (let index = 0; index < wrongKinds.length; index += 1) {
      identityRecords.push(await dispatchFixture({
        id: `${family.id}:wrong-kind:${wrongKinds[index]}`,
        family: family.id,
        payloadFamily: family.id,
        domain: family.domain,
        typedKind: wrongKinds[index],
        typedValue: family.typedValue,
        sideEffectClass: alternateSideEffect(index, family),
        query: alternateQuery(index, family),
      }));
    }
  }

  const modelAdversarial = await dispatchFixture({
    id: "model-read-only-graph-domain-dashboard-kind-clear-payload",
    family: "model_adversarial",
    payloadFamily: "graph",
    domain: "graph_mutation",
    typedKind: "DashboardControlIntent",
    typedValue: { canonicalIntent: "NOOP", operations: [{ type: "CLEAR_GRAPH" }] },
    sideEffectClass: "read_only",
    query: "Explain graph clearing without changing anything.",
    modelSource: true,
  });

  const unexpectedFixtures = [
    {
      id: "dashboard-with-graph-operations",
      domain: "dashboard_control",
      typedKind: "DashboardControlIntent",
      typedValue: { canonicalIntent: "NOOP", operations: [{ type: "CLEAR_GRAPH" }] },
      sideEffectClass: "read_only",
      query: "",
    },
    {
      id: "grounded-question-with-graph-operations",
      domain: "grounded_question",
      typedKind: "GroundedQuestion",
      typedValue: { intent: "explain_graph", operations: [{ type: "CLEAR_GRAPH" }] },
      sideEffectClass: "read_only",
      query: "Explain graph clearing without changing anything.",
    },
    {
      id: "help-query-with-parser-operations",
      domain: "help_query",
      typedKind: "DeterministicHelpQuery",
      typedValue: { intent: "SHOW_HELP_OVERVIEW", operations: [{ type: "RUN_CUSTOM_PARSER_CONFIRMATION" }] },
      sideEffectClass: "read_only",
      query: "Explain parser commands without running anything.",
    },
    {
      id: "legacy-action-with-graph-operations",
      domain: "legacy_action",
      typedKind: "LegacyActionIntent",
      typedValue: {
        intent: "upload_files",
        registryId: "files.upload",
        handlerKind: "open_file_picker",
        sideEffect: "file_picker",
        requiredContext: [],
        operations: [{ type: "CLEAR_GRAPH" }],
      },
      sideEffectClass: "file_picker",
      query: "Upload files.",
    },
  ];
  const unexpectedPayloadRecords = [];
  for (const fixture of unexpectedFixtures) unexpectedPayloadRecords.push(await dispatchFixture(fixture));

  const allRecords = [...identityRecords, modelAdversarial, ...unexpectedPayloadRecords];
  return {
    registeredIdentities: REGISTERED_IDENTITIES.map(([domain, typedKind]) => ({ domain, typedKind })),
    protectedFamilies: PROTECTED_FAMILIES.map(family => ({ id: family.id, domain: family.domain })),
    typedKinds: ALL_TYPED_KINDS,
    identityCases: identityRecords.length,
    identityMismatchHandlerCalls: identityRecords.reduce((sum, record) => sum + record.protectedHandlerCalls, 0),
    identityMismatchWrongReasons: identityRecords.filter(record => record.dispatchBlockReason !== "plan_identity_mismatch").length,
    readOnlyKindPairings: identityRecords.filter(record => ["GroundedQuestion", "DeterministicHelpQuery"].includes(record.typedKind)).length,
    unexpectedPayloadCases: unexpectedPayloadRecords.length,
    unexpectedPayloadHandlerCalls: unexpectedPayloadRecords.reduce((sum, record) => sum + record.protectedHandlerCalls, 0),
    unexpectedPayloadWrongReasons: unexpectedPayloadRecords.filter(record => record.dispatchBlockReason !== "unexpected_state_changing_payload").length,
    protectedStateViolations: allRecords.filter(record => record.protectedStateChanged).length,
    modelAdversarial,
    identityRecords,
    unexpectedPayloadRecords,
  };
}

function unrelatedSideEffect(actual) {
  return actual === "navigation" ? "graph_edit_preview" : "navigation";
}

function legacyTypedValue(entry, query, suppliedSideEffect) {
  const action = {
    intent: entry.intent,
    registryId: entry.id,
    handlerKind: entry.handlerKind,
    confirmation: entry.confirmation,
    requiredContext: entry.requiredContext ?? [],
    argumentSlots: entry.argumentSlots ?? [],
    ...extractActionArguments(entry, query),
  };
  if (suppliedSideEffect !== undefined) action.sideEffect = suppliedSideEffect;
  return action;
}

export async function runLegacyAuthorityMatrix() {
  const publicActions = ACTION_INTENT_REGISTRY.filter(
    item => item.visibility === ACTION_INTENT_VISIBILITY.PUBLIC,
  );
  const variants = ["correct", "read_only", "unrelated", "unknown", "omitted"];
  const records = [];
  for (const entry of publicActions) {
    const query = entry.examples[0];
    for (const variant of variants) {
      const suppliedSideEffect = variant === "correct" ? entry.sideEffect
        : variant === "read_only" ? "read_only"
          : variant === "unrelated" ? unrelatedSideEffect(entry.sideEffect)
            : variant === "unknown" ? "unknown"
              : undefined;
      const declaredSideEffectClass = variant === "omitted" ? entry.sideEffect : suppliedSideEffect;
      const record = await dispatchFixture({
        id: `${entry.intent}:${variant}`,
        family: "legacy",
        payloadFamily: entry.intent,
        domain: "legacy_action",
        typedKind: "LegacyActionIntent",
        typedValue: legacyTypedValue(entry, query, suppliedSideEffect),
        sideEffectClass: declaredSideEffectClass,
        requestSemantics: analyzeRequestSemantics(query),
        query,
      });
      const expectedExecution = variant === "correct"
        || variant === "omitted"
        || (variant === "read_only" && entry.sideEffect === "read_only");
      records.push({
        ...record,
        registryId: entry.id,
        intent: entry.intent,
        registrySideEffect: entry.sideEffect,
        variant,
        suppliedSideEffect: suppliedSideEffect ?? null,
        expectedExecution,
      });
    }
  }

  const kindOnlySelfDeclared = await dispatchFixture({
    id: "known-kind-open-file-picker-self-declared-read-only",
    family: "legacy",
    payloadFamily: "upload_files",
    domain: "legacy_action",
    typedKind: "LegacyActionIntent",
    typedValue: { kind: "open_file_picker", sideEffect: "read_only", requiredContext: [] },
    sideEffectClass: "read_only",
    query: "",
  });
  records.push({
    ...kindOnlySelfDeclared,
    registryId: "files.upload",
    intent: "upload_files",
    registrySideEffect: "file_picker",
    variant: "read_only_kind_only",
    suppliedSideEffect: "read_only",
    expectedExecution: false,
  });

  const compiledActionCorruption = await dispatchFixture({
    id: "compiled-action-open-file-picker-self-declared-read-only",
    family: "legacy",
    payloadFamily: "upload_files",
    domain: "legacy_action",
    typedKind: "LegacyActionIntent",
    typedValue: {
      intent: "upload_files",
      registryId: "files.upload",
      handlerKind: "open_file_picker",
      requiredContext: [],
    },
    compiled: {
      action: {
        intent: "upload_files",
        registryId: "files.upload",
        handlerKind: "open_file_picker",
        sideEffect: "read_only",
        requiredContext: [],
      },
    },
    sideEffectClass: "file_picker",
    requestSemantics: analyzeRequestSemantics("Upload files."),
    query: "Upload files.",
  });
  records.push({
    ...compiledActionCorruption,
    registryId: "files.upload",
    intent: "upload_files",
    registrySideEffect: "file_picker",
    variant: "read_only_compiled_action",
    suppliedSideEffect: "read_only",
    expectedExecution: false,
  });

  const unregistered = await dispatchFixture({
    id: "unregistered-kind",
    family: "legacy",
    payloadFamily: "unregistered",
    domain: "legacy_action",
    typedKind: "LegacyActionIntent",
    typedValue: { kind: "unregistered_dangerous_action", sideEffect: "read_only", requiredContext: [] },
    sideEffectClass: "read_only",
    query: "",
  });
  records.push({
    ...unregistered,
    registryId: null,
    intent: null,
    registrySideEffect: null,
    variant: "unregistered",
    suppliedSideEffect: "read_only",
    expectedExecution: false,
  });

  const expectedExecutionFailures = records.filter(record => (
    record.expectedExecution ? record.handlerCalls.legacyAction !== 1 : record.handlerCalls.legacyAction !== 0
  ));
  return {
    publicActionCount: publicActions.length,
    variantsPerAction: variants.length,
    cases: records.length,
    expectedExecutions: records.filter(record => record.expectedExecution).length,
    actualExecutions: records.filter(record => record.handlerCalls.legacyAction > 0).length,
    expectedExecutionFailures: expectedExecutionFailures.length,
    correctPositiveFailures: records.filter(record => record.variant === "correct" && record.handlerCalls.legacyAction !== 1).length,
    omittedAuthorityFailures: records.filter(record => record.variant === "omitted" && record.handlerCalls.legacyAction !== 1).length,
    legacyMetadataBypassCalls: records.filter(record => (
      ["read_only", "read_only_kind_only", "read_only_compiled_action"].includes(record.variant)
      && record.registrySideEffect !== "read_only"
      && record.handlerCalls.legacyAction > 0
    )).length,
    corruptMetadataHandlerCalls: records.filter(record => (
      ["unrelated", "unknown"].includes(record.variant)
      || (record.variant === "read_only" && record.registrySideEffect !== "read_only")
    )).reduce((sum, record) => sum + record.handlerCalls.legacyAction, 0),
    unregisteredHandlerCalls: unregistered.handlerCalls.legacyAction,
    kindOnlySelfDeclaredPrivilegeCalls: kindOnlySelfDeclared.handlerCalls.legacyAction,
    kindOnlySelfDeclaredBlockReason: kindOnlySelfDeclared.dispatchBlockReason,
    compiledActionSelfDeclaredPrivilegeCalls: compiledActionCorruption.handlerCalls.legacyAction,
    compiledActionSelfDeclaredBlockReason: compiledActionCorruption.dispatchBlockReason,
    protectedStateViolations: records.filter(record => !record.expectedExecution && record.protectedStateChanged).length,
    records,
  };
}
