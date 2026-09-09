import { CANDY_SCHEMA_VERSIONS } from "./schemaVersions.js";
import { CANDY_ERROR_CODES, failCandy } from "./errorClasses.js";
import { GRAPH_TYPES, isGraphType, validateAlgorithmGraphCompatibility } from "./graphTypes.js";
import {
  requireBoolean,
  requireExactKeys,
  requireNonEmptyString,
  requireNonNegativeSafeInteger,
  requirePlainObject,
  validateArtifactRef,
  validateGraphRef,
} from "./contractValidation.js";

export const SSSP_ALGORITHM = "SSSP";
export const SSSP_MODES = Object.freeze(["STATIC", "INCREMENTAL", "COMPARE"]);
export const CANDY_BACKENDS = Object.freeze(["LOCAL_OPENMP"]);
export const MAX_NATIVE_WEIGHT = 2_147_483_647;
export const MAX_NATIVE_VERTICES = 2_147_483_647;
export const MAX_NATIVE_EDGES = 2_147_483_647;
const MAX_MODEL_SUMMARY_BYTES = 4_096;
const MAX_WARNINGS = 20;

function requireSchema(actual, expected, label, code = CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA) {
  if (actual !== expected) {
    failCandy(code, `${label} uses an unknown schema version.`, { actual, expected });
  }
}

export function validateWeightModel(value) {
  requirePlainObject(value, "weightModel");
  requireExactKeys(value, ["kind", "objectives"], ["nativeMax"], "weightModel");
  if (value.kind !== "nonnegative_integer") {
    failCandy(CANDY_ERROR_CODES.UNSUPPORTED_WEIGHT_MODEL, "SSSP requires non-negative integer edge weights.", {
      kind: value.kind,
    });
  }
  if (!Array.isArray(value.objectives) || value.objectives.length !== 1) {
    failCandy(CANDY_ERROR_CODES.UNSUPPORTED_WEIGHT_MODEL, "SSSP requires exactly one named objective.", {
      objectives: value.objectives,
    });
  }
  requireNonEmptyString(value.objectives[0], "weightModel.objectives[0]", CANDY_ERROR_CODES.UNSUPPORTED_WEIGHT_MODEL);
  if (Object.hasOwn(value, "nativeMax") && value.nativeMax !== MAX_NATIVE_WEIGHT) {
    failCandy(CANDY_ERROR_CODES.UNSUPPORTED_WEIGHT_MODEL, "Unsupported native weight bound.", {
      nativeMax: value.nativeMax,
      expected: MAX_NATIVE_WEIGHT,
    });
  }
  return Object.freeze({ kind: value.kind, objectives: Object.freeze([...value.objectives]), nativeMax: MAX_NATIVE_WEIGHT });
}

function validateProjectionProvenance(provenance) {
  requirePlainObject(provenance, "provenance");
  requireExactKeys(provenance, ["sourceGraphRef", "projection"], ["source", "createdAt"], "provenance");
  validateGraphRef(provenance.sourceGraphRef, "provenance.sourceGraphRef");
  requirePlainObject(provenance.projection, "provenance.projection");
  requireExactKeys(provenance.projection, ["method", "schemaVersion", "mappingArtifactRef", "validation"], ["parameters", "warnings"], "provenance.projection");
  requireNonEmptyString(provenance.projection.method, "provenance.projection.method");
  requireNonEmptyString(provenance.projection.schemaVersion, "provenance.projection.schemaVersion");
  validateArtifactRef(provenance.projection.mappingArtifactRef, "provenance.projection.mappingArtifactRef");
  if (provenance.projection.validation !== "passed") {
    failCandy(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA, "Projected graph provenance must record passed validation.");
  }
}

