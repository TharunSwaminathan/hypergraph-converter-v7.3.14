import {
  ACTION_VERB_RE,
  ACTION_VERB_SOURCE,
  PENDING_CANCEL_FORMS,
  PENDING_CONFIRM_FORMS,
  RUNTIME_STOP_FORMS,
} from "./actionLexicon.js";

const ACTION_PREAMBLE_SOURCE = String.raw`(?:for\s+(?:the\s+)?current\s+(?:task|dataset|graph),?\s*|for\s+(?:the\s+)?pending\s+correction,?\s*|for\s+this\s+(?:mapping|dataset|graph|parser)\s+correction,?\s*|go\s+ahead\s+and\s+|i\s+want\s+you\s+to\s+|please\s+|now,?\s*|this\s+time,?\s*)?`;
const DIRECT_ACTION_RE = new RegExp(String.raw`^\s*${ACTION_PREAMBLE_SOURCE}(?:${ACTION_VERB_SOURCE})\b`, "i");
const CORRECTION_ACTION_RE = new RegExp(String.raw`^\s*${ACTION_PREAMBLE_SOURCE}(?:actually|no(?:[,;:]|\b)|instead|i\s+meant|rather|change\s+that|not\s+that|scratch\s+that)\s*,?\s*(?:${ACTION_VERB_SOURCE})\b`, "i");
const POLITE_ACTION_RE = new RegExp(String.raw`^\s*(?:please\s+)?(?:can|could|would|will)\s+you\s+(?:please\s+)?(?:${ACTION_VERB_SOURCE})\b`, "i");
const CONSEQUENT_ACTION_RE = new RegExp(String.raw`\b(?:so|therefore|then)\s+(?:please\s+)?(?:${ACTION_VERB_SOURCE})\b`, "i");
const POLITE_EXPLAIN_RE = /^\s*(?:please\s+)?(?:can|could|would|will)\s+you\s+(?:please\s+)?(?:explain|describe|clarify|tell|show|walk|teach|outline|summarize|summarise|discuss|review)\b/i;
const QUESTION_START_RE = /^\s*(?:what|why|how|which|where|when|who|is|are|does|do|did|can|could|would|will|should|may|might)\b/i;
const DOUBLED_QUESTION_MARK_RE = /\?\?+\s*$/;
const LEADING_CORRECTION_RE = /^\s*(?:actually|no(?:[,;:]|\b)|instead|i\s+meant|rather|change\s+that|not\s+that|scratch\s+that)\b/i;

const INSTRUCTIONAL_PATTERNS = Object.freeze([
  /\b(?:how\s+(?:to|do\s+i|can\s+i|would\s+i|should\s+i|does\s+(?:it|this|the\s+system)|is\s+it\s+possible\s+to))\b/i,
  /\b(?:could|can|would)\s+you\s+(?:please\s+)?(?:tell|show|explain|describe|outline|demonstrate)\s+(?:me\s+)?(?:what\s+to\s+type|how\s+to|the\s+steps?|the\s+procedure|the\s+syntax)\b/i,
  /\b(?:i\s+(?:was\s+)?wonder(?:ed|ing)?\s+how)\b/i,
  /\b(?:i\s+)?wonder(?:ed|ing)?\s+(?:whether|if)\s+it\s+is\s+(?:possible|feasible)\s+to\b/i,
  /\b(?:show|tell|explain|describe|teach|guide)\s+(?:me\s+)?(?:the\s+)?(?:steps?|instructions?|procedure|workflow|syntax|command|how)\b/i,
  /\b(?:give\s+me|provide)\s+(?:the\s+)?(?:steps?|instructions?|procedure|workflow|syntax|command(?:s|\s+example)?)\b/i,
  /\bhelp\s+me\s+(?:understand|learn|figure\s+out)\b/i,
  /\bwalk\s+me\s+through\b/i,
  /\b(?:what|which)\s+(?:are\s+the\s+|is\s+the\s+)?(?:steps?|instructions?|procedure|workflow|syntax|commands?)\b/i,
  /\bwhat\s+(?:do|should|would|can)\s+i\s+type\b/i,
  /\b(?:what|which)\s+(?:button|menu|option|command)\b/i,
  /\bwhere\s+(?:do|should|can|would)\s+i\s+(?:go|click|find)\b/i,
  /\bis\s+there\s+(?:a\s+)?way\s+to\b/i,
  /\b(?:learn|understand)\s+how\s+to\b/i,
  /\bunderstand(?:ing)?\s+the\s+(?:process|steps?|procedure)\s+(?:of|for|behind)\b/i,
  /\b(?:instructions?|steps?|procedure|syntax|walkthrough|documentation)\s+(?:for|to|about|on)\b/i,
  /\b(?:i\s+)?(?:just|only)\s+(?:want\s+to\s+know|need)\s+(?:the\s+)?(?:command|syntax|steps?|procedure)\s*(?::|to|for)\b/i,
  /\bfind\s+help\s+for\b/i,
  /\brequest\s+for\s+information\s+about\b/i,
  /\bi\s+have\s+a\s+(?:question|request)\s+(?:about|for\s+information\s+about)\b/i,
]);

