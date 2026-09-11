import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ArtifactStore } from "../candy-runtime/src/artifacts/artifactStore.js";
import { JobManager } from "../candy-runtime/src/jobs/jobManager.js";
import { createRuntimeConfig } from "../candy-runtime/src/config.js";
import { CANDY_ERROR_CODES, CandyContractError } from "../src/candy/contracts/errorClasses.js";

const root = await mkdtemp(join(tmpdir(), "candy-failure-matrix-"));
const store = await new ArtifactStore({ root: join(root, "artifacts"), maxBytes: 4096 }).initialize();
const graph = { graphType: "OrdinaryGraph", directed: true, vertices: ["A", "B"], edges: [{ source: "A", target: "B", weight: 1 }] };
const graphRef = await store.put(Buffer.from(JSON.stringify(graph)), "application/vnd.candy.graph+json");
const snapshot = { schemaVersion: "candy.graph-snapshot/1", graphId: "g", graphVersion: 1, graphType: "OrdinaryGraph", directed: true, weightModel: { kind: "nonnegative_integer", objectives: ["cost"] }, vertexCount: 2, edgeCount: 1, canonicalArtifactRef: graphRef, provenance: {} };
const baseRequest = { schemaVersion: "candy.algorithm-request/1", requestId: "r", capability: "RUN_SSSP", algorithm: "SSSP", algorithmVersion: "scope1-openmp-sssp/1", mode: "STATIC", backend: "LOCAL_OPENMP", graphRef: { graphId: "g", graphVersion: 1 }, parameters: { sourceVertexId: "A", objective: "cost" }, resourceHints: { threads: 1, timeoutMs: 100 } };
const payload = request => ({ schemaVersion: "candy.job-submit/1", request, graphSnapshot: snapshot, graphArtifactId: graphRef.id });
const terminal = async (manager, id) => {
  for (let i = 0; i < 100; i += 1) {
    const value = manager.get(id);
    if (["failed", "completed", "cancelled"].includes(value.status)) return value;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  throw new Error("timeout waiting for test job");
};

try {
  for (const [name, runner, expected] of [
    ["malformed output", { run: async () => ({ stdout: "not json" }) }, "OUTPUT_PARSE_FAILURE"],
    ["process timeout", { run: async () => { throw new CandyContractError(CANDY_ERROR_CODES.PROCESS_TIMEOUT, "timed out"); } }, "PROCESS_TIMEOUT"],
    ["process crash", { run: async () => { throw new CandyContractError(CANDY_ERROR_CODES.PROCESS_CRASH, "crashed"); } }, "PROCESS_CRASH"],
    ["stdout limit", { run: async () => { throw new CandyContractError(CANDY_ERROR_CODES.RESOURCE_LIMIT, "stdout flood"); } }, "RESOURCE_LIMIT"],
  ]) {
    const manager = new JobManager({ artifactStore: store, config: createRuntimeConfig({ artifactRoot: store.root, backendAvailable: true, nativeRunner: runner }) });
    const submitted = await manager.submit(payload({ ...baseRequest, requestId: `r-${name}` }));
    const failed = await terminal(manager, submitted.jobId);
    assert.equal(failed.status, "failed", name);
    assert.equal(failed.error.classification, expected, name);
  }

  const manager = new JobManager({ artifactStore: store, config: createRuntimeConfig({ artifactRoot: store.root, backendAvailable: true, nativeRunner: { run: async () => { throw new Error("must not execute"); } } }) });
  await assert.rejects(manager.submit(payload({ ...baseRequest, backend: "CUDA" })), error => error.code === "BACKEND_UNAVAILABLE");
  await assert.rejects(manager.submit(payload({ ...baseRequest, algorithm: "SHELL", capability: "EXEC", requestId: "inject", executablePath: "cmd /c whoami" })), error => error.code === "INVALID_GRAPH_SCHEMA");
  await assert.rejects(manager.submit({ ...payload(baseRequest), environment: { PATH: "evil" } }), error => error.code === "INVALID_GRAPH_SCHEMA");
  await assert.rejects(store.read("sha256:../../secret"), error => error.code === "INVALID_GRAPH_SCHEMA");
  await assert.rejects(store.put(Buffer.alloc(4097), "application/json"), error => error.code === "RESOURCE_LIMIT");
} finally {
  await rm(root, { recursive: true, force: true });
}

console.log("CANDY Scope 2 C2 adversarial failure matrix passed.");
