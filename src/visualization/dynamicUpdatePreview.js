import { stableStringify } from "../graph/graphFingerprint.js";

export function dynamicUpdatePreview(graph, pending) {
  if (pending?.status !== "VALIDATED" || pending.baseGraphRef.graphId !== graph.graphId
    || pending.baseGraphRef.graphVersion !== graph.graphVersion || pending.baseGraphFingerprint !== graph.graphFingerprint) return null;
  const before = new Map((graph.hyperedges ?? []).map(edge => [edge.id, edge]));
  const semantics = new Map();
  const hyperedges = pending.preview.hyperedges.map(edge => {
    const old = before.get(edge.id);
    semantics.set(edge.id, !old ? "inserted" : stableStringify(old) === stableStringify(edge) ? "unchanged" : "replaced");
    before.delete(edge.id);
    return edge;
  });
  for (const edge of before.values()) { semantics.set(edge.id, "deleted"); hyperedges.push(edge); }
  return { hyperedges, semantics };
}

export const UPDATE_PREVIEW_COLORS = Object.freeze({ unchanged: "#64748b", inserted: "#15803d", deleted: "#be123c", replaced: "#b45309" });
