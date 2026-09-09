import { availableReactActions } from "./orchestratorCapabilities.js";

export const MAX_OBSERVATION_CHARS = 14000;

const text = (value, limit = 240) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, limit);

export function orchestratorStateVersion(state = {}, pendingConfirmation = null) {
  return Object.freeze({
    inputRoute: text(state.fmt),
    activeSection: text(state.activeSection),
    exportPreview: text(state.expId),
    visualLimit: Number(state.vizLimit) || 0,
    graphView: text(state.graphView),
    graphLayout: text(state.graphLayout),
    graphSearch: text(state.graphSearch),
    activeDatasetId: text(state.activeBatchId),
    batchVersion: Number(state.activeBatch?.version ?? state.batchVersion) || 0,
    groupingRevision: Number(state.activeBatch?.groupingRevision) || 0,
    mappingRevision: Number(state.activeBatch?.mappingRevision) || 0,
    customCodeVersion: Number(state.customCodeVersion) || 0,
    customResultId: text(state.customResultId),
    graphId: text(state.graphId),
    graphVersion: Number(state.graphVersion) || 0,
    pendingConfirmationType: text(pendingConfirmation?.actionType),
  });
}

export function stateVersionToken(version) {
  return JSON.stringify(version ?? {});
}

function formatStatus(state = {}) {
  const detection = state.agentDetection ?? state.activeBatch?.detectedFormat ?? {};
  if (!state.agentFileCount) return "not_available";
  if (detection.confidence === "ambiguous") return "ambiguous";
  if (detection.formatId === "custom") return "unsupported";
  if (detection.formatId) return "supported";
  return "unknown";
}

function specialistStatus(state = {}) {
  const jobs = state.specialist?.jobs ?? [];
  const current = jobs.find(job => job.id === state.customCodeBinding?.modelRunId) ?? jobs.at(-1);
  if (state.customRunning) return "running_and_validating";
  if (current?.status) return current.status;
  if (state.specialist?.working) return "generating";
  if (state.specialistReviewRequired && state.customResultId) return "awaiting_apply_confirmation";
  if (state.specialistReviewRequired && state.customCodeExists) return "awaiting_run_confirmation";
  return "not_started";
}

function safeToolResult(result) {
  if (!result) return null;
  return {
    action: text(result.action),
    ok: Boolean(result.ok),
    outcome: text(result.outcome),
    error: text(result.error, 500) || null,
    stateMutationCommitted: Boolean(result.stateMutationCommitted),
    resultId: text(result.resultId),
  };
}

export function buildAuthoritativeOrchestratorObservation({
  state = {},
  threadId = "main",
  threadSummary = "",
  pendingConfirmation = null,
  lastToolResult = null,
  restoredWorkspace = null,
} = {}) {
  const requiresReupload = Boolean(!state.agentFileCount && restoredWorkspace?.requiresReupload);
  const version = orchestratorStateVersion(state, pendingConfirmation);
  const observation = {
    schemaVersion: 1,
    authority: "live_application_state",
    stateVersion: version,
    stateVersionToken: stateVersionToken(version),
    thread: { threadId: text(threadId, 80) || "main", summary: text(threadSummary, 2000), summaryAuthority: "context_only" },
    dataset: { activeDatasetId: text(state.activeBatchId) || null, available: Boolean(state.activeBatchId && state.agentFileCount) },
    upload: { fileCount: Number(state.agentFileCount) || 0, requiresReupload },
    formatDetection: { status: formatStatus(state), formatId: text(state.agentDetection?.formatId ?? state.activeBatch?.detectedFormat?.formatId) || null },
    grouping: { status: ["together", "separate"].includes(state.activeBatch?.parseMode) ? state.activeBatch.parseMode : "unresolved", revision: Number(state.activeBatch?.groupingRevision) || 0 },
    customParser: {
      status: specialistStatus(state),
      bindingCurrent: Boolean(state.specialistRunReady || state.specialistApplyReady),
      runReady: Boolean(state.specialistRunReady),
      applyReady: Boolean(state.specialistApplyReady),
      working: Boolean(state.specialist?.working || state.customRunning),
      triggerPolicy: text(state.specialist?.policy?.kind) || "none",
    },
    ui: {
      inputRoute: text(state.fmt) || null,
      activeSection: text(state.activeSection) || null,
      exportPreview: text(state.expId) || null,
      visualLimit: Number(state.vizLimit) || 0,
      graphView: text(state.graphView) || null,
      graphLayout: text(state.graphLayout) || null,
      graphSearch: text(state.graphSearch) || null,
    },
    graph: { available: Boolean(state.hasGraph), id: text(state.graphId) || null, version: Number(state.graphVersion) || 0 },
    pendingConfirmation: pendingConfirmation ? { actionType: text(pendingConfirmation.actionType), status: "awaiting_user" } : null,
    lastToolResult: safeToolResult(lastToolResult),
  };
  observation.availableCapabilities = availableReactActions(observation);
  const size = JSON.stringify(observation).length;
  if (size > MAX_OBSERVATION_CHARS) throw new Error("The authoritative orchestrator observation exceeded its size limit.");
  return Object.freeze({ ...observation, sizeChars: size });
}

export function observationStillCurrent(observation, currentObservation) {
  return Boolean(observation?.stateVersionToken) && observation.stateVersionToken === currentObservation?.stateVersionToken;
}
