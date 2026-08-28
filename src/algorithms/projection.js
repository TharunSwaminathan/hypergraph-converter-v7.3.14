export const PROJECTION_WEIGHT_POLICIES = Object.freeze({
  COUNT_SHARED_HYPEREDGES: "count_shared_hyperedges",
  SUM_HYPEREDGE_WEIGHTS: "sum_hyperedge_weights",
  MIN_HYPEREDGE_WEIGHT: "min_hyperedge_weight",
  UNWEIGHTED: "unweighted",
});

export const DEFAULT_PROJECTION_WEIGHT_POLICY = PROJECTION_WEIGHT_POLICIES.COUNT_SHARED_HYPEREDGES;

// Deterministic budgets (V7310-D03). The two-section (V2V) projection of a
// hyperedge of size k contributes up to k*(k-1)/2 candidate pairs; for a
// hypergraph with many large hyperedges this is quadratic and can reach
// billions of pairs long before the browser tab itself would be considered
// "too large" to load. These budgets exist so a bad input produces a clear,
// bounded refusal instead of an unresponsive tab or an OOM crash.
export const PROJECTION_BUDGETS = Object.freeze({
  maxCandidatePairWork: 2_000_000,
  maxUniqueProjectedEdges: 200_000,
  maxProjectedEdgeSupportReferences: 2_000_000,
  maxAdjacencyReferences: 400_000,
  maxRenderEdges: 200_000,
  maxExportRows: 200_000,
  maxMatrixCells: 1_000_000,
  maxSynchronousWork: 2_000_000,
  // Compatibility aliases retained for callers introduced before Stage 4.
  maxEstimatedPairs: 2_000_000,
  maxProjectedEdges: 200_000,
  maxOutputRows: 200_000,
});

/**
 * Overflow-safe estimate of how many candidate V2V pairs a full two-section
 * projection would need to consider, *without* building it. O(H) — reads
 * each hyperedge's vertex count once; never allocates anything proportional
 * to the pair count itself. Runs in one pass so it stays cheap even for a
 * huge hypergraph, and stops early once the running total is already
 * unambiguously over budget (no need to keep exact-summing past that point).
 *
 * @param {Array<{vertices?: Array}>} hyperedges
 * @param {number} [ceiling] stop early once the estimate exceeds this
 * @returns {{ estimatedPairs: number, overBudget: boolean, largestHyperedgeSize: number }}
 */
export function estimateProjectionPairCount(hyperedges = [], ceiling = PROJECTION_BUDGETS.maxCandidatePairWork) {
  let estimatedPairs = 0;
  let largestHyperedgeSize = 0;
  for (const hyperedge of hyperedges ?? []) {
    // Use the raw vertex-array length as a fast upper bound rather than
    // de-duplicating (Set construction) here — de-duplication happens
    // during the real build, but for an *estimate* the raw length is
    // sufficient and keeps this loop allocation-free.
    const size = hyperedge?.vertices?.length ?? 0;
    if (size > largestHyperedgeSize) largestHyperedgeSize = size;
    // k*(k-1)/2 computed with a division-first order to reduce overflow risk
    // for very large k, then checked against Number.MAX_SAFE_INTEGER.
    const pairs = size > 1 ? (size / 2) * (size - 1) : 0;
    estimatedPairs += pairs;
    if (!Number.isSafeInteger(estimatedPairs) || estimatedPairs > ceiling) {
      return { estimatedPairs: Math.min(estimatedPairs, Number.MAX_SAFE_INTEGER), overBudget: true, largestHyperedgeSize };
    }
  }
  return { estimatedPairs, overBudget: estimatedPairs > ceiling, largestHyperedgeSize };
}

export function buildTwoSectionProjection(hyperedges = [], {
  weightPolicy = DEFAULT_PROJECTION_WEIGHT_POLICY,
  defaultWeight = 1,
} = {}) {
  return materializeTwoSectionProjection(hyperedges, { weightPolicy, defaultWeight }).projection;
}

