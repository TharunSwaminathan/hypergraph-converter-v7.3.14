import { buildIncidenceIndex } from "../graph/incidenceIndex.js";
import { normalizeGraphIdentifier } from "../utils/graphIdentifiers.js";

/**
 * Algorithms consume the app's canonical graph, whose IDs are strings. The
 * public algorithm functions historically also accepted primitive numeric IDs
 * because the old projection stringified them. Preserve that narrow adapter at
 * the boundary, then build the shared Stage 3 incidence index exactly once.
 */
export function buildAlgorithmIncidenceIndex(hyperedges = []) {
  const canonical = (hyperedges ?? []).map((hyperedge, index) => {
    const path = `hyperedges[${index}]`;
    if (!hyperedge || typeof hyperedge !== "object" || Array.isArray(hyperedge)) return hyperedge;
    const id = normalizeGraphIdentifier(hyperedge.id, { path: `${path}.id` });
    const vertices = Array.isArray(hyperedge.vertices)
      ? hyperedge.vertices.map((vertex, vertexIndex) => normalizeGraphIdentifier(vertex, {
        path: `${path}.vertices[${vertexIndex}]`,
      }))
      : hyperedge.vertices;
    return { ...hyperedge, id, vertices };
  });
  return buildIncidenceIndex(canonical);
}
