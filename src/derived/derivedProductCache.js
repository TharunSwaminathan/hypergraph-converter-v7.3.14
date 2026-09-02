import { DERIVED_STATUS } from "../utils/derivedResults.js";

export function createDerivedProductCache() {
  const entries = new Map();
  let activeGraphVersion = null;
  let activeGraphIdentity = null;
  const counters = {
    graphInvalidations: 0,
    hits: 0,
    misses: 0,
    completeWrites: 0,
    refusedWrites: 0,
    contextRejectedWrites: 0,
  };

  function activateGraph(graphVersion, graphIdentity) {
    if (Object.is(activeGraphVersion, graphVersion) && Object.is(activeGraphIdentity, graphIdentity)) return false;
    entries.clear();
    activeGraphVersion = graphVersion;
    activeGraphIdentity = graphIdentity;
    counters.graphInvalidations += 1;
    return true;
  }

  function keyForGraph(graphVersion, operationType, options) {
    return `${String(graphVersion)}|${operationType}|${stableStringify(options ?? {})}`;
  }

  function peek(operationType, options) {
    const key = keyForGraph(activeGraphVersion, operationType, options);
    if (!entries.has(key)) return undefined;
    counters.hits += 1;
    return entries.get(key);
  }

  function setCompleteForGraph(graphVersion, graphIdentity, operationType, options, value) {
    if (!Object.is(graphVersion, activeGraphVersion) || !Object.is(graphIdentity, activeGraphIdentity)) {
      counters.contextRejectedWrites += 1;
      return false;
    }
    if (!isCompleteSuccessfulDerived(value)) {
      counters.refusedWrites += 1;
      return false;
    }
    entries.set(keyForGraph(graphVersion, operationType, options), value);
    counters.completeWrites += 1;
    return true;
  }

  function getOrCompute(operationType, options, compute) {
    const expectedGraphVersion = activeGraphVersion;
    const expectedGraphIdentity = activeGraphIdentity;
    const cached = peek(operationType, options);
    if (cached !== undefined) return cached;
    counters.misses += 1;
    const value = compute();
    setCompleteForGraph(expectedGraphVersion, expectedGraphIdentity, operationType, options, value);
    return value;
  }

  return Object.freeze({
    activateGraph,
    getOrCompute,
    peek,
    setCompleteForGraph,
    clear() { entries.clear(); },
    getSnapshot() {
      return Object.freeze({
        activeGraphVersion,
        entryCount: entries.size,
        ...counters,
      });
    },
  });
}

export function isCompleteSuccessfulDerived(value) {
  if (value == null) return false;
  if (typeof value !== "object" || Array.isArray(value)) return true;
  if (!("status" in value)) return true;
  return value.status === DERIVED_STATUS.COMPUTED;
}

export function stableStringify(value) {
  if (value == null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}
