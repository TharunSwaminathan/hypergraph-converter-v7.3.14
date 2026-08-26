import { graphFingerprint } from "./graphFingerprint.js";

let fallbackIdCounter = 0;

export function createGraphId(prefix = "graph") {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) return `${prefix}-${cryptoApi.randomUUID()}`;
  fallbackIdCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${fallbackIdCounter.toString(36)}`;
}

export function createGraphIdentity(hyperedges = [], previous = null, { replace = false, clear = false } = {}) {
  const hasGraph = Boolean(hyperedges?.length);
  if (!hasGraph) {
    return {
      graphId: clear ? createGraphId("empty-graph") : (previous?.graphId ?? createGraphId("empty-graph")),
      graphVersion: previous?.graphVersion ?? 0,
      graphFingerprint: graphFingerprint([]),
    };
  }
  const fingerprint = graphFingerprint(hyperedges);
  if (!previous || replace || previous.graphFingerprint !== fingerprint) {
    return {
      graphId: replace || !previous ? createGraphId("graph") : previous.graphId,
      graphVersion: replace || !previous ? 1 : previous.graphVersion + 1,
      graphFingerprint: fingerprint,
    };
  }
  return { ...previous, graphFingerprint: fingerprint };
}

export function nextCommittedGraphIdentity(previous, hyperedges, { replacement = false } = {}) {
  const fingerprint = graphFingerprint(hyperedges);
  if (previous?.graphFingerprint === fingerprint) {
    return { ...previous, graphFingerprint: fingerprint };
  }
  if (!hyperedges?.length) {
    return {
      graphId: createGraphId("empty-graph"),
      graphVersion: (previous?.graphVersion ?? 0) + 1,
      graphFingerprint: fingerprint,
    };
  }
  return {
    graphId: replacement ? createGraphId("graph") : previous?.graphId ?? createGraphId("graph"),
    graphVersion: (previous?.graphVersion ?? 0) + 1,
    graphFingerprint: fingerprint,
  };
}
