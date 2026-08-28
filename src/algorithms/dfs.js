import { buildIncidenceIndex } from "../graph/incidenceIndex.js";
import { createIncidenceTraversal } from "./traversal.js";

/**
 * Runs depth-first search over a hypergraph's 2-section, starting at
 * `startVertex`. Returns visit order, distances (from the DFS tree), edges
 * used, and a step-by-step trace suitable for animating on the visualization.
 *
 * @param {Array} hyperedges
 * @param {string|number} startVertex
 */
export function runDFS(hyperedges, startVertex) {
  const index = buildIncidenceIndex(hyperedges);
  const result = createIncidenceTraversal(index).traverse(startVertex, "dfs");
  return {
    algorithm: "dfs",
    startVertex: String(startVertex),
    visitOrder: result.visitOrder,
    edgesUsed: result.edgesUsed,
    distances: result.distances,
    steps: result.steps,
    reached: result.visitOrder.length,
    total: index.vertices.length,
  };
}
