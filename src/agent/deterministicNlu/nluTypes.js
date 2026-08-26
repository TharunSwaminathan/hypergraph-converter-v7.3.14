export const NLU_VERSION = 1;

export const NLU_MODES = Object.freeze([
  "action",
  "question",
  "clarification_answer",
  "correction",
  "cancellation",
  "preview",
  "status_request",
  "mixed",
  "unknown",
]);

export const NLU_DOMAINS = Object.freeze([
  "dataset_grouping",
  "dataset_mapping",
  "parser_workflow",
  "graph_mutation",
  "dashboard_control",
  "conversion_export",
  "grounded_question",
  "runtime_control",
  "unknown",
]);

export const CONFIDENCE_LEVELS = Object.freeze(["low", "medium", "high"]);

export function confidenceLevel(score = 0) {
  if (score >= 0.78) return "high";
  if (score >= 0.48) return "medium";
  return "low";
}

export function createNluResult(rawText = "") {
  return {
    version: NLU_VERSION,
    rawText: String(rawText ?? ""),
    normalizedText: "",
    protectedSpans: [],
    tokens: [],
    clauses: [],
    primaryDomain: "unknown",
    primaryIntent: "unknown",
    mode: "unknown",
    speechAct: "unknown",
    speechActReasons: [],
    domainCandidates: [],
    intentCandidates: [],
    entities: [],
    values: [],
    references: [],
    operations: [],
    negations: [],
    corrections: [],
    ambiguities: [],
    unresolvedReferences: [],
    confidence: {
      score: 0,
      level: "low",
      reasons: [],
    },
    safetyClass: "read_only",
    trace: {
      matchedRuleIds: [],
      resolvedEntityIds: [],
      rejectedCandidates: [],
    },
    limits: {
      truncated: false,
    },
  };
}

export function stableDedupe(values = []) {
  return [...new Set(values.filter(value => value !== null && value !== undefined && value !== ""))];
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
