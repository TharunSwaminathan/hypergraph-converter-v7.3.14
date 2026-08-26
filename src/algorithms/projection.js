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
  maxEstimatedPairs: 2_000_000,
  maxProjectedEdges: 2_000_000,
  maxOutputRows: 200_000,
  maxAdjacencyReferences: 400_000,
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
export function estimateProjectionPairCount(hyperedges = [], ceiling = PROJECTION_BUDGETS.maxEstimatedPairs) {
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
  const edges = new Map();
  const vertices = new Set();
  const warnings = [];
  const warned = new Set();

  for (const hyperedge of hyperedges ?? []) {
    const uniqueVertices = [...new Set((hyperedge?.vertices ?? []).map(String))];
    uniqueVertices.forEach(vertex => vertices.add(vertex));
    const edgeWeight = normalizedHyperedgeWeight(hyperedge, { weightPolicy, defaultWeight, warnings, warned });
    for (let i = 0; i < uniqueVertices.length; i += 1) {
      for (let j = i + 1; j < uniqueVertices.length; j += 1) {
        const [src, dst] = [uniqueVertices[i], uniqueVertices[j]].sort(compareVertexId);
        const key = `${src}\u0000${dst}`;
        if (!edges.has(key)) {
          edges.set(key, {
            src,
            dst,
            weight: initialWeight(weightPolicy, edgeWeight),
            hyperedges: [],
          });
        } else {
          const edge = edges.get(key);
          edge.weight = combineWeight(edge.weight, edgeWeight, weightPolicy);
        }
        edges.get(key).hyperedges.push(String(hyperedge.id));
      }
    }
  }

  const projectedEdges = [...edges.values()]
    .map(edge => ({
      ...edge,
      weight: Number.isFinite(edge.weight) ? edge.weight : defaultWeight,
      hyperedges: [...new Set(edge.hyperedges)],
    }))
    .sort((left, right) => compareVertexId(left.src, right.src) || compareVertexId(left.dst, right.dst));

  return {
    vertices: [...vertices].sort(compareVertexId),
    edges: projectedEdges,
    warnings,
    weightPolicy,
  };
}

/**
 * Same as buildTwoSectionProjection, but checks estimateProjectionPairCount
 * first and refuses to materialize anything if the estimate is over budget
 * (V7310-D03 requirement: "estimate before allocating... if a limit is
 * exceeded, do not begin full construction"). Callers get back a structured
 * refusal with the estimate instead of a hung tab or an OOM crash, and can
 * offer the user a bounded sample or a confirmed override rather than
 * silently truncating and calling it the full projection.
 *
 * @returns {{ ok: true, projection: object } | { ok: false, overBudget: true, estimatedPairs: number, largestHyperedgeSize: number, budget: number }}
 */
export function buildTwoSectionProjectionSafely(hyperedges = [], options = {}) {
  const maxEstimatedPairs = options.maxEstimatedPairs ?? PROJECTION_BUDGETS.maxEstimatedPairs;
  const maxProjectedEdges = options.maxProjectedEdges ?? PROJECTION_BUDGETS.maxProjectedEdges;
  const maxOutputRows = options.maxOutputRows ?? PROJECTION_BUDGETS.maxOutputRows;
  const maxAdjacencyReferences = options.maxAdjacencyReferences ?? PROJECTION_BUDGETS.maxAdjacencyReferences;
  const effectivePairBudget = Math.min(maxEstimatedPairs, maxProjectedEdges, maxOutputRows, Math.floor(maxAdjacencyReferences / 2));
  const { estimatedPairs, overBudget, largestHyperedgeSize } = estimateProjectionPairCount(hyperedges, effectivePairBudget);
  if (overBudget) {
    return {
      ok: false,
      overBudget: true,
      estimatedPairs,
      largestHyperedgeSize,
      budget: effectivePairBudget,
      budgets: { maxEstimatedPairs, maxProjectedEdges, maxOutputRows, maxAdjacencyReferences },
      reason: `estimated ${estimatedPairs.toLocaleString()} candidate/output rows exceeds the ${effectivePairBudget.toLocaleString()} effective projection safety limit`,
    };
  }
  return { ok: true, projection: buildTwoSectionProjection(hyperedges, options) };
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
  if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
  return a.localeCompare(b);
}
