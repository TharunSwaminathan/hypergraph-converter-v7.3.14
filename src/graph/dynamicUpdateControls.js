import { createMutationPlan } from "./graphMutationValidator.js";
import { graphIdentityFromState } from "./graphState.js";
import { createConfirmationSnapshot } from "../agent/confirmationState.js";
import { APPLY_PENDING_HYPERGRAPH_UPDATE_ACTION } from "./pendingHypergraphUpdate.js";
import { parseBatchUpdates, batchUpdatesToMutationOperations } from "../utils/batchUpdates.js";
import { motifApplicationBinding, motifAuthorityKey } from "../candy/motifPreflight.js";
import { QUALIFIED_INCREMENTAL_UPDATE_LIMITS as LIMITS } from "../candy/adapters/graphMutationToHypergraphUpdate.js";

// A control surface over the qualified owners. It retains approvals only;
// committed graphs, pending updates and results always come from live getters.
export function createDynamicUpdateControls({ pendingController, getGraphState, getCandy }) {
  let applyApproval = null, applyAnalysisKey = null, busy = false;
  const analysisKey = () => {
    const candy = getCandy().state;
    return JSON.stringify([candy.runtimeSessionId, candy.analysisStatus, candy.selectedJob?.jobId, candy.selectedJob?.status]);
  };
  const current = () => pendingController.getCurrent();
  const reject = message => { throw new Error(message); };
  const exact = selector => {
    if (!selector || Object.keys(selector).some(key => !["updateId", "revision"].includes(key))
      || typeof selector.updateId !== "string" || !Number.isSafeInteger(selector.revision)) reject("Malformed pending-update selector.");
    const pending = current();
    if (!pending || pending.updateId !== selector.updateId || pending.revision !== selector.revision) reject("Pending update superseded or discarded. Re-observe and request again.");
    return pending;
  };
  const guarded = async operation => {
    if (busy) reject("A pending-update transition is already in progress.");
    busy = true;
    try { return await operation(); } finally { busy = false; }
  };
  const observe = () => {
    const pending = current(), candy = getCandy().state;
    const evidence = candy.resultEvidence;
    const resultCurrent = Boolean(evidence?.mode === "INCREMENTAL" && evidence.runtimeSessionId === candy.runtimeSessionId
      && motifAuthorityKey(evidence.applicationBinding) === motifAuthorityKey(motifApplicationBinding(getGraphState(), pending)));
    return pending ? Object.freeze({ updateId: pending.updateId, revision: pending.revision, status: pending.status,
      baseGraphVersion: pending.baseGraphRef.graphVersion, nextGraphVersion: pending.nextGraphVersion,
      operationCount: pending.plan.operations.reduce((sum, op) => sum + (op.operations?.length ?? 1), 0),
      motifImpact: pending.motifImpact, staleReason: pending.staleReason,
      analysisStatus: candy.analysisStatus, resultCurrent }) : null;
  };
  const controls = {
    observe,
    stagePlan: plan => guarded(async () => {
      applyApproval = null;
      const operations = plan?.operations?.flatMap(op => op.operations ?? [op]);
      if (!operations?.length || operations.length > LIMITS.maxDeletions + LIMITS.maxInsertions
        || operations.some(op => op.operations) || operations.reduce((sum, op) => sum + (op.vertices?.length ?? 0), 0) > LIMITS.maxInsertedIncidences) reject("Mutation intent exceeds the qualified update bounds.");
      const result = await pendingController.stage(plan);
      return { ok: true, noOp: result.noOp, pending: observe(), graphCommitted: false };
    }),
    stageBatch(text) {
      if (typeof text !== "string" || text.length > 100000) reject("Batch commands exceed the authoring bound.");
      const parsed = parseBatchUpdates(text), warnings = [];
      if (!parsed.length || parsed.length > LIMITS.maxDeletions + LIMITS.maxInsertions || parsed.some(item => item.op === "UNKNOWN")) reject("Use supported Batch Updates commands within the qualified update bounds; correct unknown commands before staging.");
      const operations = batchUpdatesToMutationOperations(parsed, { warnings, emptyHyperedgePolicy: "remove_empty" });
      return controls.stagePlan(createMutationPlan({ operations, graphIdentity: graphIdentityFromState(getGraphState()),
        source: "dynamic_batch_updates", summary: `Pending batch: ${operations.length} operations` }));
    },
    discard(selector) {
      if (busy) reject("A pending-update transition is already in progress.");
      exact(selector); applyApproval = null; pendingController.discard();
      return { ok: true, pending: observe(), graphCommitted: false };
    },
    requestApply(selector) {
      if (busy) reject("A pending-update transition is already in progress.");
      const pending = exact(selector), graph = getGraphState();
      if (pending.status !== "VALIDATED" || pending.baseGraphRef.graphId !== graph.graphId
        || pending.baseGraphRef.graphVersion !== graph.graphVersion || pending.baseGraphFingerprint !== graph.graphFingerprint
        || graph.graphType !== "DynamicHypergraph") reject("Pending update is stale or unvalidated. Discard or re-stage from the current graph.");
      applyApproval = Object.freeze(createConfirmationSnapshot(APPLY_PENDING_HYPERGRAPH_UPDATE_ACTION, {
        ...graph, pendingDynamicUpdate: pending,
      }, { pendingUpdate: pending, mutationPlan: pending.plan }));
      applyAnalysisKey = analysisKey();
      return { ok: true, confirmation: applyApproval, pending: observe() };
    },
    confirmApply(approval) {
      return guarded(async () => {
        if (!approval || approval !== applyApproval) reject("A currently owned, separate Apply confirmation is required.");
        applyApproval = null; // consume before the first await
        if (analysisKey() !== applyAnalysisKey) reject("Analysis changed or was cancelled. Request a fresh Apply confirmation.");
        exact({ updateId: approval.pendingUpdateId, revision: approval.pendingUpdateRevision });
        const result = await pendingController.apply(approval);
        return { ...result, pending: observe() };
      });
    },
    cancelApply(approval) { if (approval === applyApproval) applyApproval = null; },
    invalidateApply() { applyApproval = null; },
    isApplyCurrent: approval => approval === applyApproval && analysisKey() === applyAnalysisKey,
    requestAnalysis(selector) {
      applyApproval = null;
      const pending = exact(selector), candy = getCandy(), availability = candy.state.incrementalAvailability;
      if (!availability?.ready) reject(availability?.message ?? "Exact CUDA_INCREMENTAL analysis is unavailable.");
      const argumentsValue = { mode: "INCREMENTAL", backend: "CUDA_INCREMENTAL", deviceId: availability.capability.devices[0].id,
        timeoutMs: 5000, updateContextId: pending.updateId };
      const result = candy.actions.stageMotifAnalysis(argumentsValue);
      return { ...result, argumentsValue, pending: observe() };
    },
    async confirmAnalysis(argumentsValue, approval) {
      const result = await getCandy().actions.submitFromAssistant(argumentsValue, approval);
      return { ...result, pending: observe() };
    },
    refreshAnalysis: jobId => getCandy().actions.getJobStatus(jobId),
    openAnalysisResult: jobId => getCandy().actions.openResult(jobId),
    cancelAnalysis(jobId) { applyApproval = null; return getCandy().actions.cancelJob(jobId); },
  };
  return Object.freeze(controls);
}