export function validateGraphSnapshot(value) {
  requirePlainObject(value, "GraphSnapshot");
  requireExactKeys(
    value,
    ["schemaVersion", "graphId", "graphVersion", "graphType", "directed", "weightModel", "vertexCount", "canonicalArtifactRef", "provenance"],
    ["edgeCount", "hyperedgeCount"],
    "GraphSnapshot",
  );
  requireSchema(value.schemaVersion, CANDY_SCHEMA_VERSIONS.GRAPH_SNAPSHOT, "GraphSnapshot");
  requireNonEmptyString(value.graphId, "graphId");
  requireNonNegativeSafeInteger(value.graphVersion, "graphVersion");
  if (!isGraphType(value.graphType)) failCandy(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA, "GraphSnapshot has an unknown graph type.", { graphType: value.graphType });
  requireBoolean(value.directed, "directed");
  const weightModel = validateWeightModel(value.weightModel);
  requireNonNegativeSafeInteger(value.vertexCount, "vertexCount");
  if (value.vertexCount > MAX_NATIVE_VERTICES) failCandy(CANDY_ERROR_CODES.RESOURCE_LIMIT, "Graph exceeds native vertex limit.");
  const ordinary = [GRAPH_TYPES.ORDINARY, GRAPH_TYPES.DYNAMIC_ORDINARY, GRAPH_TYPES.PROJECTED_ORDINARY].includes(value.graphType);
  if (ordinary) {
    if (!Object.hasOwn(value, "edgeCount") || Object.hasOwn(value, "hyperedgeCount")) {
      failCandy(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA, "Ordinary graph metadata requires edgeCount and forbids hyperedgeCount.");
    }
    requireNonNegativeSafeInteger(value.edgeCount, "edgeCount");
    if (value.edgeCount > MAX_NATIVE_EDGES) failCandy(CANDY_ERROR_CODES.RESOURCE_LIMIT, "Graph exceeds native edge limit.");
  } else {
    if (!Object.hasOwn(value, "hyperedgeCount") || Object.hasOwn(value, "edgeCount")) {
      failCandy(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA, "Hypergraph metadata requires hyperedgeCount and forbids edgeCount.");
    }
    requireNonNegativeSafeInteger(value.hyperedgeCount, "hyperedgeCount");
  }
  validateArtifactRef(value.canonicalArtifactRef, "canonicalArtifactRef");
  requirePlainObject(value.provenance, "provenance");
  if (value.graphType === GRAPH_TYPES.PROJECTED_ORDINARY) validateProjectionProvenance(value.provenance);
  return Object.freeze({ ...value, weightModel });
}

export function validateGraphUpdateBatch(value, expectedGraphRef) {
  const code = CANDY_ERROR_CODES.INVALID_UPDATE_BATCH;
  requirePlainObject(value, "GraphUpdateBatch", code);
  requireExactKeys(value, ["schemaVersion", "updateBatchId", "baseGraphRef", "insertionsArtifactRef", "deletionsArtifactRef", "semantics"], [], "GraphUpdateBatch", code);
  requireSchema(value.schemaVersion, CANDY_SCHEMA_VERSIONS.GRAPH_UPDATE_BATCH, "GraphUpdateBatch", code);
  requireNonEmptyString(value.updateBatchId, "updateBatchId", code);
  const baseGraphRef = validateGraphRef(value.baseGraphRef, "baseGraphRef", code);
  validateArtifactRef(value.insertionsArtifactRef, "insertionsArtifactRef", code);
  validateArtifactRef(value.deletionsArtifactRef, "deletionsArtifactRef", code);
  requirePlainObject(value.semantics, "semantics", code);
  requireExactKeys(value.semantics, ["ordering", "duplicatePolicy"], ["conflictPolicy"], "semantics", code);
  if (value.semantics.ordering !== "DELETE_THEN_INSERT") failCandy(code, "Update ordering must be declared as DELETE_THEN_INSERT.");
  if (value.semantics.duplicatePolicy !== "REJECT") failCandy(code, "Scope 1 duplicate policy must be REJECT.");
  if (value.semantics.conflictPolicy && value.semantics.conflictPolicy !== "REJECT") failCandy(code, "Scope 1 conflict policy must be REJECT.");
  if (expectedGraphRef && (baseGraphRef.graphId !== expectedGraphRef.graphId || baseGraphRef.graphVersion !== expectedGraphRef.graphVersion)) {
    failCandy(CANDY_ERROR_CODES.STALE_GRAPH_VERSION, "Update batch does not target the active graph version.", {
      expectedGraphRef,
      actualGraphRef: baseGraphRef,
    });
  }
  return Object.freeze({ ...value, baseGraphRef });
}

