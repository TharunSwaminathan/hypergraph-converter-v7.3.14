import { DERIVED_STATUS } from "../utils/derivedResults.js";

export function createDerivedRequestCoordinator() {
  let requestSequence = 0;
  let currentGraphVersion = null;
  let currentGraphIdentity = null;
  const active = new Map();
  const listeners = new Set();
  const counters = {
    started: 0,
    completed: 0,
    cancelled: 0,
    failed: 0,
    staleRejected: 0,
    duplicateCompletionRejected: 0,
  };

  function activateGraph(graphVersion, graphIdentity) {
    if (Object.is(currentGraphVersion, graphVersion) && Object.is(currentGraphIdentity, graphIdentity)) return false;
    for (const channel of [...active.keys()]) cancel(channel, "graph_changed");
    currentGraphVersion = graphVersion;
    currentGraphIdentity = graphIdentity;
    emit();
    return true;
  }

  function request({ channel, graphVersion, graphIdentity, operationType, options = {}, execute }) {
    if (typeof execute !== "function") throw new TypeError("A derived request executor is required.");
    activateGraph(graphVersion, graphIdentity);
    cancel(channel, "superseded");

    const requestId = `${operationType}-${++requestSequence}`;
    const metadata = Object.freeze({ graphVersion, requestId, operationType, options: Object.freeze({ ...options }) });
    const controller = new AbortController();
    let settled = false;
    let settledStatus = null;
    let executionCancel = null;
    let resolveOutcome;
    const promise = new Promise(resolve => { resolveOutcome = resolve; });
    const record = { channel, metadata, graphIdentity, controller, cancelExecution: () => executionCancel?.(), finish };
    active.set(channel, record);
    counters.started += 1;
    emit();

    try {
      const execution = execute(metadata, controller.signal);
      const executionPromise = execution?.promise ?? execution;
      executionCancel = typeof execution?.cancel === "function" ? execution.cancel : null;
      Promise.resolve(executionPromise).then(
        value => finishResolved(value),
        error => finishRejected(error),
      );
    } catch (error) {
      finishRejected(error);
    }

    return Object.freeze({ metadata, promise, cancel: reason => cancel(channel, reason ?? "cancelled") });

    function finishResolved(value) {
      if (settled) {
        if (settledStatus === "cancelled" || settledStatus === "stale") counters.staleRejected += 1;
        else counters.duplicateCompletionRejected += 1;
        return;
      }
      if (!isCurrent(record)) {
        counters.staleRejected += 1;
        finish("stale", { value: null, reason: "stale_result_rejected" });
        return;
      }
      counters.completed += 1;
      finish("completed", { value, derivedStatus: value?.status ?? DERIVED_STATUS.COMPUTED });
    }

    function finishRejected(error) {
      if (settled) {
        if (!isAbortError(error)) {
          if (settledStatus === "cancelled" || settledStatus === "stale") counters.staleRejected += 1;
          else counters.duplicateCompletionRejected += 1;
        }
        return;
      }
      if (!isCurrent(record)) {
        counters.staleRejected += 1;
        finish("stale", { value: null, reason: "stale_error_rejected" });
        return;
      }
      if (controller.signal.aborted || isAbortError(error)) {
        counters.cancelled += 1;
        finish("cancelled", { value: null, reason: controller.signal.reason ?? "cancelled" });
        return;
      }
      counters.failed += 1;
      finish("failed", {
        value: null,
        reason: error?.message || "Derived worker failed.",
        error: serializeError(error),
      });
    }

    function finish(status, details) {
      if (settled) return;
      settled = true;
      settledStatus = status;
      if (active.get(channel) === record) active.delete(channel);
      const outcome = Object.freeze({ status, metadata, ...details });
      resolveOutcome(outcome);
      emit();
    }
  }

  function cancel(channel, reason = "cancelled") {
    const record = active.get(channel);
    if (!record) return false;
    active.delete(channel);
    record.controller.abort(reason);
    try { record.cancelExecution(); } catch { /* stale rejection remains authoritative */ }
    counters.cancelled += 1;
    record.finish("cancelled", { value: null, reason });
    emit();
    return true;
  }

  function isCurrent(record) {
    return active.get(record.channel) === record
      && Object.is(record.metadata.graphVersion, currentGraphVersion)
      && Object.is(record.graphIdentity, currentGraphIdentity);
  }

  function emit() {
    const snapshot = getSnapshot();
    for (const listener of listeners) listener(snapshot);
  }

  function getSnapshot() {
    return Object.freeze({
      graphVersion: currentGraphVersion,
      active: Object.freeze([...active.values()].map(record => record.metadata)),
      ...counters,
    });
  }

  return Object.freeze({
    activateGraph,
    request,
    cancel,
    cancelAll(reason = "cancelled") {
      for (const channel of [...active.keys()]) cancel(channel, reason);
    },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    getSnapshot,
  });
}

function isAbortError(error) {
  return error?.name === "AbortError" || /abort|cancel/i.test(error?.message ?? "");
}

function serializeError(error) {
  return { name: error?.name ?? "Error", message: error?.message ?? String(error) };
}
