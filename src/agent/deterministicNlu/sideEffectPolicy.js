import { speechActIsReadOnly } from "./speechActClassifier.js";
import { authorizationAllowsSideEffect } from "./positiveAuthorization.js";
import { resolvePublicActionIntentReference } from "../actionIntentRegistry.js";
import { authorizeGraphMutationOperations } from "./graphOperationAuthorization.js";

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

const TYPED_KINDS_BY_DOMAIN = Object.freeze({
  graph_mutation: Object.freeze(["GraphMutationPlan", "GraphMutationDraft"]),
  dataset_mapping: Object.freeze(["DatasetMappingPatch"]),
  dataset_grouping: Object.freeze(["DatasetMappingPatch"]),
  parser_workflow: Object.freeze(["ParserWorkflowOperation"]),
  dashboard_control: Object.freeze(["DashboardControlIntent"]),
  legacy_action: Object.freeze(["LegacyActionIntent"]),
  grounded_question: Object.freeze(["GroundedQuestion"]),
  help_query: Object.freeze(["DeterministicHelpQuery"]),
});

const DOMAINS_BY_TYPED_KIND = Object.freeze({
  GraphMutationPlan: Object.freeze(["graph_mutation"]),
  GraphMutationDraft: Object.freeze(["graph_mutation"]),
  DatasetMappingPatch: Object.freeze(["dataset_mapping", "dataset_grouping"]),
  ParserWorkflowOperation: Object.freeze(["parser_workflow"]),
  DashboardControlIntent: Object.freeze(["dashboard_control"]),
  LegacyActionIntent: Object.freeze(["legacy_action"]),
  GroundedQuestion: Object.freeze(["grounded_question"]),
  DeterministicHelpQuery: Object.freeze(["help_query"]),
});

const OPERATION_FREE_TYPED_KINDS = new Set([
  "DashboardControlIntent",
  "LegacyActionIntent",
  "GroundedQuestion",
  "DeterministicHelpQuery",
]);

function operationsForCompilation(typedValue, compiled) {
  const candidates = [
    typedValue?.operations,
    typedValue?.draft?.operations,
    typedValue?.plan?.operations,
    compiled?.draft?.operations,
    compiled?.plan?.operations,
    compiled?.operations,
  ];
  return candidates.find(value => Array.isArray(value) && value.length)
    ?? candidates.find(Array.isArray)
    ?? (Array.isArray(typedValue) ? typedValue : []);
}

function invalidIdentity({
  domain,
  typedKind,
  declaredDomain,
  declaredTypedKind,
  operationTypes,
  reason,
  sideEffectClass = "unknown",
  legacyRegistryEntry = null,
}) {
  return Object.freeze({
    valid: false,
    reason,
    domain,
    typedKind,
    declaredDomain,
    declaredTypedKind,
    sideEffectClass,
    operationTypes,
    legacyRegistryId: legacyRegistryEntry?.id ?? null,
    legacyIntent: legacyRegistryEntry?.intent ?? null,
  });
}

function resolveLegacyAuthority(typedValue, compiled) {
  const sources = [typedValue, compiled?.action]
    .filter(value => value && typeof value === "object" && !Array.isArray(value));
  const identitySources = sources.filter(source => (
    source.registryId || source.intent || source.handlerKind || source.kind
  ));
  if (!identitySources.length) {
    return { valid: false, reason: "legacy_action_unregistered", entry: null };
  }
  const resolutions = identitySources.map(resolvePublicActionIntentReference);
  const invalid = resolutions.find(resolution => !resolution.valid);
  if (invalid) return invalid;
  const entry = resolutions[0].entry;
  if (resolutions.some(resolution => resolution.entry.id !== entry.id)) {
    return { valid: false, reason: "legacy_action_identity_mismatch", entry: null };
  }
  const suppliedSideEffects = sources
    .map(source => source.sideEffect)
    .filter(value => value !== undefined && value !== null);
  if (suppliedSideEffects.some(sideEffect => sideEffect !== entry.sideEffect)) {
    return { valid: false, reason: "legacy_side_effect_metadata_mismatch", entry };
  }
  return { valid: true, reason: null, entry };
}

