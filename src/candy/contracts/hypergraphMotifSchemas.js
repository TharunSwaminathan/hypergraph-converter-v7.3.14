import { CANDY_SCHEMA_VERSIONS } from "./schemaVersions.js";
import { CANDY_ERROR_CODES, failCandy } from "./errorClasses.js";
import { GRAPH_TYPES, validateHypergraphMotifCompatibility } from "./graphTypes.js";
import {
  requireExactKeys,
  requireNonNegativeSafeInteger,
  requirePlainObject,
  validateGraphRef as validateSharedGraphRef,
} from "./contractValidation.js";
import { requireBoundedMotifString as requireNonEmptyString } from "./hypergraphMotifMetadata.js";
import { canonicalIdentifierKey } from "../adapters/identifierMapping.js";
import { HYPERGRAPH_INCIDENCE_LIMITS } from "../adapters/hypergraphIncidenceAdapter.js";
import {
  HYPERGRAPH_3EDGE_MOTIF_TAXONOMY,
  HYPERGRAPH_3EDGE_MOTIF_TAXONOMY_V1,
} from "../hypergraphMotifs/taxonomy.js";

export const HYPERGRAPH_3EDGE_MOTIF_ALGORITHM = "HYPERGRAPH_3EDGE_MOTIF_COUNT";
export const HYPERGRAPH_3EDGE_MOTIF_MODES = Object.freeze(["STATIC", "INCREMENTAL"]);
export const HYPERGRAPH_3EDGE_MOTIF_BACKEND = "CPU_REFERENCE_ORACLE";
export const HYPERGRAPH_UPDATE_ORDERING = "DELETE_THEN_INSERT";
export const HYPERGRAPH_UPDATE_COLLISION_POLICY = "REJECT_EXCEPT_EXACT_DELETE_REINSERT";
const MAX_WARNINGS = 20;

function validateGraphRef(value, label = "graphRef", code) {
  const ref = validateSharedGraphRef(value, label, code);
  requireNonEmptyString(ref.graphId, `${label}.graphId`, code);
  return ref;
}

function requireSchema(actual, expected, label, code = CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA) {
  if (actual !== expected) failCandy(code, `${label} uses an unknown schema version.`, { actual, expected });
}

function validateMotifStateRef(value, graphRef) {
  requirePlainObject(value, "motifStateRef", CANDY_ERROR_CODES.STALE_PROPERTY_STATE);
  requireExactKeys(
    value,
    ["schemaVersion", "stateId", "graphId", "graphVersion", "stateVersion", "taxonomyVersion"],
    [],
    "motifStateRef",
    CANDY_ERROR_CODES.STALE_PROPERTY_STATE,
  );
  requireSchema(value.schemaVersion, CANDY_SCHEMA_VERSIONS.HYPERGRAPH_MOTIF_STATE, "motifStateRef", CANDY_ERROR_CODES.STALE_PROPERTY_STATE);
  requireNonEmptyString(value.stateId, "motifStateRef.stateId", CANDY_ERROR_CODES.STALE_PROPERTY_STATE);
  requireNonEmptyString(value.graphId, "motifStateRef.graphId", CANDY_ERROR_CODES.STALE_PROPERTY_STATE);
  requireNonNegativeSafeInteger(value.graphVersion, "motifStateRef.graphVersion", CANDY_ERROR_CODES.STALE_PROPERTY_STATE);
  requireNonNegativeSafeInteger(value.stateVersion, "motifStateRef.stateVersion", CANDY_ERROR_CODES.STALE_PROPERTY_STATE);
  if (value.stateVersion === 0 || value.taxonomyVersion !== HYPERGRAPH_3EDGE_MOTIF_TAXONOMY_V1) {
    failCandy(CANDY_ERROR_CODES.STALE_PROPERTY_STATE, "Motif state is missing or uses a stale taxonomy.");
  }
  if (value.graphId !== graphRef.graphId || value.graphVersion !== graphRef.graphVersion) {
    failCandy(CANDY_ERROR_CODES.STALE_PROPERTY_STATE, "Motif state does not belong to the requested graph version.", {
      graphRef,
      stateGraphRef: { graphId: value.graphId, graphVersion: value.graphVersion },
    });
  }
  return Object.freeze({ ...value });
}

