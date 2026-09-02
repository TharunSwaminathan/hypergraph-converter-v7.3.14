import { ACTION_VERB_RE, ACTION_VERB_SOURCE } from "./actionLexicon.js";
import { isHelpSeekingQuestionText } from "./helpSeekingGuards.js";
import { analyzeRequestSemantics } from "./requestSemantics.js";

const POLITE_REQUEST_RE = new RegExp(`^\\s*(?:(?:go\\s+ahead\\s+and)\\s+)?(?:please\\s+)?(?:can|could|would|will)\\s+you\\s+(?:please\\s+)?(?:${ACTION_VERB_SOURCE})\\b`, "i");
const POLITE_READ_ONLY_OPERATION_RE = /^\s*(?:can|could|would|will)\s+you\s+(?:please\s+)?(?:show|list|view|inspect|report|tell)\b/i;
const DIRECT_READ_ONLY_COMMAND_FRAME_RE = /^\s*(?:please\s+)?(?:show|list|view|inspect|report|tell(?:\s+me)?)\b[\s\S]{0,120}\b(?:status|summary|stats|commands?|help|preview|report)\b/i;
const DIRECT_READ_ONLY_QUESTION_LIST_RE = /^\s*(?:please\s+)?(?:show|list|view)\b[\s\S]{0,60}\bread[-\s]?only\b[\s\S]{0,60}\bquestions?\b/i;
const ACTION_PREAMBLE = "(?:for\\s+(?:the\\s+)?current\\s+(?:task|dataset|graph),?\\s*|go\\s+ahead\\s+and\\s+|i\\s+want\\s+you\\s+to\\s+|please\\s+|now,?\\s*|this\\s+time,?\\s*)?";
const DIRECT_REQUEST_RE = new RegExp(`^\\s*${ACTION_PREAMBLE}(?:${ACTION_VERB_SOURCE})\\b`, "i");
const QUESTION_START_RE = /^\s*(?:what|why|how|which|where|when|who|is|are|does|do|did|can|could|would|will|should|may|might)\b/i;
const CORRECTION_RE = /^\s*(?:actually|no(?:[,;:]|\b)|instead|i meant|rather|change that|not that|scratch that)\b/i;
const STATUS_RE = /\b(?:what (?:is|are) (?:the )?(?:current|active)|where am i|what should i do next|what is ready|status|next step)\b/i;
const EXPLANATION_RE = /^\s*(?:why|how)\b/i;

export const SPEECH_ACTS = Object.freeze([
  "imperative_request",
  "polite_interrogative_request",
  "informational_question",
  "help_seeking_question",
  "hypothetical_question",
  "status_question",
  "explanation_question",
  "reported_command",
  "quoted_command",
  "correction",
  "cancellation",
  "declarative_mapping_statement",
  "declarative_graph_statement",
  "unknown",
]);

