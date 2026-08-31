import { buildIncidenceIndex } from "../graph/incidenceIndex.js";

/**
 * Algorithms consume the app's canonical graph, whose IDs are strings. The
 * public algorithm functions historically also accepted primitive numeric IDs
 * because the old projection stringified them. Preserve that narrow adapter at
 * the boundary, then build the shared Stage 3 incidence index exactly once.
 */
export function buildAlgorithmIncidenceIndex(hyperedges = []) {
  const canonical = (hyperedges ?? []).map((hyperedge, index) => ({
    ...hyperedge,
    id: String(hyperedge?.id ?? `h${index}`),
    vertices: (hyperedge?.vertices ?? []).map(String),
  }));
  return buildIncidenceIndex(canonical);
}
