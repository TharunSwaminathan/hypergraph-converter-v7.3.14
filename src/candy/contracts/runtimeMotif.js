import { CANDY_ERROR_CODES, failCandy } from "./errorClasses.js";
import { requireExactKeys, requirePlainObject, requireNonNegativeSafeInteger } from "./contractValidation.js";

export const MOTIF_ALGORITHM = "HYPERGRAPH_3EDGE_MOTIF_COUNT";
export const MOTIF_TAXONOMY = "candy.hypergraph-3edge-motif-taxonomy/1";
export const MOTIF_RUNTIME_REQUEST = "candy.runtime-motif-request/1";
export const MOTIF_RUNTIME_RESULT = "candy.runtime-motif-result/1";
export const MOTIF_BACKENDS = Object.freeze({ STATIC: "CUDA_STATIC", INCREMENTAL: "CUDA_INCREMENTAL" });
export function validateRuntimeMotifRequest(value, snapshot) {
  requirePlainObject(value, "RuntimeMotifRequest");
  requireExactKeys(value, ["schemaVersion", "requestId", "algorithm", "taxonomyVersion", "backend", "mode", "graphRef", "deviceId", "timeoutMs"], ["updateRef"], "RuntimeMotifRequest");
  if (value.schemaVersion !== MOTIF_RUNTIME_REQUEST || value.algorithm !== MOTIF_ALGORITHM || value.taxonomyVersion !== MOTIF_TAXONOMY
    || !Object.hasOwn(MOTIF_BACKENDS, value.mode) || value.backend !== MOTIF_BACKENDS[value.mode]) failCandy(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA, "Unsupported motif schema, taxonomy, mode or backend.");
  if (typeof value.requestId !== "string" || !/^[0-9a-f-]{36}$/.test(value.requestId)) failCandy(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA, "Invalid request identity.");
  requirePlainObject(value.graphRef, "graphRef");
  requireExactKeys(value.graphRef, ["graphId", "graphVersion"], [], "graphRef");
  requireNonNegativeSafeInteger(value.graphRef.graphVersion, "graphVersion");
  if (typeof value.graphRef.graphId !== "string" || !value.graphRef.graphId || value.graphRef.graphId.length > 512) failCandy(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA, "Invalid graph identity.");
  if (!["Hypergraph", "DynamicHypergraph"].includes(snapshot?.graphType) || value.mode === "INCREMENTAL" && snapshot.graphType !== "DynamicHypergraph") failCandy(CANDY_ERROR_CODES.INVALID_GRAPH_TYPE, "Motif analysis requires Hypergraph; incremental analysis requires DynamicHypergraph.");
  if (snapshot.graphId !== value.graphRef.graphId || snapshot.graphVersion !== value.graphRef.graphVersion) failCandy(CANDY_ERROR_CODES.STALE_GRAPH_VERSION, "Motif request does not match the immutable graph snapshot.");
  if (!Number.isSafeInteger(value.deviceId) || value.deviceId < 0 || value.deviceId > 255) failCandy(CANDY_ERROR_CODES.BACKEND_UNAVAILABLE, "Invalid qualified device selector.");
  if (!Number.isSafeInteger(value.timeoutMs) || value.timeoutMs < 1 || value.timeoutMs > 60_000) failCandy(CANDY_ERROR_CODES.RESOURCE_LIMIT, "Motif timeout must be an integer from 1 to 60000 milliseconds.");
  if (value.mode === "STATIC" && Object.hasOwn(value, "updateRef")) failCandy(CANDY_ERROR_CODES.INVALID_UPDATE_BATCH, "STATIC does not accept an update.");
  if (value.mode === "INCREMENTAL") {
    requirePlainObject(value.updateRef, "updateRef", CANDY_ERROR_CODES.INVALID_UPDATE_BATCH);
    requireExactKeys(value.updateRef, ["updateId", "artifactId", "nextGraphVersion"], [], "updateRef", CANDY_ERROR_CODES.INVALID_UPDATE_BATCH);
    if (typeof value.updateRef.updateId !== "string" || !value.updateRef.updateId || value.updateRef.updateId.length > 512
      || !/^sha256:[a-f0-9]{64}$/.test(value.updateRef.artifactId) || value.updateRef.nextGraphVersion !== snapshot.graphVersion + 1) failCandy(CANDY_ERROR_CODES.INVALID_UPDATE_BATCH, "Invalid immutable pending update binding.");
  }
  return JSON.parse(JSON.stringify(value));
}
