import assert from "node:assert/strict";
import { startCandyRuntime } from "../src/server.js";

const runtime = await startCandyRuntime({ port: 0 });
const base = `http://127.0.0.1:${runtime.port}`;
const headers = { Authorization: `Bearer ${runtime.pairingToken}`, "Content-Type": "application/json" };
const call = async (path, init = {}) => {
  const response = await fetch(`${base}${path}`, { ...init, headers });
  const body = await response.json();
  if (!response.ok) throw new Error(`${path}: ${response.status} ${JSON.stringify(body)}`);
  return body;
};
const upload = (value, mediaType) => call("/v1/artifacts", { method: "POST", body: JSON.stringify({ schemaVersion: "candy.artifact-upload/1", mediaType, contentEncoding: "utf8", content: JSON.stringify(value) }) });
const terminal = async jobId => {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const status = await call(`/v1/jobs/${jobId}`);
    if (["completed", "failed", "cancelled"].includes(status.status)) return status;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error("Companion native job did not reach a terminal state.");
};

try {
  const capability = await call("/v1/capabilities");
  assert.equal(capability.capabilities.length, 1, "qualified native backend must be discoverable");
  assert.equal(capability.capabilities[0].executionEnvironment, process.platform === "win32" ? "WSL2_LINUX" : "LINUX");

  const graph = { graphType: "DynamicOrdinaryGraph", directed: true, vertices: ["A", "B", "C"], edges: [{ source: "A", target: "B", weight: 1 }, { source: "B", target: "C", weight: 2 }] };
  const graphArtifact = await upload(graph, "application/vnd.candy.graph+json");
  const snapshot = { schemaVersion: "candy.graph-snapshot/1", graphId: "companion-native-graph", graphVersion: 1, graphType: "DynamicOrdinaryGraph", directed: true, weightModel: { kind: "nonnegative_integer", objectives: ["cost"] }, vertexCount: 3, edgeCount: 2, canonicalArtifactRef: graphArtifact, provenance: {} };
  const baseRequest = { schemaVersion: "candy.algorithm-request/1", requestId: "companion-static", capability: "RUN_SSSP", algorithm: "SSSP", algorithmVersion: "scope1-openmp-sssp/1", mode: "STATIC", backend: "LOCAL_OPENMP", graphRef: { graphId: snapshot.graphId, graphVersion: 1 }, parameters: { sourceVertexId: "A", objective: "cost" }, resourceHints: { threads: 2, timeoutMs: 10_000 } };
  const submitted = await call("/v1/jobs", { method: "POST", body: JSON.stringify({ schemaVersion: "candy.job-submit/1", request: baseRequest, graphSnapshot: snapshot, graphArtifactId: graphArtifact.id }) });
  const completed = await terminal(submitted.jobId);
  assert.equal(completed.status, "completed", JSON.stringify(completed.error));
  const staticResult = await call(`/v1/jobs/${submitted.jobId}/result`);
  assert.deepEqual({ reachable: staticResult.modelSummary.reachableCount, unreachable: staticResult.modelSummary.unreachableCount }, { reachable: 3, unreachable: 0 });

  const insertion = await upload({ edges: [{ source: "A", target: "C", weight: 1 }] }, "application/vnd.candy.updates+json");
  const deletion = await upload({ edges: [] }, "application/vnd.candy.updates+json");
  const descriptor = await upload({ schemaVersion: "candy.graph-update-batch/1", updateBatchId: "companion-updates", baseGraphRef: baseRequest.graphRef, insertionsArtifactRef: insertion, deletionsArtifactRef: deletion, semantics: { ordering: "DELETE_THEN_INSERT", duplicatePolicy: "REJECT", conflictPolicy: "REJECT" } }, "application/vnd.candy.updates+json");
  const prior = await upload({ schemaVersion: "candy.property-state/1", sessionId: "companion-session", graphId: snapshot.graphId, graphVersion: 1, algorithmStateVersion: 1, sourceVertexId: "A", objective: "cost", distances: [0, 1, 3], parents: [-1, 0, 1] }, "application/vnd.candy.state+json");
  const incrementalRequest = { ...baseRequest, requestId: "companion-incremental", mode: "INCREMENTAL", propertyStateRef: { sessionId: "companion-session", graphId: snapshot.graphId, graphVersion: 1, algorithmStateVersion: 1 }, updateBatchRef: { updateBatchId: "companion-updates", baseGraphId: snapshot.graphId, baseGraphVersion: 1 } };
  const incrementalJob = await call("/v1/jobs", { method: "POST", body: JSON.stringify({ schemaVersion: "candy.job-submit/1", request: incrementalRequest, graphSnapshot: snapshot, graphArtifactId: graphArtifact.id, propertyStateArtifactId: prior.id, updateBatchArtifactId: descriptor.id }) });
  const incrementalStatus = await terminal(incrementalJob.jobId);
  assert.equal(incrementalStatus.status, "completed", JSON.stringify(incrementalStatus.error));
  const incrementalResult = await call(`/v1/jobs/${incrementalJob.jobId}/result`);
  assert.equal(incrementalResult.modelSummary.affectedCount > 0, true);

  console.log(JSON.stringify({ result: "PASS", transport: "authenticated_loopback_http", executionEnvironment: capability.capabilities[0].executionEnvironment, staticStatus: completed.status, staticReachable: staticResult.modelSummary.reachableCount, incrementalStatus: incrementalStatus.status, incrementalAffected: incrementalResult.modelSummary.affectedCount, tokenLogged: false, fullArraysInStatus: false }, null, 2));
} finally {
  await runtime.close();
}
