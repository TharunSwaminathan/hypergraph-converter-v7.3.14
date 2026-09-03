import { bindingMismatch, createStateContextBinding, staleBindingMessage } from "./contextBinding.js";
import { finishRuntimeTrace } from "./runtimeInstrumentation.js";
import { evaluateActionContext } from "../actionContextPolicy.js";
import {
  authorizeCompiledSideEffect,
  resolveActualPlanIdentity,
  sideEffectIsStateChanging,
} from "./sideEffectPolicy.js";
import { analyzeRequestSemantics } from "./requestSemantics.js";

export async function dispatchCompiledAction({
  prepared,
  query = "",
  state = {},
  pendingAction = null,
  handlers = {},
} = {}) {
  const trace = { ...(prepared?.runtimeTrace ?? {}) };
  const nlu = prepared?.nlu ?? null;
  const compilation = prepared?.compilation ?? null;
  trace.status = "dispatching";
  if (!prepared?.handled || !compilation) return result(false, "not_handled", trace, "completed");

  if (nlu?.limits?.truncated) {
    await handlers.truncated?.(prepared, query);
    trace.dispatchPath = "deterministic_truncated";
    return result(true, "responded", trace, "completed");
  }

  const confidence = compilation.semanticConfidence ?? compilation.diagnostics?.semanticConfidence ?? nlu?.confidence ?? {};
  const explicitClarification = Boolean(
    compilation.compiled?.needsClarification
    || compilation.compiled?.draft?.classification === "clarification"
    || compilation.compiled?.classification === "clarification"
    || ((compilation.typedValue?.needsResolution || compilation.typedValue?.classification === "clarification")
      && compilation.requestSemantics
      && compilation.requestSemantics.stateChangingActionAuthorized !== true
      && (compilation.requestSemantics.authorization?.deniedClauses?.length > 0
        || compilation.requestSemantics.mode !== "execute"))
  );
  const blockingAmbiguity = explicitClarification || (
    (compilation.ambiguities?.length ?? nlu?.ambiguities?.length ?? 0) > 0
    && confidence.level !== "high"
  );
  if (blockingAmbiguity) {
    const clarification = compilation.compiled?.clarificationQuestion
      ?? compilation.typedValue?.clarificationQuestion
      ?? compilation.ambiguities?.[0]
      ?? nlu?.ambiguities?.[0]
      ?? null;
    await handlers.clarification?.(prepared, query, clarification);
    trace.dispatchPath = "deterministic_clarification";
    return result(true, "clarification", trace, "completed");
  }

  const declaredSideEffectClass = compilation.sideEffectClass ?? "unknown";
  const actualIdentity = resolveActualPlanIdentity(compilation);
  trace.declaredSideEffectClass = declaredSideEffectClass;
  trace.actualSideEffectClass = actualIdentity.sideEffectClass;
  trace.declaredDomain = actualIdentity.declaredDomain;
  trace.actualDomain = actualIdentity.domain;
  trace.declaredTypedKind = actualIdentity.declaredTypedKind;
  trace.typedKind = actualIdentity.typedKind;
  trace.operationTypes = actualIdentity.operationTypes;
  trace.legacyRegistryId = actualIdentity.legacyRegistryId;
  trace.legacyIntent = actualIdentity.legacyIntent;

  if (!actualIdentity.valid) {
    trace.dispatchPath = "deterministic_final_plan_identity_gate";
    trace.blockedSideEffect = actualIdentity.sideEffectClass;
    trace.dispatchBlockReason = actualIdentity.reason;
    trace.authorizationDecision = "read_only_blocked";
    const outcome = await handlers.blockedSideEffect?.(prepared, query, actualIdentity.reason, actualIdentity);
    applyOutcomeTrace(trace, outcome);
    return result(Boolean(outcome?.handled ?? true), outcome?.outcome ?? "responded", trace, "completed");
  }

  const domain = actualIdentity.domain;
  const stale = staleForDomain(domain, prepared.contextBinding, state, pendingAction);
  if (stale.stale) {
    await handlers.stale?.(prepared, staleBindingMessage(stale.scope), stale);
    trace.dispatchPath = `stale_${domain}`;
    trace.staleDispatchRejected = true;
    return result(true, "clarification", trace, "stale_rejected");
  }

  if (compilation.dispatchAuthorized === false) {
    trace.dispatchPath = "deterministic_side_effect_blocked";
    trace.blockedSideEffect = compilation.sideEffectClass ?? compilation.diagnostics?.blockedSideEffect ?? "unknown";
    const outcome = await handlers.blockedSideEffect?.(prepared, query, compilation.dispatchBlockReason);
    applyOutcomeTrace(trace, outcome);
    return result(Boolean(outcome?.handled ?? true), outcome?.outcome ?? "responded", trace, "completed");
  }

  // The final dispatcher independently derives the side effect from the typed
  // plan. Caller/model metadata is evidence to validate, never authority.
  const actualSideEffectClass = actualIdentity.sideEffectClass;

  if (sideEffectIsStateChanging(actualSideEffectClass)
    && declaredSideEffectClass !== actualSideEffectClass) {
    trace.dispatchPath = "deterministic_final_side_effect_gate";
    trace.blockedSideEffect = actualSideEffectClass;
    trace.dispatchBlockReason = "side_effect_class_mismatch";
    trace.authorizationDecision = "read_only_blocked";
    const outcome = await handlers.blockedSideEffect?.(prepared, query, "side_effect_class_mismatch", {
      declaredSideEffectClass,
      actualSideEffectClass,
      typedKind: actualIdentity.typedKind,
      operationTypes: actualIdentity.operationTypes,
    });
    applyOutcomeTrace(trace, outcome);
    return result(Boolean(outcome?.handled ?? true), outcome?.outcome ?? "responded", trace, "completed");
  }

  // Prepared turns normally carry semantics from the deterministic compiler.
  // If an internal/model-produced prepared object omits them, reconstruct the
  // contract from the original query. An empty query can retain compatibility
  // only for an actually read-only plan; state-changing plans fail closed.
  const finalSemantics = compilation.requestSemantics
    ?? compilation.diagnostics?.requestSemantics
    ?? prepared?.nlu?.requestSemantics
    ?? (String(query ?? "").trim() ? analyzeRequestSemantics(query) : null);
  const finalAuthorization = authorizeCompiledSideEffect({
    semantics: finalSemantics,
    sideEffectClass: actualSideEffectClass,
    plan: compilation.typedValue ?? compilation.compiled ?? null,
    context: {
      dispatchDomain: domain,
      typedKind: actualIdentity.typedKind,
      intent: compilation.intent,
      operationTypes: actualIdentity.operationTypes,
    },
  });
  if (!finalAuthorization.allowed) {
    trace.dispatchPath = "deterministic_final_side_effect_gate";
    trace.blockedSideEffect = actualSideEffectClass;
    trace.dispatchBlockReason = finalAuthorization.reason;
    trace.authorizationDecision = finalAuthorization.reason === "denied_by_user" ? "denied_by_user"
      : finalAuthorization.reason === "clarification_required" ? "clarification_required"
        : "read_only_blocked";
    const outcome = await handlers.blockedSideEffect?.(prepared, query, finalAuthorization.reason);
    applyOutcomeTrace(trace, outcome);
    return result(Boolean(outcome?.handled ?? true), outcome?.outcome ?? "responded", trace, "completed");
  }
  trace.authorizationDecision = "authorized";

  if (domain === "help_query") {
    trace.dispatchPath = "typed_help_query";
    const handled = await handlers.helpQuery?.(prepared, query);
    applyOutcomeTrace(trace, handled);
    return result(Boolean(handled?.handled ?? handled), handled?.outcome ?? (handled ? "responded" : "not_handled"), trace, "completed");
  }

  if (domain === "grounded_question") {
    trace.dispatchPath = "typed_grounded_question";
    const handled = await handlers.groundedQuestion?.(prepared, query);
    applyOutcomeTrace(trace, handled);
    return result(Boolean(handled?.handled ?? handled), handled?.outcome ?? (handled ? "responded" : "not_handled"), trace, "completed");
  }
  if (domain === "dataset_mapping" || domain === "dataset_grouping") {
    trace.dispatchPath = "typed_dataset_mapping";
    const outcome = await handlers.datasetMapping?.(prepared, query);
    applyOutcomeTrace(trace, outcome);
    return result(Boolean(outcome?.handled ?? outcome), outcome?.outcome ?? "responded", trace, "completed");
  }
  if (domain === "parser_workflow") {
    trace.dispatchPath = "typed_parser_workflow";
    const outcome = await handlers.parserWorkflow?.(prepared, query);
    applyOutcomeTrace(trace, outcome);
    return result(Boolean(outcome?.handled ?? outcome), outcome?.outcome ?? "responded", trace, "completed");
  }
  if (domain === "graph_mutation") {
    trace.dispatchPath = "typed_graph_mutation";
    const outcome = await handlers.graphMutation?.(prepared, query);
    applyOutcomeTrace(trace, outcome);
    return result(Boolean(outcome?.handled ?? outcome), outcome?.outcome ?? "staged_confirmation", trace, "completed");
  }
  if (domain === "dashboard_control") {
    trace.dispatchPath = "typed_dashboard_control";
    const outcome = await handlers.dashboardControl?.(prepared, query);
    applyOutcomeTrace(trace, outcome);
    return result(Boolean(outcome?.handled ?? outcome), outcome?.outcome ?? "responded", trace, "completed");
  }
  if (domain === "legacy_action") {
    const action = compilation.typedValue ?? compilation.compiled?.action ?? {};
    const context = evaluateActionContext(action, state, pendingAction, action);
    if (!context.ok) {
      trace.dispatchPath = "deterministic_context_missing";
      trace.requiredContext = action.requiredContext ?? [];
      trace.missingContext = context.requirement;
      const outcome = await handlers.contextMissing?.(prepared, query, context);
      applyOutcomeTrace(trace, outcome);
      return result(Boolean(outcome?.handled ?? true), outcome?.outcome ?? "clarification", trace, "completed");
    }
    trace.dispatchPath = "typed_legacy_action";
    const outcome = await handlers.legacyAction?.(prepared, query);
    applyOutcomeTrace(trace, outcome);
    return result(Boolean(outcome?.handled ?? outcome), outcome?.outcome ?? "responded", trace, "completed");
  }

  return result(false, "not_handled", trace, "completed");
}

