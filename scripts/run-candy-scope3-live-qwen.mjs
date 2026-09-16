import assert from "node:assert/strict";
import { buildAuthoritativeOrchestratorObservation } from "../src/agent/orchestratorObservation.js";
import { buildReactOrchestratorRequest } from "../src/agent/reactOrchestrator.js";
import { generateWithLocalModel, listOllamaModels } from "../src/agent/localModelClient.js";
import { validateOrchestratorStep } from "../src/agent/orchestratorStepValidator.js";
import { routeDeterministicCandyRequest } from "../src/candy/deterministicRouting.js";

const MODEL = "qwen3:8b";
const BASE_URL = "http://127.0.0.1:11434";
const JOB_ID = "11111111-1111-4111-8111-111111111111";
const cudaCapability = Object.freeze({ capability: "RUN_SSSP", algorithm: "SSSP", algorithmVersion: "scope3-cuda-sssp/1", backend: "LOCAL_CUDA", graphTypes: ["OrdinaryGraph", "DynamicOrdinaryGraph", "ProjectedOrdinaryGraph"], modes: ["INCREMENTAL", "COMPARE"], devices: [{ id: 0, name: "NVIDIA GeForce RTX 5060", computeCapability: "12.0", qualifiedArchitecture: "sm_120", memoryMiB: 8151 }] });

function state({ graphType = "DynamicOrdinaryGraph", cudaAvailable = true, jobs = [] } = {}) {
  return { hasGraph: true, graphId: "live-qwen-cuda-graph", graphVersion: 2, vertexCount: 3, candy: { featureEnabled: true, status: "ready", authorized: true, runtimeVersion: "candy-runtime-companion/1", capabilityStatus: graphType === "Hypergraph" || !cudaAvailable ? "unavailable" : "ready", graphType, edgeCount: 2, capabilities: graphType === "Hypergraph" || !cudaAvailable ? [] : [cudaCapability], jobs } };
}

async function modelStep(userQuery, modelState) {
  const observation = buildAuthoritativeOrchestratorObservation({ state: modelState });
  const request = buildReactOrchestratorRequest({ userQuery, observation });
  const raw = await generateWithLocalModel({ enabled: true, activeBaseUrl: BASE_URL, model: MODEL }, request);
  return { observation, validated: validateOrchestratorStep(raw, observation.availableCapabilities) };
}

const models = await listOllamaModels(BASE_URL);
assert.ok(models.includes(MODEL), `${MODEL} is not installed in the local Ollama runtime.`);

const first = await modelStep("Run shortest paths from A using CUDA.", state());
assert.equal(first.validated.ok, true, first.validated.errors?.join("; "));
assert.equal(first.validated.data.action, "SUBMIT_CANDY_JOB");
assert.deepEqual(first.validated.data.arguments, { algorithm: "SSSP", backend: "LOCAL_CUDA", mode: "INCREMENTAL", sourceVertexId: "A", deviceId: 0, timeoutMs: 5000 });

const second = await modelStep("Use the GPU for this shortest-path update.", state());
assert.equal(second.validated.ok, true, second.validated.errors?.join("; "));
assert.equal(second.validated.data.action, "SUBMIT_CANDY_JOB");
assert.equal(second.validated.data.arguments.backend, "LOCAL_CUDA");
assert.equal(second.validated.data.arguments.mode, "INCREMENTAL");
assert.equal(Object.hasOwn(second.validated.data.arguments, "threads"), false);

const unavailable = routeDeterministicCandyRequest("Run shortest paths from A using CUDA.", state({ cudaAvailable: false }));
assert.equal(unavailable.classification, "BACKEND_UNAVAILABLE");
assert.match(unavailable.message, /not substituted with LOCAL_OPENMP/);
const hypergraph = routeDeterministicCandyRequest("Run shortest paths from A using CUDA.", state({ graphType: "Hypergraph" }));
assert.equal(hypergraph.classification, "INVALID_GRAPH_TYPE");
assert.match(hypergraph.message, /zero artifacts, native jobs, or processes/);
const explanation = routeDeterministicCandyRequest("Explain CUDA SSSP but do not run it.", state());
assert.equal(explanation.kind, "explain");
assert.match(explanation.message, /INCREMENTAL and COMPARE only/);

const runningJob = { jobId: JOB_ID, status: "running", algorithm: "SSSP", backend: "LOCAL_CUDA", mode: "INCREMENTAL" };
const status = await modelStep(`Check the authoritative status of CUDA CANDY job ${JOB_ID}.`, state({ jobs: [runningJob] }));
assert.equal(status.validated.ok, true, status.validated.errors?.join("; "));
assert.equal(status.validated.data.outcome, "PROPOSE_ACTION");
assert.equal(status.validated.data.action, "GET_CANDY_JOB_STATUS");
assert.deepEqual(status.validated.data.arguments, { jobId: JOB_ID });
const cancellation = await modelStep(`Cancel CUDA CANDY job ${JOB_ID}.`, state({ jobs: [runningJob] }));
assert.equal(cancellation.validated.ok, true, cancellation.validated.errors?.join("; "));
assert.equal(cancellation.validated.data.outcome, "PROPOSE_ACTION");
assert.equal(cancellation.validated.data.action, "CANCEL_CANDY_JOB");
assert.deepEqual(cancellation.validated.data.arguments, { jobId: JOB_ID });

for (const action of [first.validated.data, second.validated.data, status.validated.data, cancellation.validated.data]) {
  const serialized = JSON.stringify(action.arguments);
  assert.doesNotMatch(serialized, /shell|path|kernel|blocks|threadsPerBlock|executable|nvcc/i);
}

console.log(JSON.stringify({ result: "PASS", runtime: "ollama", model: MODEL, modelCalls: 4, typedCudaSubmissions: 2, deterministicBypassCount: 3, schemaFailures: 0, fallbackCount: 0, unavailableClassification: unavailable.classification, hypergraphClassification: hypergraph.classification, explanationCreatedJob: false, statusAction: status.validated.data.action, cancellationAction: cancellation.validated.data.action, shellPathKernelFields: false }, null, 2));
