import { buildAdjacencyList, getAllVertices } from "./graphModel.js";

/**
 * k-core decomposition over the hypergraph's 2-section, using the standard
 * Batagelj–Zaversnik peeling algorithm: repeatedly remove whichever
 * remaining vertex currently has the smallest degree. A removed vertex's
 * "coreness" is the highest running-minimum degree seen so far in the
 * peel — that running minimum only ever increases as peeling proceeds
 * (every vertex removed later had to survive at least as long as every
 * vertex removed before it), which is exactly what makes this produce a
 * correct coreness number for every vertex in one pass, without having to
 * separately test each candidate k from scratch.
 *
 * The graph's degeneracy is the maximum coreness assigned to any vertex —
 * the largest k for which a non-empty k-core exists.
 *
 * Picking the next vertex to peel is a linear scan over what's left
 * (O(V) per removal, O(V^2) overall), matching the complexity already
 * used elsewhere in this codebase; fine for the browser-sized graphs this
 * app targets.
 *
 * @param {Array} hyperedges
 */
export function runKCore(hyperedges) {
  const adjacency = buildAdjacencyList(hyperedges);
  const vertices = getAllVertices(hyperedges ?? []);
  const degree = new Map(vertices.map(v => [v, adjacency.get(v)?.size ?? 0]));
  const remaining = new Set(vertices);
  const coreness = new Map();
  const peelOrder = [];
  let degeneracy = 0;

  while (remaining.size > 0) {
    // Find the remaining vertex with the smallest current degree.
    let v = null;
    let minDeg = Infinity;
    for (const candidate of remaining) {
      const d = degree.get(candidate);
      if (d < minDeg) { minDeg = d; v = candidate; }
    }

    degeneracy = Math.max(degeneracy, minDeg);
    coreness.set(v, degeneracy);
    peelOrder.push({ vertex: v, coreness: degeneracy, degreeAtRemoval: minDeg });
    remaining.delete(v);

    for (const neighbor of adjacency.get(v) ?? []) {
      if (remaining.has(neighbor)) degree.set(neighbor, degree.get(neighbor) - 1);
    }
  }

  const byCoreValue = new Map();
  for (const [vertex, k] of coreness) {
    if (!byCoreValue.has(k)) byCoreValue.set(k, []);
    byCoreValue.get(k).push(vertex);
  }
  const cores = [...byCoreValue.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([k, verts]) => ({ k, vertices: verts.sort(), size: verts.length }));

  return {
    algorithm: "k_core",
    coreness, // Map<vertex, coreness number>
    degeneracy, // the graph's degeneracy: the largest k with a non-empty k-core
    peelOrder, // peeling sequence, weakest vertex first
    cores, // vertices grouped by coreness value, highest (densest) first
  };
}