function validatePropertyStateRef(value, graphRef) {
  requirePlainObject(value, "propertyStateRef");
  requireExactKeys(value, ["sessionId", "graphId", "graphVersion", "algorithmStateVersion"], [], "propertyStateRef");
  requireNonEmptyString(value.sessionId, "propertyStateRef.sessionId");
  requireNonEmptyString(value.graphId, "propertyStateRef.graphId");
  requireNonNegativeSafeInteger(value.graphVersion, "propertyStateRef.graphVersion");
  requireNonNegativeSafeInteger(value.algorithmStateVersion, "propertyStateRef.algorithmStateVersion");
  if (value.algorithmStateVersion === 0) {
    failCandy(CANDY_ERROR_CODES.STALE_PROPERTY_STATE, "propertyStateRef.algorithmStateVersion must identify an existing positive state version.");
  }
  if (value.graphId !== graphRef.graphId || value.graphVersion !== graphRef.graphVersion) {
    failCandy(CANDY_ERROR_CODES.STALE_PROPERTY_STATE, "Property state does not belong to the requested graph version.", {
      graphRef,
      propertyGraphRef: { graphId: value.graphId, graphVersion: value.graphVersion },
    });
  }
  return Object.freeze({ ...value });
}

function validateUpdateBatchRef(value, graphRef) {
  requirePlainObject(value, "updateBatchRef", CANDY_ERROR_CODES.INVALID_UPDATE_BATCH);
  requireExactKeys(value, ["updateBatchId", "baseGraphId", "baseGraphVersion"], [], "updateBatchRef", CANDY_ERROR_CODES.INVALID_UPDATE_BATCH);
  requireNonEmptyString(value.updateBatchId, "updateBatchRef.updateBatchId", CANDY_ERROR_CODES.INVALID_UPDATE_BATCH);
  requireNonEmptyString(value.baseGraphId, "updateBatchRef.baseGraphId", CANDY_ERROR_CODES.INVALID_UPDATE_BATCH);
  requireNonNegativeSafeInteger(value.baseGraphVersion, "updateBatchRef.baseGraphVersion", CANDY_ERROR_CODES.INVALID_UPDATE_BATCH);
  if (value.baseGraphId !== graphRef.graphId || value.baseGraphVersion !== graphRef.graphVersion) {
    failCandy(CANDY_ERROR_CODES.STALE_GRAPH_VERSION, "Update reference does not target the requested graph version.", {
      graphRef,
      updateBaseGraphRef: { graphId: value.baseGraphId, graphVersion: value.baseGraphVersion },
    });
  }
  return Object.freeze({ ...value });
}

