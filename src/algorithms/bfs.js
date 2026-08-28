import { buildIncidenceIndex } from "../graph/incidenceIndex.js";
import { createIncidenceTraversal } from "./traversal.js";

/**
 * Runs breadth-first search over a hypergraph's 2-section, starting at
 * `startVertex`. Returns visit order, distances, edges used, and a
 * step-by-step trace suitable for animating on the visualization.
 *
 * @param {Array} hyperedges
 * @param {string|number} startVertex
 */
export function runBFS(hyperedges, startVertex) {
  const index = buildIncidenceIndex(hyperedges);
  const result = createIncidenceTraversal(index).traverse(startVertex, "bfs");
  return {
    algorithm: "bfs",
    startVertex: String(startVertex),
    visitOrder: result.visitOrder,
    edgesUsed: result.edgesUsed,
    distances: result.distances,
    steps: result.steps,
    reached: result.visitOrder.length,
    total: index.vertices.length,
  };
}
