function nsToMs(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return number / 1_000_000;
}

function round(value, digits = 2) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function normalizeOllamaMetrics(raw = {}, { clientElapsedMs = null } = {}) {
  const totalDurationMs = nsToMs(raw.total_duration);
  const loadDurationMs = nsToMs(raw.load_duration);
  const promptEvalDurationMs = nsToMs(raw.prompt_eval_duration);
  const evalDurationMs = nsToMs(raw.eval_duration);
  const promptEvalCount = Number.isFinite(Number(raw.prompt_eval_count)) ? Number(raw.prompt_eval_count) : null;
  const evalCount = Number.isFinite(Number(raw.eval_count)) ? Number(raw.eval_count) : null;
  const evalSeconds = evalDurationMs != null ? evalDurationMs / 1000 : null;
  const evalTokensPerSecond = evalCount != null && evalSeconds > 0 ? round(evalCount / evalSeconds) : null;
  const elapsed = Number.isFinite(Number(clientElapsedMs)) ? Number(clientElapsedMs) : null;
  const approximateTransportOverheadMs = elapsed != null && totalDurationMs != null
    ? Math.max(0, round(elapsed - totalDurationMs))
    : null;
  return {
    totalDurationMs: totalDurationMs == null ? null : round(totalDurationMs),
    loadDurationMs: loadDurationMs == null ? null : round(loadDurationMs),
    promptEvalCount,
    promptEvalDurationMs: promptEvalDurationMs == null ? null : round(promptEvalDurationMs),
    evalCount,
    evalDurationMs: evalDurationMs == null ? null : round(evalDurationMs),
    evalTokensPerSecond,
    doneReason: raw.done_reason ?? raw.doneReason ?? null,
    clientElapsedMs: elapsed == null ? null : round(elapsed),
    approximateTransportOverheadMs,
  };
}

export function createLocalModelRequestDiagnostic({
  requestId,
  task,
  model,
  transport,
  outcome,
  classification = "",
  startedAt,
  completedAt,
  metrics = null,
  promptChars = 0,
  schemaChars = 0,
  attemptCount = 1,
  fallbackUsed = false,
} = {}) {
  return {
    requestId,
    task,
    model,
    transport,
    outcome,
    classification,
    startedAt,
    completedAt,
    metrics,
    promptChars,
    schemaChars,
    attemptCount,
    fallbackUsed,
  };
}

export function appendBoundedRequestDiagnostic(history = [], diagnostic = null, limit = 20) {
  if (!diagnostic) return history;
  return [...history, diagnostic].slice(-Math.max(1, limit));
}
