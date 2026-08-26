export const DEFAULT_GRAPH_HISTORY_LIMIT = 25;

export function createGraphHistoryEvent({
  graphIdentity,
  beforeHyperedges,
  afterHyperedges,
  plan,
  preview,
  source = "manual",
  timestamp = new Date().toISOString(),
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
    beforeHyperedges: clone(beforeHyperedges ?? []),
    afterHyperedges: clone(afterHyperedges ?? []),
    before: preview?.before ?? null,
    after: preview?.after ?? null,
    affected: preview?.affected ?? null,
    warnings: preview?.warnings ?? [],
  };
}

export function appendGraphHistory(history = [], event, limit = DEFAULT_GRAPH_HISTORY_LIMIT) {
  return [...history, event].slice(-Math.max(1, limit));
}

export function latestUndoEvent(history = []) {
  return history.length ? history[history.length - 1] : null;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

