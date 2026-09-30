import { QUALIFIED_INCREMENTAL_UPDATE_LIMITS as LIMITS } from "./adapters/graphMutationToHypergraphUpdate.js";
import { MOTIF_ALGORITHM, MOTIF_BACKENDS } from "./contracts/runtimeMotif.js";

export const QUALIFIED_MOTIF_LIMITS = Object.freeze({ ...LIMITS, maxPackedBytes: 2 * 1024 * 1024, maxMembershipVisits: 5_000_000 });
const unavailable = (reason, classification, message) => Object.freeze({ ok: false, ready: false, reason, classification, message });

// Only bounded authority fields enter observations, approvals and lookup keys.
export function motifApplicationBinding(graph = {}, pending = null) {
  return Object.freeze({
    graphId: graph.graphId ?? null, graphVersion: graph.graphVersion ?? 0,
    graphFingerprint: graph.graphFingerprint ?? null, graphType: graph.graphType ?? null,
    updateId: pending?.updateId ?? null, revision: pending?.revision ?? null,
    updateDigest: pending?.updateDigest ?? null, proposedGraphFingerprint: pending?.proposedGraphFingerprint ?? null,
    nextGraphVersion: pending?.nextGraphVersion ?? null, pendingStatus: pending?.status ?? null,
    motifImpact: pending?.motifImpact ?? null,
  });
}

export const motifAuthorityKey = binding => JSON.stringify(motifApplicationBinding({
  graphId: binding.graphId, graphVersion: binding.graphVersion,
  graphFingerprint: binding.graphFingerprint, graphType: binding.graphType,
}, binding.updateId == null ? null : { ...binding, status: binding.pendingStatus }));

export function motifGraphBudget(graph) {
  const edges = graph?.hyperedges;
  if (!Array.isArray(edges)) return unavailable("GRAPH_TYPE_UNSUPPORTED", "INVALID_GRAPH_TYPE", "No committed hypergraph is available.");
  if (edges.length > LIMITS.maxHyperedges) return unavailable("GRAPH_LIMIT_EXCEEDED", "RESOURCE_LIMIT", "Qualified motifs support at most 256 hyperedges.");
  let incidences = 0;
  for (const edge of edges) {
    if (!Array.isArray(edge?.vertices)) return unavailable("GRAPH_TYPE_UNSUPPORTED", "INVALID_GRAPH_SCHEMA", "Hyperedge memberships must be arrays.");
    incidences += edge.vertices.length;
    if (incidences > LIMITS.maxIncidences) return unavailable("GRAPH_LIMIT_EXCEEDED", "RESOURCE_LIMIT", "Qualified motifs support at most 100000 incidences.");
  }
  const visits = edges.length < 3 ? 0 : incidences * (edges.length - 1) * (edges.length - 2) / 2;
  if (visits > QUALIFIED_MOTIF_LIMITS.maxMembershipVisits) return unavailable("GRAPH_LIMIT_EXCEEDED", "RESOURCE_LIMIT", "The qualified aggregate membership-work budget is exceeded.");
  return { ok: true, ready: true, incidences, hyperedges: edges.length };
}

