import { speechActIsReadOnly } from "./speechActClassifier.js";
import { authorizationAllowsSideEffect } from "./positiveAuthorization.js";

export const SIDE_EFFECT_CLASSES = Object.freeze([
  "read_only",
  "reversible_mapping_edit",
  "reversible_grouping_edit",
  "workflow_preparation",
  "requires_parser_run_confirmation",
  "requires_graph_apply_confirmation",
  "graph_edit_preview",
  "navigation",
  "file_picker",
  "batch_state_edit",
  "destructive_batch_state",
  "runtime_control",
  "runtime_probe",
  "confirmation_control",
  "download_or_copy",
  "cancellation",
  "unknown",
]);

const GROUPING_OPERATIONS = new Set([
  "SET_PARSE_MODE",
  "CREATE_GROUP",
  "RENAME_GROUP",
  "MOVE_FILE_TO_GROUP",
  "MARK_VALIDATION_FILE",
  "MARK_UPDATE_STREAM",
  "IGNORE_FILE",
]);

const READ_ONLY_WORKFLOW = new Set([
  "SHOW_WORKFLOW_STATUS",
  "SHOW_TRANSFORMATION_PLAN",
  "SHOW_RECONCILIATION_REPORT",
  "SHOW_UNMATCHED_ROWS",
  "SHOW_GENERATED_PARSER",
  "PREVIEW_GRAPH_RESULT",
]);

const NAVIGATION_INTENTS = new Set([
  "NAVIGATE_STATS",
  "NAVIGATE_STATISTICS",
  "NAVIGATE_VISUALIZATION",
  "NAVIGATE_MAPPINGS",
  "NAVIGATE_EXPORT",
  "NAVIGATE_WORKSPACE",
  "OPEN_RUNTIME_DIAGNOSTICS",
  "OPEN_ASSISTANT_SETTINGS",
]);

const RUNTIME_CONTROL_INTENTS = new Set([
  "TEST_LOCAL_MODEL_CONNECTION",
  "STOP_LOCAL_MODEL_TASK",
]);

export function deriveActualSideEffect(compilation = {}) {
  const declaredTypedKind = compilation.typedKind ?? null;
  const typedKind = declaredTypedKind ?? typedKindForDomain(compilation.domain);
  const typedValue = compilation.typedValue ?? null;
  const compiled = compilation.compiled ?? {};
  const operations = compiled.draft?.operations
    ?? compiled.plan?.operations
    ?? compiled.operations
    ?? typedValue?.operations
    ?? (Array.isArray(typedValue) ? typedValue : []);

  let sideEffectClass = "read_only";
  if (typedKind === "GroundedQuestion" || typedKind === "DeterministicHelpQuery") {
    sideEffectClass = "read_only";
  } else if (typedKind === "LegacyActionIntent") {
    sideEffectClass = typedValue?.sideEffect ?? compiled.action?.sideEffect ?? "read_only";
  }
  if (typedKind === "DatasetMappingPatch") {
    sideEffectClass = !operations.length ? "read_only"
      : operations.every(operation => GROUPING_OPERATIONS.has(operation.type))
        ? "reversible_grouping_edit"
        : "reversible_mapping_edit";
  }
  if (typedKind === "GraphMutationPlan") sideEffectClass = operations.length ? "graph_edit_preview" : "read_only";
  if (typedKind === "ParserWorkflowOperation") {
    const types = operations.map(operation => operation.type);
    if (types.includes("APPLY_CUSTOM_PARSER_RESULT_CONFIRMATION")) sideEffectClass = "requires_graph_apply_confirmation";
    else if (types.includes("RUN_CUSTOM_PARSER_CONFIRMATION")) sideEffectClass = "requires_parser_run_confirmation";
    else if (types.length && types.every(type => READ_ONLY_WORKFLOW.has(type))) sideEffectClass = "read_only";
    else sideEffectClass = types.length ? "workflow_preparation" : "read_only";
  }
  if (typedKind === "DashboardControlIntent") {
    const intent = typedValue?.canonicalIntent ?? compiled.canonicalIntent ?? compilation.intent;
    if (RUNTIME_CONTROL_INTENTS.has(intent)) sideEffectClass = "runtime_control";
    else if (NAVIGATION_INTENTS.has(intent) || /^NAVIGATE_|^OPEN_|^SET_/.test(String(intent ?? ""))) sideEffectClass = "navigation";
    else sideEffectClass = "read_only";
  }
  return Object.freeze({
    sideEffectClass,
    typedKind,
    declaredTypedKind,
    operationTypes: operations.map(operation => operation?.type).filter(Boolean),
  });
}

export function classifyCompiledSideEffect(compilation = {}) {
  return deriveActualSideEffect(compilation).sideEffectClass;
}