function validateUpdateRef(value, graphRef) {
  requirePlainObject(value, "updateRef", CANDY_ERROR_CODES.INVALID_UPDATE_BATCH);
  requireExactKeys(value, ["updateId", "baseGraphId", "baseGraphVersion", "nextGraphVersion"], [], "updateRef", CANDY_ERROR_CODES.INVALID_UPDATE_BATCH);
  requireNonEmptyString(value.updateId, "updateRef.updateId", CANDY_ERROR_CODES.INVALID_UPDATE_BATCH);
  requireNonEmptyString(value.baseGraphId, "updateRef.baseGraphId", CANDY_ERROR_CODES.INVALID_UPDATE_BATCH);
  requireNonNegativeSafeInteger(value.baseGraphVersion, "updateRef.baseGraphVersion", CANDY_ERROR_CODES.INVALID_UPDATE_BATCH);
  requireNonNegativeSafeInteger(value.nextGraphVersion, "updateRef.nextGraphVersion", CANDY_ERROR_CODES.INVALID_UPDATE_BATCH);
  if (value.baseGraphId !== graphRef.graphId || value.baseGraphVersion !== graphRef.graphVersion) {
    failCandy(CANDY_ERROR_CODES.STALE_GRAPH_VERSION, "Motif update reference does not target the requested graph version.");
  }
  if (value.nextGraphVersion !== value.baseGraphVersion + 1) {
    failCandy(CANDY_ERROR_CODES.INVALID_UPDATE_BATCH, "Motif update must advance the graph version by exactly one.");
  }
  return Object.freeze({ ...value });
}

export function validateHypergraphMotifRequest(value, graph, expectedMotifStateRef) {
  requirePlainObject(value, "HypergraphMotifRequest");
  requireExactKeys(
    value,
    ["schemaVersion", "requestId", "algorithm", "taxonomyVersion", "mode", "graphRef"],
    ["motifStateRef", "updateRef"],
    "HypergraphMotifRequest",
  );
  requireSchema(value.schemaVersion, CANDY_SCHEMA_VERSIONS.HYPERGRAPH_MOTIF_REQUEST, "HypergraphMotifRequest");
  requireNonEmptyString(value.requestId, "requestId");
  if (value.algorithm !== HYPERGRAPH_3EDGE_MOTIF_ALGORITHM) {
    failCandy(CANDY_ERROR_CODES.ALGORITHM_FAILURE, "Unsupported Hypergraph motif algorithm.");
  }
  if (value.taxonomyVersion !== HYPERGRAPH_3EDGE_MOTIF_TAXONOMY_V1) {
    failCandy(CANDY_ERROR_CODES.ALGORITHM_FAILURE, "Unsupported Hypergraph motif taxonomy.");
  }
  if (!HYPERGRAPH_3EDGE_MOTIF_MODES.includes(value.mode)) {
    failCandy(CANDY_ERROR_CODES.ALGORITHM_FAILURE, "Unsupported Hypergraph motif mode.", { mode: value.mode });
  }
  const graphRef = validateGraphRef(value.graphRef);
  if (graph) {
    if (graph.graphId !== graphRef.graphId || graph.graphVersion !== graphRef.graphVersion) {
      failCandy(CANDY_ERROR_CODES.STALE_GRAPH_VERSION, "Hypergraph motif request targets a stale graph version.");
    }
    validateHypergraphMotifCompatibility(graph.graphType, value.mode);
    if (value.mode === "INCREMENTAL" && graph.graphType !== GRAPH_TYPES.DYNAMIC_HYPERGRAPH) {
      failCandy(CANDY_ERROR_CODES.INVALID_GRAPH_TYPE, "INCREMENTAL motif mode requires DynamicHypergraph.", {
        actualGraphType: graph.graphType,
      });
    }
  }
  const incremental = value.mode === "INCREMENTAL";
  if (incremental !== Object.hasOwn(value, "motifStateRef") || incremental !== Object.hasOwn(value, "updateRef")) {
    failCandy(CANDY_ERROR_CODES.STALE_PROPERTY_STATE, "INCREMENTAL requires motifStateRef and updateRef; STATIC forbids both.");
  }
  if (incremental && expectedMotifStateRef) {
    const expected = validateMotifStateRef(expectedMotifStateRef, graphRef);
    const actual = validateMotifStateRef(value.motifStateRef, graphRef);
    if (actual.stateId !== expected.stateId || actual.stateVersion !== expected.stateVersion) {
      failCandy(CANDY_ERROR_CODES.STALE_PROPERTY_STATE, "Motif state identity/version does not match the supplied current state.");
    }
  }
  return Object.freeze({
    ...value,
    graphRef,
    ...(incremental ? {
      motifStateRef: validateMotifStateRef(value.motifStateRef, graphRef),
      updateRef: validateUpdateRef(value.updateRef, graphRef),
    } : {}),
  });
}

