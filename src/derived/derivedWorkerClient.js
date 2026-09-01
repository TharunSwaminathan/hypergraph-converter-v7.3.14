import { executeDerivedOperation } from "./derivedOperations.js";
import { estimateH2HNeighborReferences, estimateMatrixExport } from "../utils/mappings.js";
import { estimateProjectionPairCount } from "../algorithms/projection.js";

export const DERIVED_WORKER_THRESHOLDS = Object.freeze({
  h2hNeighborReferences: 50_000,
  v2vCandidatePairs: 50_000,
  matrixCells: 50_000,
});

export function runDerivedWorkerRequest(metadata, hyperedges, signal) {
  const policy = chooseDerivedExecutionPolicy(metadata.operationType, hyperedges);
  if (!policy.useWorker || typeof Worker !== "function") return runDeferredOnMainThread(metadata, hyperedges, signal);

  const worker = new Worker(new URL("../workers/derivedWorker.js", import.meta.url), { type: "module" });
  let settled = false;
  let rejectPromise;
  const promise = new Promise((resolve, reject) => {
    rejectPromise = reject;
    worker.onmessage = event => {
      if (settled) return;
      const message = event.data ?? {};
      if (message.requestId !== metadata.requestId) return;
      settled = true;
      worker.terminate();
      if (message.ok) resolve(message.value);
      else reject(structuredWorkerError(message.error));
    };
    worker.onerror = event => {
      if (settled) return;
      settled = true;
      worker.terminate();
      reject(structuredWorkerError({ name: "WorkerError", message: event.message || "Derived worker failed." }));
    };
    worker.postMessage({ ...metadata, hyperedges });
  });
  const cancel = () => {
    if (settled) return;
    settled = true;
    worker.terminate();
    rejectPromise(abortError(signal?.reason ?? "Derived work cancelled."));
  };
  signal?.addEventListener("abort", cancel, { once: true });
  return { promise, cancel };
}

export function chooseDerivedExecutionPolicy(operationType, hyperedges) {
  if (operationType === "h2h") {
    const estimate = estimateH2HNeighborReferences(hyperedges, Infinity);
    return { useWorker: estimate.references > DERIVED_WORKER_THRESHOLDS.h2hNeighborReferences, estimate: estimate.references, dimension: "h2hNeighborReferences" };
  }
  if (operationType === "v2v" || operationType === "line_graph") {
    const estimate = estimateProjectionPairCount(hyperedges, Infinity).estimatedPairs;
    return { useWorker: estimate > DERIVED_WORKER_THRESHOLDS.v2vCandidatePairs, estimate, dimension: "v2vCandidatePairs" };
  }
  if (operationType === "matrix") {
    const estimate = estimateMatrixExport(hyperedges).cells;
    return { useWorker: estimate > DERIVED_WORKER_THRESHOLDS.matrixCells, estimate, dimension: "matrixCells" };
  }
  return { useWorker: false, estimate: 0, dimension: "unknown" };
}

function runDeferredOnMainThread(metadata, hyperedges, signal) {
  let timer = null;
  let rejectPromise;
  const promise = new Promise((resolve, reject) => {
    rejectPromise = reject;
    timer = setTimeout(() => {
      timer = null;
      if (signal?.aborted) { reject(abortError(signal.reason)); return; }
      try { resolve(executeDerivedOperation(metadata.operationType, hyperedges, metadata.options)); }
      catch (error) { reject(error); }
    }, 0);
  });
  return {
    promise,
    cancel() {
      if (timer != null) clearTimeout(timer);
      timer = null;
      rejectPromise?.(abortError(signal?.reason ?? "Derived work cancelled."));
    },
  };
}

function structuredWorkerError(error) {
  const failure = new Error(error?.message || "Derived worker failed.");
  failure.name = error?.name || "WorkerError";
  failure.code = "derived_worker_failure";
  return failure;
}

function abortError(reason) {
  const error = new Error(String(reason || "Derived work cancelled."));
  error.name = "AbortError";
  return error;
}
