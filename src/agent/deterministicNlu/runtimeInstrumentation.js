const MAX_RETAINED_TRACES = 20;

export function createRuntimeTrace({
  requestId = `turn-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`,
  startedAt = now(),
} = {}) {
  return {
    requestId,
    status: "prepared",
    analysisCount: 0,
    compilationCount: 0,
    authoritativeCompiler: "unknown",
    typedKind: null,
    speechAct: "unknown",
    sideEffectClass: "read_only",
    dispatchAuthorized: true,
    dispatchBlockReason: null,
    semanticConfidence: null,
    authorizationMode: "unknown",
    authorizationDecision: "unknown",
    authorizationEvidence: [],
    dispatchPath: "not_dispatched",
    modelCalls: [],
    genericActionPlannerCallCount: 0,
    legacyRawParserCallCount: 0,
    rawControlClassifierCallCount: 0,
    mappingRecompileCount: 0,
    graphRecompileCount: 0,
    validatorCalls: [],
    confirmationStaged: false,
    stateMutationCommitted: false,
    staleDispatchRejected: false,
    blockedSideEffect: null,
    startedAt,
    elapsedMs: null,
  };
}

export function snapshotRuntimeTrace(trace, { status = trace?.status ?? "prepared" } = {}) {
  if (!trace) return trace;
  return {
    ...trace,
    status,
    elapsedMs: Math.max(0, Math.round(now() - (trace.startedAt ?? now()))),
  };
}

export function finishRuntimeTrace(trace, { status = "completed" } = {}) {
  return snapshotRuntimeTrace(trace, { status });
}

export function appendRuntimeTrace(history = [], trace) {
  if (!trace) return history.slice(-MAX_RETAINED_TRACES);
  return [...history, snapshotRuntimeTrace(trace)].slice(-MAX_RETAINED_TRACES);
}

export function upsertRuntimeTrace(history = [], trace) {
  if (!trace?.requestId) return appendRuntimeTrace(history, trace);
  const next = history.filter(item => item.requestId !== trace.requestId);
  return [...next, snapshotRuntimeTrace(trace)].slice(-MAX_RETAINED_TRACES);
}

export function runtimeDiagnosticsFromTrace(trace = {}) {
  return {
    requestId: trace.requestId ?? null,
    traceStatus: trace.status ?? "unknown",
    plannerPath: trace.dispatchPath ?? "not_dispatched",
    authoritativeCompiler: trace.authoritativeCompiler ?? "unknown",
    typedKind: trace.typedKind ?? null,
    speechAct: trace.speechAct ?? "unknown",
    sideEffectClass: trace.sideEffectClass ?? "read_only",
    dispatchAuthorized: trace.dispatchAuthorized !== false,
    dispatchBlockReason: trace.dispatchBlockReason ?? null,
    semanticConfidence: trace.semanticConfidence ?? null,
    authorizationMode: trace.authorizationMode ?? "unknown",
    authorizationDecision: trace.authorizationDecision ?? "unknown",
    authorizationEvidence: trace.authorizationEvidence ?? [],
    analysisCount: trace.analysisCount ?? 0,
    compilationCount: trace.compilationCount ?? 0,
    modelCallCount: trace.modelCalls?.length ?? 0,
    modelCalls: trace.modelCalls ?? [],
    genericActionPlannerCallCount: trace.genericActionPlannerCallCount ?? 0,
    legacyRawParserCallCount: trace.legacyRawParserCallCount ?? 0,
    rawControlClassifierCallCount: trace.rawControlClassifierCallCount ?? 0,
    mappingRecompileCount: trace.mappingRecompileCount ?? 0,
    graphRecompileCount: trace.graphRecompileCount ?? 0,
    dispatchPath: trace.dispatchPath ?? "not_dispatched",
    confirmationStaged: Boolean(trace.confirmationStaged),
    stateMutationCommitted: Boolean(trace.stateMutationCommitted),
    staleDispatchRejected: Boolean(trace.staleDispatchRejected),
    blockedSideEffect: trace.blockedSideEffect ?? null,
    elapsedMs: trace.elapsedMs ?? null,
  };
}

function now() {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}
