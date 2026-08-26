import { buildTwoSectionProjectionSafely, PROJECTION_WEIGHT_POLICIES } from "./projection.js";

// Converts a hypergraph (list of hyperedges) into a plain vertex-adjacency
// map so that ordinary vertex-level graph algorithms (BFS, DFS, connected
// components, and anything added later) can run on it without knowing
// anything about hyperedges.
//
// The technique used is the "2-section" (a.k.a. clique expansion): every
// pair of vertices that co-occurs in the same hyperedge becomes an edge.
// This is the standard way to run graph algorithms on a hypergraph.

/**
 * @param {Array<{id: string, vertices: Array<string|number>}>} hyperedges
 * @returns {Map<string, Set<string>>} vertex id (stringified) -> set of neighbor vertex ids
 */
export function buildAdjacencyList(hyperedges) {
  const adjacency = new Map();
  const ensure = v => {
    const key = String(v);
    if (!adjacency.has(key)) adjacency.set(key, new Set());
    return adjacency.get(key);
  };
  const projectionResult = buildTwoSectionProjectionSafely(hyperedges, { weightPolicy: PROJECTION_WEIGHT_POLICIES.UNWEIGHTED });
  if (!projectionResult.ok) {
    throw new Error(`V2V projection not computed: estimated ${projectionResult.estimatedPairs.toLocaleString()} candidate pairs exceeds the ${projectionResult.budget.toLocaleString()} safety limit.`);
  }
  const projection = projectionResult.projection;
  projection.vertices.forEach(ensure);
  for (const edge of projection.edges) {
    ensure(edge.src).add(edge.dst);
    ensure(edge.dst).add(edge.src);
  }
  return adjacency;
}

/**
 * @param {Array<{vertices: Array<string|number>}>} hyperedges
 * @returns {string[]} every distinct vertex id (stringified), in first-seen order
 */
export function getAllVertices(hyperedges) {
  const seen = new Set();
  const out = [];
  for (const h of hyperedges ?? []) {
    for (const v of h.vertices ?? []) {
      const key = String(v);
      if (!seen.has(key)) {
        seen.add(key);
        out.push(key);
      }
    }
  }
  return out;
}

/**
 * Builds a weighted 2-section adjacency map for algorithms (Dijkstra) that
 * need an edge cost rather than just connectivity. Each hyperedge's `weight`
 * becomes the cost of every pairwise edge it induces; when two vertices
 * co-occur in more than one hyperedge, the cheapest of those hyperedges wins.
 *
 * Dijkstra requires non-negative costs. Zero is valid; missing, negative, and
 * non-numeric weights are replaced with a default cost of 1 and reported as
 * warnings so shortest-path answers are never silently based on bad weights.
 *
 * @param {Array<{id: string, vertices: Array<string|number>, weight?: number}>} hyperedges
 * @returns {{ adjacency: Map<string, Map<string, number>>, warnings: string[], weightPolicy: string }}
 */
export function buildWeightedAdjacency(hyperedges) {
  const adjacency = new Map();
  const ensure = v => {
    const key = String(v);
    if (!adjacency.has(key)) adjacency.set(key, new Map());
    return adjacency.get(key);
  };

  const projectionResult = buildTwoSectionProjectionSafely(hyperedges, {
    weightPolicy: PROJECTION_WEIGHT_POLICIES.MIN_HYPEREDGE_WEIGHT,
    defaultWeight: 1,
  });
  if (!projectionResult.ok) {
    throw new Error(`Weighted V2V projection not computed: estimated ${projectionResult.estimatedPairs.toLocaleString()} candidate pairs exceeds the ${projectionResult.budget.toLocaleString()} safety limit.`);
  }
  const projection = projectionResult.projection;
  projection.vertices.forEach(ensure);
  for (const edge of projection.edges) {
    ensure(edge.src).set(edge.dst, edge.weight);
    ensure(edge.dst).set(edge.src, edge.weight);
  }
  return { adjacency, warnings: projection.warnings, weightPolicy: projection.weightPolicy };
}
