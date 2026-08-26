export const CONTINUATION_PHASES = {
  AUTO_DETECT: "pending_auto_detect",
  CUSTOM_PARSER_COMPLETION: "pending_custom_parser_completion",
};

export const CONTINUATION_TRANSITION_REASONS = {
  AUTO_DETECT_METADATA_UPDATE: "auto_detect_metadata_update",
  PARSE_MODE_TOGETHER: "parse_mode_together",
  PARSE_MODE_SEPARATE: "parse_mode_separate",
  ROUTE_TO_CUSTOM_PARSER: "route_to_custom_parser",
};

const AUTHORIZED_TRANSITION_REASONS = new Set(Object.values(CONTINUATION_TRANSITION_REASONS));

function normalizeQuery(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function isDetectionOnlyContinuationQuery(value) {
  const query = normalizeQuery(value).replace(/[.!?]+$/g, "");
  return /^(?:auto[- ]?detect(?: (?:the )?(?:file|upload|dataset|input))?(?: format)?|detect(?: (?:the )?(?:file|upload|dataset|input))?(?: format)?|identify(?: (?:the )?(?:file|upload|dataset|input))?(?: format)?|what format is (?:this|the file|the upload|the dataset|it))$/.test(query);
}

export function continuationCanResume(continuation) {
  if (!continuation || continuation.phase !== CONTINUATION_PHASES.AUTO_DETECT) return Boolean(continuation);
  if (continuation.requestedExportId) return true;
  const query = String(continuation.originalQuery ?? "").trim();
  return Boolean(query) && !isDetectionOnlyContinuationQuery(query);
}

export function activeBatchFileSignature(state = {}) {
  return (
    state.activeBatch?.fileNames
    ?? state.activeBatch?.files?.map(file => file.name)
    ?? state.agentFiles?.map(file => file.name)
    ?? []
  )
    .join("|||");
}

function activeBatchVersion(state = {}) {
  return state.activeBatch?.version ?? state.batchVersion ?? null;
}

function normalizeVersion(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : String(value);
}

function versionsMatch(left, right) {
  const normalizedLeft = normalizeVersion(left);
  const normalizedRight = normalizeVersion(right);
  if (normalizedLeft === null || normalizedRight === null) return normalizedLeft === normalizedRight;
  return normalizedLeft === normalizedRight;
}

export function createPendingConversionContinuation({
  state = {},
  originalQuery = "",
  requestedExportId = null,
  phase = CONTINUATION_PHASES.AUTO_DETECT,
} = {}) {
  if (!state.activeBatchId) return null;
  const normalizedQuery = String(originalQuery ?? "").trim();
  const continuation = {
    phase,
    originalQuery: normalizedQuery,
    requestedExportId: requestedExportId || null,
    batchId: state.activeBatchId,
    batchVersion: activeBatchVersion(state),
    fileSignature: activeBatchFileSignature(state),
    createdAt: Date.now(),
  };
  return continuationCanResume(continuation) || phase === CONTINUATION_PHASES.CUSTOM_PARSER_COMPLETION
    ? continuation
    : null;
}

export function continuationMatchesActiveBatch(continuation, state = {}) {
  const currentBatchVersion = activeBatchVersion(state);
  return Boolean(continuation)
    && continuation.batchId === state.activeBatchId
    // Current v7 batches are versioned. If a continuation records a version,
    // the active batch must expose the same version; same ID+filenames alone is stale.
    && versionsMatch(continuation.batchVersion, currentBatchVersion)
    && continuation.fileSignature === activeBatchFileSignature(state);
}

export function createExpectedContinuationTransition({
  continuation,
  state = {},
  reason,
} = {}) {
  if (!continuation || !AUTHORIZED_TRANSITION_REASONS.has(reason)) return null;
  if (!continuationMatchesActiveBatch(continuation, state)) return null;
  return {
    reason,
    batchId: continuation.batchId,
    fromBatchVersion: continuation.batchVersion,
    fileSignature: continuation.fileSignature,
    continuation: { ...continuation },
    createdAt: Date.now(),
  };
}

export function rebaseContinuationForExpectedTransition(transition, state = {}) {
  if (!transition?.continuation || !AUTHORIZED_TRANSITION_REASONS.has(transition.reason)) return null;
  if (transition.continuation.batchId !== transition.batchId) return null;
  if (!versionsMatch(transition.continuation.batchVersion, transition.fromBatchVersion)) return null;
  if (transition.continuation.fileSignature !== transition.fileSignature) return null;
  if (state.activeBatchId !== transition.batchId) return null;
  if (activeBatchFileSignature(state) !== transition.fileSignature) return null;
  const currentBatchVersion = activeBatchVersion(state);
  if (versionsMatch(currentBatchVersion, transition.fromBatchVersion)) return null;
  return {
    ...transition.continuation,
    batchVersion: currentBatchVersion,
    fileSignature: activeBatchFileSignature(state),
    rebasedAt: Date.now(),
    rebaseReason: transition.reason,
  };
}

export function transitionContinuationToCustomParser(continuation, state = {}) {
  if (!continuationMatchesActiveBatch(continuation, state)) return null;
  return {
    ...continuation,
    phase: CONTINUATION_PHASES.CUSTOM_PARSER_COMPLETION,
    detectedBatchVersion: activeBatchVersion(state),
    transitionedAt: Date.now(),
  };
}

export function pendingCustomParserExportAction(continuation, state = {}, applyResult = {}) {
  if (!continuation || continuation.phase !== CONTINUATION_PHASES.CUSTOM_PARSER_COMPLETION) {
    return { ok: false, reason: "no_pending_custom_parser_export", invalidate: false };
  }
  if (!continuation.requestedExportId) {
    return { ok: false, reason: "no_requested_export", invalidate: false };
  }
  if (!continuationMatchesActiveBatch(continuation, state)) {
    return { ok: false, reason: "stale_batch", invalidate: true };
  }
  if (applyResult?.ok === false) {
    return { ok: false, reason: "custom_parser_apply_failed", invalidate: false };
  }
  if (applyResult?.batchId && applyResult.batchId !== continuation.batchId) {
    return { ok: false, reason: "applied_result_for_different_batch", invalidate: true };
  }
  if (applyResult?.batchVersion !== undefined
    && applyResult?.batchVersion !== null
    && !versionsMatch(applyResult.batchVersion, continuation.batchVersion)) {
    return { ok: false, reason: "applied_result_version_mismatch", invalidate: true };
  }
  if (!state.hasGraph) {
    return { ok: false, reason: "graph_not_loaded", invalidate: false };
  }
  return {
    ok: true,
    reason: "select_requested_export_preview",
    requestedExportId: continuation.requestedExportId,
    action: {
      type: "SELECT_EXPORT_PREVIEW",
      exportId: continuation.requestedExportId,
    },
  };
}