function materializeTwoSectionProjection(hyperedges, {
  weightPolicy,
  defaultWeight,
  limits = null,
}) {
  const edgesBySource = new Map();
  const vertices = new Set();
  const warnings = [];
  const warned = new Set();
  const usage = emptyProjectionUsage();

  for (const hyperedge of hyperedges ?? []) {
    const uniqueVertices = [...new Set((hyperedge?.vertices ?? []).map(String))];
    uniqueVertices.forEach(vertex => vertices.add(vertex));
    const edgeWeight = normalizedHyperedgeWeight(hyperedge, { weightPolicy, defaultWeight, warnings, warned });
    for (let i = 0; i < uniqueVertices.length; i += 1) {
      for (let j = i + 1; j < uniqueVertices.length; j += 1) {
        usage.candidatePairWork += 1;
        usage.synchronousWork += 1;
        if (limits && usage.candidatePairWork > limits.maxCandidatePairWork) {
          return limitedMaterialization("candidatePairWork", usage, limits);
        }
        if (limits && usage.synchronousWork > limits.maxSynchronousWork) {
          return limitedMaterialization("synchronousWork", usage, limits);
        }

        const [src, dst] = orientPair(uniqueVertices[i], uniqueVertices[j]);
        let edgesByDestination = edgesBySource.get(src);
        if (!edgesByDestination) {
          edgesByDestination = new Map();
          edgesBySource.set(src, edgesByDestination);
        }
        let edge = edgesByDestination.get(dst);
        if (!edge) {
          usage.uniqueProjectedEdges += 1;
          usage.adjacencyReferences = usage.uniqueProjectedEdges * 2;
          usage.renderEdges = usage.uniqueProjectedEdges;
          usage.exportRows = usage.uniqueProjectedEdges;
          if (limits && usage.uniqueProjectedEdges > limits.maxUniqueProjectedEdges) {
            return limitedMaterialization("uniqueProjectedEdges", usage, limits);
          }
          edge = {
            src,
            dst,
            weight: initialWeight(weightPolicy, edgeWeight),
            hyperedges: [],
            supportIds: new Set(),
          };
          edgesByDestination.set(dst, edge);
        } else {
          edge.weight = combineWeight(edge.weight, edgeWeight, weightPolicy);
        }
        const hyperedgeId = String(hyperedge.id);
        if (!edge.supportIds.has(hyperedgeId)) {
          usage.projectedEdgeSupportReferences += 1;
          if (limits && usage.projectedEdgeSupportReferences > limits.maxProjectedEdgeSupportReferences) {
            return limitedMaterialization("projectedEdgeSupportReferences", usage, limits);
          }
          edge.supportIds.add(hyperedgeId);
          edge.hyperedges.push(hyperedgeId);
        }
      }
    }
  }

  const projectedEdges = [...edgesBySource.values()].flatMap(edges => [...edges.values()])
    .map(edge => ({
      src: edge.src,
      dst: edge.dst,
      weight: Number.isFinite(edge.weight) ? edge.weight : defaultWeight,
      hyperedges: edge.hyperedges,
    }))
    .sort((left, right) => compareVertexId(left.src, right.src) || compareVertexId(left.dst, right.dst));

  usage.matrixCells = safeProduct(vertices.size, vertices.size);
  return {
    ok: true,
    usage,
    projection: {
      vertices: [...vertices].sort(compareVertexId),
      edges: projectedEdges,
      warnings,
      weightPolicy,
    },
  };
}

/**
 * Bounded exact projection with independent work, edge-storage, and support-
 * reference limits. Display, export, matrix, and adjacency dimensions are
 * reported for downstream consumers but do not become candidate-work
 * preflight limits. A refusal never exposes a partial projection as complete.
 */
export function buildTwoSectionProjectionSafely(hyperedges = [], options = {}) {
  const limits = projectionLimits(options);
  const { estimatedPairs, overBudget, largestHyperedgeSize } = estimateProjectionPairCount(hyperedges, limits.maxCandidatePairWork);
  if (overBudget) {
    const usage = emptyProjectionUsage();
    usage.candidatePairWork = estimatedPairs;
    usage.synchronousWork = estimatedPairs;
    return projectionRefusal("candidatePairWork", usage, limits, { estimatedPairs, largestHyperedgeSize, preflight: true });
  }
  const materialized = materializeTwoSectionProjection(hyperedges, {
    weightPolicy: options.weightPolicy ?? DEFAULT_PROJECTION_WEIGHT_POLICY,
    defaultWeight: options.defaultWeight ?? 1,
    limits,
  });
  if (!materialized.ok) {
    return projectionRefusal(materialized.exceededResource, materialized.usage, limits, { estimatedPairs, largestHyperedgeSize, preflight: false });
  }
  return {
    ok: true,
    overBudget: false,
    projection: materialized.projection,
    estimatedPairs,
    largestHyperedgeSize,
    usage: materialized.usage,
    limits,
    budget: limits.maxCandidatePairWork,
    budgets: compatibilityBudgets(limits),
    resourceMaterialization: resourceMaterializationContract(),
  };
}