export function resolveActualPlanIdentity(compilation = {}) {
  const declaredDomain = compilation.domain ?? compilation.compiled?.domain ?? null;
  const declaredTypedKind = compilation.typedKind ?? compilation.compiled?.typedKind ?? null;
  const domain = declaredDomain ?? DOMAINS_BY_TYPED_KIND[declaredTypedKind]?.[0] ?? null;
  const typedKind = declaredTypedKind ?? TYPED_KINDS_BY_DOMAIN[domain]?.[0] ?? null;
  const typedValue = compilation.typedValue ?? null;
  const compiled = compilation.compiled ?? {};
  const operations = operationsForCompilation(typedValue, compiled);
  const operationTypes = operations.map(operation => operation?.type).filter(Boolean);

  if (!domain || !typedKind || !DOMAINS_BY_TYPED_KIND[typedKind]) {
    return invalidIdentity({
      domain,
      typedKind,
      declaredDomain,
      declaredTypedKind,
      operationTypes,
      reason: "unknown_plan_identity",
    });
  }
  if (!DOMAINS_BY_TYPED_KIND[typedKind].includes(domain)
    || !TYPED_KINDS_BY_DOMAIN[domain]?.includes(typedKind)) {
    return invalidIdentity({
      domain,
      typedKind,
      declaredDomain,
      declaredTypedKind,
      operationTypes,
      reason: "plan_identity_mismatch",
    });
  }
  if (OPERATION_FREE_TYPED_KINDS.has(typedKind) && operations.length) {
    return invalidIdentity({
      domain,
      typedKind,
      declaredDomain,
      declaredTypedKind,
      operationTypes,
      reason: "unexpected_state_changing_payload",
    });
  }

  let sideEffectClass = "read_only";
  let legacyRegistryEntry = null;
  if (typedKind === "GroundedQuestion" || typedKind === "DeterministicHelpQuery") {
    sideEffectClass = "read_only";
  } else if (typedKind === "LegacyActionIntent") {
    const legacyAuthority = resolveLegacyAuthority(typedValue, compiled);
    const authoritativeSideEffect = legacyAuthority.entry?.sideEffect ?? "unknown";
    if (!legacyAuthority.valid) {
      return invalidIdentity({
        domain,
        typedKind,
        declaredDomain,
        declaredTypedKind,
        operationTypes,
        reason: legacyAuthority.reason,
        sideEffectClass: authoritativeSideEffect,
        legacyRegistryEntry: legacyAuthority.entry,
      });
    }
    legacyRegistryEntry = legacyAuthority.entry;
    sideEffectClass = authoritativeSideEffect;
  }
  if (typedKind === "DatasetMappingPatch") {
    sideEffectClass = !operations.length ? "read_only"
      : operations.every(operation => GROUPING_OPERATIONS.has(operation.type))
        ? "reversible_grouping_edit"
        : "reversible_mapping_edit";
  }
  if (typedKind === "GraphMutationPlan") sideEffectClass = operations.length ? "graph_edit_preview" : "read_only";
  if (typedKind === "GraphMutationDraft") sideEffectClass = "graph_edit_preview";
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
    valid: true,
    reason: null,
    domain,
    sideEffectClass,
    typedKind,
    declaredDomain,
    declaredTypedKind,
    operationTypes,
    legacyRegistryId: legacyRegistryEntry?.id ?? null,
    legacyIntent: legacyRegistryEntry?.intent ?? null,
  });
}

export function deriveActualSideEffect(compilation = {}) {
  return resolveActualPlanIdentity(compilation);
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
  if (sideEffectClass === "graph_edit_preview") {
    const operationAuthorization = authorizeGraphMutationOperations({
      authorization: semantics.authorization,
      actualOperations: plan?.operations ?? plan?.plan?.operations ?? plan?.draft?.operations ?? context?.operations ?? [],
      pendingOperations: context?.pendingOperations ?? [],
      selectedEntity: context?.selectedEntity ?? null,
      graphHyperedges: context?.graphHyperedges ?? [],
    });
    if (!operationAuthorization.allowed) {
      return {
        ...operationAuthorization,
        blockedSideEffect: sideEffectClass,
        plan,
        context,
      };
    }
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
  if (typedKind === "GraphMutationDraft") return true;
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
