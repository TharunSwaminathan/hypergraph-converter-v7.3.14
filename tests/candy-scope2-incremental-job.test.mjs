import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { startCandyRuntime } from "../candy-runtime/src/server.js";

const runner = {
  async run({ requestPath }) {
    const requestText = await readFile(requestPath, "utf8");
    const mode = /^mode (\w+)$/m.exec(requestText)?.[1];
    const validation = mode === "COMPARE" ? "passed" : "not_requested";
    return { stdout: JSON.stringify({ schemaVersion: "candy.native-sssp-result/1", ok: true, algorithm: "SSSP", backend: "LOCAL_OPENMP", mode, graphId: "dynamic-1", graphVersion: 2, source: 0, vertexCount: 3, reachableCount: 3, unreachableCount: 0, affectedVertices: 1, execution: { status: "completed", exitCode: 0 }, validation: { status: validation }, metrics: { preparationMs: 0, computeMs: 1, validationMs: mode === "COMPARE" ? 1 : 0 }, distances: [0, 1, 1], parents: [-1, 0, 0] }), stderr: "", exitCode: 0 };
  },
};
const runtime = await startCandyRuntime({ port: 0, backendAvailable: true, nativeRunner: runner, pairingToken: "scope2-incremental-token-abcdefghijklmnopqrstuvwxyz" });
const base = `http://127.0.0.1:${runtime.port}`;
const headers = { Authorization: `Bearer ${runtime.pairingToken}`, "Content-Type": "application/json" };
const call = async (path, init = {}) => {
  const response = await fetch(`${base}${path}`, { ...init, headers });
  return { response, body: await response.json() };
};
const upload = async (value, mediaType = "application/json") => (await call("/v1/artifacts", { method: "POST", body: JSON.stringify({ schemaVersion: "candy.artifact-upload/1", mediaType, contentEncoding: "utf8", content: JSON.stringify(value) }) })).body;
const wait = async id => {
  for (let i = 0; i < 100; i += 1) {
    const status = (await call(`/v1/jobs/${id}`)).body;
    if (["completed", "failed"].includes(status.status)) return status;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  throw new Error("incremental job did not finish");
};

try {
  const graph = { graphType: "DynamicOrdinaryGraph", directed: true, vertices: ["A", "B", "C"], edges: [{ source: "A", target: "B", weight: 1 }, { source: "B", target: "C", weight: 2 }] };
  const graphArtifact = await upload(graph, "application/vnd.candy.graph+json");
  const insertions = await upload({ edges: [{ source: "A", target: "C", weight: 1 }] }, "application/vnd.candy.updates+json");
  const deletions = await upload({ edges: [] }, "application/vnd.candy.updates+json");
  const updateDescriptor = await upload({ schemaVersion: "candy.graph-update-batch/1", updateBatchId: "updates-1", baseGraphRef: { graphId: "dynamic-1", graphVersion: 2 }, insertionsArtifactRef: insertions, deletionsArtifactRef: deletions, semantics: { ordering: "DELETE_THEN_INSERT", duplicatePolicy: "REJECT", conflictPolicy: "REJECT" } }, "application/vnd.candy.updates+json");
  const prior = await upload({ schemaVersion: "candy.property-state/1", sessionId: "session-1", graphId: "dynamic-1", graphVersion: 2, algorithmStateVersion: 1, sourceVertexId: "A", objective: "cost", distances: [0, 1, 3], parents: [-1, 0, 1] }, "application/vnd.candy.state+json");
  const snapshot = { schemaVersion: "candy.graph-snapshot/1", graphId: "dynamic-1", graphVersion: 2, graphType: "DynamicOrdinaryGraph", directed: true, weightModel: { kind: "nonnegative_integer", objectives: ["cost"] }, vertexCount: 3, edgeCount: 2, canonicalArtifactRef: graphArtifact, provenance: {} };
  const makeRequest = mode => ({ schemaVersion: "candy.algorithm-request/1", requestId: `request-${mode}`, capability: "RUN_SSSP", algorithm: "SSSP", algorithmVersion: "scope1-openmp-sssp/1", mode, backend: "LOCAL_OPENMP", graphRef: { graphId: "dynamic-1", graphVersion: 2 }, parameters: { sourceVertexId: "A", objective: "cost" }, resourceHints: { threads: 2, timeoutMs: 5_000 }, propertyStateRef: { sessionId: "session-1", graphId: "dynamic-1", graphVersion: 2, algorithmStateVersion: 1 }, updateBatchRef: { updateBatchId: "updates-1", baseGraphId: "dynamic-1", baseGraphVersion: 2 } });
  for (const mode of ["INCREMENTAL", "COMPARE"]) {
    const submitted = await call("/v1/jobs", { method: "POST", body: JSON.stringify({ schemaVersion: "candy.job-submit/1", request: makeRequest(mode), graphSnapshot: snapshot, graphArtifactId: graphArtifact.id, propertyStateArtifactId: prior.id, updateBatchArtifactId: updateDescriptor.id }) });
    assert.equal(submitted.response.status, 202);
    const status = await wait(submitted.body.jobId);
    assert.equal(status.status, "completed", JSON.stringify(status.error));
    const result = (await call(`/v1/jobs/${submitted.body.jobId}/result`)).body;
    assert.equal(result.mode, mode);
    assert.equal(result.modelSummary.affectedCount, 1);
    if (mode === "COMPARE") assert.equal(result.validation.status, "passed");
  }

  const stale = makeRequest("INCREMENTAL");
  stale.propertyStateRef = { ...stale.propertyStateRef, graphVersion: 1 };
  const rejected = await call("/v1/jobs", { method: "POST", body: JSON.stringify({ schemaVersion: "candy.job-submit/1", request: stale, graphSnapshot: snapshot, graphArtifactId: graphArtifact.id, propertyStateArtifactId: prior.id, updateBatchArtifactId: updateDescriptor.id }) });
  assert.equal(rejected.response.status, 400);
  assert.equal(rejected.body.classification, "STALE_PROPERTY_STATE");
} finally { await runtime.close(); }

console.log("CANDY Scope 2 C2 incremental/compare/stale-state qualification passed.");
