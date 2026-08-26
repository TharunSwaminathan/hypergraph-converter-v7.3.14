let submissionCounter = 0;

export function createSubmissionRequestId(prefix = "submission") {
  const cryptoLike = globalThis.crypto;
  if (cryptoLike?.randomUUID) return `${prefix}-${cryptoLike.randomUUID()}`;
  submissionCounter += 1;
  return `${prefix}-${submissionCounter.toString(36)}`;
}

/**
 * Tracks every UI submission by owner ID. Read-only Help and direct Stop may
 * coexist with an already running request, but finishing either request can
 * remove only its own token. This prevents one request from clearing another
 * request's busy lifecycle.
 */
export function createSubmissionRequestCoordinator({ idFactory = createSubmissionRequestId } = {}) {
  const active = new Map();

  return {
    begin({ kind = "action", allowConcurrent = false, metadata = {} } = {}) {
      if (active.size > 0 && !allowConcurrent) {
        return {
          ok: false,
          reason: "busy",
          activeCount: active.size,
          message: "The local assistant is already working. Wait for it to finish or press Stop.",
        };
      }
      const requestId = idFactory();
      active.set(requestId, { requestId, kind, metadata });
      return { ok: true, requestId, activeCount: active.size };
    },

    finish(requestId) {
      if (!active.has(requestId)) return { ok: false, reason: "not_owner", activeCount: active.size };
      active.delete(requestId);
      return { ok: true, activeCount: active.size };
    },

    has(requestId) {
      return active.has(requestId);
    },

    isBusy() {
      return active.size > 0;
    },

    count() {
      return active.size;
    },

    snapshot() {
      return [...active.values()].map(entry => ({ ...entry }));
    },
  };
}

/**
 * Adds only runtime lifecycle facts needed by registry required-context checks.
 * coordinatorCount includes the submission currently being routed, so it is
 * excluded before deciding whether another cancellable request is active.
 */
export function deriveSubmissionRuntimeContext(state = {}, {
  coordinatorCount = 0,
  currentSubmissionCount = 1,
  streaming = false,
} = {}) {
  const otherSubmissionCount = Math.max(0, Number(coordinatorCount || 0) - Number(currentSubmissionCount || 0));
  const activeModelWork = Boolean(state?.localModel?.request?.busy || state?.localModelRequestActive);
  return {
    ...state,
    activeRequestCount: otherSubmissionCount,
    activeCancellableWork: Boolean(streaming || activeModelWork || otherSubmissionCount > 0),
  };
}
