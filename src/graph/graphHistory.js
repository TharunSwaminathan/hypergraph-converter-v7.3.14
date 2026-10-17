import { ownGraph, graphSnapshotBytes } from "./immutableGraph.js";
export const DEFAULT_GRAPH_HISTORY_LIMIT = 25;
export const DEFAULT_GRAPH_HISTORY_BYTES = 32 * 1024 * 1024;

export function createGraphHistoryEvent({
  graphIdentity,
  beforeHyperedges,
  afterHyperedges,
  plan,
  preview,
  source = "manual",
  timestamp = new Date().toISOString(),
  beforeGraphType = graphIdentity?.graphType ?? "Hypergraph",
  afterGraphType = graphIdentity?.graphType ?? "Hypergraph",
}) {
  return {
    id: `history-${graphIdentity?.graphVersion ?? 0}`,
    graphId: graphIdentity?.graphId ?? null,
    graphVersion: graphIdentity?.graphVersion ?? 0,
    timestamp,
    source,
    summary: plan?.summary ?? preview?.summary ?? "Graph mutation",
    planId: plan?.planId ?? null,
    planHash: plan?.planHash ?? null,
    beforeGraphType,
    afterGraphType,
    beforeHyperedges: ownGraph(beforeHyperedges ?? []),
    afterHyperedges: ownGraph(afterHyperedges ?? []),
    before: preview?.before ?? null,
    after: preview?.after ?? null,
    affected: preview?.affected ?? null,
    warnings: preview?.warnings ?? [],
  };
}

export function appendGraphHistory(history = [], event, limit = DEFAULT_GRAPH_HISTORY_LIMIT, byteBudget = DEFAULT_GRAPH_HISTORY_BYTES) {
  const count = Number.isSafeInteger(limit) && limit > 0 ? Math.min(limit, DEFAULT_GRAPH_HISTORY_LIMIT) : DEFAULT_GRAPH_HISTORY_LIMIT;
  const budget = Number.isSafeInteger(byteBudget) && byteBudget >= 0 ? Math.min(byteBudget, DEFAULT_GRAPH_HISTORY_BYTES) : DEFAULT_GRAPH_HISTORY_BYTES;
  const retained = [...history, event].slice(-count);
  while (retained.length && graphHistoryUsage(retained).snapshotBytes > budget) retained.shift();
  return retained;
}

export function graphHistoryUsage(history = []) {
  const snapshots = new Set();
  for (const event of history) { snapshots.add(event.beforeHyperedges); snapshots.add(event.afterHyperedges); }
  return { snapshotCount: snapshots.size, snapshotBytes: [...snapshots].reduce((sum, rows) => sum + graphSnapshotBytes(rows), 0) };
}

export function latestUndoEvent(history = []) {
  return history.length ? history[history.length - 1] : null;
}