export function motifPreflight({ graph, pendingUpdate = null, argumentsValue = {}, runtime = null }) {
  const incremental = argumentsValue.mode === "INCREMENTAL";
  if (!["Hypergraph", "DynamicHypergraph"].includes(graph?.graphType) || incremental && graph.graphType !== "DynamicHypergraph")
    return unavailable("GRAPH_TYPE_UNSUPPORTED", "INVALID_GRAPH_TYPE", "This explicit analysis requires a compatible authoritative hypergraph. No projection is performed.");
  if (incremental) {
    if (pendingUpdate?.status === "STALE") return unavailable("PENDING_UPDATE_STALE", "STALE_GRAPH_VERSION", "The pending update is stale.");
    if (pendingUpdate?.status !== "VALIDATED" || !pendingUpdate.motifUpdate)
      return unavailable("NO_VALIDATED_PENDING_UPDATE", "INVALID_UPDATE_BATCH", "Incremental analysis requires the exact validated pending update.");
    const base = pendingUpdate.baseGraphRef;
    if (base?.graphId !== graph.graphId || base?.graphVersion !== graph.graphVersion
      || pendingUpdate.baseGraphFingerprint !== graph.graphFingerprint || pendingUpdate.graphType !== graph.graphType
      || pendingUpdate.nextGraphVersion !== graph.graphVersion + 1 || pendingUpdate.updateId !== argumentsValue.updateContextId)
      return unavailable("PENDING_UPDATE_STALE", "STALE_GRAPH_VERSION", "The pending transition does not match current graph authority.");
    if (pendingUpdate.motifImpact !== "CHANGED") return unavailable("NO_MOTIF_RELEVANT_CHANGE", "INVALID_UPDATE_BATCH", "This valid update has no motif-relevant change; Apply remains independent.");
    const update = pendingUpdate.motifUpdate;
    if (!Array.isArray(update.deletions) || !Array.isArray(update.insertions)) return unavailable("NO_VALIDATED_PENDING_UPDATE", "INVALID_UPDATE_BATCH", "The qualified update transport is unavailable.");
    if (update.deletions.length > LIMITS.maxDeletions || update.insertions.length > LIMITS.maxInsertions)
      return unavailable("UPDATE_LIMIT_EXCEEDED", "RESOURCE_LIMIT", "The qualified deletion/insertion limit is 256 each.");
    let inserted = 0;
    for (const edge of update.insertions) {
      if (!Array.isArray(edge?.vertices)) return unavailable("NO_VALIDATED_PENDING_UPDATE", "INVALID_UPDATE_BATCH", "Inserted memberships must be arrays.");
      inserted += edge.vertices.length;
      if (inserted > LIMITS.maxInsertedIncidences) return unavailable("UPDATE_LIMIT_EXCEEDED", "RESOURCE_LIMIT", "The qualified inserted-incidence limit is 100000.");
    }
    const proposedBudget = motifGraphBudget({ hyperedges: pendingUpdate.preview?.hyperedges });
    if (!proposedBudget.ok) return proposedBudget;
  }
  const budget = motifGraphBudget(graph);
  if (!budget.ok) return budget;
  if (!Number.isSafeInteger(argumentsValue.timeoutMs) || argumentsValue.timeoutMs < 1 || argumentsValue.timeoutMs > 60000)
    return unavailable("INVALID_TIMEOUT", "RESOURCE_LIMIT", "Timeout must be an integer from 1 to 60000 ms.");
  if (!Object.hasOwn(MOTIF_BACKENDS, argumentsValue.mode) || argumentsValue.backend !== MOTIF_BACKENDS[argumentsValue.mode])
    return unavailable("BACKEND_UNAVAILABLE", "BACKEND_UNAVAILABLE", "The explicit mode requires its exact CUDA backend. No fallback is selected.");
  if (runtime) {
    if (!runtime.featureEnabled || !runtime.authorized || !runtime.runtimeSessionId) return unavailable("RUNTIME_UNAVAILABLE", "BACKEND_UNAVAILABLE", "Discover an authenticated Runtime session first.");
    const capability = runtime.capabilities?.find(cap => cap.algorithm === MOTIF_ALGORITHM && cap.backend === argumentsValue.backend && cap.modes?.includes(argumentsValue.mode) && cap.graphTypes?.includes(graph.graphType));
    if (!capability) return unavailable("BACKEND_UNAVAILABLE", "BACKEND_UNAVAILABLE", "The exact qualified backend is unavailable. No fallback is selected.");
    if (!capability.devices?.some(device => device.id === argumentsValue.deviceId)) return unavailable("DEVICE_UNAVAILABLE", "BACKEND_UNAVAILABLE", "The requested device is not qualified for this backend.");
    return Object.freeze({ ok: true, ready: true, capability, reason: null, message: "Explicit analysis requires a fresh separate confirmation; it never applies the update." });
  }
  return Object.freeze({ ok: true, ready: true, reason: null });
}

export function motifGraphValue(graphState) {
  const budget = motifGraphBudget(graphState);
  if (!budget.ok) throw Object.assign(new Error(budget.message), { code: budget.classification });
  const vertices = new Set(graphState.explicitVertices ?? []);
  // Check a lower bound on artifact bytes before copying memberships. The
  // companion's existing 6MiB limit is rechecked on exact serialized bytes.
  let bytes=0;
  const measure = value => {
    bytes+=new TextEncoder().encode(JSON.stringify(value)).length+1;
    if(bytes>6*1024*1024) throw Object.assign(new Error("Graph exceeds the qualified artifact byte limit."),{code:"RESOURCE_LIMIT"});
  };
  for (const edge of graphState.hyperedges) {
    measure(edge.id);
    for (const vertex of edge.vertices) { measure(vertex); vertices.add(vertex); }
  }
  for (const vertex of vertices) measure(vertex);
  return { schemaVersion: "candy.hypergraph-incidence/1", graphId: graphState.graphId,
    graphVersion: graphState.graphVersion, graphType: graphState.graphType,
    vertices: [...vertices], hyperedges: graphState.hyperedges.map(edge => ({ id: edge.id, vertices: [...edge.vertices] })) };
}
