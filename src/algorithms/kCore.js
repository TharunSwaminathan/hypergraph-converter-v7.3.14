import { buildAlgorithmIncidenceIndex } from "./algorithmIncidence.js";

export const K_CORE_STATUS = Object.freeze({
  COMPUTED: "computed",
  RESOURCE_LIMITED: "over_budget",
});

export const K_CORE_LIMITS = Object.freeze({
  maxCandidatePairWork: 2_000_000,
  maxUniqueProjectedEdges: 200_000,
  maxAdjacencyReferences: 400_000,
  maxSynchronousWork: 2_000_000,
});

/**
 * Exact k-core decomposition of the deduplicated two-section. This stores only
 * the projected neighbor Sets k-core mathematically needs—no projection edge
 * records, weight/support metadata, render rows, or export data.
 */
export function runKCore(hyperedges, options = {}) {
  const startedAt = performanceNow();
  const limits = resolveLimits(options);
  const index = buildAlgorithmIncidenceIndex(hyperedges);
  const adjacency = new Map(index.vertices.map(vertex => [vertex, new Set()]));
  const usage = {
    hyperedges: index.counts.hyperedges,
    vertices: index.counts.vertices,
    incidences: index.counts.incidences,
    incidenceIndexBuilds: 1,
    candidatePairWork: 0,
    uniqueProjectedEdges: 0,
    adjacencyReferences: 0,
    synchronousWork: 0,
    elapsedMs: 0,
  };

  for (const hyperedgeId of index.hyperedges) {
    const members = [...(index.hyperedgeToVertices.get(hyperedgeId) ?? [])];
    for (let left = 0; left < members.length; left += 1) {
      for (let right = left + 1; right < members.length; right += 1) {
        usage.candidatePairWork += 1;
        usage.synchronousWork += 1;
        const limited = exceeds("candidatePairWork", usage, limits)
          ?? exceeds("synchronousWork", usage, limits);
        if (limited) return limitedResult(limited, usage, limits, startedAt);

        const source = members[left];
        const target = members[right];
        if (adjacency.get(source).has(target)) continue;

        const nextUniqueEdges = usage.uniqueProjectedEdges + 1;
        const nextAdjacencyReferences = usage.adjacencyReferences + 2;
        if (nextUniqueEdges > limits.maxUniqueProjectedEdges) {
          usage.uniqueProjectedEdges = nextUniqueEdges;
          return limitedResult("uniqueProjectedEdges", usage, limits, startedAt);
        }
        if (nextAdjacencyReferences > limits.maxAdjacencyReferences) {
          usage.adjacencyReferences = nextAdjacencyReferences;
          return limitedResult("adjacencyReferences", usage, limits, startedAt);
        }
        adjacency.get(source).add(target);
        adjacency.get(target).add(source);
        usage.uniqueProjectedEdges = nextUniqueEdges;
        usage.adjacencyReferences = nextAdjacencyReferences;
      }
    }
  }

  const vertices = [...index.vertices];
  const degree = new Map(vertices.map(vertex => [vertex, adjacency.get(vertex).size]));
  const remaining = new Set(vertices);
  const coreness = new Map();
  const peelOrder = [];
  let degeneracy = 0;

  while (remaining.size > 0) {
    let vertex = null;
    let minimumDegree = Infinity;
    for (const candidate of remaining) {
      usage.synchronousWork += 1;
      if (usage.synchronousWork > limits.maxSynchronousWork) {
        return limitedResult("synchronousWork", usage, limits, startedAt);
      }
      const candidateDegree = degree.get(candidate);
      if (candidateDegree < minimumDegree) {
        minimumDegree = candidateDegree;
        vertex = candidate;
      }
    }

    degeneracy = Math.max(degeneracy, minimumDegree);
    coreness.set(vertex, degeneracy);
    peelOrder.push({ vertex, coreness: degeneracy, degreeAtRemoval: minimumDegree });
    remaining.delete(vertex);

    for (const neighbor of adjacency.get(vertex)) {
      usage.synchronousWork += 1;
      if (usage.synchronousWork > limits.maxSynchronousWork) {
        return limitedResult("synchronousWork", usage, limits, startedAt);
      }
      if (remaining.has(neighbor)) degree.set(neighbor, degree.get(neighbor) - 1);
    }
  }

  const byCoreValue = new Map();
  for (const [vertex, k] of coreness) {
    if (!byCoreValue.has(k)) byCoreValue.set(k, []);
    byCoreValue.get(k).push(vertex);
  }
  const cores = [...byCoreValue.entries()]
    .sort((left, right) => right[0] - left[0])
    .map(([k, coreVertices]) => ({ k, vertices: coreVertices.sort(), size: coreVertices.length }));

  usage.elapsedMs = performanceNow() - startedAt;
  return {
    algorithm: "k_core",
    status: K_CORE_STATUS.COMPUTED,
    coreness,
    degeneracy,
    peelOrder,
    cores,
    usage,
    limits,
  };
}

function resolveLimits(options) {
  return Object.freeze({
    maxCandidatePairWork: limit(options.maxCandidatePairWork, K_CORE_LIMITS.maxCandidatePairWork),
    maxUniqueProjectedEdges: limit(options.maxUniqueProjectedEdges, K_CORE_LIMITS.maxUniqueProjectedEdges),
    maxAdjacencyReferences: limit(options.maxAdjacencyReferences, K_CORE_LIMITS.maxAdjacencyReferences),
    maxSynchronousWork: limit(options.maxSynchronousWork, K_CORE_LIMITS.maxSynchronousWork),
  });
}

function limit(value, fallback) {
  if (value === undefined) return fallback;
  if (value === Infinity) return value;
  if (!Number.isFinite(value) || value < 0) throw new TypeError("K-core resource limits must be non-negative finite numbers or Infinity.");
  return Math.floor(value);
}

function exceeds(resource, usage, limits) {
  const key = `max${resource[0].toUpperCase()}${resource.slice(1)}`;
  return usage[resource] > limits[key] ? resource : null;
}

function limitedResult(exceededResource, usage, limits, startedAt) {
  usage.elapsedMs = performanceNow() - startedAt;
  const limitKey = `max${exceededResource[0].toUpperCase()}${exceededResource.slice(1)}`;
  const labels = {
    candidatePairWork: "candidate pair work units",
    uniqueProjectedEdges: "unique projected edges",
    adjacencyReferences: "adjacency references",
    synchronousWork: "synchronous work units",
  };
  return {
    algorithm: "k_core",
    status: K_CORE_STATUS.RESOURCE_LIMITED,
    value: null,
    coreness: null,
    degeneracy: null,
    peelOrder: [],
    cores: [],
    exceededResource,
    usage: { ...usage },
    limits,
    reason: `${usage[exceededResource].toLocaleString()} ${labels[exceededResource]} exceeds the ${limits[limitKey].toLocaleString()} K-core safety limit`,
  };
}

function performanceNow() {
  return globalThis.performance?.now?.() ?? Date.now();
}
