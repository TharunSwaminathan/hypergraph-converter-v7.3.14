import { canonicalIdentifierKey } from "./identifierMapping.js";
import { canonicalizeHypergraphIncidence } from "./hypergraphIncidenceAdapter.js";
import { CANDY_SCHEMA_VERSIONS } from "../contracts/schemaVersions.js";
import { CANDY_ERROR_CODES, failCandy } from "../contracts/errorClasses.js";
import {
  HYPERGRAPH_UPDATE_COLLISION_POLICY,
  HYPERGRAPH_UPDATE_ORDERING,
  validateHypergraphMotifUpdate,
} from "../contracts/hypergraphMotifSchemas.js";
import { GRAPH_TYPES } from "../contracts/graphTypes.js";

export const QUALIFIED_INCREMENTAL_UPDATE_LIMITS = Object.freeze({
  maxHyperedges: 256,
  maxIncidences: 100_000,
  maxDeletions: 256,
  maxInsertions: 256,
  maxInsertedIncidences: 100_000,
});

const INPUT_KEYS = new Set(["baseGraphState", "proposedHyperedges", "updateId", "nextGraphVersion"]);

export function deriveHypergraphMotifUpdate(input = {}) {
  rejectCallerSemantics(input);
  const { baseGraphState, proposedHyperedges, updateId, nextGraphVersion } = input;
  if (baseGraphState?.graphType !== GRAPH_TYPES.DYNAMIC_HYPERGRAPH) {
    failCandy(CANDY_ERROR_CODES.INVALID_GRAPH_TYPE, "Pending motif updates require an authoritative DynamicHypergraph.");
  }
  if (!Array.isArray(proposedHyperedges)) {
    failCandy(CANDY_ERROR_CODES.INVALID_UPDATE_BATCH, "A deterministic proposed hypergraph is required.");
  }
  if (nextGraphVersion !== baseGraphState.graphVersion + 1) {
    failCandy(CANDY_ERROR_CODES.INVALID_UPDATE_BATCH, "Pending update must target exactly the next graph version.");
  }

  const base = canonicalizeState(baseGraphState, baseGraphState.hyperedges ?? []);
  const proposed = canonicalizeState({ ...baseGraphState, graphVersion: nextGraphVersion }, proposedHyperedges);
  const before = incidenceByHyperedge(base);
  const after = incidenceByHyperedge(proposed);
  const deletions = [];
  const insertions = [];

  for (const key of sortedKeys(new Set([...before.keys(), ...after.keys()]))) {
    const oldEdge = before.get(key);
    const newEdge = after.get(key);
    if (oldEdge && (!newEdge || oldEdge.membershipKey !== newEdge.membershipKey)) deletions.push(oldEdge.id);
    if (newEdge && (!oldEdge || oldEdge.membershipKey !== newEdge.membershipKey)) {
      insertions.push({ id: newEdge.id, vertices: newEdge.vertices });
    }
  }

  enforceUpdateLimits(deletions, insertions);
  const motifUpdate = validateHypergraphMotifUpdate({
    schemaVersion: CANDY_SCHEMA_VERSIONS.HYPERGRAPH_MOTIF_UPDATE,
    updateId,
    baseGraphRef: {
      graphId: baseGraphState.graphId,
      graphVersion: baseGraphState.graphVersion,
    },
    nextGraphVersion,
    ordering: HYPERGRAPH_UPDATE_ORDERING,
    collisionPolicy: HYPERGRAPH_UPDATE_COLLISION_POLICY,
    deletions,
    insertions,
  }, base);

  return Object.freeze({
    motifUpdate,
    motifImpact: deletions.length || insertions.length ? "CHANGED" : "NONE",
    baseCanonical: base,
    proposedCanonical: proposed,
  });
}

