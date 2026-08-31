import { buildAlgorithmIncidenceIndex } from "./algorithmIncidence.js";
import {
  compareVertexId,
  normalizedHyperedgeWeight,
  PROJECTION_WEIGHT_POLICIES,
} from "./projection.js";

const DEFAULT_WEIGHT = 1;

/**
 * Dijkstra over the weighted two-section without materializing its global
 * projected edge/adjacency set. The public result remains the established
 * Stage 0-5 shape; diagnostics are available separately for resource evidence.
 */
export function runShortestPath(hyperedges, options = {}) {
  return executeShortestPath(hyperedges, options).result;
}

export function runShortestPathWithDiagnostics(hyperedges, options = {}) {
  return executeShortestPath(hyperedges, options);
}

function executeShortestPath(hyperedges, { startVertex, targetVertex = null } = {}) {
  const startedAt = performanceNow();
  const start = String(startVertex);
  const target = targetVertex != null ? String(targetVertex) : null;
  const index = buildAlgorithmIncidenceIndex(hyperedges);
  const warnings = [];
  const warned = new Set();
  const weights = new Map();

  // The old eager projection interpreted every hyperedge's weight before
  // Dijkstra began, including disconnected/unexpanded hyperedges. Preserve
  // that exact warning scope and canonical hyperedge order.
  for (const hyperedgeId of index.hyperedges) {
    weights.set(hyperedgeId, normalizedHyperedgeWeight(index.hyperedgesById.get(hyperedgeId), {
      weightPolicy: PROJECTION_WEIGHT_POLICIES.MIN_HYPEREDGE_WEIGHT,
      defaultWeight: DEFAULT_WEIGHT,
      warnings,
      warned,
    }));
  }

  const metrics = {
    hyperedges: index.counts.hyperedges,
    vertices: index.counts.vertices,
    incidences: index.counts.incidences,
    incidenceIndexBuilds: 1,
    expandedVertices: 0,
    neighborCandidateEncounters: 0,
    neighborMapsBuilt: 0,
    neighborEntriesProduced: 0,
    maxTransientNeighborEntries: 0,
    cachedNeighborEntries: 0,
    storedProjectedEdges: 0,
    storedGlobalAdjacencyReferences: 0,
    elapsedMs: 0,
  };

  const vertices = [...index.vertices].sort(compareVertexId);
  if (!index.vertexToHyperedges.has(start)) {
    const result = emptyResult(start, target, warnings);
    metrics.elapsedMs = performanceNow() - startedAt;
    return { result, metrics };
  }

  const distances = new Map([[start, 0]]);
  const previous = new Map();
  const visited = new Set();
  const unvisited = new Set(vertices);
  const steps = [];

  while (unvisited.size > 0) {
    let current = null;
    let currentDist = Infinity;
    for (const vertex of unvisited) {
      const distance = distances.has(vertex) ? distances.get(vertex) : Infinity;
      if (distance < currentDist) {
        currentDist = distance;
        current = vertex;
      }
    }
    if (current == null || currentDist === Infinity) break;

    unvisited.delete(current);
    visited.add(current);
    metrics.expandedVertices += 1;

    const relaxed = [];
    const neighbors = weightedNeighbors(index, weights, current, metrics);
    for (const [neighbor, cost] of neighbors) {
      if (visited.has(neighbor)) continue;
      const candidate = currentDist + cost;
      const known = distances.has(neighbor) ? distances.get(neighbor) : Infinity;
      // Strict inequality is part of the frozen predecessor/tie contract.
      if (candidate < known) {
        distances.set(neighbor, candidate);
        previous.set(neighbor, current);
        relaxed.push(neighbor);
      }
    }

    steps.push({
      visited: [...visited],
      frontier: [...unvisited].filter(vertex => distances.has(vertex)),
      current,
      newlyDiscovered: relaxed,
    });

    // Intentionally remains after relaxation/step capture: target==start has
    // this established behavior in the approved pre-change contract.
    if (target != null && current === target) break;
  }

  let path = [];
  if (target != null && distances.has(target)) {
    path = [target];
    let current = target;
    while (previous.has(current)) {
      current = previous.get(current);
      path.push(current);
    }
    path.reverse();
  }

  const edgesUsed = [...previous.entries()].map(([to, from]) => ({ from, to }));
  const result = {
    algorithm: "shortest_path",
    startVertex: start,
    targetVertex: target,
    distances,
    previous,
    path,
    reachable: target != null ? distances.has(target) : null,
    edgesUsed,
    steps,
    warnings,
  };
  metrics.elapsedMs = performanceNow() - startedAt;
  return { result, metrics };
}

function weightedNeighbors(index, weights, current, metrics) {
  const minimumByNeighbor = new Map();
  metrics.neighborMapsBuilt += 1;
  for (const hyperedgeId of index.vertexToHyperedges.get(current) ?? []) {
    const cost = weights.get(hyperedgeId);
    for (const neighbor of index.hyperedgeToVertices.get(hyperedgeId) ?? []) {
      if (neighbor === current) continue;
      metrics.neighborCandidateEncounters += 1;
      const known = minimumByNeighbor.get(neighbor);
      if (known === undefined || cost < known) minimumByNeighbor.set(neighbor, cost);
    }
  }
  const entries = [...minimumByNeighbor].sort(([left], [right]) => compareVertexId(left, right));
  metrics.neighborEntriesProduced += entries.length;
  metrics.maxTransientNeighborEntries = Math.max(metrics.maxTransientNeighborEntries, entries.length);
  return entries;
}

function emptyResult(start, target, warnings) {
  return {
    algorithm: "shortest_path",
    startVertex: start,
    targetVertex: target,
    distances: new Map(),
    previous: new Map(),
    path: [],
    reachable: target != null ? false : null,
    edgesUsed: [],
    steps: [],
    warnings,
  };
}

function performanceNow() {
  return globalThis.performance?.now?.() ?? Date.now();
}
