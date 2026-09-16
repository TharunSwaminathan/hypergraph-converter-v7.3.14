import { CANDY_SCHEMA_VERSIONS } from "../contracts/schemaVersions.js";
import { CANDY_ERROR_CODES, failCandy } from "../contracts/errorClasses.js";
import { validateHypergraphMotifCompatibility } from "../contracts/graphTypes.js";
import {
  requireExactKeys,
  requireNonNegativeSafeInteger,
  requirePlainObject,
} from "../contracts/contractValidation.js";
import { canonicalIdentifierKey, createCanonicalIdentifierMapping } from "./identifierMapping.js";
import { resolveHypergraphLimits } from "../contracts/hypergraphMotifLimits.js";
import { requireBoundedMotifString, cloneBoundedMotifProvenance } from "../contracts/hypergraphMotifMetadata.js";

const CANONICAL_GRAPHS = new WeakSet();
export function isCanonicalHypergraphIncidence(value) {
  return value != null && typeof value === "object" && CANONICAL_GRAPHS.has(value);
}

export const HYPERGRAPH_INCIDENCE_LIMITS = Object.freeze({
  maxVertices: 1_000_000,
  maxHyperedges: 1_000_000,
  maxHyperedgeCardinality: 1_000_000,
  maxTotalIncidences: 10_000_000,
});

function requireSchema(value) {
  if (value !== CANDY_SCHEMA_VERSIONS.HYPERGRAPH_INCIDENCE) {
    failCandy(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA, "Hypergraph incidence uses an unknown schema version.", {
      actual: value,
      expected: CANDY_SCHEMA_VERSIONS.HYPERGRAPH_INCIDENCE,
    });
  }
}

