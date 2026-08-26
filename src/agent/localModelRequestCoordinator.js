let fallbackCounter = 0;

export function createLocalRequestId(prefix = "local-request") {
  const cryptoLike = globalThis.crypto;
  if (cryptoLike?.randomUUID) return `${prefix}-${cryptoLike.randomUUID()}`;
  fallbackCounter += 1;
  return `${prefix}-${fallbackCounter.toString(36)}`;
}

export function createLocalModelRequestCoordinator({
  idFactory = createLocalRequestId,
  now = () => new Date().toISOString(),
} = {}) {
  let active = null;

  function snapshot() {
    if (!active) return { busy: false, active: null };
    const safeActive = { ...active };
    delete safeActive.abortController;
    return {
      busy: true,
      active: { ...safeActive },
    };
  }

  return {
    begin({
      task = "local_model",
      requestId = idFactory(),
      abortController = new AbortController(),
      priority = "interactive",
      userInitiated = true,
      startedAt = now(),
      metadata = {},
    } = {}) {
      if (active) {
        return {
          ok: false,
          rejected: true,
          reason: "busy",
          message: "The local assistant is already working. Wait for it to finish or press Stop.",
          active: snapshot().active,
        };
      }
      active = {
        requestId,
        task,
        status: "running",
        priority,
        startedAt,
        abortController,
        userInitiated,
        metadata,
      };
      return { ok: true, request: active, snapshot: snapshot() };
    },

    finish(requestId, outcome = "completed") {
      if (!active) return { ok: false, reason: "idle" };
      if (active.requestId !== requestId) {
        return { ok: false, reason: "stale_request", active: snapshot().active };
      }
      const finished = {
        ...snapshot().active,
        status: outcome,
        completedAt: now(),
      };
      active = null;
      return { ok: true, request: finished, snapshot: snapshot() };
    },

    abortActive(reason = "request_aborted") {
      if (!active) return { ok: false, reason: "idle" };
      const request = active;
      request.status = "aborting";
      request.abortReason = reason;
      request.abortController?.abort(reason);
      return { ok: true, request: snapshot().active };
    },

    getActiveController(requestId = null) {
      if (!active) return null;
      if (requestId && active.requestId !== requestId) return null;
      return active.abortController;
    },

    getSnapshot: snapshot,
    isBusy() {
      return Boolean(active);
    },
  };
}
