import { ACTION_VERB_RE, containsActionVerb } from "./actionLexicon.js";
import { analyzeRequestSemantics } from "./requestSemantics.js";

const BASIC_HELP_FRAMES = Object.freeze([
  /^\s*what\s+commands?\b/i,
  /^\s*what\s+syntax\b/i,
  /^\s*what\s+do\s+i\s+say\b/i,
  /^\s*which\s+commands?\b/i,
  /^\s*can\s+(?:the\s+)?(?:deterministic\s+)?(?:chatbot|assistant)\b/i,
  /^\s*does\s+(?:the\s+)?(?:deterministic\s+)?(?:chatbot|assistant)\b/i,
]);

// Backwards-compatible export. The source now comes from one canonical lexicon.
export const ACTION_COMMAND_TOPIC_RE = ACTION_VERB_RE;

export function isHelpSeekingQuestionText(text = "") {
  const raw = String(text ?? "").trim();
  if (!raw) return false;
  const semantics = analyzeRequestSemantics(raw);
  if (semantics.groundedWorkflowGuidance) return false;
  if (semantics.instructional) return true;
  return BASIC_HELP_FRAMES.some(pattern => pattern.test(raw));
}

export function helpSeekingTopic(text = "") {
  const raw = String(text ?? "").trim();
  if (!raw) return "";
  const stripped = raw
    .replace(/[?!.]+$/g, "")
    .replace(/^\s*(?:please\s+|ok(?:ay)?[, ]+\s*|hey[, ]+\s*)*/i, "")
    .replace(/^\s*(?:before\s+doing\s+anything[,;—-]*\s*)/i, "")
    .replace(/^\s*(?:without\s+changing\s+anything[,;—-]*\s*)/i, "")
    .replace(/^\s*(?:i\s+(?:was\s+)?wonder(?:ed|ing)?\s+how\s+(?:to|i|we)\s+)/i, "")
    .replace(/^\s*(?:(?:can|could|would|will)\s+you\s+(?:please\s+)?)?(?:show|tell|explain|describe|teach|guide|help)(?:\s+me)?\s+(?:through\s+)?(?:the\s+)?(?:steps?\s+(?:to|for)|instructions?\s+(?:to|for)|procedure\s+(?:to|for)|syntax\s+(?:to|for)|how\s+(?:to|i|we))\s+/i, "")
    .replace(/^\s*(?:(?:can|could|would|will)\s+)?(?:you\s+)?(?:tell|show|explain|describe)(?:\s+me)?\s+(?:what\s+to\s+type\s+to|how\s+(?:to|i|we))\s+/i, "")
    .replace(/^\s*(?:give\s+me|provide)\s+(?:the\s+)?(?:instructions?|steps?|workflow|procedure|syntax|command(?:s|\s+example)?)\s+(?:for|to|about|on)\s+/i, "")
    .replace(/^\s*(?:i\s+)?(?:want|need|would\s+like)\s+(?:to\s+)?(?:know|learn|understand)\s+how\s+(?:to|i|we)\s+/i, "")
    .replace(/^\s*(?:(?:can|could|would|will)\s+)?(?:you\s+)?walk\s+me\s+through\s+(?:how\s+(?:to|i|we)\s+)?/i, "")
    .replace(/^\s*(?:what|which)\s+(?:is\s+the\s+|are\s+the\s+)?(?:procedure|steps?|workflow|syntax|commands?)\s+(?:for|to|about)\s+/i, "")
    .replace(/^\s*(?:what|which)\s+(?:button|menu|option|command)\s+(?:do\s+i\s+use\s+|lets?\s+me\s+|would\s+I\s+use\s+)?/i, "")
    .replace(/^\s*what\s+(?:do|should|would|can)\s+i\s+type\s+(?:for|to|about)?\s*/i, "")
    .replace(/^\s*where\s+(?:do|should|can|would)\s+i\s+(?:go|click|find)\s+(?:to|for)?\s*/i, "")
    .replace(/^\s*is\s+there\s+(?:a\s+)?way\s+to\s+/i, "")
    .replace(/^\s*how\s+(?:do|can|would|should)\s+i\s+/i, "")
    .replace(/^\s*how\s+would\s+someone\s+/i, "")
    .replace(/^\s*how\s+is\s+it\s+possible\s+to\s+/i, "")
    .replace(/^\s*(?:can|does)\s+(?:the\s+)?(?:deterministic\s+)?(?:chatbot|assistant)\s+/i, "")
    .replace(/^\s*(?:to|for|about)\s+/i, "")
    .trim();
  return stripped || raw;
}

export function helpSeekingMentionsActionCommand(text = "") {
  return isHelpSeekingQuestionText(text) && containsActionVerb(helpSeekingTopic(text));
}