/**
 * A bounded sample of the projection, built only from the first `sampleSize`
 * hyperedges (by input order) — explicitly labeled as a sample, never
 * returned or displayed as if it were the complete projection.
 */
export function buildTwoSectionProjectionSample(hyperedges = [], { sampleSize = 500, ...options } = {}) {
  const sampled = (hyperedges ?? []).slice(0, sampleSize);
  return {
    ...buildTwoSectionProjection(sampled, options),
    isSample: true,
    sampledHyperedgeCount: sampled.length,
    totalHyperedgeCount: hyperedges?.length ?? 0,
  };
}
export function incidenceDensity(hyperedges = []) {
  const hyperedgeCount = hyperedges?.length ?? 0;
  const vertexCount = new Set((hyperedges ?? []).flatMap(h => (h.vertices ?? []).map(String))).size;
  if (!hyperedgeCount || !vertexCount) return 0;
  const incidences = (hyperedges ?? []).reduce((sum, h) => sum + new Set((h.vertices ?? []).map(String)).size, 0);
  return incidences / (hyperedgeCount * vertexCount);
}

export function projectionDensity(hyperedges = [], budget = PROJECTION_BUDGETS.maxEstimatedPairs) {
  const { overBudget } = estimateProjectionPairCount(hyperedges, budget);
  if (overBudget) return null; // caller must show "too large to compute" rather than hang
  const projection = buildTwoSectionProjection(hyperedges);
  const vertexCount = projection.vertices.length;
  if (vertexCount < 2) return 0;
  return projection.edges.length / (vertexCount * (vertexCount - 1) / 2);
}

function projectionLimits(options) {
  return Object.freeze({
    maxCandidatePairWork: limit(options.maxCandidatePairWork ?? options.maxEstimatedPairs, PROJECTION_BUDGETS.maxCandidatePairWork),
    maxUniqueProjectedEdges: limit(options.maxUniqueProjectedEdges ?? options.maxProjectedEdges, PROJECTION_BUDGETS.maxUniqueProjectedEdges),
    maxProjectedEdgeSupportReferences: limit(options.maxProjectedEdgeSupportReferences, PROJECTION_BUDGETS.maxProjectedEdgeSupportReferences),
    maxAdjacencyReferences: limit(options.maxAdjacencyReferences, PROJECTION_BUDGETS.maxAdjacencyReferences),
    maxRenderEdges: limit(options.maxRenderEdges, PROJECTION_BUDGETS.maxRenderEdges),
    maxExportRows: limit(options.maxExportRows ?? options.maxOutputRows, PROJECTION_BUDGETS.maxExportRows),
    maxMatrixCells: limit(options.maxMatrixCells, PROJECTION_BUDGETS.maxMatrixCells),
    maxSynchronousWork: limit(options.maxSynchronousWork, PROJECTION_BUDGETS.maxSynchronousWork),
  });
}

function limit(value, fallback) {
  if (value === undefined) return fallback;
  if (value === Infinity) return value;
  if (!Number.isFinite(value) || value < 0) throw new TypeError("Projection resource limits must be non-negative finite numbers or Infinity.");
  return Math.floor(value);
}

function emptyProjectionUsage() {
  return {
    candidatePairWork: 0,
    uniqueProjectedEdges: 0,
    projectedEdgeSupportReferences: 0,
    adjacencyReferences: 0,
    renderEdges: 0,
    exportRows: 0,
    matrixCells: 0,
    synchronousWork: 0,
  };
}

function limitedMaterialization(exceededResource, usage, limits) {
  return { ok: false, overBudget: true, exceededResource, usage: { ...usage }, limits };
}