export function canonicalizeHypergraphIncidence(value, limitOverrides) {
  const limits = resolveHypergraphLimits(limitOverrides, HYPERGRAPH_INCIDENCE_LIMITS);
  requirePlainObject(value, "HypergraphIncidence");
  requireExactKeys(
    value,
    ["schemaVersion", "graphId", "graphVersion", "graphType", "vertices", "hyperedges"],
    ["provenance"],
    "HypergraphIncidence",
  );
  requireSchema(value.schemaVersion);
  requireBoundedMotifString(value.graphId, "graphId");
  requireNonNegativeSafeInteger(value.graphVersion, "graphVersion");
  validateHypergraphMotifCompatibility(value.graphType);
  if (Object.hasOwn(value, "provenance")) requirePlainObject(value.provenance, "provenance");
  const provenance = cloneBoundedMotifProvenance(value.provenance ?? {});
  if (!Array.isArray(value.vertices)) failCandy(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA, "vertices must be an array.");
  if (!Array.isArray(value.hyperedges)) failCandy(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA, "hyperedges must be an array.");
  if (value.vertices.length > limits.maxVertices || value.hyperedges.length > limits.maxHyperedges) {
    failCandy(CANDY_ERROR_CODES.RESOURCE_LIMIT, "Hypergraph exceeds canonical incidence limits.", {
      vertexCount: value.vertices.length,
      hyperedgeCount: value.hyperedges.length,
    });
  }

  // Preflight cardinality/total arithmetic before copying memberships or maps.
  let preflightIncidences = 0;
  for (const hyperedge of value.hyperedges) {
    requirePlainObject(hyperedge, "hyperedge");
    if (!Array.isArray(hyperedge.vertices)) failCandy(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA, "Memberships must be arrays.");
    preflightIncidences += hyperedge.vertices.length;
    if (hyperedge.vertices.length > limits.maxHyperedgeCardinality
      || !Number.isSafeInteger(preflightIncidences) || preflightIncidences > limits.maxTotalIncidences) {
      failCandy(CANDY_ERROR_CODES.RESOURCE_LIMIT, "Incidence cardinality/total exceeds hard limits.");
    }
  }

  const vertexMapping = createCanonicalIdentifierMapping(value.vertices, {
    schemaVersion: CANDY_SCHEMA_VERSIONS.VERTEX_MAPPING,
    label: "vertex",
  });
  const vertexKeys = new Set(vertexMapping.entries.map(entry => entry.key));
  const rawHyperedges = value.hyperedges.map((hyperedge, index) => {
    requirePlainObject(hyperedge, `hyperedges[${index}]`);
    requireExactKeys(hyperedge, ["id", "vertices"], [], `hyperedges[${index}]`);
    canonicalIdentifierKey(hyperedge.id, `hyperedges[${index}].id`);
    if (!Array.isArray(hyperedge.vertices)) {
      failCandy(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA, `hyperedges[${index}].vertices must be an array.`);
    }
    if (hyperedge.vertices.length === 0) {
      failCandy(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA, "Empty hyperedges are not permitted by the v1 incidence contract.", {
        hyperedgeId: hyperedge.id,
      });
    }
    if (hyperedge.vertices.length > limits.maxHyperedgeCardinality) {
      failCandy(CANDY_ERROR_CODES.RESOURCE_LIMIT, "Hyperedge cardinality exceeds the canonical incidence limit.", {
        hyperedgeId: hyperedge.id,
        cardinality: hyperedge.vertices.length,
      });
    }
    const membershipKeys = new Set();
    for (const vertexId of hyperedge.vertices) {
      const key = canonicalIdentifierKey(vertexId, `membership in hyperedge ${String(hyperedge.id)}`);
      if (!vertexKeys.has(key)) {
        failCandy(CANDY_ERROR_CODES.INVALID_VERTEX, "Hyperedge membership references an undeclared vertex.", {
          hyperedgeId: hyperedge.id,
          vertexId,
        });
      }
      if (membershipKeys.has(key)) {
        failCandy(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA, "Duplicate vertex membership is not permitted.", {
          hyperedgeId: hyperedge.id,
          vertexId,
        });
      }
      membershipKeys.add(key);
    }
    return Object.freeze({ id: hyperedge.id, vertices: Object.freeze([...hyperedge.vertices]) });
  });

  const incidenceCount = rawHyperedges.reduce((total, hyperedge) => {
    const next = total + hyperedge.vertices.length;
    if (!Number.isSafeInteger(next) || next > limits.maxTotalIncidences) {
      failCandy(CANDY_ERROR_CODES.RESOURCE_LIMIT, "Total incidence count exceeds the canonical incidence limit.");
    }
    return next;
  }, 0);
  const hyperedgeMapping = createCanonicalIdentifierMapping(rawHyperedges.map(hyperedge => hyperedge.id), {
    schemaVersion: CANDY_SCHEMA_VERSIONS.HYPEREDGE_MAPPING,
    label: "hyperedge",
  });
  const rawByKey = new Map(rawHyperedges.map(hyperedge => [canonicalIdentifierKey(hyperedge.id), hyperedge]));
  const hyperedges = hyperedgeMapping.entries.map(mappingEntry => {
    const raw = rawByKey.get(mappingEntry.key);
    const vertexNativeIndices = raw.vertices.map(vertexMapping.toNative).sort((left, right) => left - right);
    return Object.freeze({
      canonicalId: raw.id,
      nativeIndex: mappingEntry.nativeIndex,
      vertexNativeIndices: Object.freeze(vertexNativeIndices),
    });
  });

  const usedVertices = new Set();
  for (const hyperedge of hyperedges) {
    for (const nativeIndex of hyperedge.vertexNativeIndices) usedVertices.add(nativeIndex);
  }
  const canonical = Object.freeze({
    schemaVersion: CANDY_SCHEMA_VERSIONS.HYPERGRAPH_INCIDENCE,
    graphId: value.graphId,
    graphVersion: value.graphVersion,
    graphType: value.graphType,
    vertexCount: value.vertices.length,
    hyperedgeCount: hyperedges.length,
    incidenceCount,
    vertexMapping,
    hyperedgeMapping,
    hyperedges: Object.freeze(hyperedges),
    isolatedVertexNativeIndices: Object.freeze(vertexMapping.entries
      .map(entry => entry.nativeIndex)
      .filter(nativeIndex => !usedVertices.has(nativeIndex))),
    provenance,
  });
  CANONICAL_GRAPHS.add(canonical);
  return canonical;
}
