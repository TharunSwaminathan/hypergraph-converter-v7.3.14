import { REQUIRED_CONTEXT } from "./deterministicNlu/commandCatalogSchema.js";

export function missingActionArguments(action = {}, args = {}) {
  return (action.argumentSlots ?? []).filter(slot => {
    const value = args?.[slot];
    if (typeof value === "number") return !Number.isFinite(value);
    return value == null || String(value).trim() === "";
  });
}

export function evaluateActionContext(action = {}, state = {}, pendingAction = null, args = {}) {
  const requirements = (action.requiredContext ?? [REQUIRED_CONTEXT.NONE])
    .filter(requirement => requirement !== REQUIRED_CONTEXT.NONE);
  for (const requirement of requirements) {
    const check = checkRequirement(requirement, state, pendingAction, args);
    if (!check.ok) {
      return {
        ok: false,
        requirement,
        message: check.message ?? defaultMissingContextMessage(requirement),
      };
    }
  }
  return { ok: true, requirement: null, message: "" };
}

export function defaultMissingArgumentMessage(action = {}, missing = []) {
  if (missing.includes("batchNumber")) {
    return action.intent === "generate_parser_for_batch"
      ? "Which batch number should I use? For example: Generate parser for batch 2."
      : "Which batch number should I activate? For example: Activate batch 2.";
  }
  if (missing.includes("modelName")) return "Which model name should I use? For example: Use model qwen3:8b.";
  return `This command needs: ${missing.join(", ")}.`;
}

export function defaultMissingContextMessage(requirement) {
  return ({
    [REQUIRED_CONTEXT.LOADED_GRAPH]: "Load or parse a graph first.",
    [REQUIRED_CONTEXT.EXISTING_HYPEREDGE]: "That command needs an existing hyperedge.",
    [REQUIRED_CONTEXT.EXISTING_VERTEX]: "That command needs an existing vertex.",
    [REQUIRED_CONTEXT.GRAPH_HISTORY]: "There is no reversible graph edit to undo.",
    [REQUIRED_CONTEXT.UPLOADED_FILES]: "Upload files first.",
    [REQUIRED_CONTEXT.ACTIVE_BATCH]: "Upload or activate a file batch first.",
    [REQUIRED_CONTEXT.VALID_MAPPING]: "Generate and validate a mapping for the active batch first.",
    [REQUIRED_CONTEXT.PARSER_PLAN_READY]: "Generate a transformation plan first.",
    [REQUIRED_CONTEXT.GENERATED_PARSER]: "Generate parser code first.",
    [REQUIRED_CONTEXT.PARSER_RESULT]: "Run the parser and produce a validated result first.",
    [REQUIRED_CONTEXT.PARSER_RESULT_READY]: "Run the parser and produce a validated result first.",
    [REQUIRED_CONTEXT.PENDING_ACTION]: "No pending action is currently staged.",
    [REQUIRED_CONTEXT.COMPATIBLE_PENDING_CONFIRMATION]: "There is no compatible pending action to confirm.",
    [REQUIRED_CONTEXT.ACTIVE_MODEL_WORK]: "No local-model request is active.",
    [REQUIRED_CONTEXT.ACTIVE_CANCELLABLE_WORK]: "There is no active cancellable model or runtime work.",
    [REQUIRED_CONTEXT.REVERSIBLE_COMMITTED_HISTORY]: "There is no reversible committed action available.",
    [REQUIRED_CONTEXT.MATCHING_PENDING_OR_RECENT_INTERPRETATION]: "There is no matching pending or recent interpretation to correct.",
    [REQUIRED_CONTEXT.EXISTING_BATCH]: "That upload batch does not exist.",
    [REQUIRED_CONTEXT.VALID_MAPPING_FOR_BATCH]: "That batch does not have a valid mapping yet.",
  })[requirement] ?? `Required context is missing: ${requirement}.`;
}

