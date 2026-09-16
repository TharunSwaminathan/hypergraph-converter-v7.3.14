import assert from "node:assert/strict";
import { validateAlgorithmRequest } from "../src/candy/contracts/algorithmSchemas.js";
import { intersectCandyCapabilities } from "../src/candy/capabilityDiscovery.js";
import { candyRequestConfirmationBinding, candyRequestNeedsConfirmation, validateCandySubmissionIntent } from "../src/candy/requestPolicy.js";
import { reactActionRequiresConfirmation, validateReactActionArguments } from "../src/agent/orchestratorCapabilities.js";
import { routeDeterministicCandyRequest } from "../src/candy/deterministicRouting.js";
import { createRuntimeConfig } from "../candy-runtime/src/config.js";
import { buildCapabilityDeclaration } from "../candy-runtime/src/capabilities/capabilityRegistry.js";
import { serializeNativeSsspRequest } from "../candy-runtime/src/backends/nativeRequestAdapter.js";

const ref = { id: `sha256:${"a".repeat(64)}`, mediaType: "application/json", byteLength: 1 };
const graph = { schemaVersion: "candy.graph-snapshot/1", graphId: "g", graphVersion: 4, graphType: "DynamicOrdinaryGraph", directed: true, weightModel: { kind: "nonnegative_integer", objectives: ["cost"] }, vertexCount: 3, edgeCount: 2, canonicalArtifactRef: ref, provenance: {} };
const cuda = { algorithm: "SSSP", backend: "LOCAL_CUDA", mode: "INCREMENTAL", sourceVertexId: "A", deviceId: 0, timeoutMs: 5_000 };
const request = { schemaVersion: "candy.algorithm-request/1", requestId: "cuda-s3c", capability: "RUN_SSSP", algorithm: "SSSP", algorithmVersion: "scope3-cuda-sssp/1", mode: "INCREMENTAL", backend: "LOCAL_CUDA", graphRef: { graphId: "g", graphVersion: 4 }, parameters: { sourceVertexId: "A", objective: "cost" }, resourceHints: { deviceId: 0, timeoutMs: 5_000 }, propertyStateRef: { sessionId: "s", graphId: "g", graphVersion: 4, algorithmStateVersion: 2 }, updateBatchRef: { updateBatchId: "u", baseGraphId: "g", baseGraphVersion: 4 } };

assert.equal(validateAlgorithmRequest(request, graph).backend, "LOCAL_CUDA");
assert.throws(() => validateAlgorithmRequest({ ...request, mode: "STATIC" }, graph), error => error.code === "ALGORITHM_FAILURE");
assert.throws(() => validateAlgorithmRequest({ ...request, resourceHints: { threads: 2, timeoutMs: 5_000 } }, graph), error => error.code === "INVALID_GRAPH_SCHEMA");
assert.throws(() => validateAlgorithmRequest({ ...request, resourceHints: { deviceId: 999, timeoutMs: 5_000 } }, graph), error => error.code === "RESOURCE_LIMIT");
assert.throws(() => validateAlgorithmRequest(request, { ...graph, graphType: "Hypergraph", hyperedgeCount: 2, edgeCount: undefined }), error => error.code === "INVALID_GRAPH_SCHEMA" || error.code === "INVALID_GRAPH_TYPE");

assert.deepEqual(validateReactActionArguments("SUBMIT_CANDY_JOB", cuda), []);
assert.ok(validateReactActionArguments("SUBMIT_CANDY_JOB", { ...cuda, mode: "STATIC" }).length);
assert.ok(validateReactActionArguments("SUBMIT_CANDY_JOB", { ...cuda, threads: 2 }).length);
assert.ok(validateReactActionArguments("SUBMIT_CANDY_JOB", { ...cuda, executable: "evil" }).length);
assert.equal(reactActionRequiresConfirmation("SUBMIT_CANDY_JOB", {}, cuda), true);
assert.equal(candyRequestNeedsConfirmation(cuda, graph), true);
assert.equal(validateCandySubmissionIntent(cuda, graph).ok, true);
assert.equal(validateCandySubmissionIntent({ ...cuda, mode: "STATIC" }, graph).classification, "ALGORITHM_FAILURE");

