import { GRAPH_TYPES } from "../candy/contracts/graphTypes.js";
import { isOwnedGraph } from "./immutableGraph.js";
const serializedGraphs = new WeakMap();
const fingerprints = new WeakMap();
const metrics = { canonicalizations: 0, hits: 0 };
// Reuse the same default-locale collation rules for every canonical comparison.
// Passing options to localeCompare for every pair repeatedly constructs collation
// machinery on the cold path; the resulting order and stable tie handling agree.
const compareAuthorityIds = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" }).compare;
export function graphDerivationMetrics() { return { ...metrics }; }
export function graphAuthoritySerialization(hyperedges, options = {}) {
  const type = options.graphType ?? GRAPH_TYPES.HYPERGRAPH;
  const cacheable = isOwnedGraph(hyperedges) && options.explicitVertices == null
    && (type === GRAPH_TYPES.HYPERGRAPH || type === GRAPH_TYPES.DYNAMIC_HYPERGRAPH);
  const cached = cacheable ? serializedGraphs.get(hyperedges)?.get(type) : undefined;
  if (cached !== undefined) { metrics.hits += 1; return cached; }
  const value = stableStringify(canonicalizeGraphAuthority(hyperedges, options));
  if (cacheable) {
    let entries = serializedGraphs.get(hyperedges);
    if (!entries) { entries = new Map(); serializedGraphs.set(hyperedges, entries); }
    entries.set(type, value);
  }
  return value;
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value).sort().reduce((out, key) => {
    out[key] = sortKeys(value[key]);
    return out;
  }, {});
}

export function stableStringify(value) {
  return JSON.stringify(sortKeys(value));
}

export function canonicalizeHyperedge(hyperedge) {
  return {
    id: String(hyperedge?.id ?? ""),
    vertices: [...(hyperedge?.vertices ?? [])].map(vertex => String(vertex)),
    time: hyperedge?.time ?? null,
    weight: Number.isFinite(Number(hyperedge?.weight)) ? Number(hyperedge.weight) : 1,
    attributes: sortKeys(hyperedge?.attributes && typeof hyperedge.attributes === "object" && !Array.isArray(hyperedge.attributes)
      ? hyperedge.attributes
      : {}),
  };
}

export function canonicalizeGraph(hyperedges = []) {
  metrics.canonicalizations += 1;
  return [...(hyperedges ?? [])]
    .map(canonicalizeHyperedge)
    .sort((a, b) => compareAuthorityIds(a.id, b.id));
}

export function canonicalizeGraphAuthority(hyperedges = [], {
  graphType = GRAPH_TYPES.HYPERGRAPH,
  explicitVertices = null,
} = {}) {
  return {
    graphType,
    explicitVertices: Array.isArray(explicitVertices)
      ? [...explicitVertices].map(vertex => String(vertex)).sort(compareAuthorityIds)
      : null,
    hyperedges: canonicalizeGraph(hyperedges),
  };
}

export function graphFingerprint(hyperedges = [], options = {}) {
  const type = options.graphType ?? GRAPH_TYPES.HYPERGRAPH;
  const cacheable = isOwnedGraph(hyperedges) && options.explicitVertices == null
    && (type === GRAPH_TYPES.HYPERGRAPH || type === GRAPH_TYPES.DYNAMIC_HYPERGRAPH);
  const cached = cacheable ? fingerprints.get(hyperedges)?.get(type) : undefined;
  if (cached !== undefined) { metrics.hits += 1; return cached; }
  const serialized = graphAuthoritySerialization(hyperedges, options);
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const fingerprint = `gfp-${(hash >>> 0).toString(16).padStart(8, "0")}-${serialized.length}`;
  if (cacheable) {
    let entries = fingerprints.get(hyperedges);
    if (!entries) { entries = new Map(); fingerprints.set(hyperedges, entries); }
    entries.set(type, fingerprint);
  }
  return fingerprint;
}

