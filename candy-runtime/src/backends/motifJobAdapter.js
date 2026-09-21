import { createHash } from "node:crypto";
import { packCudaMotifRequest, validateCudaMotifResult } from "../../test/hypergraph-motif-cuda-contract.mjs";
import { packCudaIncrementalRequest, validateCudaIncrementalResult } from "../../test/hypergraph-motif-cuda-incremental-contract.mjs";
import { CandyContractError, CANDY_ERROR_CODES } from "../../../src/candy/contracts/errorClasses.js";
import { MOTIF_RUNTIME_RESULT, MOTIF_TAXONOMY } from "../../../src/candy/contracts/runtimeMotif.js";

const fail = (code, message) => { throw new CandyContractError(code,message); };
export async function prepareMotifJob(job, store) {
  let graph;
  try { graph = JSON.parse((await store.read(job.payload.graphArtifactId)).toString("utf8")); }
  catch (error) { if (error instanceof CandyContractError) throw error; fail(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA,"Graph artifact is not valid incidence JSON."); }
  if (graph.graphType !== job.snapshot.graphType) fail(CANDY_ERROR_CODES.INVALID_GRAPH_TYPE,"Graph artifact type differs from its immutable snapshot.");
  if (graph.graphId !== job.request.graphRef.graphId || graph.graphVersion !== job.request.graphRef.graphVersion) fail(CANDY_ERROR_CODES.STALE_GRAPH_VERSION,"Graph artifact identity differs from the authorized version.");
  let packed;
  if (job.request.mode === "STATIC") packed = packCudaMotifRequest(graph,job.request.deviceId);
  else {
    let update;
    try { update = JSON.parse((await store.read(job.request.updateRef.artifactId)).toString("utf8")); }
    catch (error) { if (error instanceof CandyContractError) throw error; fail(CANDY_ERROR_CODES.INVALID_UPDATE_BATCH,"Update artifact is not valid qualified update JSON."); }
    if (update.updateId !== job.request.updateRef.updateId || update.nextGraphVersion !== job.request.updateRef.nextGraphVersion) fail(CANDY_ERROR_CODES.INVALID_UPDATE_BATCH,"Update artifact differs from the authorized pending update.");
    packed = packCudaIncrementalRequest(graph,update,job.request.deviceId);
  }
  const canonical = packed.graph ?? packed.oldGraph;
  if (canonical.vertexCount !== job.snapshot.vertexCount || canonical.hyperedgeCount !== job.snapshot.hyperedgeCount) fail(CANDY_ERROR_CODES.STALE_GRAPH_VERSION,"Snapshot cardinalities differ from the immutable incidence graph.");
  return packed;
}
export function acceptMotifNative(processResult, packed, job, runtimeSessionId) {
  let native;
  try { native = JSON.parse(processResult.stdout); }
  catch { fail(CANDY_ERROR_CODES.OUTPUT_PARSE_FAILURE,"Native motif output is not valid bounded JSON."); }
  if (native?.ok === false) {
    const code = native.error?.classification;
    if (!Object.hasOwn(CANDY_ERROR_CODES,code)) fail(CANDY_ERROR_CODES.OUTPUT_PARSE_FAILURE,"Native motif error classification is invalid.");
    // Native text is not reflected: preserve the typed class without private paths.
    fail(code,"The qualified native motif backend rejected execution.");
  }
  if (processResult.exitCode !== 0) fail(CANDY_ERROR_CODES.PROCESS_CRASH,"Native motif success content has a nonzero exit status.");
  try {
    if (job.request.mode === "STATIC") validateCudaMotifResult(native,packed);
    else validateCudaIncrementalResult(native,packed);
    if (native.cuda.compiledArchitecture !== "sm_120" || native.cuda.compilerVersion !== "13.4.59" || native.cuda.runtimeVersion !== 13040 || native.cuda.computeMajor !== 12 || native.cuda.computeMinor !== 0) throw new Error("Wrong qualified execution environment");
  } catch { fail(CANDY_ERROR_CODES.RESULT_VALIDATION_FAILURE,"Native motif result does not match the exact authorized job and qualified execution."); }
  const requestDigest = packed.digest ?? createHash("sha256").update(packed.text,"utf8").digest("hex");
  return {
    schemaVersion: MOTIF_RUNTIME_RESULT, runtimeSessionId, jobId: job.jobId, requestId: job.request.requestId,
    algorithm: job.request.algorithm, taxonomyVersion: MOTIF_TAXONOMY,
    backend: job.request.backend, mode: job.request.mode, inputGraphRef: job.request.graphRef,
    graphArtifactId: job.payload.graphArtifactId, updateRef: job.request.updateRef ?? null,
    requestDigest, execution: { status: "completed", exitCode: 0, nativeBuildFingerprint: processResult.fingerprint },
    validation: { status: "passed", method: "qualified_transport_identity_and_semantic_validation" },
    resultType: job.request.mode === "STATIC" ? "HypergraphMotifCounts" : "HypergraphMotifDelta",
    interpretation: job.request.mode === "STATIC" ? "absolute_counts" : "delta_only",
    native, warnings: [],
  };
}
