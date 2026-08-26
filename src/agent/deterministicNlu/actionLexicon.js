/**
 * Canonical deterministic action vocabulary.
 *
 * Every speech-act, Help, quotation, negation, and pending-control matcher must
 * import this module instead of maintaining a private verb list. Keep the
 * source as words/phrases so consumers can build boundary-safe expressions.
 */
export const ACTION_VERB_FORMS = Object.freeze([
  "abort", "accept", "activate", "add", "advance", "analyze", "analyse", "apply", "approve", "attach", "auto-detect", "auto detect",
  "auto-repair", "auto repair", "build", "call", "cancel", "change", "check", "choose", "clear", "compare", "confirm",
  "connect", "continue", "create", "deduplicate", "de-duplicate", "delete", "describe", "detect", "disable", "discard", "disconnect", "download", "drop", "detach", "edit", "explain",
  "enable", "execute", "exclude", "export", "fail", "filter", "fix", "generate", "go", "group", "ignore",
  "include", "inspect", "join", "belong", "belongs", "keep", "link", "list", "load", "make", "map", "mark", "move", "open",
  "needs", "parse", "prefer", "preserve", "preview", "proceed", "put", "read", "reconnect", "reject", "remove", "replace",
  "rename", "repair", "report", "reset", "retain", "revert", "revise", "run", "select", "send", "separate", "set",
  "show", "skip", "tell", "split", "start", "stop", "switch", "take", "test", "treat", "turn", "undo", "upload",
  "use", "validate", "view", "warn", "swap",
]);

export const PENDING_CANCEL_FORMS = Object.freeze([
  "cancel", "discard", "never mind", "nevermind", "forget that", "cancel pending action", "cancel the pending action",
  "discard pending action", "discard the pending action", "cancel confirmation", "cancel staged action",
]);

export const PENDING_CONFIRM_FORMS = Object.freeze([
  "confirm pending action", "confirm the pending action", "confirm action", "confirm staged action", "proceed", "continue",
]);

export const RUNTIME_STOP_FORMS = Object.freeze([
  "stop", "abort", "stop the current request", "abort the model request", "abort request", "stop active work",
]);

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function phrasePattern(value) {
  return escapeRegExp(value).replace(/\\ /g, "\\s+").replace(/-/g, "[-\\s]?");
}

export const ACTION_VERB_SOURCE = ACTION_VERB_FORMS
  .slice()
  .sort((a, b) => b.length - a.length)
  .map(phrasePattern)
  .join("|");

/**
 * Verbs that distinguish an action-shaped yes/no question from an ordinary
 * informational question in the legacy NLU mode label. This is intentionally
 * narrower than ACTION_VERB_FORMS and remains centralized here so classifiers
 * do not maintain private verb lists.
 */
export const QUESTION_MODE_ACTION_VERB_FORMS = Object.freeze([
  "use", "set", "make", "treat", "mark", "run", "generate", "apply", "remove", "add", "rename", "replace", "revise", "swap",
]);

export const QUESTION_MODE_ACTION_VERB_SOURCE = QUESTION_MODE_ACTION_VERB_FORMS
  .map(phrasePattern)
  .join("|");

export const ACTION_VERB_RE = new RegExp(`\\b(?:${ACTION_VERB_SOURCE})\\b`, "i");
export const ACTION_VERB_AT_START_RE = new RegExp(`^\\s*(?:${ACTION_VERB_SOURCE})\\b`, "i");

export function containsActionVerb(text = "") {
  return ACTION_VERB_RE.test(String(text ?? ""));
}

export function actionVerbSource() {
  return ACTION_VERB_SOURCE;
}
