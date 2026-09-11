import assert from "node:assert/strict";
import { startCandyRuntime } from "../candy-runtime/src/server.js";

let nativeRuns = 0;
let holdRun = false;
const fakeRunner = {
  async run({ signal }) {
    nativeRuns += 1;
    if (holdRun) await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, 2_000);
      signal.addEventListener("abort", () => { clearTimeout(timer); reject(Object.assign(new Error("cancelled"), { code: "JOB_CANCELLED" })); }, { once: true });
    });
    return {
      stdout: JSON.stringify({ schemaVersion: "candy.native-sssp-result/1", ok: true, algorithm: "SSSP", mode: "STATIC", graphId: "ordinary-1", graphVersion: 1, source: 0, vertexCount: 3, reachableCount: 3, unreachableCount: 0, affectedVertices: 0, execution: { status: "completed", exitCode: 0 }, validation: { status: "not_requested" }, metrics: { preparationMs: 0.1, computeMs: 0.2, validationMs: 0.1 }, distances: [0, 1, 3], parents: [-1, 0, 1] }),
      stderr: "",
      exitCode: 0,
      fingerprint: "sha256:test",
    };
  },
};

const runtime = await startCandyRuntime({ port: 0, backendAvailable: true, nativeRunner: fakeRunner, pairingToken: "scope2-job-test-token-abcdefghijklmnopqrstuvwxyz" });
const base = `http://127.0.0.1:${runtime.port}`;
const headers = { Origin: "http://localhost:5173", Authorization: `Bearer ${runtime.pairingToken}`, "Content-Type": "application/json" };
const api = async (path, init = {}) => {
  const response = await fetch(`${base}${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
  return { response, body: await response.json() };
};
const upload = async (value, mediaType = "application/json") => (await api("/v1/artifacts", { method: "POST", body: JSON.stringify({ schemaVersion: "candy.artifact-upload/1", mediaType, contentEncoding: "utf8", content: typeof value === "string" ? value : JSON.stringify(value) }) })).body;
const waitTerminal = async jobId => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const value = (await api(`/v1/jobs/${jobId}`)).body;
    if (["completed", "failed", "cancelled"].includes(value.status)) return value;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error("job did not finish");
};

try {
  const graph = { graphType: "OrdinaryGraph", directed: true, vertices: ["A", "B", "C"], edges: [{ source: "A", target: "B", weight: 1 }, { source: "B", target: "C", weight: 2 }] };
  const graphArtifact = await upload(graph, "application/vnd.candy.graph+json");
  assert.match(graphArtifact.id, /^sha256:[a-f0-9]{64}$/);
  const snapshot = { schemaVersion: "candy.graph-snapshot/1", graphId: "ordinary-1", graphVersion: 1, graphType: "OrdinaryGraph", directed: true, weightModel: { kind: "nonnegative_integer", objectives: ["cost"] }, vertexCount: 3, edgeCount: 2, canonicalArtifactRef: graphArtifact, provenance: {} };
  const request = { schemaVersion: "candy.algorithm-request/1", requestId: "request-static-1", capability: "RUN_SSSP", algorithm: "SSSP", algorithmVersion: "scope1-openmp-sssp/1", mode: "STATIC", backend: "LOCAL_OPENMP", graphRef: { graphId: "ordinary-1", graphVersion: 1 }, parameters: { sourceVertexId: "A", objective: "cost" }, resourceHints: { threads: 2, timeoutMs: 5_000 } };
  const submitted = await api("/v1/jobs", { method: "POST", body: JSON.stringify({ schemaVersion: "candy.job-submit/1", request, graphSnapshot: snapshot, graphArtifactId: graphArtifact.id }) });
  assert.equal(submitted.response.status, 202);
  const completed = await waitTerminal(submitted.body.jobId);
  assert.equal(completed.status, "completed");
  assert.equal(nativeRuns, 1);
  const result = await api(`/v1/jobs/${submitted.body.jobId}/result`);
  assert.equal(result.body.modelSummary.reachableCount, 3);
  assert.equal(result.body.inputGraphRef.graphVersion, 1);

  const replay = await api("/v1/jobs", { method: "POST", body: JSON.stringify({ schemaVersion: "candy.job-submit/1", request, graphSnapshot: snapshot, graphArtifactId: graphArtifact.id }) });
  assert.equal(replay.body.jobId, submitted.body.jobId);
  assert.equal(nativeRuns, 1);

  const hypergraphBytes = await upload({ graphType: "Hypergraph", directed: false, vertices: ["A"], edges: [] }, "application/vnd.candy.graph+json");
  const hypergraphSnapshot = { ...snapshot, graphId: "hypergraph-1", graphType: "Hypergraph", directed: false, edgeCount: undefined, hyperedgeCount: 1, canonicalArtifactRef: hypergraphBytes };
  delete hypergraphSnapshot.edgeCount;
  const hyperRequest = { ...request, requestId: "request-hyper-1", graphRef: { graphId: "hypergraph-1", graphVersion: 1 } };
  const rejected = await api("/v1/jobs", { method: "POST", body: JSON.stringify({ schemaVersion: "candy.job-submit/1", request: hyperRequest, graphSnapshot: hypergraphSnapshot, graphArtifactId: hypergraphBytes.id }) });
  assert.equal(rejected.response.status, 400);
  assert.equal(rejected.body.classification, "INVALID_GRAPH_TYPE");
  assert.equal(nativeRuns, 1, "hypergraph rejection must not start native execution");

  const traversal = await api("/v1/artifacts/sha256:..%2f..%2fsecret/metadata");
  assert.equal(traversal.response.status, 404);
  const malformed = await api("/v1/artifacts/sha256:ABC/metadata");
  assert.equal(malformed.response.status, 404);

  holdRun = true;
  const request2 = { ...request, requestId: "request-static-2", parameters: { ...request.parameters, sourceVertexId: "B" } };
  const queued = (await api("/v1/jobs", { method: "POST", body: JSON.stringify({ schemaVersion: "candy.job-submit/1", request: request2, graphSnapshot: snapshot, graphArtifactId: graphArtifact.id }) })).body;
  for (let i = 0; i < 50; i += 1) {
    const status = (await api(`/v1/jobs/${queued.jobId}`)).body;
    if (status.status === "running") break;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  const cancelled = (await api(`/v1/jobs/${queued.jobId}/cancel`, { method: "POST", body: "{}" })).body;
  assert.ok(["cancelling", "cancelled"].includes(cancelled.status));
  assert.equal((await waitTerminal(queued.jobId)).status, "cancelled");
  assert.equal((await api(`/v1/jobs/${queued.jobId}/cancel`, { method: "POST", body: "{}" })).body.status, "cancelled");
} finally {
  await runtime.close();
}

console.log("CANDY Scope 2 C2 artifact/job/type/cancellation qualification passed.");
