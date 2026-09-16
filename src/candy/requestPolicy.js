import { isOrdinaryGraphType } from "./contracts/graphTypes.js";

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export function validateCandySubmissionIntent(argumentsValue, graph = {}) {
  if (!isOrdinaryGraphType(graph.graphType)) return { ok: false, classification: "INVALID_GRAPH_TYPE", message: "CANDY SSSP accepts an ordinary graph. The active Studio graph is a hypergraph, and no implicit projection was performed." };
  if (argumentsValue.algorithm !== "SSSP" || !["LOCAL_OPENMP", "LOCAL_CUDA"].includes(argumentsValue.backend)) return { ok: false, classification: "ALGORITHM_FAILURE", message: "Only typed LOCAL_OPENMP or qualified LOCAL_CUDA SSSP requests are allowed." };
  if (argumentsValue.backend === "LOCAL_CUDA" && !["INCREMENTAL", "COMPARE"].includes(argumentsValue.mode)) return { ok: false, classification: "ALGORITHM_FAILURE", message: "LOCAL_CUDA supports INCREMENTAL and COMPARE only; CUDA STATIC is not implemented." };
  if (argumentsValue.backend === "LOCAL_OPENMP" && !["STATIC", "INCREMENTAL", "COMPARE"].includes(argumentsValue.mode)) return { ok: false, classification: "ALGORITHM_FAILURE", message: "The requested OpenMP SSSP mode is unsupported." };
  return { ok: true };
}

export function candyRequestConfirmationBinding({ argumentsValue, graph }) {
  const envelope = {
    algorithm: argumentsValue.algorithm,
    backend: argumentsValue.backend,
    mode: argumentsValue.mode,
    sourceVertexId: argumentsValue.sourceVertexId,
    ...(argumentsValue.backend === "LOCAL_CUDA" ? { deviceId: argumentsValue.deviceId } : { threads: argumentsValue.threads }),
    timeoutMs: argumentsValue.timeoutMs,
    graphId: graph.id,
    graphVersion: graph.version,
    propertyStateVersion: argumentsValue.propertyStateVersion ?? null,
    updateBatchId: argumentsValue.updateBatchId ?? null,
  };
  // A stable browser-side binding token prevents changed material arguments
  // from reusing a confirmation. Runtime request identity is independently SHA-256.
  let hash = 2166136261;
  for (const char of stable(envelope)) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Object.freeze({ requestHash: `binding-v1:${(hash >>> 0).toString(16).padStart(8, "0")}`, ...envelope });
}

export function candyRequestNeedsConfirmation(argumentsValue, graph = {}) {
  return argumentsValue.backend === "LOCAL_CUDA" || argumentsValue.mode === "COMPARE" || Number(argumentsValue.threads) > 8 || Number(argumentsValue.timeoutMs) > 30_000 || Number(graph.vertexCount) > 100_000 || Number(graph.edgeCount) > 500_000;
}