function checkRequirement(requirement, state, pendingAction, args) {
  const activeBatch = state.activeBatch ?? null;
  const batches = state.agentBatches ?? [];
  const batchNumber = Number(args?.batchNumber);
  const targetBatch = Number.isFinite(batchNumber)
    ? batches.find(batch => batch.id === `batch-${batchNumber}`) ?? batches[batchNumber - 1] ?? null
    : null;
  switch (requirement) {
    case REQUIRED_CONTEXT.NONE:
      return { ok: true };
    case REQUIRED_CONTEXT.LOADED_GRAPH:
      return { ok: Boolean(state.hasGraph || (state.hyperedgeCount ?? 0) > 0) };
    case REQUIRED_CONTEXT.EXISTING_HYPEREDGE:
      return { ok: Boolean(state.hasGraph && (state.hyperedgeCount ?? 0) > 0) };
    case REQUIRED_CONTEXT.EXISTING_VERTEX:
      return { ok: Boolean(state.hasGraph && (state.vertexCount ?? 0) > 0) };
    case REQUIRED_CONTEXT.GRAPH_HISTORY:
    case REQUIRED_CONTEXT.REVERSIBLE_COMMITTED_HISTORY:
      return { ok: Boolean((state.graphHistory ?? []).length || (state.reversibleHistory ?? []).length) };
    case REQUIRED_CONTEXT.UPLOADED_FILES:
      return { ok: Boolean((state.agentFileCount ?? 0) > 0 || batches.length) };
    case REQUIRED_CONTEXT.ACTIVE_BATCH:
      return { ok: Boolean(activeBatch || state.activeBatchId) };
    case REQUIRED_CONTEXT.VALID_MAPPING:
      return { ok: Boolean(activeBatch?.mappingSpec && ["valid", "accepted", "repaired"].includes(activeBatch?.mappingSpecStatus ?? "valid")) };
    case REQUIRED_CONTEXT.PARSER_PLAN_READY:
      return { ok: Boolean(state.transformationPlan || activeBatch?.transformationPlan) };
    case REQUIRED_CONTEXT.GENERATED_PARSER:
      return { ok: Boolean(state.customCodeExists || state.customCode) };
    case REQUIRED_CONTEXT.PARSER_RESULT:
    case REQUIRED_CONTEXT.PARSER_RESULT_READY:
      return { ok: Boolean(state.customResultId || state.customResult) };
    case REQUIRED_CONTEXT.PENDING_ACTION:
      return { ok: Boolean(pendingAction) };
    case REQUIRED_CONTEXT.COMPATIBLE_PENDING_CONFIRMATION:
      return { ok: Boolean(pendingAction?.kind === "confirmation" || pendingAction?.actionType) };
    case REQUIRED_CONTEXT.ACTIVE_MODEL_WORK:
      return { ok: Boolean(state.localModel?.request?.busy || state.localModelRequestActive || state.activeModelRequest) };
    case REQUIRED_CONTEXT.ACTIVE_CANCELLABLE_WORK:
      return { ok: Boolean(state.localModel?.request?.busy || state.localModelRequestActive || state.activeCancellableWork || state.activeRequestCount > 0) };
    case REQUIRED_CONTEXT.MATCHING_PENDING_OR_RECENT_INTERPRETATION:
      return { ok: Boolean(pendingAction || state.lastNluDiagnostic || state.recentInterpretation) };
    case REQUIRED_CONTEXT.EXISTING_BATCH:
      return { ok: Boolean(targetBatch), message: targetBatch ? "" : `Batch ${Number.isFinite(batchNumber) ? batchNumber : "number"} does not exist.` };
    case REQUIRED_CONTEXT.VALID_MAPPING_FOR_BATCH:
      return {
        ok: Boolean(targetBatch?.mappingSpec && ["valid", "accepted", "repaired"].includes(targetBatch?.mappingSpecStatus ?? "valid")),
        message: targetBatch ? `${targetBatch.label ?? `Batch ${batchNumber}`} does not have a valid mapping yet.` : `Batch ${Number.isFinite(batchNumber) ? batchNumber : "number"} does not exist.`,
      };
    default:
      return { ok: true };
  }
}

const HANDLER_PLAN_KIND_ALIASES = Object.freeze({
  activate_batch: ["activate_batch", "activate_batch_then_generate_parser", "generate_parser_from_mapping", "respond"],
  generate_mapping_spec: ["run_local_model_task", "generate_deterministic_mapping", "respond"],
  run_local_model_task: ["run_local_model_task", "generate_parser_from_mapping", "generate_deterministic_mapping", "respond"],
  test_local_model: ["test_local_model", "respond"],
  configure_local_model: ["configure_local_model", "respond"],
  parse_uploaded_files: ["parse_uploaded_files", "respond"],
  use_active_batch: ["respond"],
  use_as_new_dataset: ["respond"],
  respond: ["respond"],
  switch_section: ["switch_section", "show_stats", "respond"],
  run_runtime_diagnostics: ["run_runtime_diagnostics", "respond"],
  generate_parser_from_mapping: ["generate_parser_from_mapping", "respond"],
  generate_deterministic_mapping: ["generate_deterministic_mapping", "respond"],
});

/**
 * Enforces the registry handler contract after contextual planning. A planner
 * may choose an explicitly documented fallback, but it may not silently route
 * a public command to an unrelated handler kind.
 */
export function validatePlannedAction(action = {}, plan = {}) {
  const handlerKind = action.handlerKind;
  const planKind = plan?.kind;
  if (!handlerKind || !planKind) {
    return { ok: false, message: "The action registry or planner returned incomplete handler metadata." };
  }
  const allowed = HANDLER_PLAN_KIND_ALIASES[handlerKind] ?? [handlerKind, "respond"];
  if (!allowed.includes(planKind)) {
    return {
      ok: false,
      handlerKind,
      planKind,
      allowed,
      message: `Registry authority rejected planner handler ${planKind} for ${action.intent}; expected ${allowed.join(" or ")}.`,
    };
  }
  return { ok: true, handlerKind, planKind, allowed };
}
