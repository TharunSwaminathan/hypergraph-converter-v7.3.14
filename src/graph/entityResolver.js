import { graphFingerprint } from "./graphFingerprint.js";

export function buildGraphEntityIndex(hyperedges = []) {
  const hyperedgesById = new Map();
  const verticesById = new Map();
  for (const hyperedge of hyperedges ?? []) {
    hyperedgesById.set(String(hyperedge.id), hyperedge);
    for (const vertex of hyperedge.vertices ?? []) {
      const key = String(vertex);
      if (!verticesById.has(key)) verticesById.set(key, { id: key, hyperedgeIds: [] });
      verticesById.get(key).hyperedgeIds.push(String(hyperedge.id));
    }
  }
  return { hyperedgesById, verticesById };
}

export function selectionFingerprint(selection = null) {
  if (!selection?.type || selection.id == null) return null;
  return graphFingerprint([{ id: `selection-${selection.type}`, vertices: [String(selection.id)], attributes: { version: selection.version ?? 0 } }]);
}

export function resolveHyperedgeReference(reference, hyperedges = [], selection = null, options = {}) {
  return resolveReference(reference, buildGraphEntityIndex(hyperedges).hyperedgesById, selection?.type === "hyperedge" ? selection : null, "hyperedge", options);
}

export function resolveVertexReference(reference, hyperedges = [], selection = null, options = {}) {
  return resolveReference(reference, buildGraphEntityIndex(hyperedges).verticesById, selection?.type === "vertex" ? selection : null, "vertex", options);
}

function resolveReference(reference, map, selection, type, { recentIds = [] } = {}) {
  const text = String(reference ?? "").trim();
  if (!text) return { ok: false, reason: "missing_reference", candidates: [] };
  if (map.has(text)) return { ok: true, id: text, method: "exact" };
  const exactCaseInsensitive = [...map.keys()].filter(id => id.toLowerCase() === text.toLowerCase());
  if (exactCaseInsensitive.length === 1) return { ok: true, id: exactCaseInsensitive[0], method: "case_insensitive" };
  if (exactCaseInsensitive.length > 1) return { ok: false, reason: "ambiguous_reference", candidates: exactCaseInsensitive.map(id => ({ type, id })) };
  const selectedRequested = /^(that|selected|this|it|one|that one|this one|that hyperedge|this hyperedge|selected hyperedge|that vertex|this vertex|selected vertex)$/i.test(text);
  if (selectedRequested && selection?.id != null && map.has(String(selection.id))) {
    return { ok: true, id: String(selection.id), method: "selection", selectionFingerprint: selectionFingerprint(selection) };
  }
  if (/^(that|this|it|one|that one|this one|recent|last)$/i.test(text)) {
    const candidates = [...new Set((recentIds ?? []).map(String).filter(id => map.has(id)))];
    if (candidates.length === 1) return { ok: true, id: candidates[0], method: "recent" };
    if (candidates.length > 1) return { ok: false, reason: "ambiguous_reference", candidates: candidates.map(id => ({ type, id, method: "recent" })) };
  }
  return { ok: false, reason: "no_match", candidates: [] };
}
