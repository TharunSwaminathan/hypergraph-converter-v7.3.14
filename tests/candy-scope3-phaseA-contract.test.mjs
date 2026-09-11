import assert from "node:assert/strict";
import { CANDY_BACKENDS, validateAlgorithmRequest } from "../src/candy/contracts/algorithmSchemas.js";
import { buildCapabilityDeclaration } from "../candy-runtime/src/capabilities/capabilityRegistry.js";
import { createRuntimeConfig } from "../candy-runtime/src/config.js";
import { routeDeterministicCandyRequest } from "../src/candy/deterministicRouting.js";

const artifact = { id: `sha256:${"a".repeat(64)}`, mediaType: "application/vnd.candy.graph+json", byteLength: 1 };
const request = {
  schemaVersion: "candy.algorithm-request/1",
  requestId: "scope3-gate",
  capability: "RUN_SSSP",
  algorithm: "SSSP",
  algorithmVersion: "scope1-openmp-sssp/1",
  mode: "INCREMENTAL",
  backend: "LOCAL_CUDA",
  graphRef: { graphId: "g", graphVersion: 1 },
  parameters: { sourceVertexId: "A", objective: "cost" },
  resourceHints: { threads: 1, timeoutMs: 5000 },
  propertyStateRef: { sessionId: "s", graphId: "g", graphVersion: 1, algorithmStateVersion: 1 },
  updateBatchRef: { updateBatchId: "u", baseGraphId: "g", baseGraphVersion: 1 },
};
const common = {
  schemaVersion: "candy.graph-snapshot/1",
  graphId: "g",
  graphVersion: 1,
  directed: true,
  weightModel: { kind: "nonnegative_integer", objectives: ["cost"] },
  vertexCount: 2,
  canonicalArtifactRef: artifact,
  provenance: {},
};

assert.deepEqual(CANDY_BACKENDS, ["LOCAL_OPENMP"], "unqualified CUDA must not enter the production backend enum");
assert.throws(
  () => validateAlgorithmRequest(request, { ...common, graphType: "OrdinaryGraph", edgeCount: 1 }),
  error => error.code === "BACKEND_UNAVAILABLE",
);
for (const graphType of ["Hypergraph", "DynamicHypergraph"]) {
  assert.throws(
    () => validateAlgorithmRequest(request, { ...common, graphType, hyperedgeCount: 1 }),
    error => error.code === "INVALID_GRAPH_TYPE",
    `${graphType} must fail before CUDA backend availability`,
  );
}

const declaration = await buildCapabilityDeclaration(createRuntimeConfig({ backendAvailable: true }));
assert.deepEqual(declaration.capabilities.map(item => item.backend), ["LOCAL_OPENMP"]);

const ordinaryState = { hasGraph: true, candy: { graphType: "OrdinaryGraph", featureEnabled: true, capabilityStatus: "ready" } };
const unavailable = routeDeterministicCandyRequest("Run shortest paths from A on the GPU.", ordinaryState);
assert.equal(unavailable.kind, "blocked");
assert.equal(unavailable.classification, "BACKEND_UNAVAILABLE");
assert.match(unavailable.message, /not substituted with LOCAL_OPENMP/);

const updateWording = routeDeterministicCandyRequest("Use the GPU for this shortest-path update.", ordinaryState);
assert.equal(updateWording.kind, "blocked");
assert.equal(updateWording.classification, "BACKEND_UNAVAILABLE");
assert.match(updateWording.message, /not substituted with LOCAL_OPENMP/);

const hypergraph = routeDeterministicCandyRequest("Run shortest paths on this hypergraph using CUDA.", { hasGraph: true, candy: { graphType: "Hypergraph", featureEnabled: true, capabilityStatus: "ready" } });
assert.equal(hypergraph.classification, "INVALID_GRAPH_TYPE");
assert.match(hypergraph.message, /zero artifacts, native jobs, or processes/);

const explanation = routeDeterministicCandyRequest("Explain CUDA SSSP but do not run it.", ordinaryState);
assert.equal(explanation.kind, "explain");
assert.match(explanation.message, /not qualified or advertised/);
assert.match(explanation.message, /CPU static reference must not be described as CUDA STATIC/);
assert.match(explanation.message, /no artifact, job, process, confirmation, or graph change/);

const defaultRoute = routeDeterministicCandyRequest("Run shortest paths from A.", ordinaryState);
assert.equal(defaultRoute.kind, "delegate", "no-preference behavior must preserve the qualified default policy");

console.log("CANDY Scope 3 S3A backend gate, graph-type precedence, and no-fallback tests passed.");