export function validateAlgorithmRequest(value, graphSnapshot) {
  requirePlainObject(value, "AlgorithmRequest");
  requireExactKeys(value, ["schemaVersion", "requestId", "capability", "algorithm", "algorithmVersion", "mode", "backend", "graphRef", "parameters", "resourceHints"], ["propertyStateRef", "updateBatchRef"], "AlgorithmRequest");
  requireSchema(value.schemaVersion, CANDY_SCHEMA_VERSIONS.ALGORITHM_REQUEST, "AlgorithmRequest");
  requireNonEmptyString(value.requestId, "requestId");
  if (value.capability !== "RUN_SSSP") failCandy(CANDY_ERROR_CODES.ALGORITHM_FAILURE, "Unsupported Scope 1 capability.");
  if (value.algorithm !== SSSP_ALGORITHM) failCandy(CANDY_ERROR_CODES.ALGORITHM_FAILURE, "Only SSSP is implemented in Scope 1.");
  requireNonEmptyString(value.algorithmVersion, "algorithmVersion");
  if (!SSSP_MODES.includes(value.mode)) failCandy(CANDY_ERROR_CODES.ALGORITHM_FAILURE, "Unsupported SSSP mode.", { mode: value.mode });
  if (!CANDY_BACKENDS.includes(value.backend)) failCandy(CANDY_ERROR_CODES.BACKEND_UNAVAILABLE, "Unsupported Scope 1 backend.", { backend: value.backend });
  const graphRef = validateGraphRef(value.graphRef);
  requirePlainObject(value.parameters, "parameters");
  requireExactKeys(value.parameters, ["sourceVertexId", "objective"], [], "parameters");
  if (!((typeof value.parameters.sourceVertexId === "string" && value.parameters.sourceVertexId.length > 0) || (typeof value.parameters.sourceVertexId === "number" && Number.isSafeInteger(value.parameters.sourceVertexId)))) {
    failCandy(CANDY_ERROR_CODES.INVALID_VERTEX, "sourceVertexId must be a non-empty string or safe integer.");
  }
  requireNonEmptyString(value.parameters.objective, "parameters.objective", CANDY_ERROR_CODES.UNSUPPORTED_WEIGHT_MODEL);
  requirePlainObject(value.resourceHints, "resourceHints");
  requireExactKeys(value.resourceHints, ["threads", "timeoutMs"], [], "resourceHints");
  if (!Number.isInteger(value.resourceHints.threads) || value.resourceHints.threads < 1 || value.resourceHints.threads > 256) failCandy(CANDY_ERROR_CODES.RESOURCE_LIMIT, "threads must be an integer from 1 to 256.");
  if (!Number.isInteger(value.resourceHints.timeoutMs) || value.resourceHints.timeoutMs < 1 || value.resourceHints.timeoutMs > 86_400_000) failCandy(CANDY_ERROR_CODES.RESOURCE_LIMIT, "timeoutMs is outside the Scope 1 limit.");
  if (graphSnapshot) {
    const snapshot = validateGraphSnapshot(graphSnapshot);
    if (snapshot.graphId !== graphRef.graphId || snapshot.graphVersion !== graphRef.graphVersion) failCandy(CANDY_ERROR_CODES.STALE_GRAPH_VERSION, "AlgorithmRequest graph reference is stale.");
    validateAlgorithmGraphCompatibility(value.algorithm, snapshot.graphType, value.mode);
    if (snapshot.weightModel.objectives[0] !== value.parameters.objective) failCandy(CANDY_ERROR_CODES.UNSUPPORTED_WEIGHT_MODEL, "Requested objective does not match the graph weight model.");
  }
  const needsState = value.mode !== "STATIC";
  if (needsState !== Object.hasOwn(value, "propertyStateRef") || needsState !== Object.hasOwn(value, "updateBatchRef")) {
    failCandy(CANDY_ERROR_CODES.STALE_PROPERTY_STATE, `${value.mode} requires both propertyStateRef and updateBatchRef; STATIC forbids both.`);
  }
  const propertyStateRef = needsState ? validatePropertyStateRef(value.propertyStateRef, graphRef) : undefined;
  const updateBatchRef = needsState ? validateUpdateBatchRef(value.updateBatchRef, graphRef) : undefined;
  return Object.freeze({ ...value, graphRef, ...(needsState ? { propertyStateRef, updateBatchRef } : {}) });
}