const EXPLICIT_NO_EXECUTION_PATTERNS = Object.freeze([
  /\bread[-\s]?only\b/i,
  /\b(?:informational|information)\s+only\b/i,
  /\b(?:discussion|review|audit|reference|background)\s*,?\s+not\s+(?:execution|an?\s+action|a\s+request|authorization)\b/i,
  /\bnot\s+(?:authori[sz]ing|requesting|asking\s+you\s+to|telling\s+you\s+to|an?\s+request(?:\s+to\s+(?:execute|act|apply|change|modify|run))?|an?\s+instruction|an?\s+action|an?\s+command)\b/i,
  /\bi\s+(?:am|['’]?m)\s+(?:reviewing|auditing|evaluating|considering|studying)\b[\s\S]{0,120}\bnot\s+(?:authori[sz]ing|requesting|executing|asking)\b/i,
  /\bi\s+(?:have\s+not|haven['’]?t)\s+(?:authori[sz]ed|approved|consented\s+to)\b/i,
  /\bbefore\s+i\s+(?:authori[sz]e|approve|decide|consent)\b/i,
  /\bbefore\s+doing\s+anything\b/i,
  /\bpause\s+before\s+(?:doing|executing|running|applying|changing)\b/i,
  /\b(?:do\s+not|don['’]?t|never)\s+(?:act(?:\s+on\s+this)?|alter(?:\s+anything)?|execute|perform|apply|commit|change|modify|run|touch)\b/i,
  /\b(?:without|instead\s+of)\s+(?:doing|executing|performing|applying|committing|changing|modifying|running|editing)\b/i,
  /\b(?:make|perform|apply|commit|take)\s+no\s+(?:changes?|action|mutation|state\s+change)\b/i,
  /\b(?:no\s+execution|no\s+changes?|no\s+mutation|no\s+state\s+change|no\s+edits?)\b/i,
  /\b(?:answer|explain|describe|discuss|review|audit|evaluate|clarify)\s+only\b/i,
  /\b(?:only|just)\s+(?:a\s+)?(?:question|explanation|description|walkthrough|example|information|discussion)\b/i,
  /\b(?:only|just)\s+(?:want|need)\s+(?:an?\s+)?(?:explanation|instructions?|description|information|help|the\s+syntax)\b/i,
  /\b(?:do\s+not|don['’]?t)\s+(?:do\s+it|touch\s+(?:the\s+)?(?:graph|state|mapping|parser|dashboard)|change\s+(?:anything|the\s+graph|the\s+state))\b/i,
  /\b(?:you\s+do\s+not|you\s+don['’]?t)\s+have\s+(?:my\s+)?permission\s+to\b/i,
  /\bwithout\s+(?:my\s+)?consent\b/i,
  /\bconsent(?:\s+is)?\s+missing\b/i,
]);

const PRESERVE_STATE_PATTERNS = Object.freeze([
  /\bpreserve\s+(?:the\s+)?(?:current\s+)?(?:state|graph|mapping|parser|dashboard)\b/i,
  /\bkeep\s+(?:the\s+)?(?:current\s+)?(?:state|graph|mapping|parser|dashboard)\s+(?:exactly\s+)?(?:intact|unchanged|as\s+it\s+is)\b/i,
  /\bkeep\s+state\s+intact\b/i,
  /\bleave\s+everything\s+unchanged\b/i,
  /\banswer\s+only\b[\s\S]{0,80}\bdon['’]?t\s+(?:touch|change|modify)\b/i,
]);

const REPORTED_OR_EXAMPLE_PATTERNS = Object.freeze([
  /\b(?:for\s+(?:training|documentation|educational|example|reference)\s+purposes?|as\s+an?\s+example|reference\s+example)\b/i,
  /\b(?:example|sample)\s+command\b/i,
  /\b(?:the\s+)?(?:guide|documentation|docs?|manual|message|report|text|example|note|file|command|instruction)\s+(?:says|said|tells|contains|includes|shows|uses|is)\b/i,
  /\bquoted\s+from\s+documentation\b/i,
  /\b(?:i\s+am|i['’]?m)\s+quoting\b/i,
  /\b(?:you|it)\s+said\b/i,
  /\bi\s+(?:previously|already|earlier)\s+(?:asked|said|told)\b/i,
  /\bparaphrase\s+what\s+(?:the\s+)?(?:instruction|sentence|text|command)\b/i,
  /\bidentify\s+the\s+action\s+represented\s+by\b/i,
  /\bthis\s+(?:is|was)\s+(?:documentation|reference|an?\s+example|sample|a\s+note|quoted\s+text)\b/i,
]);

const HYPOTHETICAL_PATTERNS = Object.freeze([
  /\bhypothetical(?:ly|\s+future)?\b/i,
  /\bif\s+i\s+(?:wanted|were|was|might|decided|needed)\s+to\b/i,
  /\bif\s+someone\s+(?:wanted|were|was|needed)\s+to\b/i,
  /\bsuppose\s+(?:i|someone|we)\b/i,
  /\bimagine\s+(?:i|someone|we)\b/i,
  /\bhow\s+would\s+someone\b/i,
  /\bwhat\s+(?:(?:would|could)\s+happen|happens)\s+if\b/i,
  /\bwhat\s+would\s+(?:someone|i|we|you)\b[\s\S]{0,160}\bdo\b/i,
  /\btell\s+me\s+what\s+(?:someone|i|we|you)\b[\s\S]{0,160}\bwould\s+do\b/i,
  /\bstale\b[\s\S]{0,80}\breference\b[\s\S]{0,60}\b(?:cannot|can['’]?t|not)\s+be\s+used\b/i,
  /^\s*would\s+(?!you\b)[\s\S]{0,100}\b(?:be|work|make|help|change)\b/i,
  /^\s*(?:can|could)\s+(?!you\b)[\s\S]{0,100}\bbe\s+used\b/i,
  /\bwhat\s+command\s+would\s+(?:cause|make|tell)\b/i,
  /\bi\s+(?:may|might|will)\s+[\s\S]{0,120}\blater\b/i,
  /\bhow\s+would\s+(?:i|we|you|the\s+app)\b/i,
]);

const EXPLANATORY_PATTERNS = Object.freeze([
  /^\s*(?:please\s+)?(?:explain|describe|define|summarize|summarise|paraphrase|clarify|interpret|translate|discuss|review|audit|evaluate)\b/i,
  /^\s*(?:please\s+)?(?:tell\s+me\s+about|talk\s+me\s+through|walk\s+me\s+through|give\s+me\s+background\s+on|provide\s+background\s+on|learn\s+about)\b/i,
  /^\s*(?:wait[.!]\s*)?tell\s+me\s+what\b[\s\S]{0,180}\bwould\s+do\b/i,
  /^\s*tell\s+me\s+the\s+consequences\s+before\s+i\b/i,
  /^\s*(?:i\s+(?:am|['’]?m)\s+)?curious\s+(?:about|what|whether|if)\b/i,
  /^\s*(?:what\s+does|what\s+would|what\s+happens\s+if|how\s+would|is\s+.+\s+possible\b|could\s+you\s+explain|can\s+you\s+explain)\b/i,
  /\b(?:meaning|consequences|background|idea|concept|syntax|steps?|instructions?|procedure|workflow|how\s+to)\s+of\b/i,
]);

const COMPARE_RE = /\bcompare\b[\s\S]{0,120}\b(?:with|to|against)\s+doing\s+nothing\b/i;
const NEGATED_ACTION_RE = new RegExp(String.raw`^\s*(?:please\s+)?(?:do\s+not|don['’]?t|never)\s+(?:${ACTION_VERB_SOURCE})\b`, "i");
const DIRECT_MAPPING_RELATION_RE = /(?:^\s*[A-Za-z0-9_.:-]+\.[A-Za-z0-9_.:-]+\s+(?:maps|links|connects|joins|belongs)\s+(?:to|with)\s+[A-Za-z0-9_.:-]+\.[A-Za-z0-9_.:-]+\b|^\s*[A-Za-z0-9_.:-]+\.csv\s+(?:is|are|means|defines|represents|supplies|contains)\b|^\s*[A-Za-z0-9_.:-]+\s+(?:is|as|for)\s+(?:the\s+)?(?:key|id|identifier|time|timestamp|year)\b)/i;
const DIRECT_MAPPING_DECLARATION_RE = /(?:^\s*[A-Za-z][A-Za-z0-9_.:-]{0,80}\s+(?:is|are)\s+(?:the\s+)?(?:vertex|vertices|node|nodes|hyperedge|hyperedges|edge|edges|incidence|incidences|membership|memberships|source|sources|target|targets|relation|relations|connector|connectors)\b|^\s*[A-Za-z][A-Za-z0-9_.:-]{0,80}\s+(?:connects?|links?|joins|maps|relates)\s+(?:them|vertices?|nodes?|hyperedges?|edges?|[A-Za-z][A-Za-z0-9_.:-]{0,80})\b|^\s*[A-Za-z][A-Za-z0-9_.:-]{0,80}\s+(?:tells?|shows?|indicates|defines|describes)\s+(?:which|how)\b[\s\S]{0,120}\b(?:belong|belongs|connects?|links?|joins|maps|relates)\s+(?:to|with)\b)/i;
const DIRECT_GROUPING_DECLARATION_RE = /(?:^\s*(?:the\s+)?first\s+(?:two|2)\b[\s\S]{0,120}\bbelong\s+together\b|^\s*[A-Za-z0-9_.:-]+\.(?:csv|tsv|json|txt)\s+(?:is|are)\s+validation[-\s]?only\b|\bvalidation[-\s]?only\b[\s\S]{0,80}\b(?:expected|ground\s+truth|gold|reference)\b)/i;
const DIRECT_GRAPH_RELATION_RE = /\b(?:needs|should\s+(?:also\s+)?(?:include|contain|have|no\s+longer)|belongs\s+to|is\s+part\s+of)\b/i;

const QUOTED_ACTION_RE = new RegExp(
  String.raw`(?:"[^"\n]*\b(?:${ACTION_VERB_SOURCE})\b\s+[^"\n]+"|'[^'\n]*\b(?:${ACTION_VERB_SOURCE})\b\s+[^'\n]+'|[“][^”\n]*\b(?:${ACTION_VERB_SOURCE})\b\s+[^”\n]+[”]|[‘][^’\n]*\b(?:${ACTION_VERB_SOURCE})\b\s+[^’\n]+[’])`,
  "i",
);
const CODE_QUOTED_ACTION_RE = new RegExp(
  String.raw`(?:\`[^\`\n]*\b(?:${ACTION_VERB_SOURCE})\b\s+[^\`\n]*\`|\`\`\`[\s\S]*?\b(?:${ACTION_VERB_SOURCE})\b[\s\S]*?\`\`\`)`,
  "i",
);
const ANY_QUOTED_SPAN_RE = /"[^"\n]+"|'[^'\n]{2,}'|[“][^”\n]+[”]|[‘][^’\n]{2,}[’]/;
const QUOTE_EXPLAIN_VERB_RE = /\b(?:explain|identify|paraphrase|define|describe|interpret|translate|clarify|review|audit|evaluate)\b/i;

export function analyzeRequestSemantics(text = "") {
  const raw = String(text ?? "").trim();
  if (!raw) return emptySemantics();

  const safeWorkflowPreparation = isSafeWorkflowPreparation(raw);
  const clauses = splitRequestClauses(raw);
  const actionMentioned = ACTION_VERB_RE.test(raw);
  const directRuntimeExplainAction = /^\s*(?:please\s+)?(?:explain|analy[sz]e)\s+file\s+roles?\s+with\s+local\s+model\s*[.!]?$/i.test(raw);
  const directReadOnlyOperation = isDirectReadOnlyOperation(raw);
  const explicitReadOnly = !safeWorkflowPreparation && hasAny(raw, EXPLICIT_NO_EXECUTION_PATTERNS);
  const preserveState = !safeWorkflowPreparation && hasAny(raw, PRESERVE_STATE_PATTERNS);
  const instructional = !safeWorkflowPreparation && hasAny(raw, INSTRUCTIONAL_PATTERNS) && !directReadOnlyOperation;
  const reported = !safeWorkflowPreparation && hasAny(raw, REPORTED_OR_EXAMPLE_PATTERNS);
  const hypothetical = !safeWorkflowPreparation && hasAny(raw, HYPOTHETICAL_PATTERNS);
  const quoted = QUOTED_ACTION_RE.test(raw)
    || CODE_QUOTED_ACTION_RE.test(raw)
    || (ANY_QUOTED_SPAN_RE.test(raw) && QUOTE_EXPLAIN_VERB_RE.test(raw));
  const bareImperativeQuestion = isBareImperativeQuestion(raw);
  const rawExplanatory = !directRuntimeExplainAction && !safeWorkflowPreparation && hasAny(raw, EXPLANATORY_PATTERNS);
  const compare = COMPARE_RE.test(raw);
  const correction = LEADING_CORRECTION_RE.test(raw);
  const negatedCancellationCommand = /^\s*(?:please\s+)?(?:(?:do\s+not|don['’]?t|never)\s+(?:set|use|remove|delete|add|clear|rename|run|execute|apply|generate|open|switch|export|download)\b|(?:do\s+not|don['’]?t)\s+continue\b)/i.test(raw);
  const globalNoActionScope = explicitReadOnly || preserveState || reported || compare;

  const analyzedClauses = clauses.map((clause, index) => analyzeClause(clause, {
    index,
    raw,
    safeWorkflowPreparation,
    globalNoActionScope,
    directReadOnlyOperation,
    directRuntimeExplainAction,
  }));
  const executableClauses = analyzedClauses.filter(clause => clause.executable);
  const readOnlyActionClauses = analyzedClauses.filter(clause => clause.actionCandidate && !clause.executable);
  const negatedAction = analyzedClauses.some(clause => clause.scopes.negation);
  const explanatoryAction = rawExplanatory
    || analyzedClauses.some(clause => clause.scopes.explanatory && (clause.actionCandidate || actionMentioned));
  const ambiguousAction = actionMentioned && !executableClauses.length && !directReadOnlyOperation;

  const readOnlyScope = !safeWorkflowPreparation && (
    explicitReadOnly
    || preserveState
    || instructional
    || reported
    || hypothetical
    || compare
    || (negatedAction && executableClauses.length === 0)
    || explanatoryAction
    || bareImperativeQuestion
    || quoted && (rawExplanatory || reported || QUESTION_START_RE.test(raw) || /\bnot\s+(?:a\s+)?request\b/i.test(raw))
    || (readOnlyActionClauses.length > 0 && executableClauses.length === 0)
  );

  const executionAuthorized = Boolean(
    safeWorkflowPreparation
    || (executableClauses.length > 0 && !readOnlyScope && !globalNoActionScope && !bareImperativeQuestion)
    || (directReadOnlyOperation && !readOnlyScope)
  );
  const finalExecutableClauses = executionAuthorized ? executableClauses : [];

  let requestedResponse = "execute";
  if (instructional) requestedResponse = "instructions";
  else if (explicitReadOnly || preserveState || explanatoryAction || compare) requestedResponse = "explain";
  else if (hypothetical) requestedResponse = "hypothetical_explanation";
  else if (reported || quoted) requestedResponse = "reported_explanation";
  else if (negatedAction) requestedResponse = "no_action";
  else if (bareImperativeQuestion || ambiguousAction) requestedResponse = "clarify";
  else if (QUESTION_START_RE.test(raw) || /\?$/.test(raw)) requestedResponse = "answer";

  const mode = executionAuthorized ? "execute" : (bareImperativeQuestion || ambiguousAction ? "clarify" : "read_only");
  const scopes = {
    quoted,
    codeQuoted: CODE_QUOTED_ACTION_RE.test(raw),
    reported,
    hypothetical,
    explanatory: explanatoryAction,
    instructional,
    syntaxRequest: /\bsyntax\b/i.test(raw),
    previewOnly: /\bpreview\s+only\b/i.test(raw),
    comparison: compare,
    explicitNoExecution: explicitReadOnly,
    preserveState,
    permissionDenied: /\b(?:do\s+not|don['’]?t)\s+have\s+(?:my\s+)?permission\b/i.test(raw),
    consentDenied: /\b(?:not\s+consented|without\s+(?:my\s+)?consent)\b/i.test(raw),
    deferredAction: hypothetical || /\bbefore\s+i\s+(?:authori[sz]e|approve|decide|consent)\b/i.test(raw),
  };

  return {
    raw,
    mode,
    executionAuthorized,
    stateChangingActionAuthorized: finalExecutableClauses.length > 0,
    authorizedActionClauses: finalExecutableClauses.map(clause => clause.id),
    authorizedActionText: finalExecutableClauses.map(clause => clause.text).join("; "),
    authorizedPendingCorrection: finalExecutableClauses.some(clause => clause.scopes.pendingTarget && clause.scopes.typedCorrection),
    clauses: analyzedClauses,
    actionMentioned,
    instructional,
    groundedWorkflowGuidance: /^\s*how\s+should\s+i\s+proceed\b[\s\S]{0,100}\b(?:parser|mapping|grouping)\s+workflow\b/i.test(raw),
    explicitReadOnly,
    reported,
    hypothetical,
    quoted,
    negatedAction,
    negatedCancellationCommand,
    explanatoryAction,
    bareImperativeQuestion,
    safeWorkflowPreparation,
    directReadOnlyOperation,
    directRuntimeExplainAction,
    correction,
    readOnlyScope,
    requestedResponse,
    directPendingCancellation: isDirectPendingCancellation(raw),
    directPendingConfirmation: isDirectPendingConfirmation(raw),
    directRuntimeStop: isDirectRuntimeStop(raw),
    reasons: [
      instructional && "instructional response requested",
      explicitReadOnly && "explicit non-execution scope",
      preserveState && "preserve-state scope",
      reported && "reported/example scope",
      hypothetical && "hypothetical scope",
      quoted && "quoted action text",
      negatedAction && "negated action",
      explanatoryAction && "explanatory action request",
      bareImperativeQuestion && "bare imperative posed as a question",
      ambiguousAction && "action phrase without positive executable clause",
    ].filter(Boolean),
    scopes,
  };
}

export function isReadOnlyRequest(text = "") {
  return analyzeRequestSemantics(text).readOnlyScope;
}

export function isInstructionalRequest(text = "") {
  const semantics = analyzeRequestSemantics(text);
  return semantics.instructional || semantics.explicitReadOnly || semantics.explanatoryAction;
}

export function isDirectPendingCancellation(text = "") {
  const normalized = normalizeControl(text);
  if (!normalized) return false;
  if (PENDING_CANCEL_FORMS.includes(normalized)) return true;
  return /^(?:please\s+)?(?:cancel|discard)\s+(?:this|that|the|current|pending|staged)?\s*(?:action|confirmation|preview|request)?$/.test(normalized)
    || /^(?:please\s+)?(?:never\s*mind|nevermind|forget\s+that)$/.test(normalized);
}

export function isDirectPendingConfirmation(text = "") {
  const normalized = normalizeControl(text);
  if (!normalized) return false;
  if (PENDING_CONFIRM_FORMS.includes(normalized)) return true;
  return /^(?:please\s+)?(?:confirm|approve|proceed|continue)(?:\s+(?:this|that|the|current|pending|staged))?(?:\s+(?:action|confirmation|preview|request))?$/.test(normalized);
}

export function isDirectRuntimeStop(text = "") {
  const normalized = normalizeControl(text);
  if (!normalized) return false;
  if (RUNTIME_STOP_FORMS.includes(normalized)) return true;
  return /^(?:please\s+)?(?:stop|abort)(?:\s+(?:this|that|the|current|active))?(?:\s+(?:request|model|runtime|assistant|work|generation|task))?$/.test(normalized);
}

function analyzeClause(clause, {
  index = 0,
  raw = "",
  safeWorkflowPreparation = false,
  globalNoActionScope = false,
  directReadOnlyOperation = false,
  directRuntimeExplainAction = false,
} = {}) {
  const text = clause.text;
  const actionCandidate = ACTION_VERB_RE.test(text);
  const directControl = isDirectPendingCancellation(text) || isDirectPendingConfirmation(text) || isDirectRuntimeStop(text);
  const startsAsDirectAction = POLITE_ACTION_RE.test(text) || DIRECT_ACTION_RE.test(text) || CORRECTION_ACTION_RE.test(text) || CONSEQUENT_ACTION_RE.test(text);
  const scopes = {
    quoted: QUOTED_ACTION_RE.test(text) || (ANY_QUOTED_SPAN_RE.test(text) && QUOTE_EXPLAIN_VERB_RE.test(text)),
    codeQuoted: CODE_QUOTED_ACTION_RE.test(text),
    reported: clause.connectorFromPrevious === "reported_by_colon" || hasAny(text, REPORTED_OR_EXAMPLE_PATTERNS),
    hypothetical: hasAny(text, HYPOTHETICAL_PATTERNS),
    explanatory: !directRuntimeExplainAction && hasAny(text, EXPLANATORY_PATTERNS),
    instructional: hasAny(text, INSTRUCTIONAL_PATTERNS),
    reviewOnly: /\b(?:review|audit|evaluate|consider|study|curious)\b/i.test(text) && !DIRECT_ACTION_RE.test(text),
    comparison: COMPARE_RE.test(text),
    preserveState: hasAny(text, PRESERVE_STATE_PATTERNS),
    explicitNoAction: hasAny(text, EXPLICIT_NO_EXECUTION_PATTERNS),
    permissionDenied: /\b(?:do\s+not|don['’]?t)\s+have\s+(?:my\s+)?permission\b/i.test(text),
    consentDenied: /\b(?:not\s+consented|without\s+(?:my\s+)?consent)\b/i.test(text),
    deferred: /\bbefore\s+i\s+(?:authori[sz]e|approve|decide|consent)\b|\blater\b/i.test(text),
    negation: NEGATED_ACTION_RE.test(text),
    pendingTarget: /\bpending\b/i.test(text),
    typedCorrection: /\b(?:change|replace|revise|use|set|swap|instead\s+of|from\s+.+\s+to)\b/i.test(text),
  };
  const explanatoryControl = POLITE_EXPLAIN_RE.test(text) || scopes.explanatory || scopes.instructional;
  const directAction = safeWorkflowPreparation
    || directControl
    || (!explanatoryControl && startsAsDirectAction)
    || (!explanatoryControl && !QUESTION_START_RE.test(text) && (
      DIRECT_GRAPH_RELATION_RE.test(text)
      || isDirectMappingDeclaration(text)
      || isDirectGroupingDeclaration(text)
    ));
  const quotedBlocksExecution = scopes.codeQuoted || (scopes.quoted && !startsAsDirectAction);
  const blockByScope = globalNoActionScope
    || quotedBlocksExecution
    || scopes.reported
    || scopes.hypothetical
    || scopes.explanatory
    || scopes.instructional
    || scopes.reviewOnly
    || scopes.comparison
    || scopes.preserveState
    || (!safeWorkflowPreparation && scopes.explicitNoAction)
    || scopes.permissionDenied
    || scopes.consentDenied
    || scopes.deferred
    || (!safeWorkflowPreparation && scopes.negation);
  const executable = Boolean(
    (directReadOnlyOperation || directAction)
    && !blockByScope
    && !(isBareImperativeQuestion(raw) && index === 0)
  );

  return {
    ...clause,
    role: roleForClause({ executable, directAction, actionCandidate, scopes }),
    actionCandidate,
    requestedAction: executable ? extractActionVerb(text) : null,
    executable,
    executionAuthorized: executable,
    scopes,
  };
}

function splitRequestClauses(raw) {
  const spans = protectedSpans(raw);
  const clauses = [];
  let start = 0;
  let connectorFromPrevious = null;
  const push = end => {
    const text = raw.slice(start, end).trim();
    if (text) {
      clauses.push({
        id: `clause-${clauses.length + 1}`,
        text,
        charStart: start,
        charEnd: end,
        tokenStart: null,
        tokenEnd: null,
        connectorFromPrevious,
        polarity: /\b(?:do\s+not|don['’]?t|cannot|can't|not|never|without)\b/i.test(text) ? "negative" : "positive",
        scopeHints: [],
        inheritedSubject: null,
      });
      connectorFromPrevious = null;
    }
  };
  for (let i = 0; i < raw.length; i += 1) {
    if (insideSpans(i, spans)) continue;
    const ch = raw[i];
    if (ch === ":" && shouldSplitAtColon(raw.slice(start, i))) {
      push(i);
      connectorFromPrevious = "reported_by_colon";
      start = i + 1;
      continue;
    }
    if ((ch === "." || ch === "!" || ch === "?") && !isSentenceEndingPunctuation(raw, i)) continue;
    if (ch === "\n" || ch === ";" || ch === "." || ch === "!" || ch === "?") {
      push(i);
      connectorFromPrevious = ch === "\n" ? "newline" : ch === ";" ? "semicolon" : "sentence";
      start = i + 1;
    }
  }
  push(raw.length);
  return clauses.length ? clauses.slice(0, 40) : [{
    id: "clause-1",
    text: raw,
    charStart: 0,
    charEnd: raw.length,
    tokenStart: null,
    tokenEnd: null,
    connectorFromPrevious: null,
    polarity: /\b(?:do\s+not|don['’]?t|cannot|can't|not|never|without)\b/i.test(raw) ? "negative" : "positive",
    scopeHints: [],
    inheritedSubject: null,
  }];
}

function protectedSpans(text) {
  const spans = [];
  addRegexSpans(spans, text, /```[\s\S]*?```/g, "code");
  addRegexSpans(spans, text, /`[^`\n]*`/g, "code");
  addRegexSpans(spans, text, /"[^"\n]*"/g, "quote");
  addRegexSpans(spans, text, /[“][^”\n]*[”]/g, "quote");
  addRegexSpans(spans, text, /[‘][^’\n]*[’]/g, "quote");
  addRegexSpans(spans, text, /'[^'\n]{2,}'/g, "quote");
  return spans.sort((a, b) => a.start - b.start);
}

function addRegexSpans(spans, text, regex, type) {
  let match = regex.exec(text);
  while (match) {
    spans.push({ start: match.index, end: match.index + match[0].length, type });
    match = regex.exec(text);
  }
}

function insideSpans(index, spans) {
  return spans.some(span => index >= span.start && index < span.end);
}

function shouldSplitAtColon(prefix) {
  return /\b(?:explain|describe|clarify|review|audit|evaluate|background|meaning|question|documentation|docs?|manual|command|example|sample|reference|read[-\s]?only|no\s+execution|no\s+changes?|not\s+authori[sz]ing|not\s+requesting|not\s+a\s+request)\b/i.test(prefix);
}

function isSentenceEndingPunctuation(text, index) {
  const ch = text[index];
  if (ch === "." && /[A-Za-z0-9_]/.test(text[index - 1] ?? "") && /[A-Za-z0-9_]/.test(text[index + 1] ?? "")) return false;
  const next = text[index + 1] ?? "";
  return !next || /\s|["'”’)\]]/.test(next);
}

function isBareImperativeQuestion(raw) {
  const directDeclarative = DIRECT_GRAPH_RELATION_RE.test(raw) || isDirectMappingDeclaration(raw) || isDirectGroupingDeclaration(raw);
  return ((/\?\s*$/.test(raw) && (!QUESTION_START_RE.test(raw) || /^\s*(?:please\s+)?(?:do\s+not|don['’]?t|never)\b/i.test(raw)) && ACTION_VERB_RE.test(raw))
    || (/\?\s*$/.test(raw) && !QUESTION_START_RE.test(raw) && directDeclarative)
    || (DOUBLED_QUESTION_MARK_RE.test(raw) && (ACTION_VERB_RE.test(raw) || directDeclarative)));
}

function isSafeWorkflowPreparation(raw) {
  const directPositiveWorkflowPreparation = new RegExp(String.raw`^\s*${ACTION_PREAMBLE_SOURCE}(?:generate|create|build)\b[\s\S]{0,120}\b(?:transformation\s+plan|plan|parser)\b[\s\S]{0,100}\b(?:do\s+not|don['’]?t)\s+(?:run|execute|apply)\b`, "i").test(raw);
  const directShowPlanPreparation = /^\s*(?:please\s+)?(?:do\s+not|don['’]?t)\s+run\s+(?:it|the\s+parser)?\s*[;,.—-]+\s*(?:just\s+)?show\b[\s\S]{0,80}\b(?:transformation\s+plan|plan)\b/i.test(raw);
  return (directPositiveWorkflowPreparation || directShowPlanPreparation)
    && !hasAny(raw, REPORTED_OR_EXAMPLE_PATTERNS)
    && !hasAny(raw, HYPOTHETICAL_PATTERNS)
    && !QUOTED_ACTION_RE.test(raw)
    && !isBareImperativeQuestion(raw)
    && !/\b(?:explain|describe|instructions?|steps?|syntax|how\s+to|what\s+to\s+type)\b/i.test(raw);
}

function isDirectReadOnlyOperation(raw) {
  return /^\s*(?:please\s+)?(?:show|list|view|inspect|report|tell(?:\s+me)?)\b[\s\S]{0,100}\b(?:status|summary|stats|commands?|help|preview)\b/i.test(raw)
    && !hasAny(raw, INSTRUCTIONAL_PATTERNS)
    && !hasAny(raw, REPORTED_OR_EXAMPLE_PATTERNS)
    && !hasAny(raw, HYPOTHETICAL_PATTERNS)
    && !hasAny(raw, EXPLICIT_NO_EXECUTION_PATTERNS)
    && !isBareImperativeQuestion(raw);
}

function isDirectMappingDeclaration(text) {
  const raw = String(text ?? "")
    .trim()
    .replace(/^\s*(?:please\s+|for\s+(?:the\s+)?current\s+(?:task|dataset|graph),?\s*|for\s+(?:the\s+)?pending\s+correction,?\s*|for\s+this\s+(?:mapping|dataset|graph|parser)\s+correction,?\s*|go\s+ahead\s+and\s+|i\s+want\s+you\s+to\s+|now,?\s*|this\s+time,?\s*)/i, "")
    .trim();
  if (!raw) return false;
  if (QUESTION_START_RE.test(raw)) return false;
  if (/^\s*(?:if|when|whether|unless|maybe|perhaps|suppose|imagine)\b/i.test(raw)) return false;
  return DIRECT_MAPPING_RELATION_RE.test(raw) || DIRECT_MAPPING_DECLARATION_RE.test(raw);
}

function isDirectGroupingDeclaration(text) {
  const raw = String(text ?? "").trim();
  if (!raw) return false;
  if (QUESTION_START_RE.test(raw)) return false;
  if (/^\s*(?:if|when|whether|unless|maybe|perhaps|suppose|imagine)\b/i.test(raw)) return false;
  return DIRECT_GROUPING_DECLARATION_RE.test(raw);
}

function roleForClause({ executable, directAction, actionCandidate, scopes }) {
  if (executable) return "action";
  if (scopes.quoted || scopes.codeQuoted) return "quoted_example";
  if (scopes.reported) return "reported_text";
  if (scopes.hypothetical) return "condition";
  if (scopes.negation) return "negation";
  if (scopes.explanatory || scopes.instructional) return "explanation_request";
  if (scopes.preserveState || scopes.explicitNoAction || scopes.reviewOnly) return "meta_instruction";
  if (directAction || actionCandidate) return "unknown";
  return "unknown";
}

function extractActionVerb(text) {
  return String(text ?? "").match(ACTION_VERB_RE)?.[0]?.toLowerCase() ?? null;
}

function hasAny(text, patterns) {
  return patterns.some(pattern => pattern.test(text));
}

function normalizeControl(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[.!?]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function emptySemantics() {
  return {
    raw: "",
    mode: "clarify",
    executionAuthorized: false,
    stateChangingActionAuthorized: false,
    authorizedActionClauses: [],
    authorizedActionText: "",
    authorizedPendingCorrection: false,
    clauses: [],
    actionMentioned: false,
    instructional: false,
    groundedWorkflowGuidance: false,
    explicitReadOnly: false,
    reported: false,
    hypothetical: false,
    quoted: false,
    negatedAction: false,
    negatedCancellationCommand: false,
    explanatoryAction: false,
    bareImperativeQuestion: false,
    safeWorkflowPreparation: false,
    directReadOnlyOperation: false,
    correction: false,
    readOnlyScope: false,
    requestedResponse: "unknown",
    directPendingCancellation: false,
    directPendingConfirmation: false,
    directRuntimeStop: false,
    reasons: [],
    scopes: {},
  };
}
