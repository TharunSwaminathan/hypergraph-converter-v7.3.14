import { normalizeGraphIdentifier } from "../utils/graphIdentifiers.js";

const EMPTY_IDENTIFIERS = Object.freeze([]);
const COLLECTION_MUTATORS = new Set(["add", "set", "delete", "clear"]);

/**
 * Build a derived incidence index from an already-canonical hyperedge array.
 *
 * Ordering is deterministic and intentionally unsorted: hyperedges follow
 * canonical array order, vertices follow first-seen membership order,
 * hyperedge memberships follow canonical membership order, and incident
 * hyperedges follow canonical hyperedge order. Duplicate membership is
 * ignored in the derived relations without mutating the source graph.
 *
 * The builder is pure and deliberately uncached. Canonical graph mutations
 * remain owned by the existing commit path; callers rebuild this index from
 * the new canonical array after a graph/version change.
 */
export function buildIncidenceIndex(canonicalHyperedges) {
  if (!Array.isArray(canonicalHyperedges)) {
    throw new TypeError("buildIncidenceIndex requires a canonical hyperedge array.");
  }

  const vertices = [];
  const hyperedges = [];
  const hyperedgesById = new Map();
  const vertexToHyperedges = new Map();
  const hyperedgeToVertices = new Map();
  let incidenceCount = 0;

  for (const [hyperedgeIndex, hyperedge] of canonicalHyperedges.entries()) {
    const path = `hyperedges[${hyperedgeIndex}]`;
    if (!hyperedge || typeof hyperedge !== "object" || Array.isArray(hyperedge)) {
      throw new TypeError(`${path} must be a canonical hyperedge record.`);
    }
    if (!Object.hasOwn(hyperedge, "id")) {
      throw new TypeError(`${path}.id is required for a canonical hyperedge record.`);
    }
    const hyperedgeId = requireCanonicalIdentifier(hyperedge.id, `${path}.id`);
    if (hyperedgesById.has(hyperedgeId)) {
      throw new Error(`${path}.id duplicates an earlier canonical hyperedge ID: ${JSON.stringify(hyperedgeId)}.`);
    }
    if (!Array.isArray(hyperedge.vertices)) {
      throw new TypeError(`${path}.vertices must be an array of canonical identifiers.`);
    }

    hyperedges.push(hyperedgeId);
    hyperedgesById.set(hyperedgeId, hyperedge);
    const memberIds = new Set();

    for (const [vertexIndex, value] of hyperedge.vertices.entries()) {
      const vertexId = requireCanonicalIdentifier(value, `${path}.vertices[${vertexIndex}]`);
      if (memberIds.has(vertexId)) continue;
      memberIds.add(vertexId);
      incidenceCount += 1;
      if (!vertexToHyperedges.has(vertexId)) {
        vertices.push(vertexId);
        vertexToHyperedges.set(vertexId, new Set());
      }
      vertexToHyperedges.get(vertexId).add(hyperedgeId);
    }
    hyperedgeToVertices.set(hyperedgeId, memberIds);
  }

  const readonlyVertexToHyperedges = new Map();
  for (const [vertexId, hyperedgeIds] of vertexToHyperedges) {
    readonlyVertexToHyperedges.set(vertexId, readonlyCollection(hyperedgeIds, "incident hyperedge set"));
  }
  const readonlyHyperedgeToVertices = new Map();
  for (const [hyperedgeId, vertexIds] of hyperedgeToVertices) {
    readonlyHyperedgeToVertices.set(hyperedgeId, readonlyCollection(vertexIds, "hyperedge vertex set"));
  }

  return Object.freeze({
    vertices: Object.freeze(vertices),
    hyperedges: Object.freeze(hyperedges),
    hyperedgesById: readonlyCollection(hyperedgesById, "hyperedgesById map"),
    vertexToHyperedges: readonlyCollection(readonlyVertexToHyperedges, "vertexToHyperedges map"),
    hyperedgeToVertices: readonlyCollection(readonlyHyperedgeToVertices, "hyperedgeToVertices map"),
    counts: Object.freeze({
      hyperedges: hyperedges.length,
      vertices: vertices.length,
      incidences: incidenceCount,
    }),
  });
}

export function getIncidentHyperedgeIds(index, vertexId) {
  assertIncidenceIndex(index);
  const canonicalId = requireCanonicalIdentifier(vertexId, "vertexId");
  const ids = index.vertexToHyperedges.get(canonicalId);
  return ids ? Object.freeze([...ids]) : EMPTY_IDENTIFIERS;
}

export function getHyperedgeVertexIds(index, hyperedgeId) {
  assertIncidenceIndex(index);
  const canonicalId = requireCanonicalIdentifier(hyperedgeId, "hyperedgeId");
  const ids = index.hyperedgeToVertices.get(canonicalId);
  return ids ? Object.freeze([...ids]) : EMPTY_IDENTIFIERS;
}

export function hasVertex(index, vertexId) {
  assertIncidenceIndex(index);
  return index.vertexToHyperedges.has(requireCanonicalIdentifier(vertexId, "vertexId"));
}

export function hasHyperedge(index, hyperedgeId) {
  assertIncidenceIndex(index);
  return index.hyperedgesById.has(requireCanonicalIdentifier(hyperedgeId, "hyperedgeId"));
}

function requireCanonicalIdentifier(value, path) {
  const normalized = normalizeGraphIdentifier(value, { path });
  if (normalized !== value) {
    throw new TypeError(`${path} must already be canonical; received ${JSON.stringify(value)}, expected ${JSON.stringify(normalized)}.`);
  }
  return value;
}

function assertIncidenceIndex(index) {
  if (!index || !(index.hyperedgesById instanceof Map)
    || !(index.vertexToHyperedges instanceof Map)
    || !(index.hyperedgeToVertices instanceof Map)) {
    throw new TypeError("A valid incidence index is required.");
  }
}

function readonlyCollection(collection, label) {
  let proxy;
  proxy = new Proxy(collection, {
    get(target, property) {
      if (COLLECTION_MUTATORS.has(property)) {
        return () => { throw new TypeError(`${label} is read-only.`); };
      }
      if (property === "forEach") {
        return (callback, thisArgument) => target.forEach((value, key) => callback.call(thisArgument, value, key, proxy));
      }
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
    set() {
      throw new TypeError(`${label} is read-only.`);
    },
    defineProperty() {
      throw new TypeError(`${label} is read-only.`);
    },
    deleteProperty() {
      throw new TypeError(`${label} is read-only.`);
    },
  });
  return proxy;
}