function rejectCallerSemantics(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    failCandy(CANDY_ERROR_CODES.INVALID_UPDATE_BATCH, "Pending update projection input must be an object.");
  }
  const unexpected = Object.keys(input).filter(key => !INPUT_KEYS.has(key));
  if (unexpected.length) {
    failCandy(CANDY_ERROR_CODES.INVALID_UPDATE_BATCH, "Update ordering and collision semantics are fixed and cannot be caller-selected.", { unexpected });
  }
}

function canonicalizeState(state, hyperedges) {
  preflightHyperedges(hyperedges);
  const vertices = new Map();
  for (const vertex of state.explicitVertices ?? []) vertices.set(canonicalIdentifierKey(vertex), vertex);
  for (const hyperedge of hyperedges) {
    for (const vertex of hyperedge.vertices ?? []) vertices.set(canonicalIdentifierKey(vertex), vertex);
  }
  return canonicalizeHypergraphIncidence({
    schemaVersion: CANDY_SCHEMA_VERSIONS.HYPERGRAPH_INCIDENCE,
    graphId: state.graphId,
    graphVersion: state.graphVersion,
    graphType: state.graphType,
    vertices: [...vertices.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([, value]) => value),
    hyperedges: hyperedges.map(hyperedge => ({ id: hyperedge.id, vertices: [...(hyperedge.vertices ?? [])] })),
  }, {
    maxHyperedges: QUALIFIED_INCREMENTAL_UPDATE_LIMITS.maxHyperedges,
    maxTotalIncidences: QUALIFIED_INCREMENTAL_UPDATE_LIMITS.maxIncidences,
  });
}

function preflightHyperedges(hyperedges) {
  if (hyperedges.length > QUALIFIED_INCREMENTAL_UPDATE_LIMITS.maxHyperedges) {
    failCandy(CANDY_ERROR_CODES.RESOURCE_LIMIT, "Incremental graph exceeds the qualified hyperedge limit.");
  }
  let incidences = 0;
  for (const hyperedge of hyperedges) {
    const count = Array.isArray(hyperedge?.vertices) ? hyperedge.vertices.length : 0;
    incidences += count;
    if (!Number.isSafeInteger(incidences) || incidences > QUALIFIED_INCREMENTAL_UPDATE_LIMITS.maxIncidences) {
      failCandy(CANDY_ERROR_CODES.RESOURCE_LIMIT, "Incremental graph exceeds the qualified incidence limit.");
    }
  }
}

function incidenceByHyperedge(canonical) {
  const result = new Map();
  for (const edge of canonical.hyperedges) {
    const vertices = edge.vertexNativeIndices
      .map(canonical.vertexMapping.toCanonical)
      .sort((left, right) => canonicalIdentifierKey(left).localeCompare(canonicalIdentifierKey(right)));
    result.set(canonicalIdentifierKey(edge.canonicalId), {
      id: edge.canonicalId,
      vertices: Object.freeze(vertices),
      membershipKey: vertices.map(vertex => canonicalIdentifierKey(vertex)).join("|"),
    });
  }
  return result;
}

function sortedKeys(keys) {
  return [...keys].sort((left, right) => left.localeCompare(right));
}

function enforceUpdateLimits(deletions, insertions) {
  if (deletions.length > QUALIFIED_INCREMENTAL_UPDATE_LIMITS.maxDeletions
    || insertions.length > QUALIFIED_INCREMENTAL_UPDATE_LIMITS.maxInsertions) {
    failCandy(CANDY_ERROR_CODES.RESOURCE_LIMIT, "Incremental update exceeds the qualified 256 deletion/insertion limit.");
  }
  let insertedIncidences = 0;
  for (const insertion of insertions) {
    insertedIncidences += insertion.vertices.length;
    if (!Number.isSafeInteger(insertedIncidences)
      || insertedIncidences > QUALIFIED_INCREMENTAL_UPDATE_LIMITS.maxInsertedIncidences) {
      failCandy(CANDY_ERROR_CODES.RESOURCE_LIMIT, "Incremental update exceeds the qualified inserted-incidence limit.");
    }
  }
}