export function validateAlgorithmResult(value) {
  requirePlainObject(value, "AlgorithmResult", CANDY_ERROR_CODES.OUTPUT_PARSE_FAILURE);
  requireExactKeys(value, ["schemaVersion", "jobId", "requestId", "algorithm", "mode", "inputGraphRef", "resultType", "execution", "modelSummary", "resultArtifactRef", "mappingArtifactRef", "metrics", "validation", "warnings"], [], "AlgorithmResult", CANDY_ERROR_CODES.OUTPUT_PARSE_FAILURE);
  requireSchema(value.schemaVersion, CANDY_SCHEMA_VERSIONS.ALGORITHM_RESULT, "AlgorithmResult", CANDY_ERROR_CODES.OUTPUT_PARSE_FAILURE);
  requireNonEmptyString(value.jobId, "jobId", CANDY_ERROR_CODES.OUTPUT_PARSE_FAILURE);
  requireNonEmptyString(value.requestId, "requestId", CANDY_ERROR_CODES.OUTPUT_PARSE_FAILURE);
  if (value.algorithm !== SSSP_ALGORITHM || !SSSP_MODES.includes(value.mode)) failCandy(CANDY_ERROR_CODES.OUTPUT_PARSE_FAILURE, "Unexpected algorithm result identity.");
  validateGraphRef(value.inputGraphRef, "inputGraphRef", CANDY_ERROR_CODES.OUTPUT_PARSE_FAILURE);
  if (value.resultType !== "ShortestPathTree") failCandy(CANDY_ERROR_CODES.OUTPUT_PARSE_FAILURE, "Unexpected result type.");
  requirePlainObject(value.execution, "execution", CANDY_ERROR_CODES.OUTPUT_PARSE_FAILURE);
  requireExactKeys(value.execution, ["status", "exitCode"], [], "execution", CANDY_ERROR_CODES.OUTPUT_PARSE_FAILURE);
  if (value.execution.status !== "completed") failCandy(CANDY_ERROR_CODES.ALGORITHM_FAILURE, "Native execution did not complete successfully.");
  if (value.execution.exitCode !== 0) failCandy(CANDY_ERROR_CODES.PROCESS_CRASH, "Native execution reported a non-zero exit code.", { exitCode: value.execution.exitCode });
  requirePlainObject(value.validation, "validation", CANDY_ERROR_CODES.OUTPUT_PARSE_FAILURE);
  requireExactKeys(value.validation, ["status", "method"], ["mismatchCount"], "validation", CANDY_ERROR_CODES.OUTPUT_PARSE_FAILURE);
  if (!['passed', 'not_requested'].includes(value.validation.status)) failCandy(CANDY_ERROR_CODES.RESULT_VALIDATION_FAILURE, "Execution completed but correctness validation did not pass.", { validation: value.validation });
  if (value.mode === "COMPARE" && value.validation.status !== "passed") failCandy(CANDY_ERROR_CODES.RESULT_VALIDATION_FAILURE, "COMPARE mode requires passed reference validation.");
  requirePlainObject(value.modelSummary, "modelSummary", CANDY_ERROR_CODES.OUTPUT_PARSE_FAILURE);
  if (new TextEncoder().encode(JSON.stringify(value.modelSummary)).byteLength > MAX_MODEL_SUMMARY_BYTES) failCandy(CANDY_ERROR_CODES.RESOURCE_LIMIT, "modelSummary exceeds its bounded observation limit.");
  validateArtifactRef(value.resultArtifactRef, "resultArtifactRef", CANDY_ERROR_CODES.OUTPUT_PARSE_FAILURE);
  validateArtifactRef(value.mappingArtifactRef, "mappingArtifactRef", CANDY_ERROR_CODES.OUTPUT_PARSE_FAILURE);
  requirePlainObject(value.metrics, "metrics", CANDY_ERROR_CODES.OUTPUT_PARSE_FAILURE);
  if (!Array.isArray(value.warnings) || value.warnings.length > MAX_WARNINGS || value.warnings.some(item => typeof item !== "string" || item.length > 512)) failCandy(CANDY_ERROR_CODES.OUTPUT_PARSE_FAILURE, "warnings must be a bounded string array.");
  return Object.freeze({ ...value });
}
