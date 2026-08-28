import { PALETTE } from "../theme.js";
import { buildIncidenceIndex } from "../graph/incidenceIndex.js";
import { createIncidenceTraversal } from "./traversal.js";

/**
 * Finds connected components of a hypergraph's 2-section by repeatedly
 * running the shared traversal core from every not-yet-visited vertex.
 *
 * @param {Array} hyperedges
 * @returns {{
 *   components: Array<{ id: number, vertices: string[], size: number, color: string }>,
 *   vertexToComponent: Map<string, number>,
 * }}
 */
export function runConnectedComponents(hyperedges) {
  const index = buildIncidenceIndex(hyperedges);
  const incidenceTraversal = createIncidenceTraversal(index);
  const visited = new Set();
  const components = [];
  const vertexToComponent = new Map();

  for (const vertex of index.vertices) {
    if (visited.has(vertex)) continue;
    const visitOrder = incidenceTraversal.collectComponent(vertex, visited);
    const id = components.length;
    visitOrder.forEach(v => vertexToComponent.set(v, id));
    components.push({
      id,
      vertices: visitOrder,
      size: visitOrder.length,
      color: PALETTE[id % PALETTE.length],
    });
  }

  // Largest components first — the most useful reading order in the results panel.
  components.sort((a, b) => b.size - a.size);
  components.forEach((c, i) => { c.id = i; c.vertices.forEach(v => vertexToComponent.set(v, i)); c.color = PALETTE[i % PALETTE.length]; });

  return {
    algorithm: "connected_components",
    components,
    vertexToComponent,
    count: components.length,
  };
}