export function authorizeSpeechActSideEffect({ speechAct = "unknown", sideEffectClass = "unknown" } = {}) {
  if (speechAct === "cancellation") {
    return {
      allowed: [
        "cancellation",
        "read_only",
        "runtime_control",
        "confirmation_control",
      ].includes(sideEffectClass),
      reason: "cancellation_scope",
    };
  }
  if (speechActIsReadOnly(speechAct)) {
    return {
      allowed: sideEffectClass === "read_only",
      reason: sideEffectClass === "read_only" ? "read_only_speech_act" : `${speechAct}_blocks_${sideEffectClass}`,
    };
  }
  if (speechAct === "declarative_mapping_statement") {
    return {
      allowed: ["reversible_mapping_edit", "reversible_grouping_edit", "read_only"].includes(sideEffectClass),
      reason: "declarative_mapping_scope",
    };
  }
  if (speechAct === "declarative_graph_statement") {
    return {
      allowed: ["graph_edit_preview", "read_only"].includes(sideEffectClass),
      reason: "declarative_graph_scope",
    };
  }
  if (["imperative_request", "polite_interrogative_request", "correction"].includes(speechAct)) {
    return { allowed: sideEffectClass !== "unknown", reason: "action_request" };
  }
  return {
    allowed: sideEffectClass === "read_only",
    reason: sideEffectClass === "read_only" ? "unknown_read_only" : "unknown_speech_act_blocks_side_effect",
  };
}

export function sideEffectIsStateChanging(sideEffectClass) {
  return [
    "reversible_mapping_edit",
    "reversible_grouping_edit",
    "workflow_preparation",
    "requires_parser_run_confirmation",
    "requires_graph_apply_confirmation",
    "graph_edit_preview",
    "navigation",
    "file_picker",
    "batch_state_edit",
    "destructive_batch_state",
    "runtime_control",
    "runtime_probe",
    "confirmation_control",
    "download_or_copy",
  ].includes(sideEffectClass);
}

export function authorizeCompiledSideEffect({
  semantics = null,
  sideEffectClass = "unknown",
  plan = null,
  context = {},
} = {}) {
  const requiresPositiveGate = sideEffectIsStateChanging(sideEffectClass)
    || planLooksStateChanging(plan, context);
  if (!requiresPositiveGate) {
    return { allowed: true, reason: "read_only_or_non_mutating_side_effect" };
  }
  if (!semantics) {
    return { allowed: false, reason: "missing_request_semantics" };
  }
  const positiveAuthorization = authorizationAllowsSideEffect(semantics.authorization, sideEffectClass);
  if (!positiveAuthorization.allowed) {
    return {
      ...positiveAuthorization,
      blockedSideEffect: sideEffectClass,
      plan,
      context,
    };
  }
  if (semantics.mode !== "execute" || semantics.executionAuthorized !== true) {
    return {
      allowed: false,
      reason: "request_semantics_do_not_authorize_execution",
      blockedSideEffect: sideEffectClass,
      plan,
      context,
    };
  }
  if (semantics.readOnlyScope) {
    return {
      allowed: false,
      reason: "read_only_scope_blocks_side_effect",
      blockedSideEffect: sideEffectClass,
      plan,
      context,
    };
  }
  if (["declarative_mapping_statement", "declarative_graph_statement"].includes(context?.speechAct)) {
    return { allowed: true, reason: "declarative_speech_act_authorized" };
  }
  const executableClause = (semantics.clauses ?? []).some(clause => clause.executable === true);
  if (!executableClause && (semantics.clauses ?? []).length) {
    return {
      allowed: false,
      reason: "no_executable_clause_for_side_effect",
      blockedSideEffect: sideEffectClass,
      plan,
      context,
    };
  }
  return { allowed: true, reason: positiveAuthorization.reason };
}

function planLooksStateChanging(plan, context = {}) {
  const typedKind = context?.typedKind ?? plan?.typedKind ?? null;
  const operations = plan?.operations
    ?? plan?.draft?.operations
    ?? plan?.plan?.operations
    ?? context?.operations
    ?? [];
  if (typedKind === "GraphMutationPlan") return operations.length > 0;
  if (typedKind === "DatasetMappingPatch") return operations.length > 0;
  if (typedKind === "ParserWorkflowOperation") {
    return operations.some(operation => !READ_ONLY_WORKFLOW.has(operation?.type));
  }
  if (typedKind === "DashboardControlIntent") {
    const intent = plan?.canonicalIntent ?? plan?.intent ?? context?.intent ?? "";
    return NAVIGATION_INTENTS.has(intent) || RUNTIME_CONTROL_INTENTS.has(intent) || /^NAVIGATE_|^OPEN_|^SET_/.test(String(intent));
  }
  if (typedKind === "LegacyActionIntent") return Boolean(plan?.sideEffect && plan.sideEffect !== "read_only");
  return false;
}

function typedKindForDomain(domain) {
  if (domain === "graph_mutation") return "GraphMutationPlan";
  if (domain === "dataset_mapping" || domain === "dataset_grouping") return "DatasetMappingPatch";
  if (domain === "parser_workflow") return "ParserWorkflowOperation";
  if (domain === "dashboard_control") return "DashboardControlIntent";
  if (domain === "legacy_action") return "LegacyActionIntent";
  if (domain === "grounded_question") return "GroundedQuestion";
  if (domain === "help_query") return "DeterministicHelpQuery";
  return null;
}
