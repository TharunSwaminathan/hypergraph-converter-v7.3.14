import { applyGraphMutationPlan } from "./graphMutationEngine.js";
import { canonicalizeGraph, stableStringify } from "./graphFingerprint.js";
import { isOwnedGraph } from "./immutableGraph.js";
const countCache = new WeakMap();

export function graphCounts(hyperedges = []) {
  if (isOwnedGraph(hyperedges) && countCache.has(hyperedges)) return countCache.get(hyperedges);
  const vertices = new Set();
  let incidences = 0;
  for (const hyperedge of hyperedges ?? []) {
    incidences += hyperedge.vertices?.length ?? 0;
    for (const vertex of hyperedge.vertices ?? []) vertices.add(String(vertex));
  }
  const result = Object.freeze({
    hyperedges: hyperedges?.length ?? 0,
    vertices: vertices.size,
    incidences,
  });
  if (isOwnedGraph(hyperedges)) countCache.set(hyperedges, result);
  return result;
}

export function previewGraphMutation(baseHyperedges = [], plan, graphIdentity = {}, history = []) {
  const result = applyGraphMutationPlan(baseHyperedges, plan, graphIdentity, history);
  const before = graphCounts(baseHyperedges);
  const after = result.ok ? graphCounts(result.hyperedges) : before;
  return {
    ...result,
    before,
    after,
    delta: {
      hyperedges: after.hyperedges - before.hyperedges,
      vertices: after.vertices - before.vertices,
      incidences: after.incidences - before.incidences,
    },
    graphChanged: result.ok
      ? result.beforeFingerprint !== result.afterFingerprint || result.graphType !== graphIdentity.graphType
        || stableStringify(canonicalizeGraph(baseHyperedges)) !== stableStringify(canonicalizeGraph(result.hyperedges))
      : false,
    operationCount: plan?.operations?.length ?? 0,
    summary: plan?.summary ?? "Graph mutation preview",
  };
}

export function formatMutationSummary(preview) {
  if (!preview?.ok) return `Mutation preview failed: ${(preview?.errors ?? []).join(" ")}`;
  const d = preview.delta;
  const bits = [
    `${preview.operationCount} operation${preview.operationCount === 1 ? "" : "s"}`,
    `${signed(d.hyperedges)} hyperedges`,
    `${signed(d.vertices)} vertices`,
    `${signed(d.incidences)} incidences`,
  ];
  return `${preview.summary}: ${bits.join(", ")}.`;
}

function signed(value) {
  return value >= 0 ? `+${value}` : String(value);
}
