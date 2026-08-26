import { buildWeightedAdjacency } from "./graphModel.js";

/**
 * Dijkstra's algorithm over a hypergraph's weighted 2-section, from
 * `startVertex` to every reachable vertex (and, if given, specifically to
 * `targetVertex`).
 *
 * Implementation notes:
 *  - Uses a linear scan to pick the next-closest unvisited vertex each
 *    round (O(V^2) overall). That matches the complexity already used
 *    elsewhere in this codebase (e.g. the force-directed layout, k-core's
 *    peeling step) and is fast enough for the browser-sized graphs this
 *    app targets; a binary-heap priority queue would only matter at a
 *    scale nothing else here is built for either.
 *  - A vertex is finalized (moved out of the "unvisited" set) only once
 *    its shortest distance is certain, which is what makes the greedy
 *    choice correct — this is why Dijkstra requires non-negative edge
 *    weights, which `buildWeightedAdjacency` guarantees by construction.
 *  - `steps` follows the same {visited, frontier, current, newlyDiscovered}
 *    shape as BFS/DFS, so the existing step-by-step animation controls in
 *    the Algorithms panel work here for free.
 *
 * @param {Array} hyperedges
 * @param {{ startVertex: string|number, targetVertex?: string|number|null }} options
 */
export function runShortestPath(hyperedges, { startVertex, targetVertex = null } = {}) {
  const start = String(startVertex);
  const target = targetVertex != null ? String(targetVertex) : null;
  const { adjacency, warnings } = buildWeightedAdjacency(hyperedges);

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
    // Pick the unvisited vertex with the smallest known tentative distance.
    let current = null;
    let currentDist = Infinity;
    for (const v of unvisited) {
      const d = distances.has(v) ? distances.get(v) : Infinity;
      if (d < currentDist) { currentDist = d; current = v; }
    }
    if (current == null || currentDist === Infinity) break; // everything left is unreachable

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
      frontier: [...unvisited].filter(v => distances.has(v)),
      current,
      newlyDiscovered: relaxed,
    });

    if (target != null && current === target) break; // target's shortest distance is now finalized
  }

  let path = [];
  if (target != null && distances.has(target)) {
    path = [target];
    let cur = target;
    while (previous.has(cur)) { cur = previous.get(cur); path.push(cur); }
    path.reverse();
  }

  const edgesUsed = [...previous.entries()].map(([to, from]) => ({ from, to }));

  return {
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
}
