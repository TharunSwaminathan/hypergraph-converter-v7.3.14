import { selectionFingerprint } from "../graph/entityResolver.js";

export const CONFIRMATION_TTL_MS = 10 * 60 * 1000;

let confirmationCounter = 0;

export function createConfirmationSnapshot(actionType, state, context = {}) {
  const mutationPlan = context.mutationPlan ?? context.plan ?? null;
  const pendingUpdate = context.pendingUpdate ?? state.pendingDynamicUpdate ?? null;
  return {
    id: createConfirmationId(),
    actionType,
    batchId: state.activeBatchId ?? null,
    batchVersion: state.batchVersion ?? 0,
    mappingRevision: state.activeBatch?.mappingRevision ?? null,
    resultId: state.customResultId ?? null,
    graphId: state.graphId ?? null,
    graphVersion: state.graphVersion ?? 0,
    graphType: state.graphType ?? state.candy?.graphType ?? null,
    graphFingerprint: state.graphFingerprint ?? null,
    customCodeVersion: state.customCodeVersion ?? 0,
    mutationPlanId: mutationPlan?.planId ?? null,
    mutationPlanHash: mutationPlan?.planHash ?? null,
    pendingUpdateId: pendingUpdate?.updateId ?? null,
    pendingUpdateRevision: pendingUpdate?.revision ?? null,
    pendingUpdateDigest: pendingUpdate?.updateDigest ?? null,
    proposedGraphFingerprint: pendingUpdate?.proposedGraphFingerprint ?? null,
    nextGraphVersion: pendingUpdate?.nextGraphVersion ?? null,
    selectionFingerprint: context.selectionFingerprint ?? mutationPlan?.metadata?.selectionFingerprint ?? null,
    createdAt: Date.now(),
    expiresAt: Date.now() + CONFIRMATION_TTL_MS,
  };
}

export function isConfirmationStale(snapshot, state) {
  if (!snapshot) return true;
  const now = Date.now();
  if (Number.isFinite(snapshot.expiresAt) && now > snapshot.expiresAt) return true;
  const pendingUpdate = state.pendingDynamicUpdate ?? null;
  return snapshot.batchId !== (state.activeBatchId ?? null)
    || snapshot.batchVersion !== (state.batchVersion ?? 0)
    || snapshot.mappingRevision !== (state.activeBatch?.mappingRevision ?? null)
    || snapshot.resultId !== (state.customResultId ?? null)
    || snapshot.graphId !== (state.graphId ?? null)
    || snapshot.graphVersion !== (state.graphVersion ?? 0)
    || snapshot.graphType !== (state.graphType ?? state.candy?.graphType ?? null)
    || snapshot.graphFingerprint !== (state.graphFingerprint ?? null)
    || snapshot.customCodeVersion !== (state.customCodeVersion ?? 0)
    || snapshot.pendingUpdateId !== (pendingUpdate?.updateId ?? null)
    || snapshot.pendingUpdateRevision !== (pendingUpdate?.revision ?? null)
    || snapshot.pendingUpdateDigest !== (pendingUpdate?.updateDigest ?? null)
    || snapshot.proposedGraphFingerprint !== (pendingUpdate?.proposedGraphFingerprint ?? null)
    || snapshot.nextGraphVersion !== (pendingUpdate?.nextGraphVersion ?? null)
    || (snapshot.selectionFingerprint != null
      && snapshot.selectionFingerprint !== selectionFingerprint(state.selectedGraphEntity));
}

function createConfirmationId() {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) return `confirmation-${cryptoApi.randomUUID()}`;
  confirmationCounter += 1;
  return `confirmation-${Date.now().toString(36)}-${confirmationCounter.toString(36)}`;
}
