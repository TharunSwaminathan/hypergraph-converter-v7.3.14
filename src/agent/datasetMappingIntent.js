import { analyzeDeterministicNlu } from "./deterministicNlu/deterministicNlu.js";

function lower(text = "") {
  return String(text ?? "").toLowerCase();
}

function exactMentionCount(text, values = []) {
  const normalized = lower(text);
  return values.filter(value => normalized.includes(lower(value))).length;
}

function profiledHeaders(context = {}) {
  return Object.values(context.profiledColumnsByFile ?? {}).flat();
}

const EDIT_VERBS = /\b(set|use|treat|mark|make|join|connect|map|preserve|keep|drop|ignore|split|filter|rename|move|group)\b/i;
const MAPPING_CONCEPTS = /\b(file|table|column|field|key|id|vertex|vertices|node|nodes|hyperedge|hyperedges|membership|incidence|join|relationship|time|timestamp|year|weight|attribute|filter|policy|empty hyperedge|validation|update stream)\b/i;
const ROLE_ASSIGNMENT = /\b(as|using|join(?:ing)?|connect(?:ing)?|preserve|keep|ignore|split)\b/i;
const INTERPRETATION_CUES = /\b(figure out|understand|what role|how (?:do|are).*(?:relate|connect)|describe|these files describe|authors are vertices|papers are hyperedges|connects them|infer roles|explain file roles)\b/i;
const QUESTION_START = /^\s*(what|why|how|which|where|does|do|can)\b/i;
const NOT_MAPPING_ACTIONS = /\b(show graph stats|show stats|export|download|run (?:the )?parser|generate (?:the )?(?:transformation plan|parser)|apply (?:the )?parser result|clear graph|add vertex|remove vertex|rename vertex|add .* to h\d+|parse current|auto-detect|auto detect)\b/i;

export function isDatasetMappingExplanationQuestion(text, context = {}) {
  const q = String(text ?? "");
  if (!QUESTION_START.test(q)) return false;
  if (/what is a hyperedge\??$/i.test(q.trim())) return false;
  const headerMentions = exactMentionCount(q, profiledHeaders(context));
  return MAPPING_CONCEPTS.test(q) || headerMentions > 0;
}

export function isPlausibleDatasetMappingText(text, context = {}) {
  return classifyDatasetMappingIntent(text, context).kind !== "not_mapping";
}

export function classifyDatasetMappingIntent(text = "", context = {}) {
  const raw = String(text ?? "").trim();
  const q = lower(raw);
  const reasons = [];
  if (!raw || !context.hasActiveBatch) {
    return { kind: "not_mapping", confidence: "low", reasons: ["No active upload batch."] };
  }
  if (
    INTERPRETATION_CUES.test(q)
    && !/\b(use|set|make|treat|mark|join|map|preserve|keep|drop|ignore|split|filter|rename|move|group|actually|instead)\b/i.test(raw)
    && !exactMentionCount(raw, context.fileNames ?? [])
    && !exactMentionCount(raw, profiledHeaders(context))
  ) {
    return {
      kind: "interpretation",
      confidence: "medium",
      reasons: ["Dataset interpretation cue detected."],
    };
  }
  const nlu = analyzeDeterministicNlu(raw, {
    datasetMapping: {
      fileNames: context.fileNames ?? [],
      headersByFile: context.profiledColumnsByFile ?? {},
    },
  });
  if (nlu.primaryDomain === "grounded_question") {
    return { kind: "mapping_question", confidence: nlu.confidence.level, reasons: ["Deterministic NLU grounded question."] };
  }
  if (["dataset_mapping", "dataset_grouping"].includes(nlu.primaryDomain) && nlu.confidence.level !== "low") {
    if (nlu.mode === "question") {
      return { kind: "mapping_question", confidence: nlu.confidence.level, reasons: nlu.confidence.reasons };
    }
    if (nlu.mode === "correction" && context.pendingMappingClarification) {
      return { kind: "clarification_answer", confidence: nlu.confidence.level, reasons: ["Deterministic NLU mapping clarification/correction."] };
    }
    return {
      kind: "explicit_patch",
      confidence: nlu.confidence.level,
      reasons: nlu.confidence.reasons.length ? nlu.confidence.reasons : ["Deterministic NLU dataset mapping action."],
    };
  }
  if (context.pendingActionType && context.pendingActionType !== "mapping_clarification") {
    const fileMentions = exactMentionCount(raw, context.fileNames ?? []);
    if ((fileMentions || EDIT_VERBS.test(raw)) && MAPPING_CONCEPTS.test(raw)) {
      return {
        kind: "explicit_patch",
        confidence: "high",
        reasons: ["Mapping edit detected while another action is pending."],
      };
    }
  }
  if (NOT_MAPPING_ACTIONS.test(q)) {
    return { kind: "not_mapping", confidence: "high", reasons: ["Dashboard or graph action, not dataset mapping."] };
  }

  const fileMentions = exactMentionCount(raw, context.fileNames ?? []);
  const headerMentions = exactMentionCount(raw, profiledHeaders(context));
  if (fileMentions) reasons.push("Exact active filename mentioned.");
  if (headerMentions) reasons.push("Exact profiled header mentioned.");
  if (EDIT_VERBS.test(raw)) reasons.push("Mapping edit verb detected.");
  if (MAPPING_CONCEPTS.test(raw)) reasons.push("Mapping concept detected.");
  if (ROLE_ASSIGNMENT.test(raw)) reasons.push("Role/key/join instruction detected.");

  if (QUESTION_START.test(raw) && isDatasetMappingExplanationQuestion(raw, context) && !EDIT_VERBS.test(raw)) {
    return {
      kind: "mapping_question",
      confidence: fileMentions || headerMentions ? "high" : "medium",
      reasons: reasons.length ? reasons : ["Mapping explanation question detected."],
    };
  }

  if (EDIT_VERBS.test(raw) && MAPPING_CONCEPTS.test(raw) && (fileMentions || headerMentions || /\b(as|using|join(?:ing)?|to|empty hyperedge|membership rows)\b/i.test(raw))) {
    return {
      kind: "explicit_patch",
      confidence: fileMentions || headerMentions ? "high" : "medium",
      reasons,
    };
  }

  if (INTERPRETATION_CUES.test(q) || (MAPPING_CONCEPTS.test(raw) && /\b(are|describe|relate|connects?)\b/i.test(raw))) {
    return {
      kind: "interpretation",
      confidence: fileMentions || headerMentions ? "high" : "medium",
      reasons: reasons.length ? reasons : ["Dataset interpretation cue detected."],
    };
  }

  if (context.pendingMappingClarification && (fileMentions || headerMentions || /\b(use|that|this|yes|no)\b/i.test(raw))) {
    return {
      kind: "clarification_answer",
      confidence: "medium",
      reasons: ["Answer to a pending mapping clarification."],
    };
  }

  return {
    kind: "not_mapping",
    confidence: "low",
    reasons: reasons.length ? reasons : ["No dataset mapping cue detected."],
  };
}