function staleForDomain(domain, expected, state, pendingAction) {
  if (!expected) return { stale: false, scope: "none" };
  const current = createStateContextBinding(state, pendingAction);
  const scope = domain === "graph_mutation" ? "graph"
    : domain === "dataset_mapping" || domain === "dataset_grouping" ? "mapping"
      : domain === "parser_workflow" ? "parser"
        : "dashboard";
  return { ...bindingMismatch(expected, current, scope), scope };
}

function applyOutcomeTrace(trace, outcome) {
  if (!outcome || typeof outcome !== "object") return;
  if (outcome.tracePatch) mergeTracePatch(trace, outcome.tracePatch);
  if (outcome.confirmationStaged) trace.confirmationStaged = true;
  if (outcome.stateMutationCommitted) trace.stateMutationCommitted = true;
}

function mergeTracePatch(trace, patch) {
  for (const [key, value] of Object.entries(patch)) {
    if (key === "modelCalls" && Array.isArray(value)) {
      trace.modelCalls = [...(trace.modelCalls ?? []), ...value];
    } else if (key === "validatorCalls" && Array.isArray(value)) {
      trace.validatorCalls = [...(trace.validatorCalls ?? []), ...value];
    } else {
      trace[key] = value;
    }
  }
}

function result(handled, outcome, trace, status) {
  return {
    handled,
    outcome,
    diagnostics: {
      dispatchPath: trace.dispatchPath ?? "not_dispatched",
      modelCalled: (trace.modelCalls?.length ?? 0) > 0,
      genericActionPlannerCalled: (trace.genericActionPlannerCallCount ?? 0) > 0,
      legacyParserCalled: (trace.legacyRawParserCallCount ?? 0) > 0,
      speechAct: trace.speechAct ?? "unknown",
      sideEffectClass: trace.sideEffectClass ?? "read_only",
    },
    runtimeTrace: finishRuntimeTrace(trace, { status }),
  };
}
