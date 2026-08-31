// Immutable Stage 6 references copied from the approved pre-change behavior.
// This helper intentionally imports neither shortestPath.js nor kCore.js.

export function legacyRunShortestPath(hyperedges, { startVertex, targetVertex = null } = {}) {
  const start = String(startVertex);
  const target = targetVertex != null ? String(targetVertex) : null;
  const { adjacency, warnings } = legacyBuildWeightedAdjacency(hyperedges);

  if (!adjacency.has(start)) {
    return {
      algorithm: "shortest_path", startVertex: start, targetVertex: target,
      distances: new Map(), previous: new Map(), path: [], reachable: target != null ? false : null,
      edgesUsed: [], steps: [], warnings,
    };
  }

  const distances = new Map([[start, 0]]);
  const previous = new Map();
  const visited = new Set();
  const unvisited = new Set(adjacency.keys());
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
    const relaxed = [];
    for (const [neighbor, cost] of adjacency.get(current) ?? []) {
      if (visited.has(neighbor)) continue;
      const candidate = currentDist + cost;
      const known = distances.has(neighbor) ? distances.get(neighbor) : Infinity;
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
  return {
    algorithm: "shortest_path", startVertex: start, targetVertex: target,
    distances, previous, path, reachable: target != null ? distances.has(target) : null,
    edgesUsed, steps, warnings,
  };
}

export function legacyRunKCore(hyperedges) {
  const adjacency = legacyBuildAdjacencyList(hyperedges);
  const vertices = legacyGetAllVertices(hyperedges);
  const degree = new Map(vertices.map(vertex => [vertex, adjacency.get(vertex)?.size ?? 0]));
  const remaining = new Set(vertices);
  const coreness = new Map();
  const peelOrder = [];
  let degeneracy = 0;

  while (remaining.size > 0) {
    let vertex = null;
    let minimumDegree = Infinity;
    for (const candidate of remaining) {
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
    for (const neighbor of adjacency.get(vertex) ?? []) {
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
    .map(([k, verticesAtK]) => ({ k, vertices: verticesAtK.sort(), size: verticesAtK.length }));
  return { algorithm: "k_core", coreness, degeneracy, peelOrder, cores };
}

export function serializeShortest(result) {
  return {
    algorithm: result.algorithm,
    startVertex: result.startVertex,
    targetVertex: result.targetVertex,
    distances: [...result.distances],
    previous: [...result.previous],
    path: result.path,
    reachable: result.reachable,
    edgesUsed: result.edgesUsed,
    steps: result.steps,
    warnings: result.warnings,
  };
}

export function serializeKCore(result) {
  return {
    algorithm: result.algorithm,
    coreness: [...result.coreness],
    degeneracy: result.degeneracy,
    peelOrder: result.peelOrder,
    cores: result.cores,
  };
}

function legacyBuildWeightedAdjacency(hyperedges) {
  const projection = legacyWeightedProjection(hyperedges);
  const adjacency = new Map();
  const ensure = vertex => {
    if (!adjacency.has(vertex)) adjacency.set(vertex, new Map());
    return adjacency.get(vertex);
  };
  projection.vertices.forEach(ensure);
  for (const edge of projection.edges) {
    ensure(edge.src).set(edge.dst, edge.weight);
    ensure(edge.dst).set(edge.src, edge.weight);
  }
  return { adjacency, warnings: projection.warnings };
}

function legacyWeightedProjection(hyperedges) {
  const edgesBySource = new Map();
  const vertices = new Set();
  const warnings = [];
  const warned = new Set();
  for (const hyperedge of hyperedges ?? []) {
    const members = [...new Set((hyperedge?.vertices ?? []).map(String))];
    members.forEach(vertex => vertices.add(vertex));
    const weight = legacyWeight(hyperedge, warnings, warned);
    for (let left = 0; left < members.length; left += 1) {
      for (let right = left + 1; right < members.length; right += 1) {
        const [source, target] = compareVertexId(members[left], members[right]) <= 0
          ? [members[left], members[right]]
          : [members[right], members[left]];
        if (!edgesBySource.has(source)) edgesBySource.set(source, new Map());
        const byTarget = edgesBySource.get(source);
        const existing = byTarget.get(target);
        byTarget.set(target, existing === undefined ? weight : Math.min(existing, weight));
      }
    }
  }
  const edges = [...edgesBySource.entries()].flatMap(([src, targets]) => [...targets].map(([dst, weight]) => ({ src, dst, weight })))
    .sort((left, right) => compareVertexId(left.src, right.src) || compareVertexId(left.dst, right.dst));
  return { vertices: [...vertices].sort(compareVertexId), edges, warnings };
}

function legacyWeight(hyperedge, warnings, warned) {
  const id = String(hyperedge?.id ?? "(unknown)");
  const raw = hyperedge?.weight;
  let message = "";
  if (raw == null || raw === "") message = `Hyperedge "${id}" has no weight; using 1 for weighted projection.`;
  else if (!Number.isFinite(Number(raw))) message = `Hyperedge "${id}" has a non-numeric weight (${String(raw)}); using 1 for weighted projection.`;
  else if (Number(raw) < 0) message = `Hyperedge "${id}" has a negative weight (${Number(raw)}); using 1 for weighted projection.`;
  if (message) {
    if (!warned.has(id)) {
      warned.add(id);
      warnings.push(message);
    }
    return 1;
  }
  return Number(raw);
}

function legacyBuildAdjacencyList(hyperedges) {
  const adjacency = new Map();
  const ensure = value => {
    const vertex = String(value);
    if (!adjacency.has(vertex)) adjacency.set(vertex, new Set());
    return adjacency.get(vertex);
  };
  for (const hyperedge of hyperedges ?? []) {
    const members = [...new Set((hyperedge?.vertices ?? []).map(String))];
    members.forEach(ensure);
    for (let left = 0; left < members.length; left += 1) {
      for (let right = left + 1; right < members.length; right += 1) {
        ensure(members[left]).add(members[right]);
        ensure(members[right]).add(members[left]);
      }
    }
  }
  return adjacency;
}

function legacyGetAllVertices(hyperedges) {
  const seen = new Set();
  const output = [];
  for (const hyperedge of hyperedges ?? []) {
    for (const value of hyperedge?.vertices ?? []) {
      const vertex = String(value);
      if (seen.has(vertex)) continue;
      seen.add(vertex);
      output.push(vertex);
    }
  }
  return output;
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
  const localeOrder = a.localeCompare(b);
  if (localeOrder !== 0) return localeOrder;
  if (a === b) return 0;
  return a < b ? -1 : 1;
}
