import {
  ACTION_VERB_RE,
  ACTION_VERB_SOURCE,
  PENDING_CANCEL_FORMS,
  PENDING_CONFIRM_FORMS,
  RUNTIME_STOP_FORMS,
} from "./actionLexicon.js";

export const AUTHORIZATION_MODE = Object.freeze({
  AUTHORIZED: "authorized",
  READ_ONLY: "read_only",
  CLARIFY: "clarify",
});

export const AUTHORIZATION_CONTRACT_VERSION = 1;

const MAX_AUTHORIZATION_CHARS = 5_000;
const MAX_AUTHORIZATION_CLAUSES = 40;
const DIRECT_ACTION_RE = new RegExp(
  String.raw`^\s*(?:(?:please|now|then|separately|after\s+that)\s*[,;:]?\s*|go\s+ahead\s+and\s+|i\s+want\s+you\s+to\s+|for\s+(?:the\s+)?(?:current|pending)\s+(?:task|dataset|graph|mapping|parser|action|correction)\s*[,;:]?\s*)?(?:${ACTION_VERB_SOURCE})\b`,
  "i",
);
const POLITE_ACTION_RE = new RegExp(
  String.raw`^\s*(?:please\s+)?(?:can|could|would|will)\s+you\s+(?:please\s+)?(?:${ACTION_VERB_SOURCE})\b`,
  "i",
);
const GO_AHEAD_POLITE_ACTION_RE = new RegExp(
  String.raw`^\s*go\s+ahead\s+and\s+(?:please\s+)?(?:can|could|would|will)\s+you\s+(?:please\s+)?(?:${ACTION_VERB_SOURCE})\b`,
  "i",
);
const QUESTION_START_RE = /^\s*(?:what|why|how|which|where|when|who|is|are|am|does|do|did|can|could|would|will|should|may|might)\b/i;
const READ_ONLY_QUERY_START_RE = /^\s*(?:please\s+)?tell\s+me\s+(?:whether|if|what|which|why|how|where|when|who)\b/i;
const EXPLANATION_START_RE = /^\s*(?:please\s+)?(?:explain|describe|define|clarify|interpret|paraphrase|summari[sz]e|review|audit|evaluate|compare|teach|discuss|decode|read\b|tell\s+me\s+(?:about|what|how|the\s+consequences)|show\s+me\s+(?:the\s+)?(?:syntax|steps?|procedure)|walk\s+me\s+through|could\s+you\s+explain|can\s+you\s+explain|i\s+(?:just\s+)?need\s+(?:an?\s+)?explanation|i['’]?m\s+curious\s+what|before\s+doing\s+anything|before\s+i\s+(?:decide|authori[sz]e)|hold\s+off\s+on|pause\s+before|i\s+want\s+an?\s+explanation|i['’]?d\s+like\s+to\s+understand|i\s+want\s+to\s+understand|tell\s+me\s+what\s+[\s\S]{0,80}\s+would\s+do|tell\s+me\s+what\s+[\s\S]{0,80}\s+would\s+happen|tell\s+me\s+the\s+consequences)\b/i;
const PROCEDURE_RE = /\b(?:how\s+(?:to|do\s+i|can\s+i|would\s+i|should\s+i)|steps?|procedure|syntax|notation|workflow|instructions?|what\s+to\s+type|which\s+procedure|teach\s+(?:me|a\s+novice))\b/i;
const DENIAL_RE = /\b(?:do\s+not|don['’]?t|never|do\s+not\s+act|don['’]?t\s+act|do\s+not\s+alter|don['’]?t\s+alter|no\s+(?:action|execution|consent|permission|authorization|changes?|mutation)|(?:have|has)\s+not\s+authori[sz](?:e|ed|ing)|haven['’]?t\s+authori[sz](?:e|ed|ing)|not\s+(?:authori[sz](?:e|ed|ing)|approv(?:e|ed|ing)|consent(?:ing|ed)?|requesting|asking\s+you\s+to|an?\s+(?:instruction|order|request)|execution)|permission\s+(?:is\s+)?(?:withheld|denied)|without\s+(?:granting\s+)?(?:permission|consent|authorization)|decline\s+to\s+approve|outside\s+the\s+scope|discussion,?\s+not\s+execution|explanation,?\s+not\s+action)\b/i;
const EXPRESS_DENIAL_RE = /\bpermission\s+is\s+expressly\s+(?:withheld|denied)\b/i;
const CONTEXTUAL_NON_AUTH_RE = /\b(?:audit\s+transcript|not\s+consent|execution\s+is\s+outside\s+the\s+scope|not\s+an?\s+instruction\s+for\s+you)\b/i;
const FIRST_PERSON_NO_CONSENT_RE = /\bi\s+(?:(?:do\s+not|don['’]?t)\s+(?:want|authorize|approve|consent|ask)|am\s+not\s+(?:asking|authorizing|approving)|only\s+want\s+to\s+(?:understand|learn))\b/i;
const NEGATED_REQUEST_BASE_RE = /\b(?:i|we)\s+(?:(?:did|do)\s+not|(?:didn|don)['’]?t|never)\s+(?:ask|tell|request|instruct|direct|authorize|authorise|approve|consent)\b/i;
const NEGATED_REQUEST_PAST_RE = /\b(?:i|we)\s+(?:(?:have|had)\s+not|(?:haven|hadn)['’]?t|never)\s+(?:asked|told|requested|instructed|directed|authorized|authorised|approved|consented)\b/i;
const NEGATED_REQUEST_PROGRESSIVE_RE = /\b(?:(?:i\s+am|i['’]?m|we\s+are|we['’]?re)\s+not)\s+(?:asking|telling|requesting|instructing|directing|authorizing|authorising|approving|consenting)\b/i;
const NO_CONSENT_PROPOSITION_RE = /\b(?:(?:this|that|it|these\s+words?|that\s+statement)\s+(?:is|was|are|were)\s+not\s+(?:an?\s+)?(?:permission|consent|authorization|authorisation|request|instruction|directive)|(?:do\s+not|don['’]?t|never)\s+(?:take|interpret|read|treat|understand)\s+(?:this|that|it|these\s+words?|that\s+statement)\s+as\s+(?:an?\s+)?(?:permission|consent|authorization|authorisation|request|instruction|directive))\b/i;
const PRESERVE_RE = /\b(?:(?:keep|leave|retain|preserve)\s+(?:every\s+)?(?:the\s+)?(?:current\s+)?(?:workspace|state|graph|mapping|parser|dashboard|session|product[-\s]?state|pending\s+action)(?:(?:\s+fields?)?\s+(?:exactly\s+)?(?:untouched|unchanged|unmodified|intact|as[-\s]?is|as\s+it\s+is))?|(?:leave|keep)\s+everything\s+(?:exactly\s+)?(?:unchanged|untouched|unmodified)|(?:workspace|state|graph|mapping|parser|dashboard|session)\s+must\s+remain\s+(?:untouched|unchanged|unmodified|intact)|do\s+not\s+(?:write\s+to|touch|modify|change|alter)\s+(?:the\s+)?(?:workspace|state|graph|mapping|parser|dashboard|session))\b/i;
const BROAD_PRESERVE_RE = /\b(?:retain|keep|leave|preserve)\s+(?:(?:all|every|the)\s+)?(?:(?:current|existing|this|the)\s+)?(?:application\s+)?(?:state|workspace|graph|mapping|parser|dashboard|session)\b/i;
const INFORMATIONAL_RE = /\b(?:(?:for\s+)?(?:reference|information|informational|discussion|review|audit)\s+only|read[-\s]?only|learning,?\s+not\s+action|literal\s+(?:data|text)|treat\s+(?:these\s+words|this)\s+literally|not\s+operationally|analy[sz]e\s+only)\b/i;
const REPORTED_RE = /\b(?:(?:manual|handbook|documentation|docs?|guide|file|data|fixture|excerpt|transcript|log|note|text|model\s+output|reviewer|teammate|observer|someone(?:\s+else)?)\s+(?:says?|said|reads?|prints?|contains?|includes?|shows?|mentions?|mentioned|suggested|recorded|typed|asked)|i\s+am\s+(?:only\s+)?(?:reporting|relaying|quoting)|incident\s+log|archive\s+note|example\s+(?:input|block|command)|sample\s+command)\b/i;
const HYPOTHETICAL_RE = /\b(?:hypothetical(?:ly)?|imagine|suppose|counterfactual|if\b|what\s+(?:would|could|will)\s+happen\s+if|were\s+(?:somebody|someone|i|we)\s+to|had\s+(?:i|we)\b|might\b|perhaps\b|maybe\b|plan\s+to\b|intend\s+to\b|eventually\b|another\s+day\b|next\s+week\b|later\b|i\s+am\s+considering\b)\b/i;
const COMPARISON_RE = /\bcompare\b|\bagainst\s+(?:doing\s+nothing|preserving|retaining)\b/i;
const QUOTE_INTRO_RE = /\b(?:read|interpret|decode|explain|review|audit|evaluate|the\s+(?:phrase|text|words?|command|instruction|excerpt|handbook|manual|documentation|docs?|file|data|fixture|log|note)\b)/i;
const PENDING_TARGET_RE = /\bpending\b/i;
const TYPED_CORRECTION_RE = /\b(?:change|replace|revise|swap|use|set)\b[\s\S]{0,160}\b(?:from\b[\s\S]{0,80}\bto\b|instead\s+of|pending)\b/i;

const SIDE_EFFECT_SCOPE_RULES = Object.freeze([
  ["confirmation_control", /^(?:please\s+)?(?:confirm|approve|proceed|continue)\b/i],
  ["cancellation", /^(?:please\s+)?(?:cancel|discard|never\s*mind|forget\s+that)\b/i],
  ["runtime_control", /\b(?:stop|abort|connect|reconnect|disconnect|disable|enable|provider|model|ollama|runtime|assistant\s+settings)\b/i],
  ["runtime_probe", /\b(?:test|check|list|show)\b[\s\S]{0,80}\b(?:model(?:s)?|ollama|runtime|bridge|connection)\b/i],
  ["runtime_probe", /\b(?:analy[sz]e|explain)\b[\s\S]{0,80}\bfile\s+roles?\b/i],
  ["runtime_probe", /\b(?:test|run|check|show)\b[\s\S]{0,80}\b(?:generation|diagnostics?)\b/i],
  ["requires_graph_apply_confirmation", /\b(?:apply|load|parse)\b[\s\S]{0,100}\b(?:parser\s+result|uploaded\s+files?|current\s+input|graph)\b/i],
  ["requires_parser_run_confirmation", /\b(?:run|execute|start|test)\b[\s\S]{0,80}\b(?:custom\s+)?parser\b/i],
  ["requires_parser_run_confirmation", /\b(?:continue|proceed)\b[\s\S]{0,100}\b(?:(?:generated|ready)\s+parser|after\s+parser\s+generation)\b/i],
  ["workflow_preparation", /\b(?:continue|generate|create|build|prepare|repair|fix|validate|auto[-\s]?detect|detect|check|compare|start)\b[\s\S]{0,120}\b(?:next(?:\s+[A-Za-z0-9_-]+){0,4}\s+parser\s+step|parser|mapping|transformation\s+plan|plan|format|files?|expected\s+output|workflow|spec)\b/i],
  ["workflow_preparation", /\b(?:show|view|display)\b[\s\S]{0,80}\btransformation\s+plan\b/i],
  ["reversible_grouping_edit", /\b(?:group|groups|grouping|together|one\s+dataset|separate(?:ly)?|validation(?:[-\s]?only)?|update\s+stream|(?:ignore|exclude|skip|mark)\b[\s\S]{0,60}\.(?:csv|tsv|json|txt)|move\b[\s\S]{0,60}\.(?:csv|tsv|json|txt))\b/i],
  ["reversible_mapping_edit", /\b(?:mapping|map\b|(?:vertex|node|hyperedge|group)\s+(?:table|key|id|time|weight)|membership\s+table|attribute|column|source\s+column|target\s+column|preserve\s+empty|links?\s+to|connect\w*\b|\b(?:paper|author|researcher)_?id\b|\bkey\b|\bid\b|instead\s+of|no\s+authors?|deduplicate|memberships?|deterministic\s+draft)\b/i],
  ["graph_edit_preview", /\b(?:hyperedges?|vertices?|vertex(?:es)?|incidences?|graph\s+(?:edit|mutation)|undo\s+(?:the\s+)?(?:last\s+)?(?:graph\s+)?(?:change|edit)|clear\s+(?:the\s+)?graph|new\s+group|put\b|take\b|time\b|weight\b|attribute|color)\b/i],
  ["destructive_batch_state", /\b(?:clear|delete|remove)\b[\s\S]{0,60}\b(?:batch|batches|uploaded\s+files?)\b/i],
  ["batch_state_edit", /\b(?:batch|previous\s+batch|active\s+batch|parse\s+files?|files?\s+(?:together|separately)|one\s+dataset|separate\s+datasets)\b/i],
  ["file_picker", /\b(?:upload|attach|file\s+picker|add\s+files?)\b/i],
  ["download_or_copy", /\b(?:download|export|copy)\b/i],
  ["navigation", /\b(?:open|switch|navigate|go\s+to|set\s+(?:the\s+)?(?:visual|export)|show(?:\s+only)?|use\s+(?:h2v|v2h|csr|csc|json)|view\s+(?:previous|the\s+previous)|statistics|visualization|route|section|preview|runtime\s+diagnostics|custom\s+parser|edit\s+the\s+mapping|export\s+as)\b/i],
  ["navigation", /\bexport\b[\s\S]{0,100}\b(?:h2v|v2h|h2h|json|csv|csr|csc|edge\s+list|adjacency|corpus|preview)\b/i],
]);

export function analyzePositiveAuthorization(text = "", {
  maxChars = MAX_AUTHORIZATION_CHARS,
  maxClauses = MAX_AUTHORIZATION_CLAUSES,
} = {}) {
  const input = String(text ?? "").slice(0, Math.max(0, maxChars));
  if (!input.trim()) return emptyAuthorization();
  const clauses = splitAuthorizationClauses(input, maxClauses).map((clause, index) => analyzeAuthorizationClause(clause, index));
  const authorizedClauses = clauses.filter(clause => clause.authorization === AUTHORIZATION_MODE.AUTHORIZED);
  const deniedClauses = clauses.filter(clause => clause.authorization === AUTHORIZATION_MODE.READ_ONLY);
  const ambiguousClauses = clauses.filter(clause => clause.authorization === AUTHORIZATION_MODE.CLARIFY);
  const statePreservationConflict = clauses.some(clause => clause.scopes.preserveState)
    && authorizedClauses.some(clause => clause.sideEffectScopes.some(scope => scope !== "read_only"));
  const pendingAuthorizationConflict = clauses.some(clause => clause.scopes.denied && clause.scopes.pendingTarget)
    || (authorizedClauses.some(clause => clause.scopes.pendingTarget && clause.scopes.typedCorrection)
      && deniedClauses.some(clause => /\b(?:act|alter|touch|change|apply|authorization|consent|permission)\b/i.test(clause.text)));
  const runtimeRoleAssist = /^\s*(?:please\s+)?(?:explain|analy[sz]e)\s+file\s+roles?\s+with\s+local\s+model\s*[.!]?$/i.test(input);
  const expectedOutputAction = /^\s*(?:(?:please|go\s+ahead\s+and|i\s+want\s+you\s+to)\s+)?(?:compare\s+(?:with\s+)?expected\s+output|use\s+mapping\s+workflow|start\s+mapping\s+workflow)\s*[.!]?$/i.test(input);
  const trailingSafetyQualifier = clauses.some((clause, index) => index > 0
    && clause.authorization === AUTHORIZATION_MODE.READ_ONLY
    && (clause.scopes.informational || clause.scopes.denied || clause.scopes.preserveState || clause.scopes.explanatory)
    && !["then", "after that"].includes(clause.connectorBefore));
  const wholeSafePreparation = isWholeSafePreparation(input)
    && !statePreservationConflict
    && !pendingAuthorizationConflict
    && !trailingSafetyQualifier;
  let finalAuthorized = statePreservationConflict || pendingAuthorizationConflict || trailingSafetyQualifier ? [] : authorizedClauses;
  if (wholeSafePreparation) {
    finalAuthorized = [{
      id: "authorization-clause-1",
      text: input,
      role: "executable",
      actionCandidate: true,
      executable: true,
      executionAuthorized: true,
      requestedAction: "generate",
      authorization: AUTHORIZATION_MODE.AUTHORIZED,
      sideEffectScopes: ["workflow_preparation"],
      scopes: { safeWorkflowPreparation: true },
      evidence: ["safe_workflow_preparation"],
    }];
  } else if (runtimeRoleAssist || expectedOutputAction) {
    finalAuthorized = [{
      id: "authorization-clause-1",
      text: input,
      role: "executable",
      actionCandidate: true,
      executable: true,
      executionAuthorized: true,
      requestedAction: runtimeRoleAssist ? "analyze" : "compare",
      authorization: AUTHORIZATION_MODE.AUTHORIZED,
      sideEffectScopes: [runtimeRoleAssist ? "runtime_probe" : "workflow_preparation"],
      scopes: { directAssist: true },
      evidence: [runtimeRoleAssist ? "direct_runtime_role_assist" : "direct_expected_output_action"],
    }];
  }
  const mode = finalAuthorized.length
    ? AUTHORIZATION_MODE.AUTHORIZED
    : (ambiguousClauses.length && !deniedClauses.length ? AUTHORIZATION_MODE.CLARIFY : AUTHORIZATION_MODE.READ_ONLY);
  const evidence = [
    ...clauses.flatMap(clause => clause.evidence.map(item => `${clause.id}:${item}`)),
    ...(statePreservationConflict ? ["request:state_preservation_conflict"] : []),
    ...(pendingAuthorizationConflict ? ["request:pending_authorization_conflict"] : []),
    ...(wholeSafePreparation ? ["request:safe_workflow_preparation"] : []),
  ];
  const sideEffectScopes = [...new Set(finalAuthorized.flatMap(clause => clause.sideEffectScopes))];
  const contract = {
    version: AUTHORIZATION_CONTRACT_VERSION,
    mode,
    authorizedClauses: finalAuthorized,
    deniedClauses,
    ambiguousClauses,
    sideEffectScopes,
    evidence,
    statePreservationConflict,
    pendingAuthorizationConflict,
    wholeSafePreparation,
    truncated: String(text ?? "").length > input.length,
  };
  return Object.freeze({
    ...contract,
    token: mode === AUTHORIZATION_MODE.AUTHORIZED ? createAuthorizationToken(input, contract) : null,
  });
}

export function authorizationAllowsSideEffect(authorization, sideEffectClass) {
  if (sideEffectClass === "read_only") return { allowed: true, reason: "read_only_side_effect" };
  if (authorization?.truncated) {
    return { allowed: false, reason: "authorization_input_truncated" };
  }
  if (!authorization || authorization.version !== AUTHORIZATION_CONTRACT_VERSION) {
    return { allowed: false, reason: "read_only_scope_missing_positive_authorization_contract" };
  }
  if (authorization.mode !== AUTHORIZATION_MODE.AUTHORIZED || !authorization.token) {
    return {
      allowed: false,
      reason: authorization?.mode === AUTHORIZATION_MODE.CLARIFY
        ? "clarification_required"
        : (authorization?.deniedClauses?.length ? "denied_by_user" : "read_only_blocked"),
    };
  }
  if (!(authorization.authorizedClauses?.length > 0)) {
    return { allowed: false, reason: "no_positively_authorized_clause" };
  }
  if (!authorization.sideEffectScopes?.includes(sideEffectClass)) {
    return { allowed: false, reason: `side_effect_scope_not_authorized:${sideEffectClass}` };
  }
  return { allowed: true, reason: "positive_side_effect_authorization" };
}

/**
 * Clause-local semantic guard for a negated request/consent speech act.
 * The mutation verb may appear later in the clause, but that mention cannot
 * become execution authority when the governing ask/tell/permission act is
 * explicitly denied. Callers must evaluate each clause independently so a
 * later affirmative clause can still authorize its own operation.
 */
export function hasNegatedAuthorizationSpeechAct(text = "") {
  const value = String(text ?? "");
  return NEGATED_REQUEST_BASE_RE.test(value)
    || NEGATED_REQUEST_PAST_RE.test(value)
    || NEGATED_REQUEST_PROGRESSIVE_RE.test(value)
    || NO_CONSENT_PROPOSITION_RE.test(value);
}

function analyzeAuthorizationClause(clause, index) {
  const masked = maskClauseProtectedText(clause.text);
  const activeText = masked.activeText.trim();
  const directRuntimeRoleAssist = /^\s*(?:please\s+)?(?:explain|analy[sz]e)\s+file\s+roles?\s+with\s+local\s+model\s*[.!]?$/i.test(activeText);
  const directExpectedOutputAction = /^\s*(?:(?:please|go\s+ahead\s+and|i\s+want\s+you\s+to)\s+)?(?:compare\s+(?:with\s+)?expected\s+output|use\s+mapping\s+workflow|start\s+mapping\s+workflow)\s*[.!]?$/i.test(activeText);
  const protectedAction = masked.protectedValues.some(value => ACTION_VERB_RE.test(value));
  const unprotectedAction = ACTION_VERB_RE.test(activeText);
  const exactControl = exactControlKind(activeText);
  const relationAction = /^\s*(?:(?:please|go\s+ahead\s+and|i\s+want\s+you\s+to)\s+)?[A-Za-z0-9_.:-]+\s+(?:maps?|links?|connects?|joins|belongs)\s+to\b/i.test(activeText);
  const mappingDeclarationAction = /\b[A-Za-z0-9_.:-]+\s+(?:is|are)\s+(?:the\s+)?(?:vertex|vertices|node|nodes|hyperedge|hyperedges|edge|edges|incidence|incidences|membership|memberships|table|relation|relations)\b/i.test(activeText)
    || /\b(?:tells?|shows?|indicates?)\b[\s\S]{0,120}\b(?:belong|belongs|membership|memberships)\b/i.test(activeText)
    || /\b(?:link|linking|membership)\s+table\b/i.test(activeText)
    || /\b(?:preserve|keep|retain)\b[\s\S]{0,80}\b(?:unmatched|empty)\b[\s\S]{0,40}\b(?:row|rows|hyperedge|hyperedges)\b/i.test(activeText);
  const emptyHyperedgePolicyAction = /\b(?:preserve|keep|retain)\b[\s\S]{0,120}\b(?:do\s+not\s+have|without)\b[\s\S]{0,70}\b(?:author|member|vertex|incidence)s?\b[\s\S]{0,60}\bempty\s+hyperedges?\b/i.test(activeText);
  const graphDeclarativeAction = /\b(?:should|must)\s+(?:no\s+longer\s+)?(?:belong|be\s+in|be\s+included|be\s+removed)\b/i.test(activeText);
  const statusReadOnlyAction = /^(?:(?:please|go\s+ahead\s+and|i\s+want\s+you\s+to)\s+|for\s+(?:the\s+)?(?:current|pending)\s+(?:task|dataset|graph|mapping|parser|action|correction)\s*[,;:]?\s*)?(?:show|report|view|list|check|inspect)\b[\s\S]{0,100}\b(?:status|workflow|progress|phase)\b/i.test(activeText);
  const workflowPreparationAction = /\b(?:continue|generate|create|build|prepare|repair|fix|validate|auto[-\s]?detect|detect|compare|start)\b[\s\S]{0,120}\b(?:next(?:\s+[A-Za-z0-9_-]+){0,4}\s+parser\s+step|transformation\s+plan|mapping\s+workflow|parser\s+workflow)\b/i.test(activeText);
  const correctionAction = TYPED_CORRECTION_RE.test(activeText) || /^\s*(?:actually|instead|rather|no)\b/i.test(activeText);
  const literalFileAction = /\b(?:exclude|ignore|skip|mark)\b[\s\S]{0,100}\b(?:file\s+)?[A-Za-z0-9_.-]+\.(?:csv|tsv|json|txt)\b/i.test(activeText);
  const safeWorkflowPreamble = String.raw`(?:(?:please|go\s+ahead\s+and|i\s+want\s+you\s+to)\s+|for\s+(?:the\s+)?(?:current|pending)\s+(?:task|dataset|graph|mapping|parser|action|correction)\s*[,;:]?\s*)?`;
  const safeWorkflowPreparation = !clause.inheritedScope && (
    new RegExp(String.raw`^${safeWorkflowPreamble}(?:do\s+not|don['’]?t)\s+run\b[\s\S]{0,100}\b(?:show|display)\b[\s\S]{0,80}\b(?:plan|parser)\b`, "i").test(activeText)
    || new RegExp(String.raw`^${safeWorkflowPreamble}(?:generate|create|build)\b[\s\S]{0,120}\b(?:plan|parser)\b[\s\S]{0,80}\b(?:do\s+not|don['’]?t)\s+(?:run|execute|apply)\b`, "i").test(activeText)
  ) && !CONTEXTUAL_NON_AUTH_RE.test(activeText)
    && !/\((?:permission|execution)\s+is\s+(?:expressly\s+)?(?:withheld|denied|outside)\b/i.test(activeText);
  const scopes = {
    quotedOrCode: protectedAction,
    reported: clause.inheritedScope === "reported" || REPORTED_RE.test(activeText),
    hypothetical: HYPOTHETICAL_RE.test(activeText),
    explanatory: clause.inheritedScope === "explanatory" || EXPLANATION_START_RE.test(activeText),
    instructional: PROCEDURE_RE.test(activeText),
    denied: clause.inheritedScope === "denied" || DENIAL_RE.test(activeText) || EXPRESS_DENIAL_RE.test(activeText) || CONTEXTUAL_NON_AUTH_RE.test(activeText) || FIRST_PERSON_NO_CONSENT_RE.test(activeText) || hasNegatedAuthorizationSpeechAct(activeText),
    preserveState: PRESERVE_RE.test(activeText) || BROAD_PRESERVE_RE.test(activeText),
    informational: INFORMATIONAL_RE.test(activeText),
    comparison: COMPARISON_RE.test(activeText),
    question: QUESTION_START_RE.test(activeText) || READ_ONLY_QUERY_START_RE.test(activeText) || /\?\s*$/.test(activeText),
    pendingTarget: PENDING_TARGET_RE.test(activeText),
    typedCorrection: TYPED_CORRECTION_RE.test(activeText),
    previewWithoutApply: /\b(?:do\s+not|don['’]?t)\s+apply\s+(?:it|this|that|the\s+(?:change|preview|edit))\b/i.test(activeText),
    safeWorkflowPreparation,
  };
  const politeAction = POLITE_ACTION_RE.test(activeText) || GO_AHEAD_POLITE_ACTION_RE.test(activeText);
  const directAction = Boolean(exactControl || DIRECT_ACTION_RE.test(activeText) || politeAction || relationAction || mappingDeclarationAction || graphDeclarativeAction || (correctionAction && scopes.typedCorrection) || (
    unprotectedAction
    && !scopes.question
    && !scopes.explanatory
    && !scopes.instructional
    && !scopes.reported
    && !scopes.hypothetical
  ));
  const quoteIsData = protectedAction && !unprotectedAction;
  const blocked = !safeWorkflowPreparation && (scopes.reported
    || scopes.hypothetical
    || scopes.explanatory
    || (scopes.instructional && !statusReadOnlyAction && !workflowPreparationAction && !correctionAction)
    || (scopes.informational && !literalFileAction)
    || scopes.comparison
    || scopes.preserveState
    || (scopes.denied && !emptyHyperedgePolicyAction && !(exactControl && !clause.inheritedScope))
    || quoteIsData
    || (protectedAction && QUOTE_INTRO_RE.test(activeText) && !/^(?:execute|run|apply)\b/i.test(activeText)));
  // A single polite interrogative ("Could you ...?") remains a supported
  // action form in the legacy command catalog.  Repeated terminal question
  // punctuation is produced by the read-only safety matrix when it wraps an
  // already-interrogative command; treat that malformed/ambiguous form as
  // read-only instead of allowing the polite-action matcher to authorize it.
  const repeatedQuestionPunctuation = /[!?]{2,}\s*$/.test(clause.text);
  const questionWithoutSecondPersonRequest = scopes.question && (!politeAction || repeatedQuestionPunctuation);
  let authorization = AUTHORIZATION_MODE.CLARIFY;
  if (blocked || questionWithoutSecondPersonRequest) authorization = AUTHORIZATION_MODE.READ_ONLY;
  else if (directAction || safeWorkflowPreparation) authorization = AUTHORIZATION_MODE.AUTHORIZED;
  if (!clause.inheritedScope && !scopes.denied && !scopes.preserveState && !scopes.informational
    && (directRuntimeRoleAssist || directExpectedOutputAction)) {
    authorization = AUTHORIZATION_MODE.AUTHORIZED;
  }

  // "Create a preview, but don't apply it" still authorizes only the staging
  // side effect. The denial is not allowed to leak into graph application.
  const previewOnlyException = scopes.previewWithoutApply
    && /^(?:please\s+)?(?:create|add|remove|delete|rename|change|edit|preview)\b/i.test(activeText)
    && /\b(?:graph|hyperedge|vertex|incidence)\b/i.test(activeText);
  if (previewOnlyException) authorization = AUTHORIZATION_MODE.AUTHORIZED;

  const sideEffectScopes = authorization === AUTHORIZATION_MODE.AUTHORIZED
    ? (directRuntimeRoleAssist
        ? ["runtime_probe"]
        : directExpectedOutputAction
          ? ["workflow_preparation"]
          : scopesForClause(activeText, exactControl, { previewOnlyException, mappingDeclarationAction, graphDeclarativeAction }))
    : [];
  const evidence = [
    directAction && "direct_action_clause",
    politeAction && "second_person_request",
    exactControl && `exact_control:${exactControl}`,
    scopes.denied && "explicit_denial",
    hasNegatedAuthorizationSpeechAct(activeText) && "negated_authorization_speech_act",
    scopes.preserveState && "state_preservation",
    scopes.reported && "reported_scope",
    scopes.hypothetical && "hypothetical_scope",
    scopes.explanatory && "explanatory_scope",
    scopes.instructional && "instructional_scope",
    scopes.informational && "informational_scope",
    quoteIsData && "protected_command_text",
    questionWithoutSecondPersonRequest && "capability_or_information_question",
    previewOnlyException && "preview_authorized_apply_denied",
    mappingDeclarationAction && "mapping_declaration_action",
    statusReadOnlyAction && "status_read_only_action",
    workflowPreparationAction && "workflow_preparation_action",
    directRuntimeRoleAssist && "direct_runtime_role_assist",
    directExpectedOutputAction && "direct_expected_output_action",
  ].filter(Boolean);
  return Object.freeze({
    ...clause,
    id: `authorization-clause-${index + 1}`,
    text: clause.text.trim(),
    role: authorization === AUTHORIZATION_MODE.AUTHORIZED ? "executable" : (authorization === AUTHORIZATION_MODE.READ_ONLY ? "read_only" : "ambiguous"),
    actionCandidate: unprotectedAction || protectedAction,
    executable: authorization === AUTHORIZATION_MODE.AUTHORIZED,
    executionAuthorized: authorization === AUTHORIZATION_MODE.AUTHORIZED,
    requestedAction: authorization === AUTHORIZATION_MODE.AUTHORIZED ? activeText.match(ACTION_VERB_RE)?.[0]?.toLowerCase() ?? null : null,
    authorization,
    sideEffectScopes,
    scopes,
    evidence,
  });
}

function scopesForClause(text, exactControl, { previewOnlyException = false, mappingDeclarationAction = false, graphDeclarativeAction = false } = {}) {
  if (exactControl === "confirmation") return ["confirmation_control"];
  if (exactControl === "cancellation") return ["cancellation", "confirmation_control"];
  if (exactControl === "runtime_stop") return ["runtime_control", "cancellation"];
  if (previewOnlyException) return ["graph_edit_preview"];
  const scopes = SIDE_EFFECT_SCOPE_RULES.filter(([, pattern]) => pattern.test(text)).map(([scope]) => scope);
  if (mappingDeclarationAction) scopes.push("reversible_mapping_edit");
  if (graphDeclarativeAction) scopes.push("graph_edit_preview");
  // Direct commands are positively authorized but must still bind to a
  // concrete class. This bounded classification covers catalog actions whose
  // surface form is intentionally terse (for example "Undo last change").
  if (!scopes.length) {
    if (/\b(?:undo|rename|add|remove|delete|create|clear|change|replace|merge|split)\b/i.test(text)) scopes.push("graph_edit_preview");
    else if (/\b(?:open|show|view|switch|select|set|use|go)\b/i.test(text)) scopes.push("navigation");
  }
  return [...new Set(scopes)];
}

function splitAuthorizationClauses(text, maxClauses) {
  const protectedSpans = scanAuthorizationProtectedSpans(text);
  const clauses = [];
  let start = 0;
  let inheritedScope = null;
  let connectorBefore = null;
  const push = (end, nextScope = null, nextConnector = connectorBefore) => {
    const value = text.slice(start, end).trim();
    if (value) clauses.push({ text: value, charStart: start, charEnd: end, inheritedScope, connectorBefore });
    inheritedScope = nextScope;
    connectorBefore = nextConnector;
  };
  for (let index = 0; index < text.length && clauses.length < maxClauses - 1; index += 1) {
    if (insideSpan(index, protectedSpans)) continue;
    const rest = text.slice(index);
    const connective = rest.match(/^(?:,\s*)?(?:and\s+)?then\b\s*[,;:]?\s*|^after\s+that\b\s*[,;:]?\s*|^afterwards?\b\s*[,;:]?\s*|^separately\b\s*[,;:]?\s*/i)?.[0];
    const deniedConjunction = rest.match(/^(?:,\s*)?and\s+(?:do\s+not|don['’]?t|never|without|only)\b\s*/i)?.[0];
    const standaloneSeparately = /^separately\b/i.test(connective ?? "")
      && !text.slice(index + (connective?.length ?? 0)).trim();
    if (connective && index > start && !standaloneSeparately) {
      push(index, null, /^(?:after\s+that|afterwards?)/i.test(connective) ? "after that" : "then");
      index += connective.length - 1;
      start = index + 1;
      continue;
    }
    if (deniedConjunction && index > start && !/[A-Za-z0-9_.-]/.test(text[index - 1] ?? "")) {
      push(index, null, "and_denial");
      index += deniedConjunction.length - 1;
      start = index + 1;
      continue;
    }
    if (text.startsWith("--", index) && index > start) {
      push(index, null, "dash");
      index += 1;
      start = index + 1;
      continue;
    }
    const ch = text[index];
    if (ch === ":") {
      const prefix = text.slice(start, index);
      const scope = inheritedScopeForPrefix(prefix);
      if (scope) {
        push(index, scope, "colon");
        start = index + 1;
      }
      continue;
    }
    if (ch === "\n" || ch === ";" || ch === "；" || ch === "—" || ch === "–" || ((ch === "." || ch === "!") && sentenceBoundary(text, index)) || (ch === "?" && sentenceBoundary(text, index))) {
      const previous = text.slice(start, index);
      const inherited = ch === "—" || ch === "–"
        ? inheritedScopeForPrefix(previous)
        : ((ch === ";" || ch === "；") && /\b(?:says?|said|recorded|contains?|includes?|mentions?|suggested|reported)\b/i.test(previous) ? "reported" : null);
      // Keep the terminal question mark in the clause so the authorization
      // contract can distinguish an information question from a direct
      // imperative that happens to end with punctuation.
      const end = ch === "?" ? index + 1 : index;
      push(end, inherited, ch === "—" || ch === "–" ? "dash" : ch === "\n" ? "newline" : (ch === ";" || ch === "；") ? "semicolon" : "sentence");
      start = index + 1;
    }
  }
  if (clauses.length < maxClauses) {
    const value = text.slice(start).trim();
    if (value) clauses.push({ text: value, charStart: start, charEnd: text.length, inheritedScope });
  }
  return clauses.length ? clauses : [{ text, charStart: 0, charEnd: text.length, inheritedScope: null }];
}

function inheritedScopeForPrefix(prefix) {
  if (DENIAL_RE.test(prefix) || EXPRESS_DENIAL_RE.test(prefix) || hasNegatedAuthorizationSpeechAct(prefix) || PRESERVE_RE.test(prefix) || BROAD_PRESERVE_RE.test(prefix) || INFORMATIONAL_RE.test(prefix)) return "denied";
  if (REPORTED_RE.test(prefix) || /\b(?:read\s+this\s+as\s+text|literal\s+data|command|example|sample)\b/i.test(prefix)) return "reported";
  if (EXPLANATION_START_RE.test(prefix) || PROCEDURE_RE.test(prefix) || /\b(?:meaning|background|glossary\s+question)\b/i.test(prefix)) return "explanatory";
  return null;
}

function scanAuthorizationProtectedSpans(text) {
  const spans = [];
  const pairs = new Map([["\"", "\""], ["'", "'"], ["`", "`"], ["“", "”"], ["‘", "’"]]);
  let index = 0;
  while (index < text.length) {
    if (text.startsWith("```", index)) {
      const end = text.indexOf("```", index + 3);
      const final = end < 0 ? text.length : end + 3;
      spans.push({ start: index, end: final, value: text.slice(index + 3, end < 0 ? text.length : end) });
      index = final;
      continue;
    }
    const open = text[index];
    const close = pairs.get(open);
    if (!close || (open === "'" && /[A-Za-z0-9_]/.test(text[index - 1] ?? "") && /[A-Za-z0-9_]/.test(text[index + 1] ?? ""))) {
      index += 1;
      continue;
    }
    let cursor = index + 1;
    while (cursor < text.length && text[cursor] !== close) {
      if (text[cursor] === "\\") cursor += 2;
      else cursor += 1;
    }
    const final = cursor < text.length ? cursor + 1 : text.length;
    spans.push({ start: index, end: final, value: text.slice(index + 1, cursor) });
    index = final;
  }
  return spans;
}

function maskClauseProtectedText(text) {
  const spans = scanAuthorizationProtectedSpans(text);
  const chars = [...text];
  spans.forEach(span => {
    for (let index = span.start; index < span.end; index += 1) chars[index] = " ";
  });
  return { activeText: chars.join(""), protectedValues: spans.map(span => span.value) };
}

function exactControlKind(text) {
  const normalized = String(text ?? "")
    .toLowerCase()
    .replace(/[.!?]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:go ahead and|i want you to)\s+/, "");
  if (PENDING_CONFIRM_FORMS.includes(normalized) || /^(?:please\s+)?(?:confirm|approve|proceed|continue)(?:\s+(?:the\s+)?(?:pending|staged|current)\s+(?:action|confirmation|preview|request))?$/.test(normalized)) return "confirmation";
  if (PENDING_CANCEL_FORMS.includes(normalized) || /^(?:please\s+)?(?:cancel|discard)(?:\s+(?:the\s+)?(?:pending|staged|current)\s+(?:action|confirmation|preview|request))?$/.test(normalized)) return "cancellation";
  if (RUNTIME_STOP_FORMS.includes(normalized) || /^(?:please\s+)?(?:stop|abort)(?:\s+(?:the\s+)?(?:active|current)\s+(?:request|runtime|model|generation|work))?$/.test(normalized)) return "runtime_stop";
  return null;
}

function sentenceBoundary(text, index) {
  if (text[index] === "." && /[A-Za-z0-9_]/.test(text[index - 1] ?? "") && /[A-Za-z0-9_]/.test(text[index + 1] ?? "")) return false;
  const next = text[index + 1] ?? "";
  return !next || /\s|["'”’)\]]/.test(next);
}

function insideSpan(index, spans) {
  return spans.some(span => index >= span.start && index < span.end);
}

function createAuthorizationToken(input, contract) {
  const material = [
    `v${AUTHORIZATION_CONTRACT_VERSION}`,
    input,
    ...contract.authorizedClauses.map(clause => `${clause.id}:${clause.text}:${clause.sideEffectScopes.join(",")}`),
  ].join("\u241f");
  let hash = 2166136261;
  for (let index = 0; index < material.length; index += 1) {
    hash ^= material.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return Object.freeze({ version: AUTHORIZATION_CONTRACT_VERSION, requestHash: hash.toString(16).padStart(8, "0") });
}

function isWholeSafePreparation(input) {
  if (/['"`\u2018\u201c]/.test(input)) return false;
  if (/\b(?:explain|describe|clarify|syntax|steps?|procedure|meaning|example|reference|review|audit)\b/i.test(input)) return false;
  if (CONTEXTUAL_NON_AUTH_RE.test(input) || /\((?:permission|execution)\s+is\s+(?:expressly\s+)?(?:withheld|denied|outside)\b/i.test(input)) return false;
  const preamble = String.raw`(?:(?:please|go\s+ahead\s+and|i\s+want\s+you\s+to)\s+|for\s+(?:the\s+)?(?:current|pending)\s+(?:task|dataset|graph|mapping|parser|action|correction)\s*[,;:]?\s*)?`;
  return new RegExp(String.raw`^\s*${preamble}(?:do\s+not|don['’]?t)\s+run\s+(?:it|the\s+parser)?\s*[,;.]?\s*(?:just\s+)?(?:show|display)\b[\s\S]{0,100}\b(?:plan|parser)\b`, "i").test(input)
    || new RegExp(String.raw`^\s*${preamble}(?:generate|create|build)\b[\s\S]{0,120}\b(?:plan|parser)\b[\s\S]{0,80}\b(?:do\s+not|don['’]?t)\s+(?:run|execute|apply)\b`, "i").test(input);
}

function emptyAuthorization() {
  return Object.freeze({
    version: AUTHORIZATION_CONTRACT_VERSION,
    mode: AUTHORIZATION_MODE.CLARIFY,
    authorizedClauses: [],
    deniedClauses: [],
    ambiguousClauses: [],
    sideEffectScopes: [],
    evidence: ["request:empty"],
    statePreservationConflict: false,
    pendingAuthorizationConflict: false,
    wholeSafePreparation: false,
    truncated: false,
    token: null,
  });
}
