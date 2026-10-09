import { canonicalizeGraphAuthority, graphFingerprint, stableStringify } from "./graphFingerprint.js";
import { GRAPH_TYPES } from "../candy/contracts/graphTypes.js";

let fallbackIdCounter = 0;

export function createGraphId(prefix = "graph") {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) return `${prefix}-${cryptoApi.randomUUID()}`;
  fallbackIdCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${fallbackIdCounter.toString(36)}`;
}

export function createGraphIdentity(hyperedges = [], previous = null, {
  replace = false,
  clear = false,
  graphType = previous?.graphType ?? GRAPH_TYPES.HYPERGRAPH,
  explicitVertices = previous?.explicitVertices ?? null,
} = {}) {
  const hasGraph = Boolean(hyperedges?.length);
  if (!hasGraph) {
    return {
      graphId: clear ? createGraphId("empty-graph") : (previous?.graphId ?? createGraphId("empty-graph")),
      graphVersion: previous?.graphVersion ?? 0,
      graphFingerprint: graphFingerprint([], { graphType, explicitVertices }),
      graphType,
    };
  }
  const fingerprint = graphFingerprint(hyperedges, { graphType, explicitVertices });
  if (!previous || replace || previous.graphFingerprint !== fingerprint) {
    return {
      graphId: replace || !previous ? createGraphId("graph") : previous.graphId,
      graphVersion: replace || !previous ? 1 : previous.graphVersion + 1,
      graphFingerprint: fingerprint,
      graphType,
    };
  }
  return { ...previous, graphFingerprint: fingerprint, graphType };
}

export function nextCommittedGraphIdentity(previous, hyperedges, {
  replacement = false,
  preserveGraphId = false,
  graphType = previous?.graphType ?? GRAPH_TYPES.HYPERGRAPH,
  explicitVertices = previous?.explicitVertices ?? null,
} = {}) {
  const fingerprint = graphFingerprint(hyperedges, { graphType, explicitVertices });
  // The short fingerprint is a change marker, not content authority. GraphState
  // retains the OLD content, so equal markers must also match that content.
  const sameContent = !Object.hasOwn(previous ?? {}, "hyperedges")
    || stableStringify(canonicalizeGraphAuthority(previous.hyperedges, previous))
      === stableStringify(canonicalizeGraphAuthority(hyperedges, { graphType, explicitVertices }));
  if (!replacement && previous?.graphFingerprint === fingerprint && sameContent) {
    return { ...previous, graphFingerprint: fingerprint, graphType };
  }
  if (!hyperedges?.length) {
    return {
      graphId: preserveGraphId ? previous?.graphId ?? createGraphId("empty-graph") : createGraphId("empty-graph"),
      graphVersion: (previous?.graphVersion ?? 0) + 1,
      graphFingerprint: fingerprint,
      graphType,
    };
  }
  return {
    graphId: replacement ? createGraphId("graph") : previous?.graphId ?? createGraphId("graph"),
    graphVersion: (previous?.graphVersion ?? 0) + 1,
    graphFingerprint: fingerprint,
    graphType,
  };
}