function requireUniqueIdentifiers(values, label, code) {
  const keys = new Set();
  for (const value of values) {
    const key = canonicalIdentifierKey(value, label);
    if (keys.has(key)) failCandy(code, `${label} contains a duplicate ID.`, { id: value });
    keys.add(key);
  }
  return keys;
}

export function validateHypergraphMotifUpdate(value, baseGraph) {
  const code = CANDY_ERROR_CODES.INVALID_UPDATE_BATCH;
  requirePlainObject(value, "HypergraphMotifUpdate", code);
  requireExactKeys(
    value,
    ["schemaVersion", "updateId", "baseGraphRef", "nextGraphVersion", "ordering", "collisionPolicy", "deletions", "insertions"],
    [],
    "HypergraphMotifUpdate",
    code,
  );
  requireSchema(value.schemaVersion, CANDY_SCHEMA_VERSIONS.HYPERGRAPH_MOTIF_UPDATE, "HypergraphMotifUpdate", code);
  requireNonEmptyString(value.updateId, "updateId", code);
  const baseGraphRef = validateGraphRef(value.baseGraphRef, "baseGraphRef", code);
  requireNonNegativeSafeInteger(value.nextGraphVersion, "nextGraphVersion", code);
  if (value.nextGraphVersion !== baseGraphRef.graphVersion + 1) failCandy(code, "Update must advance graphVersion by exactly one.");
  if (value.ordering !== HYPERGRAPH_UPDATE_ORDERING || value.collisionPolicy !== HYPERGRAPH_UPDATE_COLLISION_POLICY) {
    failCandy(code, "Unsupported Hypergraph update semantics.");
  }
  if (!Array.isArray(value.deletions) || !Array.isArray(value.insertions)) failCandy(code, "deletions and insertions must be arrays.");
  if (value.deletions.length > HYPERGRAPH_INCIDENCE_LIMITS.maxHyperedges
    || value.insertions.length > HYPERGRAPH_INCIDENCE_LIMITS.maxHyperedges) {
    failCandy(CANDY_ERROR_CODES.RESOURCE_LIMIT, "Hypergraph update exceeds operation limits.");
  }
  let insertedIncidences = 0;
  for (const insertion of value.insertions) {
    requirePlainObject(insertion, "insertion", code);
    if (!Array.isArray(insertion.vertices)) failCandy(code, "Inserted memberships must be arrays.");
    insertedIncidences += insertion.vertices.length;
    if (insertion.vertices.length > HYPERGRAPH_INCIDENCE_LIMITS.maxHyperedgeCardinality
      || !Number.isSafeInteger(insertedIncidences)
      || insertedIncidences > HYPERGRAPH_INCIDENCE_LIMITS.maxTotalIncidences) {
      failCandy(CANDY_ERROR_CODES.RESOURCE_LIMIT, "Inserted incidence exceeds hard limits.");
    }
  }
  const deletionKeys = requireUniqueIdentifiers(value.deletions, "deletions", code);
  const insertionIds = [];
  for (let index = 0; index < value.insertions.length; index += 1) {
    const insertion = value.insertions[index];
    requirePlainObject(insertion, `insertions[${index}]`, code);
    requireExactKeys(insertion, ["id", "vertices"], [], `insertions[${index}]`, code);
    canonicalIdentifierKey(insertion.id, `insertions[${index}].id`);
    if (!Array.isArray(insertion.vertices) || insertion.vertices.length === 0) failCandy(code, "Inserted hyperedges must contain at least one vertex.");
    requireUniqueIdentifiers(insertion.vertices, `insertions[${index}].vertices`, code);
    insertionIds.push(insertion.id);
  }
  const insertionKeys = requireUniqueIdentifiers(insertionIds, "insertions", code);
  if (baseGraph) {
    if (baseGraph.graphId !== baseGraphRef.graphId || baseGraph.graphVersion !== baseGraphRef.graphVersion) {
      failCandy(CANDY_ERROR_CODES.STALE_GRAPH_VERSION, "Hypergraph update targets a stale graph version.", {
        expected: { graphId: baseGraph.graphId, graphVersion: baseGraph.graphVersion },
        actual: baseGraphRef,
      });
    }
    if (baseGraph.graphType !== GRAPH_TYPES.DYNAMIC_HYPERGRAPH) {
      failCandy(CANDY_ERROR_CODES.INVALID_GRAPH_TYPE, "Hypergraph motif updates require DynamicHypergraph.");
    }
    const existingKeys = new Set(baseGraph.hyperedgeMapping.entries.map(entry => entry.key));
    for (const key of deletionKeys) if (!existingKeys.has(key)) failCandy(code, "Cannot delete a missing hyperedge.");
    for (const key of insertionKeys) {
      if (existingKeys.has(key) && !deletionKeys.has(key)) {
        failCandy(code, "Cannot insert an existing hyperedge ID unless the same update deletes it first.");
      }
    }
  }
  return Object.freeze({
    ...value,
    baseGraphRef,
    deletions: Object.freeze([...value.deletions]),
    insertions: Object.freeze(value.insertions.map(insertion => Object.freeze({
      id: insertion.id,
      vertices: Object.freeze([...insertion.vertices]),
    }))),
  });
}

