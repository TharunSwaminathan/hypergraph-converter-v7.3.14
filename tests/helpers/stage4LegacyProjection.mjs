export function legacyBuildTwoSectionProjection(hyperedges = [], {
  weightPolicy = "count_shared_hyperedges",
  defaultWeight = 1,
} = {}) {
  const edges = new Map();
  const vertices = new Set();
  const warnings = [];
  const warned = new Set();

  for (const hyperedge of hyperedges ?? []) {
    const uniqueVertices = [...new Set((hyperedge?.vertices ?? []).map(String))];
    uniqueVertices.forEach(vertex => vertices.add(vertex));
    const edgeWeight = normalizedWeight(hyperedge, { weightPolicy, defaultWeight, warnings, warned });
    for (let left = 0; left < uniqueVertices.length; left += 1) {
      for (let right = left + 1; right < uniqueVertices.length; right += 1) {
        const [src, dst] = [uniqueVertices[left], uniqueVertices[right]].sort(compareVertexId);
        const key = `${src}\u0000${dst}`;
        if (!edges.has(key)) {
          edges.set(key, { src, dst, weight: initialWeight(weightPolicy, edgeWeight), hyperedges: [] });
        } else {
          const edge = edges.get(key);
          edge.weight = combineWeight(edge.weight, edgeWeight, weightPolicy);
        }
        edges.get(key).hyperedges.push(String(hyperedge.id));
      }
    }
  }

  return {
    vertices: [...vertices].sort(compareVertexId),
    edges: [...edges.values()]
      .map(edge => ({
        ...edge,
        weight: Number.isFinite(edge.weight) ? edge.weight : defaultWeight,
        hyperedges: [...new Set(edge.hyperedges)],
      }))
      .sort((left, right) => compareVertexId(left.src, right.src) || compareVertexId(left.dst, right.dst)),
    warnings,
    weightPolicy,
  };
}

function normalizedWeight(hyperedge, { weightPolicy, defaultWeight, warnings, warned }) {
  if (weightPolicy === "count_shared_hyperedges" || weightPolicy === "unweighted") return 1;
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
  return policy === "unweighted" ? 1 : edgeWeight;
}

function combineWeight(existing, edgeWeight, policy) {
  if (policy === "unweighted") return 1;
  if (policy === "min_hyperedge_weight") return Math.min(existing, edgeWeight);
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
