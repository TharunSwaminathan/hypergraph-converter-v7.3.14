import assert from "node:assert/strict";
import { CANDY_SCHEMA_VERSIONS } from "../src/candy/contracts/schemaVersions.js";
import { CANDY_ERROR_CODES, isCandyContractError } from "../src/candy/contracts/errorClasses.js";
import { GRAPH_TYPES, validateAlgorithmGraphCompatibility } from "../src/candy/contracts/graphTypes.js";
import { validateAlgorithmRequest, validateGraphSnapshot, validateGraphUpdateBatch } from "../src/candy/contracts/algorithmSchemas.js";

const artifact = suffix => ({ id: `sha256:${suffix.repeat(64)}`, mediaType: "application/octet-stream" });
const ordinary = {
  schemaVersion: CANDY_SCHEMA_VERSIONS.GRAPH_SNAPSHOT,
  graphId: "g-test",
  graphVersion: 1,
  graphType: GRAPH_TYPES.ORDINARY,
  directed: true,
  weightModel: { kind: "nonnegative_integer", objectives: ["cost"] },
  vertexCount: 3,
  edgeCount: 2,
  canonicalArtifactRef: artifact("a"),
  provenance: { source: "fixture" },
};

const expectCode = (fn, code) => assert.throws(fn, error => isCandyContractError(error, code));

assert.equal(validateGraphSnapshot(ordinary).graphType, GRAPH_TYPES.ORDINARY);
assert.equal(validateAlgorithmGraphCompatibility("SSSP", GRAPH_TYPES.DYNAMIC_ORDINARY, "INCREMENTAL").compatible, true);
assert.equal(validateAlgorithmGraphCompatibility("SSSP", GRAPH_TYPES.PROJECTED_ORDINARY).compatible, true);

for (const type of [GRAPH_TYPES.HYPERGRAPH, GRAPH_TYPES.DYNAMIC_HYPERGRAPH]) {
  expectCode(() => validateAlgorithmGraphCompatibility("SSSP", type), CANDY_ERROR_CODES.INVALID_GRAPH_TYPE);
  try {
    validateAlgorithmGraphCompatibility("SSSP", type);
  } catch (error) {
    assert.equal(error.details.implicitProjectionPerformed, false);
  }
}

expectCode(() => validateGraphSnapshot({ ...ordinary, schemaVersion: "unknown/1" }), CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA);
expectCode(() => validateGraphSnapshot({ ...ordinary, graphId: "" }), CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA);
expectCode(() => validateGraphSnapshot({ ...ordinary, graphVersion: -1 }), CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA);
expectCode(() => validateGraphSnapshot({ ...ordinary, canonicalArtifactRef: { id: "file:C:/secret", mediaType: "x" } }), CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA);
expectCode(() => validateGraphSnapshot({ ...ordinary, hyperedgeCount: 2 }), CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA);
expectCode(() => validateGraphSnapshot({ ...ordinary, graphType: GRAPH_TYPES.HYPERGRAPH }), CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA);

const projected = {
  ...ordinary,
  graphId: "g-projected",
  graphType: GRAPH_TYPES.PROJECTED_ORDINARY,
  provenance: {
    sourceGraphRef: { graphId: "h-source", graphVersion: 4 },
    projection: {
      method: "CLIQUE_TWO_SECTION",
      schemaVersion: "projection/1",
      mappingArtifactRef: artifact("b"),
      validation: "passed",
    },
  },
};
assert.equal(validateGraphSnapshot(projected).graphType, GRAPH_TYPES.PROJECTED_ORDINARY);
expectCode(() => validateGraphSnapshot({ ...projected, provenance: { source: "missing projection proof" } }), CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA);

const batch = {
  schemaVersion: CANDY_SCHEMA_VERSIONS.GRAPH_UPDATE_BATCH,
  updateBatchId: "u-1",
  baseGraphRef: { graphId: "g-test", graphVersion: 1 },
  insertionsArtifactRef: artifact("c"),
  deletionsArtifactRef: artifact("d"),
  semantics: { ordering: "DELETE_THEN_INSERT", duplicatePolicy: "REJECT", conflictPolicy: "REJECT" },
};
assert.equal(validateGraphUpdateBatch(batch, ordinary).updateBatchId, "u-1");
expectCode(() => validateGraphUpdateBatch({ ...batch, semantics: { ...batch.semantics, ordering: "INSERT_THEN_DELETE" } }), CANDY_ERROR_CODES.INVALID_UPDATE_BATCH);
expectCode(() => validateGraphUpdateBatch(batch, { graphId: "g-test", graphVersion: 2 }), CANDY_ERROR_CODES.STALE_GRAPH_VERSION);

const staticRequest = {
  schemaVersion: CANDY_SCHEMA_VERSIONS.ALGORITHM_REQUEST,
  requestId: "r-1",
  capability: "RUN_SSSP",
  algorithm: "SSSP",
  algorithmVersion: "poc-1",
  mode: "STATIC",
  backend: "LOCAL_OPENMP",
  graphRef: { graphId: "g-test", graphVersion: 1 },
  parameters: { sourceVertexId: "A", objective: "cost" },
  resourceHints: { threads: 2, timeoutMs: 1000 },
};
assert.equal(validateAlgorithmRequest(staticRequest, ordinary).mode, "STATIC");
expectCode(() => validateAlgorithmRequest({ ...staticRequest, mode: "INCREMENTAL" }, ordinary), CANDY_ERROR_CODES.STALE_PROPERTY_STATE);
const hypergraph = {
  ...ordinary,
  graphId: "h-test",
  graphType: GRAPH_TYPES.HYPERGRAPH,
  hyperedgeCount: 1,
};
delete hypergraph.edgeCount;
expectCode(
  () => validateAlgorithmRequest({ ...staticRequest, graphRef: { graphId: "h-test", graphVersion: 1 } }, hypergraph),
  CANDY_ERROR_CODES.INVALID_GRAPH_TYPE,
);
expectCode(() => validateAlgorithmRequest({ ...staticRequest, backend: "CUDA" }, ordinary), CANDY_ERROR_CODES.BACKEND_UNAVAILABLE);

const incrementalRequest = {
  ...staticRequest,
  mode: "INCREMENTAL",
  propertyStateRef: { sessionId: "s-1", graphId: "g-test", graphVersion: 1, algorithmStateVersion: 2 },
  updateBatchRef: { updateBatchId: "u-1", baseGraphId: "g-test", baseGraphVersion: 1 },
};
assert.equal(validateAlgorithmRequest(incrementalRequest, ordinary).mode, "INCREMENTAL");
expectCode(
  () => validateAlgorithmRequest({ ...incrementalRequest, propertyStateRef: { ...incrementalRequest.propertyStateRef, graphVersion: 0 } }, ordinary),
  CANDY_ERROR_CODES.STALE_PROPERTY_STATE,
);
expectCode(
  () => validateAlgorithmRequest({ ...incrementalRequest, propertyStateRef: { ...incrementalRequest.propertyStateRef, algorithmStateVersion: 0 } }, ordinary),
  CANDY_ERROR_CODES.STALE_PROPERTY_STATE,
);
expectCode(
  () => validateAlgorithmRequest({ ...incrementalRequest, updateBatchRef: { ...incrementalRequest.updateBatchRef, baseGraphVersion: 0 } }, ordinary),
  CANDY_ERROR_CODES.STALE_GRAPH_VERSION,
);

console.log("CANDY Phase A contract tests passed.");