function validateCountArray(value, label, { signed = false } = {}) {
  if (!Array.isArray(value) || value.length !== HYPERGRAPH_3EDGE_MOTIF_TAXONOMY.orbitCount) {
    failCandy(CANDY_ERROR_CODES.OUTPUT_PARSE_FAILURE, `${label} must contain exactly 30 integer counts.`);
  }
  for (const count of value) {
    if (!Number.isSafeInteger(count) || (!signed && count < 0)) {
      failCandy(CANDY_ERROR_CODES.OUTPUT_PARSE_FAILURE, `${label} contains an invalid integer count.`);
    }
  }
  return Object.freeze([...value]);
}

export function validateHypergraphMotifResult(value) {
  const code = CANDY_ERROR_CODES.OUTPUT_PARSE_FAILURE;
  requirePlainObject(value, "HypergraphMotifResult", code);
  requireExactKeys(
    value,
    ["schemaVersion", "requestId", "algorithm", "taxonomyVersion", "backend", "mode", "inputGraphRef", "counts", "totalConnectedTriples", "validation", "warnings"],
    ["outputGraphRef", "deltaCounts"],
    "HypergraphMotifResult",
    code,
  );
  requireSchema(value.schemaVersion, CANDY_SCHEMA_VERSIONS.HYPERGRAPH_MOTIF_RESULT, "HypergraphMotifResult", code);
  requireNonEmptyString(value.requestId, "requestId", code);
  if (value.algorithm !== HYPERGRAPH_3EDGE_MOTIF_ALGORITHM
    || value.taxonomyVersion !== HYPERGRAPH_3EDGE_MOTIF_TAXONOMY_V1
    || value.backend !== HYPERGRAPH_3EDGE_MOTIF_BACKEND
    || !HYPERGRAPH_3EDGE_MOTIF_MODES.includes(value.mode)) {
    failCandy(code, "Unexpected Hypergraph motif result identity.");
  }
  const inputGraphRef = validateGraphRef(value.inputGraphRef, "inputGraphRef", code);
  const counts = validateCountArray(value.counts, "counts");
  requireNonNegativeSafeInteger(value.totalConnectedTriples, "totalConnectedTriples", code);
  let totalFromCounts = 0;
  for (const count of counts) {
    totalFromCounts += count;
    if (!Number.isSafeInteger(totalFromCounts)) {
      failCandy(CANDY_ERROR_CODES.RESULT_VALIDATION_FAILURE, "Motif count total exceeds safe-integer precision.");
    }
  }
  if (totalFromCounts !== value.totalConnectedTriples) {
    failCandy(CANDY_ERROR_CODES.RESULT_VALIDATION_FAILURE, "Motif counts do not sum to totalConnectedTriples.");
  }
  requirePlainObject(value.validation, "validation", code);
  requireExactKeys(value.validation, ["status", "method"], ["deltaInvariant"], "validation", code);
  if (value.validation.status !== "passed" || value.validation.method !== "EXACT_SET_ENUMERATION") {
    failCandy(CANDY_ERROR_CODES.RESULT_VALIDATION_FAILURE, "Hypergraph motif result did not pass exact validation.");
  }
  const incremental = value.mode === "INCREMENTAL";
  if (incremental !== Object.hasOwn(value, "outputGraphRef") || incremental !== Object.hasOwn(value, "deltaCounts")) {
    failCandy(code, "INCREMENTAL results require outputGraphRef and deltaCounts; STATIC results forbid both.");
  }
  const outputGraphRef = incremental ? validateGraphRef(value.outputGraphRef, "outputGraphRef", code) : undefined;
  const deltaCounts = incremental ? validateCountArray(value.deltaCounts, "deltaCounts", { signed: true }) : undefined;
  if (incremental && (outputGraphRef.graphId !== inputGraphRef.graphId
    || outputGraphRef.graphVersion !== inputGraphRef.graphVersion + 1)) {
    failCandy(CANDY_ERROR_CODES.RESULT_VALIDATION_FAILURE, "Incremental output must identify the exact next graph version.");
  }
  if (incremental && deltaCounts.some((delta, index) => {
    const previous = counts[index] - delta;
    return !Number.isSafeInteger(previous) || previous < 0;
  })) {
    failCandy(CANDY_ERROR_CODES.RESULT_VALIDATION_FAILURE, "Delta implies invalid previous counts.");
  }
  if (!incremental && Object.hasOwn(value.validation, "deltaInvariant")) {
    failCandy(code, "STATIC validation forbids deltaInvariant.");
  }
  if (incremental && value.validation.deltaInvariant !== "passed") {
    failCandy(CANDY_ERROR_CODES.RESULT_VALIDATION_FAILURE, "Incremental result did not satisfy the exact delta invariant.");
  }
  if (!Array.isArray(value.warnings) || value.warnings.length > MAX_WARNINGS
    || value.warnings.some(warning => typeof warning !== "string" || warning.length > 512)) {
    failCandy(code, "warnings must be a bounded string array.");
  }
  return Object.freeze({
    ...value,
    inputGraphRef,
    counts,
    validation: Object.freeze({ ...value.validation }),
    ...(incremental ? { outputGraphRef, deltaCounts } : {}),
    warnings: Object.freeze([...value.warnings]),
  });
}
