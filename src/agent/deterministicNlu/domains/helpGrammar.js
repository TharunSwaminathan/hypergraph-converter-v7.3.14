import { COMMAND_CATEGORIES } from "../commandCatalogSchema.js";
import { helpSeekingTopic, isHelpSeekingQuestionText } from "../helpSeekingGuards.js";

export function compileHelpGrammar(text = "", { nlu = null } = {}) {
  const raw = String(text ?? "").trim();
  const lower = raw.toLowerCase();
  if (!looksLikeHelpQuery(raw)) return { ok: false, noMatch: true };
  const query = classifyHelpQuery(lower, raw);
  return {
    ok: true,
    domain: "help_query",
    intent: query.intent,
    typedKind: "DeterministicHelpQuery",
    query,
    diagnostics: {
      plannerPath: "deterministic_nlu",
      nluDomain: "help_query",
      nluIntent: query.intent,
      nluConfidence: nlu?.confidence,
      nluTrace: {
        matchedRuleIds: [`help.${query.intent.toLowerCase()}`],
        resolvedEntityIds: query.category ? [`category:${query.category}`] : [],
        rejectedCandidates: [],
      },
      operationTypes: [query.intent],
      legacyParserCalled: false,
      modelCalled: false,
      genericActionPlannerCalled: false,
      semanticConfidence: {
        score: 0.94,
        level: "high",
        reasons: ["catalog help query resolved"],
      },
    },
  };
}

export function looksLikeHelpQuery(text = "") {
  const q = String(text ?? "").toLowerCase();
  if (!q.trim()) return false;
  if (isHelpSeekingQuestionText(text)) return true;
  if (/\bwhat commands can i use\b|\bwhat can (?:the )?(?:deterministic )?(?:chatbot|assistant) do\b/.test(q)) return true;
  if (/\bshow\b[\s\S]{0,60}\b(?:commands?|examples?)\b/.test(q)) return true;
  if (/\bwhich commands?\b[\s\S]{0,60}\bconfirmation\b/.test(q)) return true;
  if (/\bshow\b[\s\S]{0,40}\bread[- ]only\b[\s\S]{0,40}\bquestions?\b/.test(q)) return true;
  if (/\bhow do i\b[\s\S]{0,120}\b(?:add|remove|rename|set|use|mark|generate|run|apply|clear|connect|disconnect|reconnect|validate|repair|export|open|undo|cancel|confirm|parse|upload|compare|detect|list|test|show|view|switch|select|move|create|delete|reset|inspect|explain)\b/.test(q)) return true;
  if (/\bhow do quoted identifiers work\b|\bquoted identifiers?\b/.test(q)) return true;
  if (/\bwhy did (?:the )?assistant ask\b[\s\S]{0,60}\bclarification\b|\bhow does ambiguity work\b/.test(q)) return true;
  if (/\bwhat input formats are supported\b|\bsupported input formats\b|\binput formats\b/.test(q)) return true;
  if (/\bcan\b[\s\S]{0,80}\b(?:chatbot|assistant)\b[\s\S]{0,80}\b(?:run|execute)\b[\s\S]{0,40}\b(?:bfs|dfs|dijkstra|algorithm|connected components|k-core)\b/.test(q)) return true;
  if (/\bhow do i\b[\s\S]{0,80}\b(?:bfs|dfs|dijkstra|algorithm|connected components|k-core)\b/.test(q)) return true;
  if (/^\s*what\s+would\s+happen\s+if\s+i\s+(?:clear|delete|remove)\s+(?:the\s+)?current\s+(?:graph|hypergraph)\b/.test(q)) return true;
  return false;
}

function classifyHelpQuery(lower, raw) {
  const topic = helpSeekingTopic(raw);
  if (/\bwhat commands can i use\b|\bwhat can (?:the )?(?:deterministic )?(?:chatbot|assistant) do\b/.test(lower)) {
    return { intent: "SHOW_HELP_OVERVIEW", searchText: raw };
  }
  if (/\bwhich commands?\b[\s\S]{0,60}\bconfirmation\b/.test(lower)) {
    return { intent: "LIST_CONFIRMATION_COMMANDS", searchText: raw };
  }
  if (/\bshow\b[\s\S]{0,40}\bread[- ]only\b[\s\S]{0,40}\bquestions?\b/.test(lower)) {
    return { intent: "LIST_READ_ONLY_COMMANDS", searchText: raw };
  }
  if (/\bquoted identifiers?\b|\bhow do quoted identifiers work\b/.test(lower)) {
    return { intent: "EXPLAIN_QUOTED_IDENTIFIERS", searchText: raw };
  }
  if (/\bclarification\b|\bambiguity\b/.test(lower)) {
    return { intent: "EXPLAIN_AMBIGUITY", searchText: raw };
  }
  if (/\binput formats?\b|\bsupported input formats\b/.test(lower)) {
    return { intent: "LIST_INPUT_FORMATS", searchText: raw };
  }
  if (/\b(?:bfs|dfs|dijkstra|algorithm|connected components|k-core|coreness)\b/.test(lower)) {
    return { intent: "EXPLAIN_PANEL_ONLY_FEATURE", searchText: topic || raw, category: COMMAND_CATEGORIES.ALGORITHMS };
  }
  if (/^\s*what\s+would\s+happen\s+if\s+i\s+(?:clear|delete|remove)\s+(?:the\s+)?current\s+(?:graph|hypergraph)\b/.test(lower)) {
    return { intent: "EXPLAIN_ACTION_COMMAND", searchText: raw, category: COMMAND_CATEGORIES.GRAPH_EDITING };
  }
  if (/\bshow\b[\s\S]{0,60}\b(?:commands?|examples?)\b/.test(lower)) {
    return {
      intent: "LIST_COMMAND_CATEGORY",
      category: categoryFromHelpText(lower),
      searchText: topic || raw,
    };
  }
  if (isHelpSeekingQuestionText(raw)) return { intent: "EXPLAIN_ACTION_COMMAND", searchText: topic || raw };
  if (/\bhow do i\b/.test(lower)) return { intent: "EXPLAIN_COMMAND", searchText: topic || raw };
  return { intent: "FIND_COMMAND", searchText: raw };
}

function categoryFromHelpText(lower) {
  if (/\bgraph|vertex|hyperedge|mutation|edit/.test(lower)) return COMMAND_CATEGORIES.GRAPH_EDITING;
  if (/\bmapping|key|relationship|column|dataset mapping/.test(lower)) return COMMAND_CATEGORIES.DATASET_MAPPING;
  if (/\bgroup|grouping|validation|update|ignore|separate|together/.test(lower)) return COMMAND_CATEGORIES.DATASET_GROUPING;
  if (/\bparser|custom|plan/.test(lower)) return COMMAND_CATEGORIES.CUSTOM_PARSER_WORKFLOW;
  if (/\bdashboard|route|visual|stats|export|diagnostic/.test(lower)) return COMMAND_CATEGORIES.DASHBOARD_NAVIGATION;
  if (/\balgorithm|bfs|dfs|dijkstra|components|k-core/.test(lower)) return COMMAND_CATEGORIES.ALGORITHMS;
  return COMMAND_CATEGORIES.QUESTIONS_EXPLANATIONS;
}
