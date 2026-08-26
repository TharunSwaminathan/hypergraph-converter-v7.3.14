import { planAgentAction } from "./actionPlanner.js";

/**
 * Executes numbered batch commands without recursively submitting natural
 * language. The caller supplies state/action adapters so the operation is
 * testable outside React and remains bound to the verified active batch.
 */
export async function executeNumberedBatchPlan({
  plan,
  getState,
  setActiveBatch,
  verifyActiveBatch,
  dispatchPlan,
  planAction = planAgentAction,
} = {}) {
  if (!plan || !["activate_batch", "activate_batch_then_generate_parser"].includes(plan.kind)) {
    return { ok: false, changedState: false, outcome: "unsupported_plan", error: "Unsupported numbered batch plan." };
  }
  if (!plan.batchId) {
    return { ok: false, changedState: false, outcome: "missing_batch_id", error: "A batch ID is required." };
  }
  const previousState = getState?.() ?? {};
  const previousBatchId = previousState.activeBatchId ?? previousState.activeBatch?.id ?? null;
  const activation = await setActiveBatch?.(plan.batchId);
  if (!activation?.ok) {
    return { ok: false, changedState: false, outcome: "activation_failed", error: activation?.error ?? "Batch activation failed." };
  }
  const verified = await verifyActiveBatch?.(plan.batchId);
  if (!verified) {
    return { ok: false, changedState: false, outcome: "activation_unverified", error: "The active batch could not be verified." };
  }
  const activationChanged = typeof activation.changedState === "boolean"
    ? activation.changedState
    : previousBatchId !== plan.batchId;
  if (plan.kind === "activate_batch") {
    return {
      ok: true,
      changedState: activationChanged,
      stateMutationCommitted: activationChanged,
      outcome: activationChanged ? "batch_activated" : "batch_already_active",
      batchId: plan.batchId,
    };
  }

  const currentState = getState?.() ?? {};
  const generationPlan = planAction({
    intent: "local_model_generate_parser",
    normalized: "generate parser for active batch",
  }, currentState);
  const generationOutcome = await dispatchPlan?.(generationPlan);
  if (!generationOutcome || generationOutcome.ok === false) {
    return {
      ok: false,
      changedState: activationChanged || Boolean(generationOutcome?.changedState || generationOutcome?.stateMutationCommitted),
      stateMutationCommitted: activationChanged || Boolean(generationOutcome?.stateMutationCommitted),
      outcome: "batch_activated_parser_failed",
      batchId: plan.batchId,
      generationPlan,
      childOutcome: generationOutcome ?? null,
      error: generationOutcome?.error ?? "Parser generation did not complete.",
    };
  }
  return {
    ok: true,
    changedState: activationChanged || Boolean(generationOutcome.changedState || generationOutcome.stateMutationCommitted),
    stateMutationCommitted: activationChanged || Boolean(generationOutcome.stateMutationCommitted),
    outcome: "batch_activated_then_parser_generated",
    batchId: plan.batchId,
    generationPlan,
    childOutcome: generationOutcome,
  };
}

export function executeModelSelectionPlan({ plan, updateLocalModelSettings } = {}) {
  if (plan?.kind !== "set_local_model_name" || !plan.modelName) {
    return { ok: false, changedState: false, outcome: "missing_model_name", error: "A validated model name is required." };
  }
  const result = updateLocalModelSettings?.({ model: plan.modelName });
  const changedState = typeof result?.changedState === "boolean"
    ? result.changedState
    : Boolean(result?.ok);
  return {
    ok: Boolean(result?.ok),
    changedState,
    changedKeys: result?.changedKeys ?? (changedState ? ["model"] : []),
    outcome: result?.ok ? (changedState ? "model_name_updated" : "model_name_already_selected") : "model_name_update_failed",
    details: result ?? null,
    error: result?.ok ? null : result?.error ?? "The model name was not updated.",
  };
}
