import { GRAPH_TYPES } from "../candy/contracts/graphTypes.js";
import { graphFingerprint } from "./graphFingerprint.js";
import { createGraphIdentity, nextCommittedGraphIdentity } from "./graphIdentity.js";

export const APPLICATION_GRAPH_TYPES = Object.freeze([
  GRAPH_TYPES.HYPERGRAPH,
  GRAPH_TYPES.DYNAMIC_HYPERGRAPH,
]);

const APPLICATION_GRAPH_TYPE_SET = new Set(APPLICATION_GRAPH_TYPES);

export function isApplicationGraphType(graphType) {
  return APPLICATION_GRAPH_TYPE_SET.has(graphType);
}

export function requireApplicationGraphType(graphType) {
  if (!isApplicationGraphType(graphType)) {
    throw new TypeError(`Unsupported application graph type: ${String(graphType)}.`);
  }
  return graphType;
}

export function createGraphState(hyperedges = null, {
  graphType = GRAPH_TYPES.HYPERGRAPH,
  previous = null,
  replacement = false,
  clear = false,
  explicitVertices = null,
} = {}) {
  const authoritativeType = requireApplicationGraphType(graphType);
  const committedHyperedges = normalizeCommittedHyperedges(hyperedges);
  const typeOnlyTransition = Boolean(previous
    && previous.graphType !== authoritativeType
    && previous.graphFingerprint === graphFingerprint(committedHyperedges ?? [], {
      graphType: previous.graphType,
      explicitVertices,
    }));
  const identity = previous
    ? nextCommittedGraphIdentity(previous, committedHyperedges ?? [], {
      replacement: replacement || clear,
      preserveGraphId: typeOnlyTransition,
      graphType: authoritativeType,
      explicitVertices,
    })
    : createGraphIdentity(committedHyperedges ?? [], null, {
      replace: replacement,
      clear,
      graphType: authoritativeType,
      explicitVertices,
    });
  return Object.freeze({
    graphType: authoritativeType,
    graphId: identity.graphId,
    graphVersion: identity.graphVersion,
    graphFingerprint: identity.graphFingerprint,
    hyperedges: committedHyperedges,
    // Scope 5A preserves existing membership-derived vertex behavior. This
    // reserved field lets a later phase add explicit isolates without replacing
    // the graph envelope or its authority model.
    explicitVertices: Array.isArray(explicitVertices) ? [...explicitVertices] : null,
  });
}

export function commitGraphState(previous, hyperedges, {
  graphType,
  replacement = false,
  clear = false,
} = {}) {
  const targetType = graphType ?? (replacement
    ? GRAPH_TYPES.HYPERGRAPH
    : previous?.graphType ?? GRAPH_TYPES.HYPERGRAPH);
  const explicitVertices = replacement ? null : previous?.explicitVertices ?? null;
  return createGraphState(hyperedges, {
    graphType: targetType,
    previous,
    replacement,
    clear,
    explicitVertices,
  });
}

export function graphIdentityFromState(state = {}) {
  return Object.freeze({
    graphId: state.graphId ?? null,
    graphVersion: state.graphVersion ?? 0,
    graphFingerprint: state.graphFingerprint ?? null,
    graphType: state.graphType ?? GRAPH_TYPES.HYPERGRAPH,
  });
}

function normalizeCommittedHyperedges(hyperedges) {
  return Array.isArray(hyperedges) && hyperedges.length ? hyperedges : null;
}
