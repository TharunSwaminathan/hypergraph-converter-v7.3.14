import { buildGraphEntityIndex } from "../graph/entityResolver.js";

export const GRAPH_CONVERSATION_REFERENCE_LIMIT = 5;

export function createGraphConversationReferences(graphId = null) {
  return {
    graphId,
    vertices: [],
    hyperedges: [],
  };
}

function isoNow() {
  return new Date().toISOString();
}

function normalizeId(id) {
  const text = String(id ?? "").trim();
  return text || null;
}

function upsert(list, id, entry, limit) {
  const normalized = normalizeId(id);
  if (!normalized) return list;
  const without = list.filter(item => item.id !== normalized);
  return [{ id: normalized, ...entry }, ...without].slice(0, limit);
}

function currentIds(hyperedges = []) {
  const index = buildGraphEntityIndex(hyperedges);
  return {
    vertices: new Set(index.verticesById.keys()),
    hyperedges: new Set(index.hyperedgesById.keys()),
  };
}

export function pruneGraphConversationReferences(state = createGraphConversationReferences(), {
  graphId = state.graphId,
  hyperedges = [],
  limit = GRAPH_CONVERSATION_REFERENCE_LIMIT,
} = {}) {
  if (state.graphId && graphId && state.graphId !== graphId) return createGraphConversationReferences(graphId);
  const ids = currentIds(hyperedges);
  return {
    graphId: graphId ?? state.graphId ?? null,
    vertices: (state.vertices ?? []).filter(item => ids.vertices.has(item.id)).slice(0, limit),
    hyperedges: (state.hyperedges ?? []).filter(item => ids.hyperedges.has(item.id)).slice(0, limit),
  };
}

export function addVerifiedGraphReferences(state = createGraphConversationReferences(), {
  graphId = state.graphId,
  vertices = [],
  hyperedges = [],
  source = "resolved_plan",
  sourceMessageId = null,
  planId = null,
  at = isoNow(),
  currentHyperedges = [],
  limit = GRAPH_CONVERSATION_REFERENCE_LIMIT,
} = {}) {
  let next = pruneGraphConversationReferences(state, { graphId, hyperedges: currentHyperedges, limit });
  const ids = currentIds(currentHyperedges);
  const entry = { source, sourceMessageId, planId, lastUsedAt: at };
  for (const id of vertices) {
    const normalized = normalizeId(id);
    if (normalized && ids.vertices.has(normalized)) next = { ...next, vertices: upsert(next.vertices, normalized, entry, limit) };
  }
  for (const id of hyperedges) {
    const normalized = normalizeId(id);
    if (normalized && ids.hyperedges.has(normalized)) next = { ...next, hyperedges: upsert(next.hyperedges, normalized, entry, limit) };
  }
  return next;
}

export function referencesFromMutationPlan(plan = null) {
  const vertices = new Set();
  const hyperedges = new Set();
  for (const operation of plan?.operations ?? []) {
    if (operation.vertexId != null) vertices.add(String(operation.vertexId));
    if (operation.newVertexId != null) vertices.add(String(operation.newVertexId));
    if (operation.vertices) for (const vertex of operation.vertices) vertices.add(String(vertex));
    if (operation.hyperedgeId != null) hyperedges.add(String(operation.hyperedgeId));
    if (operation.newHyperedgeId != null) hyperedges.add(String(operation.newHyperedgeId));
  }
  return { vertices: [...vertices], hyperedges: [...hyperedges] };
}

export function recentReferenceContext(state = createGraphConversationReferences()) {
  return {
    vertices: (state.vertices ?? []).map(item => item.id),
    hyperedges: (state.hyperedges ?? []).map(item => item.id),
  };
}
