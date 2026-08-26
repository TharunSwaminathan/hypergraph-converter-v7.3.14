export const CONVERSATION_RECENT_TURN_LIMIT = 16;
export const CONVERSATION_RECENT_KEEP_AFTER_SUMMARY = 8;
export const CONVERSATION_MAX_TURN_CHARS = 1200;
export const CONVERSATION_SUMMARY_TRIGGER_CHARS = 9000;
export const CONVERSATION_MAX_SUMMARY_CHARS = 2000;

export const EMPTY_CONVERSATION_MEMORY = Object.freeze({
  summary: "",
  recentTurns: [],
  activeBatchId: null,
  activeBatchVersion: null,
});

function trimTurn(turn) {
  return {
    role: turn?.role === "user" ? "user" : "agent",
    text: String(turn?.text ?? "").slice(0, CONVERSATION_MAX_TURN_CHARS),
  };
}

export function normalizeConversationMemory(memory = {}) {
  return {
    summary: String(memory.summary ?? "").slice(0, CONVERSATION_MAX_SUMMARY_CHARS),
    recentTurns: Array.isArray(memory.recentTurns)
      ? memory.recentTurns.map(trimTurn).slice(-CONVERSATION_RECENT_TURN_LIMIT)
      : [],
    activeBatchId: memory.activeBatchId ?? null,
    activeBatchVersion: memory.activeBatchVersion ?? null,
  };
}

export function bindConversationMemoryToBatch(memory, activeBatch = null) {
  const current = normalizeConversationMemory(memory);
  const nextBatchId = activeBatch?.id ?? null;
  const nextBatchVersion = activeBatch?.version ?? null;
  if (current.activeBatchId === nextBatchId && current.activeBatchVersion === nextBatchVersion) return current;
  return {
    ...EMPTY_CONVERSATION_MEMORY,
    activeBatchId: nextBatchId,
    activeBatchVersion: nextBatchVersion,
  };
}

export function appendConversationTurns(memory, turns = [], activeBatch = null) {
  const bound = bindConversationMemoryToBatch(memory, activeBatch);
  const recentTurns = [
    ...bound.recentTurns,
    ...turns.map(trimTurn),
  ].slice(-CONVERSATION_RECENT_TURN_LIMIT);
  return { ...bound, recentTurns };
}

export function conversationMemoryCharCount(memory = {}) {
  const normalized = normalizeConversationMemory(memory);
  return normalized.recentTurns.reduce((sum, turn) => sum + turn.text.length, normalized.summary.length);
}

export function shouldSummarizeConversation(memory = {}) {
  const rawTurnCount = Array.isArray(memory.recentTurns) ? memory.recentTurns.length : 0;
  const normalized = normalizeConversationMemory(memory);
  return rawTurnCount >= CONVERSATION_RECENT_TURN_LIMIT
    || conversationMemoryCharCount(normalized) > CONVERSATION_SUMMARY_TRIGGER_CHARS;
}

export function applyConversationSummary(memory = {}, summaryResult = {}, activeBatch = null) {
  const bound = bindConversationMemoryToBatch(memory, activeBatch);
  const decisions = Array.isArray(summaryResult.decisions) ? summaryResult.decisions.filter(Boolean) : [];
  const summary = [
    String(summaryResult.summary ?? bound.summary ?? "").trim(),
    decisions.length ? `Decisions: ${decisions.join("; ")}` : "",
  ].filter(Boolean).join("\n").slice(0, CONVERSATION_MAX_SUMMARY_CHARS);
  return {
    ...bound,
    summary,
    recentTurns: bound.recentTurns.slice(-CONVERSATION_RECENT_KEEP_AFTER_SUMMARY),
  };
}
