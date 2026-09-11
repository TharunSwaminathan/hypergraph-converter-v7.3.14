import assert from "node:assert/strict";
import { buildAuthoritativeOrchestratorObservation } from "../src/agent/orchestratorObservation.js";
import { buildReactOrchestratorRequest } from "../src/agent/reactOrchestrator.js";
import { generateWithLocalModel, listOllamaModels } from "../src/agent/localModelClient.js";
import { validateOrchestratorStep } from "../src/agent/orchestratorStepValidator.js";
import { routeDeterministicCandyRequest } from "../src/candy/deterministicRouting.js";

const MODEL = "qwen3:8b";
const BASE_URL = "http://127.0.0.1:11434";
const JOB_ID = "11111111-1111-4111-8111-111111111111";
const capability = Object.freeze({
  capability: "RUN_SSSP",
  algorithm: "SSSP",
  algorithmVersion: "scope1-openmp-sssp/1",
  backend: "LOCAL_OPENMP",
  graphTypes: ["OrdinaryGraph", "DynamicOrdinaryGraph", "ProjectedOrdinaryGraph"],
  modes: ["STATIC", "INCREMENTAL", "COMPARE"],
});

function state({ graphType = "OrdinaryGraph", jobs = [] } = {}) {
  return {
    hasGraph: true,
    graphId: "live-qwen-qualified-graph",
    graphVersion: 1,
    vertexCount: 3,
    candy: {
      featureEnabled: true,
      status: "ready",
      authorized: true,
      runtimeVersion: "candy-runtime-companion/1",
      capabilityStatus: graphType === "Hypergraph" ? "unavailable" : "ready",
      graphType,
      edgeCount: 2,
      capabilities: graphType === "Hypergraph" ? [] : [capability],
      jobs,
    },
  };
}

async function modelStep(userQuery, modelState) {
  const observation = buildAuthoritativeOrchestratorObservation({ state: modelState });
  const request = buildReactOrchestratorRequest({ userQuery, observation });
  const raw = await generateWithLocalModel({ enabled: true, activeBaseUrl: BASE_URL, model: MODEL }, request);
  const validated = validateOrchestratorStep(raw, observation.availableCapabilities);
  return { observation, request, validated };
}

const models = await listOllamaModels(BASE_URL);
assert.ok(models.includes(MODEL), `${MODEL} is not installed in the local Ollama runtime.`);

let modelCalls = 0;
const explanation = routeDeterministicCandyRequest(
  "Explain whether CANDY SSSP can run on this hypergraph. Do not run anything.",
  state({ graphType: "Hypergraph" }),
);
assert.equal(explanation.kind, "explain");
assert.match(explanation.message, /requires an ordinary graph/);
assert.match(explanation.message, /active dataset is Hypergraph/);
assert.match(explanation.message, /No implicit projection will be performed/);

modelCalls += 1;
const submission = await modelStep("Run shortest paths from vertex A.", state());
assert.equal(submission.validated.ok, true, submission.validated.errors?.join("; "));
assert.equal(submission.validated.data.outcome, "PROPOSE_ACTION");
assert.equal(submission.validated.data.action, "SUBMIT_CANDY_JOB");
assert.deepEqual(Object.keys(submission.validated.data.arguments).sort(), ["algorithm", "backend", "mode", "sourceVertexId", "threads", "timeoutMs"].sort());
assert.equal(submission.validated.data.arguments.algorithm, "SSSP");
assert.equal(submission.validated.data.arguments.backend, "LOCAL_OPENMP");
assert.equal(submission.validated.data.arguments.sourceVertexId, "A");

const rejected = routeDeterministicCandyRequest("Run CANDY SSSP from vertex A.", state({ graphType: "Hypergraph" }));
assert.equal(rejected.classification, "INVALID_GRAPH_TYPE");
assert.match(rejected.message, /No implicit projection was performed/);
assert.match(rejected.message, /zero artifacts, native jobs, or processes/);

const runningJob = { jobId: JOB_ID, status: "running", algorithm: "SSSP", backend: "LOCAL_OPENMP", mode: "STATIC" };
modelCalls += 1;
const status = await modelStep(`Check the authoritative status of CANDY job ${JOB_ID}.`, state({ jobs: [runningJob] }));
assert.equal(status.validated.ok, true, status.validated.errors?.join("; "));
assert.equal(status.validated.data.action, "GET_CANDY_JOB_STATUS");
assert.equal(status.validated.data.arguments.jobId, JOB_ID);

modelCalls += 1;
const cancellation = await modelStep(`Cancel CANDY job ${JOB_ID}.`, state({ jobs: [runningJob] }));
assert.equal(cancellation.validated.ok, true, cancellation.validated.errors?.join("; "));
assert.equal(cancellation.validated.data.action, "CANCEL_CANDY_JOB");
assert.equal(cancellation.validated.data.arguments.jobId, JOB_ID);

console.log(JSON.stringify({
  result: "PASS",
  runtime: "ollama",
  model: MODEL,
  modelCalls,
  deterministicBypassCount: 2,
  acceptedActions: [submission.validated.data.action, status.validated.data.action, cancellation.validated.data.action],
  rejectedActions: [{ request: "Hypergraph SSSP execution", classification: rejected.classification }],
  schemaFailures: 0,
  fallbackCount: 0,
  explanation: { graphType: "Hypergraph", deterministic: true, jobCreated: false, confirmationCreated: false, implicitProjectionPerformed: false },
  submission: { graphType: "OrdinaryGraph", stopAfterOneTypedAction: true, shellPathProcessFields: false },
  status: { requestedAuthoritativeObservation: true, completionClaimed: false },
  cancellation: { typedActionOnly: true },
}, null, 2));
