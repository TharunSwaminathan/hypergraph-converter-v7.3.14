import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { startCandyRuntime } from "../src/server.js";

const execFileAsync = promisify(execFile);
const runtime = await startCandyRuntime({ port: 0 });
const base = `http://127.0.0.1:${runtime.port}`;
const headers = { Authorization: `Bearer ${runtime.pairingToken}`, "Content-Type": "application/json" };
const rawCall = async (path, init = {}) => {
  const response = await fetch(`${base}${path}`, { ...init, headers });
  return { response, body: await response.json() };
};
const call = async (path, init = {}) => {
  const value = await rawCall(path, init);
  if (!value.response.ok) throw new Error(`${path}: ${value.response.status} ${JSON.stringify(value.body)}`);
  return value.body;
};
const upload = (value, mediaType) => call("/v1/artifacts", { method: "POST", body: JSON.stringify({ schemaVersion: "candy.artifact-upload/1", mediaType, contentEncoding: "utf8", content: JSON.stringify(value) }) });
const terminal = async jobId => {
  const observed = [];
  for (let attempt = 0; attempt < 400; attempt += 1) {
    const status = await call(`/v1/jobs/${jobId}`);
    if (observed.at(-1) !== status.status) observed.push(status.status);
    if (["completed", "failed", "cancelled"].includes(status.status)) return { status, observed };
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error("CUDA companion job did not reach a terminal state.");
};
const cudaProcesses = async () => {
  const command = process.platform === "win32" ? "wsl.exe" : "nvidia-smi";
  const args = ["--query-compute-apps=pid,process_name", "--format=csv,noheader"];
  const actualArgs = process.platform === "win32" ? ["/usr/lib/wsl/lib/nvidia-smi", ...args] : args;
  try { return (await execFileAsync(command, actualArgs, { timeout: 5_000, maxBuffer: 16 * 1024, windowsHide: true, shell: false })).stdout; }
  catch (error) { return error.stdout ?? ""; }
};

try {
  const declaration = await call("/v1/capabilities");
  const cudaCapability = declaration.capabilities.find(item => item.backend === "LOCAL_CUDA");
  assert.ok(cudaCapability, "production discovery must advertise the exact qualified CUDA backend");
  assert.deepEqual(cudaCapability.modes, ["INCREMENTAL", "COMPARE"]);
  assert.equal(cudaCapability.devices[0].qualifiedArchitecture, "sm_120");

  const graph = { graphType: "DynamicOrdinaryGraph", directed: true, vertices: ["A", "B", "C"], edges: [{ source: "A", target: "B", weight: 1 }, { source: "B", target: "C", weight: 2 }] };
  const graphArtifact = await upload(graph, "application/vnd.candy.graph+json");
  const snapshot = { schemaVersion: "candy.graph-snapshot/1", graphId: "cuda-companion-graph", graphVersion: 1, graphType: "DynamicOrdinaryGraph", directed: true, weightModel: { kind: "nonnegative_integer", objectives: ["cost"] }, vertexCount: 3, edgeCount: 2, canonicalArtifactRef: graphArtifact, provenance: {} };
  const insertion = await upload({ edges: [{ source: "A", target: "C", weight: 1 }] }, "application/vnd.candy.updates+json");
  const deletion = await upload({ edges: [] }, "application/vnd.candy.updates+json");
  const descriptorValue = { schemaVersion: "candy.graph-update-batch/1", updateBatchId: "cuda-updates", baseGraphRef: { graphId: snapshot.graphId, graphVersion: 1 }, insertionsArtifactRef: insertion, deletionsArtifactRef: deletion, semantics: { ordering: "DELETE_THEN_INSERT", duplicatePolicy: "REJECT", conflictPolicy: "REJECT" } };
  const descriptor = await upload(descriptorValue, "application/vnd.candy.updates+json");
  const prior = await upload({ schemaVersion: "candy.property-state/1", sessionId: "cuda-session", graphId: snapshot.graphId, graphVersion: 1, algorithmStateVersion: 1, sourceVertexId: "A", objective: "cost", distances: [0, 1, 3], parents: [-1, 0, 1] }, "application/vnd.candy.state+json");
  const makeRequest = (requestId, timeoutMs = 10_000) => ({ schemaVersion: "candy.algorithm-request/1", requestId, capability: "RUN_SSSP", algorithm: "SSSP", algorithmVersion: "scope3-cuda-sssp/1", mode: "COMPARE", backend: "LOCAL_CUDA", graphRef: { graphId: snapshot.graphId, graphVersion: 1 }, parameters: { sourceVertexId: "A", objective: "cost" }, resourceHints: { deviceId: 0, timeoutMs }, propertyStateRef: { sessionId: "cuda-session", graphId: snapshot.graphId, graphVersion: 1, algorithmStateVersion: 1 }, updateBatchRef: { updateBatchId: "cuda-updates", baseGraphId: snapshot.graphId, baseGraphVersion: 1 } });
  const submit = request => call("/v1/jobs", { method: "POST", body: JSON.stringify({ schemaVersion: "candy.job-submit/1", request, graphSnapshot: snapshot, graphArtifactId: graphArtifact.id, propertyStateArtifactId: prior.id, updateBatchArtifactId: descriptor.id }) });

  const submitted = await submit(makeRequest("cuda-real-complete"));
  const completed = await terminal(submitted.jobId);
  assert.equal(completed.status.status, "completed", JSON.stringify(completed.status.error));
  const repeated = await call(`/v1/jobs/${submitted.jobId}`);
  assert.equal(repeated.status, "completed");
  assert.deepEqual(repeated.lifecycle, ["queued", "preparing", "running", "validating", "completed"]);
  const result = await call(`/v1/jobs/${submitted.jobId}/result`);
  assert.equal(result.backend, "LOCAL_CUDA");
  assert.equal(result.validation.status, "passed");
  assert.equal(result.modelSummary.reachableCount, 3);
  assert.equal((await call(`/v1/jobs/${submitted.jobId}/cancel`, { method: "POST", body: "{}" })).status, "completed", "near-completion cancellation must not overwrite accepted completion");

  const cancelSubmitted = await submit(makeRequest("cuda-real-cancel"));
  const cancelledOnce = await call(`/v1/jobs/${cancelSubmitted.jobId}/cancel`, { method: "POST", body: "{}" });
  const cancelledTwice = await call(`/v1/jobs/${cancelSubmitted.jobId}/cancel`, { method: "POST", body: "{}" });
  assert.equal(cancelledOnce.status, "cancelled");
  assert.equal(cancelledTwice.status, "cancelled");
  assert.equal((await terminal(cancelSubmitted.jobId)).status.status, "cancelled");

  const timeoutSubmitted = await submit(makeRequest("cuda-real-timeout", 1));
  const timedOut = await terminal(timeoutSubmitted.jobId);
  assert.equal(timedOut.status.status, "failed");
  assert.equal(timedOut.status.error.classification, "PROCESS_TIMEOUT");

  const hypergraph = { ...snapshot, graphId: "cuda-hypergraph", graphType: "Hypergraph", hyperedgeCount: 1 };
  delete hypergraph.edgeCount;
  const hyperRequest = { ...makeRequest("cuda-hypergraph-reject"), graphRef: { graphId: hypergraph.graphId, graphVersion: 1 }, propertyStateRef: { sessionId: "cuda-session", graphId: hypergraph.graphId, graphVersion: 1, algorithmStateVersion: 1 }, updateBatchRef: { updateBatchId: "cuda-updates", baseGraphId: hypergraph.graphId, baseGraphVersion: 1 } };
  const hyperRejected = await rawCall("/v1/jobs", { method: "POST", body: JSON.stringify({ schemaVersion: "candy.job-submit/1", request: hyperRequest, graphSnapshot: hypergraph, graphArtifactId: graphArtifact.id, propertyStateArtifactId: prior.id, updateBatchArtifactId: descriptor.id }) });
  assert.equal(hyperRejected.response.ok, false);
  assert.equal(hyperRejected.body.classification, "INVALID_GRAPH_TYPE");

  await new Promise(resolve => setTimeout(resolve, 250));
  const processes = await cudaProcesses();
  assert.doesNotMatch(processes, /candy-sssp-cuda/i, "no CUDA child may remain after terminal jobs");
  console.log(JSON.stringify({
    result: "PASS",
    transport: "authenticated_loopback_http",
    backend: result.backend,
    device: cudaCapability.devices[0],
    fingerprint: cudaCapability.nativeBuildFingerprint,
    observedPollStates: completed.observed,
    lifecycle: repeated.lifecycle,
    repeatedStatus: repeated.status,
    resultValidation: result.validation.status,
    cancellationBeforeLaunch: cancelledTwice.status,
    timeoutClassification: timedOut.status.error.classification,
    nearCompletionCancel: "completed_preserved",
    hypergraphClassification: hyperRejected.body.classification,
    orphanProcess: false,
    cancellationDuringGpu: "not_forced; qualification job is shorter than a reliable external cancellation observation window",
  }, null, 2));
} finally {
  await runtime.close();
}
