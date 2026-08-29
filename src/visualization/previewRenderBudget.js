export const PREVIEW_RENDER_BUDGETS = Object.freeze({
  maxDynamicLineEdges: 4_000,
  maxHypergraphVisualEdges: 3_000,
  maxPerHyperedgeVisualEdges: 64,
  maxVisualIncidences: 100_000,
});

export function buildVisualCoMembershipOverlay(hyperedges = [], limits = PREVIEW_RENDER_BUDGETS) {
  const memberships = hyperedges.map(hyperedge => [...new Set((hyperedge.vertices ?? []).map(String))]);
  const totalIncidences = memberships.reduce((sum, members) => sum + members.length, 0);
  const totalCandidateRelations = memberships.reduce((sum, members) => sum + members.length * (members.length - 1) / 2, 0);
  const complete = totalCandidateRelations <= limits.maxHypergraphVisualEdges
    && totalIncidences <= limits.maxVisualIncidences;
  const edges = [];
  const seen = new Map();
  const activeHyperedges = memberships.filter(members => members.length > 1).length;
  const fairShare = Math.max(1, Math.floor(limits.maxHypergraphVisualEdges / Math.max(1, activeHyperedges)));
  const perHyperedgeLimit = Math.min(limits.maxPerHyperedgeVisualEdges, fairShare);

  memberships.forEach((members, hyperedgeIndex) => {
    if (members.length <= 1 || edges.length >= limits.maxHypergraphVisualEdges) return;
    if (complete) {
      for (let left = 0; left < members.length; left += 1) {
        for (let right = left + 1; right < members.length; right += 1) addEdge(members[left], members[right], hyperedgeIndex);
      }
      return;
    }
    const target = Math.min(perHyperedgeLimit, members.length * (members.length - 1) / 2);
    let attempts = 0;
    let added = 0;
    while (added < target && attempts < target * 4 && edges.length < limits.maxHypergraphVisualEdges) {
      const ordinal = hyperedgeIndex * perHyperedgeLimit + attempts;
      const left = ordinal % members.length;
      const jump = 1 + Math.floor(ordinal / members.length);
      const right = (left + jump) % members.length;
      attempts += 1;
      if (left === right) continue;
      if (addEdge(members[left], members[right], hyperedgeIndex)) added += 1;
    }
  });

  return Object.freeze({
    edges: Object.freeze(edges),
    status: complete ? "complete" : "sampled",
    complete,
    sampled: !complete,
    reason: complete
      ? "All visual co-membership relations fit the Preview budget."
      : `Preview shows a deterministic bounded co-membership sample; this is not the analytical Line Graph.`,
    samplingPolicy: complete ? "complete" : "canonical fair-share per hyperedge",
    usage: Object.freeze({ totalIncidences, totalCandidateRelations, renderedVisualRelations: edges.length }),
    limits,
  });

  function addEdge(left, right, hyperedgeIndex) {
    const [u, v] = left < right ? [left, right] : [right, left];
    let destinations = seen.get(u);
    if (!destinations) {
      destinations = new Set();
      seen.set(u, destinations);
    }
    if (destinations.has(v)) return false;
    destinations.add(v);
    edges.push(Object.freeze({ u, v, hyperedgeIndex }));
    return true;
  }
}

export function selectLineGraphVisualEdges(exactEdges = [], limits = PREVIEW_RENDER_BUDGETS) {
  if (exactEdges.length <= limits.maxDynamicLineEdges) {
    return Object.freeze({
      edges: Object.freeze(exactEdges.map(edge => Object.freeze({ u: String(edge.src), v: String(edge.dst) }))),
      status: "complete",
      complete: true,
      analyticalEdgeCount: exactEdges.length,
      renderedEdgeCount: exactEdges.length,
      reason: "Line Graph computed exactly and fully rendered.",
      limits,
    });
  }
  const edges = Array.from({ length: limits.maxDynamicLineEdges }, (_, index) => {
    const sourceIndex = Math.floor(index * exactEdges.length / limits.maxDynamicLineEdges);
    const edge = exactEdges[sourceIndex];
    return Object.freeze({ u: String(edge.src), v: String(edge.dst) });
  });
  return Object.freeze({
    edges: Object.freeze(edges),
    status: "lod",
    complete: false,
    analyticalEdgeCount: exactEdges.length,
    renderedEdgeCount: edges.length,
    reason: "Line Graph computed exactly; Preview is showing a deterministic bounded visual subset.",
    limits,
  });
}