const binding = candyRequestConfirmationBinding({ argumentsValue: { ...cuda, propertyStateVersion: 2, updateBatchId: "u" }, graph: { id: "g", version: 4 } });
for (const changed of [
  { ...cuda, deviceId: 1, propertyStateVersion: 2, updateBatchId: "u" },
  { ...cuda, backend: "LOCAL_OPENMP", threads: 2, propertyStateVersion: 2, updateBatchId: "u" },
  { ...cuda, propertyStateVersion: 3, updateBatchId: "u" },
  { ...cuda, propertyStateVersion: 2, updateBatchId: "u2" },
]) assert.notEqual(binding.requestHash, candyRequestConfirmationBinding({ argumentsValue: changed, graph: { id: "g", version: 4 } }).requestHash);
assert.notEqual(binding.requestHash, candyRequestConfirmationBinding({ argumentsValue: { ...cuda, propertyStateVersion: 2, updateBatchId: "u" }, graph: { id: "g", version: 5 } }).requestHash);

const injectedCuda = { available: true, path: "fixed-test-path", fingerprint: `sha256:${"b".repeat(64)}`, executionEnvironment: "WSL2_CUDA", adapterVersion: "candy.cuda-adapter/1", qualification: { schemaVersion: "candy.cuda-qualified-build/1", status: "exact_local_attestation" }, device: { id: 0, name: "Test GPU", computeCapability: "12.0", qualifiedArchitecture: "sm_120", memoryMiB: 8151 } };
const declaration = await buildCapabilityDeclaration(createRuntimeConfig({ backendAvailable: true, cudaBackendDiscovery: injectedCuda }));
assert.deepEqual(declaration.capabilities.map(item => item.backend), ["LOCAL_OPENMP", "LOCAL_CUDA"]);
assert.deepEqual(declaration.capabilities[1].modes, ["INCREMENTAL", "COMPARE"]);
assert.equal(declaration.capabilities[1].devices[0].qualifiedArchitecture, "sm_120");
const intersection = intersectCandyCapabilities(declaration, { authorized: true, graphType: "DynamicOrdinaryGraph" });
assert.deepEqual(intersection.capabilities.map(item => item.backend), ["LOCAL_OPENMP", "LOCAL_CUDA"]);
assert.equal(intersection.capabilities[1].devices[0].name, "Test GPU");

const noCudaState = { hasGraph: true, candy: { graphType: "DynamicOrdinaryGraph", featureEnabled: true, capabilityStatus: "ready", capabilities: declaration.capabilities.slice(0, 1) } };
assert.equal(routeDeterministicCandyRequest("Use the GPU for this shortest-path update.", noCudaState).classification, "BACKEND_UNAVAILABLE");
assert.equal(routeDeterministicCandyRequest("Use the GPU for this shortest-path update.", { ...noCudaState, candy: { ...noCudaState.candy, capabilities: declaration.capabilities } }).kind, "delegate");
assert.equal(routeDeterministicCandyRequest("Use the GPU for this shortest-path update.", { ...noCudaState, candy: { ...noCudaState.candy, graphType: "Hypergraph", capabilities: declaration.capabilities } }).classification, "INVALID_GRAPH_TYPE");

const csr = { vertexCount: 3, edgeCount: 2, rowOffsets: [0, 1, 2, 2], columnIndices: [1, 2], weights: [1, 1], mapping: { toNative: id => ({ A: 0, B: 1, C: 2 })[id] } };
const native = serializeNativeSsspRequest({ request, graphSnapshot: graph, csr, priorState: { graphId: "g", graphVersion: 4, algorithmStateVersion: 2, distances: [0, 1, 2], parents: [-1, 0, 1] }, updates: { insertions: [], deletions: [] } });
assert.match(native, /^CANDY_SSSP_CUDA_REQUEST_V1/m);
assert.match(native, /^backend LOCAL_CUDA$/m);
assert.match(native, /^cuda_device 0$/m);
assert.doesNotMatch(native, /^threads /m);

console.log("CANDY Scope 3 S3C typed backend, capability, confirmation, no-fallback, and CUDA adapter tests passed.");
