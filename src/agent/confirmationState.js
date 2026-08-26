import { selectionFingerprint } from "../graph/entityResolver.js";

export const CONFIRMATION_TTL_MS = 10 * 60 * 1000;

let confirmationCounter = 0;

export function createConfirmationSnapshot(actionType, state, context = {}) {
  const mutationPlan = context.mutationPlan ?? context.plan ?? null;
  return {
    id: createConfirmationId(),
    actionType,
    batchId: state.activeBatchId ?? null,
    batchVersion: state.batchVersion ?? 0,
    mappingRevision: state.activeBatch?.mappingRevision ?? null,
    resultId: state.customResultId ?? null,
    graphId: state.graphId ?? null,
    graphVersion: state.graphVersion ?? 0,
    graphFingerprint: state.graphFingerprint ?? null,
    customCodeVersion: state.customCodeVersion ?? 0,
    mutationPlanId: mutationPlan?.planId ?? null,
    mutationPlanHash: mutationPlan?.planHash ?? null,
    selectionFingerprint: context.selectionFingerprint ?? mutationPlan?.metadata?.selectionFingerprint ?? null,
    createdAt: Date.now(),
    expiresAt: Date.now() + CONFIRMATION_TTL_MS,
  };
}

export function isConfirmationStale(snapshot, state) {
  if (!snapshot) return true;
  const now = Date.now();
  if (Number.isFinite(snapshot.expiresAt) && now > snapshot.expiresAt) return true;
  return snapshot.batchId !== (state.activeBatchId ?? null)
    || snapshot.batchVersion !== (state.batchVersion ?? 0)
    || snapshot.mappingRevision !== (state.activeBatch?.mappingRevision ?? null)
    || snapshot.resultId !== (state.customResultId ?? null)
    || snapshot.graphId !== (state.graphId ?? null)
    || snapshot.graphVersion !== (state.graphVersion ?? 0)
    || snapshot.graphFingerprint !== (state.graphFingerprint ?? null)
    || snapshot.customCodeVersion !== (state.customCodeVersion ?? 0)
    || (snapshot.selectionFingerprint != null
      && snapshot.selectionFingerprint !== selectionFingerprint(state.selectedGraphEntity));
}

function createConfirmationId() {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) return `confirmation-${cryptoApi.randomUUID()}`;
  confirmationCounter += 1;
  return `confirmation-${Date.now().toString(36)}-${confirmationCounter.toString(36)}`;
}