function projectionRefusal(exceededResource, usage, limits, { estimatedPairs, largestHyperedgeSize, preflight }) {
  const budgetField = {
    candidatePairWork: "maxCandidatePairWork",
    uniqueProjectedEdges: "maxUniqueProjectedEdges",
    projectedEdgeSupportReferences: "maxProjectedEdgeSupportReferences",
    synchronousWork: "maxSynchronousWork",
  }[exceededResource];
  const budget = limits[budgetField];
  const labels = {
    candidatePairWork: "candidate-pair work units",
    uniqueProjectedEdges: "unique projected edges",
    projectedEdgeSupportReferences: "projected-edge support references",
    synchronousWork: "synchronous work units",
  };
  const qualifier = preflight ? "estimated " : "";
  return {
    ok: false,
    overBudget: true,
    exceededResource,
    usage: { ...usage },
    limits,
    estimatedPairs,
    largestHyperedgeSize,
    budget,
    budgets: compatibilityBudgets(limits),
    resourceMaterialization: resourceMaterializationContract(),
    reason: `${qualifier}${usage[exceededResource].toLocaleString()} ${labels[exceededResource]} exceeds the ${budget.toLocaleString()} ${exceededResource} projection safety limit`,
  };
}

function compatibilityBudgets(limits) {
  return {
    ...limits,
    maxEstimatedPairs: limits.maxCandidatePairWork,
    maxProjectedEdges: limits.maxUniqueProjectedEdges,
    maxOutputRows: limits.maxExportRows,
  };
}

function resourceMaterializationContract() {
  return Object.freeze({
    candidatePairWork: "measured",
    uniqueProjectedEdges: "materialized",
    projectedEdgeSupportReferences: "materialized",
    adjacencyReferences: "declared_downstream_estimate",
    renderEdges: "declared_downstream_estimate",
    exportRows: "declared_downstream_estimate",
    matrixCells: "declared_downstream_estimate",
    synchronousWork: "measured_deterministic_units",
  });
}

function safeProduct(left, right) {
  const product = left * right;
  return Number.isSafeInteger(product) ? product : Number.MAX_SAFE_INTEGER;
}

function orientPair(left, right) {
  return compareVertexId(left, right) <= 0 ? [left, right] : [right, left];
}

function normalizedHyperedgeWeight(hyperedge, { weightPolicy, defaultWeight, warnings, warned }) {
  if (weightPolicy === PROJECTION_WEIGHT_POLICIES.COUNT_SHARED_HYPEREDGES || weightPolicy === PROJECTION_WEIGHT_POLICIES.UNWEIGHTED) return 1;
  const id = String(hyperedge?.id ?? "(unknown)");
  const raw = hyperedge?.weight;
  if (raw == null || raw === "") {
    warnOnce(warnings, warned, id, `Hyperedge "${id}" has no weight; using ${defaultWeight} for weighted projection.`);
    return defaultWeight;
  }
  const weight = Number(raw);
  if (!Number.isFinite(weight)) {
    warnOnce(warnings, warned, id, `Hyperedge "${id}" has a non-numeric weight (${String(raw)}); using ${defaultWeight} for weighted projection.`);
    return defaultWeight;
  }
  if (weight < 0) {
    warnOnce(warnings, warned, id, `Hyperedge "${id}" has a negative weight (${weight}); using ${defaultWeight} for weighted projection.`);
    return defaultWeight;
  }
  return weight;
}

function initialWeight(policy, edgeWeight) {
  if (policy === PROJECTION_WEIGHT_POLICIES.UNWEIGHTED) return 1;
  return edgeWeight;
}

function combineWeight(existing, edgeWeight, policy) {
  if (policy === PROJECTION_WEIGHT_POLICIES.UNWEIGHTED) return 1;
  if (policy === PROJECTION_WEIGHT_POLICIES.MIN_HYPEREDGE_WEIGHT) return Math.min(existing, edgeWeight);
  return existing + edgeWeight;
}

function warnOnce(warnings, warned, id, message) {
  if (warned.has(id)) return;
  warned.add(id);
  warnings.push(message);
}

function compareVertexId(left, right) {
  const a = String(left);
  const b = String(right);
  const an = Number(a);
  const bn = Number(b);
  if (Number.isFinite(an) && Number.isFinite(bn)) {
    const numericOrder = an - bn;
    if (numericOrder !== 0) return numericOrder;
    if (a === b) return 0;
    return a < b ? -1 : 1;
  }
  return a.localeCompare(b);
}