export function classifySpeechAct(text = "", { domain = "unknown", mode = "unknown" } = {}) {
  const raw = String(text ?? "").trim();
  const reasons = [];
  if (!raw) return result("unknown", reasons);

  const semantics = analyzeRequestSemantics(raw);

  // A direct plan/parser preparation command may explicitly say not to run the
  // generated artifact. It is still an action to create a reviewable artifact.
  if (semantics.safeWorkflowPreparation) {
    return result("imperative_request", ["explicit safe workflow preparation"]);
  }

  if (semantics.directReadOnlyOperation) {
    if (!semantics.instructional && POLITE_READ_ONLY_OPERATION_RE.test(raw)) return result("polite_interrogative_request", ["second-person polite read-only request"]);
    return result("imperative_request", ["direct read-only operation"]);
  }

  // A directly negated action is cancellation/no-op speech. It remains
  // side-effect safe because the authorization gate cannot dispatch the
  // embedded graph/mapping/parser operation, and pending cancellation is
  // decided separately by the direct-control matcher.
  if (semantics.negatedCancellationCommand && !semantics.instructional) {
    return result("cancellation", semantics.reasons);
  }

  // Read-only scope always wins over embedded action language, correction
  // markers, and control words such as cancel/stop/discard.
  if (semantics.readOnlyScope) {
    if (semantics.groundedWorkflowGuidance) return result("explanation_question", ["grounded workflow guidance question"]);
    if (semantics.hypothetical) return result("hypothetical_question", semantics.reasons);
    if (semantics.reported) return result("reported_command", semantics.reasons);
    if (semantics.quoted) return result("quoted_command", semantics.reasons);
    if (!semantics.instructional && POLITE_READ_ONLY_OPERATION_RE.test(raw)) return result("polite_interrogative_request", ["second-person polite read-only request"]);
    if (DIRECT_READ_ONLY_COMMAND_FRAME_RE.test(raw)) return result("imperative_request", ["direct read-only command with non-execution scope"]);
    if (DIRECT_READ_ONLY_QUESTION_LIST_RE.test(raw)) return result("informational_question", ["read-only command list request"]);
    if (STATUS_RE.test(raw) && (QUESTION_START_RE.test(raw) || /\?$/.test(raw))) return result("status_question", ["status/next-step read-only question"]);
    if (semantics.instructional || isHelpSeekingQuestionText(raw)) return result("help_seeking_question", semantics.reasons);
    if (EXPLANATION_RE.test(raw)) return result("explanation_question", ["why/how read-only question"]);
    if (!(QUESTION_START_RE.test(raw) || /\?$/.test(raw)) && semantics.reasons.includes("action phrase without positive executable clause")) {
      return result("unknown", semantics.reasons);
    }
    return result("informational_question", semantics.reasons);
  }

  if (semantics.directPendingCancellation || semantics.directRuntimeStop) {
    return result("cancellation", ["direct cancellation/control command"]);
  }
  if (semantics.directPendingConfirmation) {
    return result("imperative_request", ["direct confirmation command"]);
  }
  if (CORRECTION_RE.test(raw)) return result("correction", ["correction marker"]);
  if (domain === "legacy_action" && mode === "action") {
    return result("imperative_request", ["exact public action command"]);
  }
  if (isHelpSeekingQuestionText(raw)) return result("help_seeking_question", ["help-seeking instructional command frame"]);
  if (semantics.reported) return result("reported_command", ["reported-speech marker"]);
  if (semantics.quoted && !DIRECT_REQUEST_RE.test(raw)) return result("quoted_command", ["quoted action language"]);
  if (semantics.hypothetical) return result("hypothetical_question", ["hypothetical construction"]);
  if (/^\s*(?:can|could|would|will)\s+you\s+(?:please\s+)?(?:explain|describe)\b/i.test(raw)) {
    return result("informational_question", ["polite explanation request"]);
  }
  if (POLITE_REQUEST_RE.test(raw)) return result("polite_interrogative_request", ["second-person polite request"]);
  if (STATUS_RE.test(raw) && (QUESTION_START_RE.test(raw) || /\?$/.test(raw))) return result("status_question", ["status/next-step question"]);
  if (EXPLANATION_RE.test(raw)) return result("explanation_question", ["why/how question"]);
  if (QUESTION_START_RE.test(raw) || /\?$/.test(raw) || mode === "question" || mode === "status_request") {
    return result("informational_question", ["question form without explicit second-person request"]);
  }
  if (["dataset_mapping", "dataset_grouping"].includes(domain)
      && /^\s*go\s+ahead\s+and\b/i.test(raw)
      && !new RegExp(`^\\s*go\\s+ahead\\s+and\\s+(?:${ACTION_VERB_SOURCE})\\b`, "i").test(raw)) {
    return result("declarative_mapping_statement", ["task-scoped declarative dataset relation"]);
  }
  if (domain === "graph_mutation"
      && /^\s*go\s+ahead\s+and\b/i.test(raw)
      && !new RegExp(`^\\s*go\\s+ahead\\s+and\\s+(?:${ACTION_VERB_SOURCE})\\b`, "i").test(raw)) {
    return result("declarative_graph_statement", ["task-scoped declarative graph edit"]);
  }
  if (DIRECT_REQUEST_RE.test(raw)) return result("imperative_request", ["direct action verb"]);
  if (["dataset_mapping", "dataset_grouping"].includes(domain) && ACTION_VERB_RE.test(raw)) {
    return result("declarative_mapping_statement", ["dataset statement contains an explicit action clause"]);
  }
  if (["dataset_mapping", "dataset_grouping"].includes(domain)
      && /\b(?:is|are|means|defines|represents|tells|supplies|associates|maps|links|connects|belongs|contains)\b/i.test(raw)) {
    return result("declarative_mapping_statement", ["unambiguous dataset relation statement"]);
  }
  if (domain === "graph_mutation" && ACTION_VERB_RE.test(raw)) {
    return result("declarative_graph_statement", ["graph edit statement"]);
  }
  return result("unknown", reasons);
}

export function speechActIsReadOnly(speechAct) {
  return [
    "informational_question",
    "help_seeking_question",
    "hypothetical_question",
    "status_question",
    "explanation_question",
    "reported_command",
    "quoted_command",
  ].includes(speechAct);
}

export function speechActIsActionable(speechAct) {
  return [
    "imperative_request",
    "polite_interrogative_request",
    "declarative_mapping_statement",
    "declarative_graph_statement",
    "correction",
    "cancellation",
  ].includes(speechAct);
}

function result(speechAct, reasons) {
  return { speechAct, reasons };
}
