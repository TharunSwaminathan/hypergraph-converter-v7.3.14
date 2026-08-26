import { DOMAIN_LEXICON, containsAlias, findLexiconMatches } from "./domainLexicon.js";
import { findActionIntentForText } from "../actionIntentRegistry.js";
import { helpSeekingMentionsActionCommand, helpSeekingTopic, isHelpSeekingQuestionText } from "./helpSeekingGuards.js";
import { ACTION_VERB_SOURCE, QUESTION_MODE_ACTION_VERB_SOURCE } from "./actionLexicon.js";
import { analyzeRequestSemantics } from "./requestSemantics.js";

const QUESTION_START = /^\s*(what|why|how|which|where|does|do|can|would|should)\b/i;

function candidate(domain, score, reasons = []) {
  return { domain, score: Number(score.toFixed(2)), reasons };
}

export function classifyDeterministicIntent({ text = "", entities = [], clauses = [], context = {} } = {}) {
  const raw = String(text ?? "");
  const fileCount = entities.filter(entity => entity.type === "file").length;
  const columnCount = entities.filter(entity => entity.type === "column").length;
  const graphEntities = entities.filter(entity => entity.type === "hyperedge" || entity.type === "vertex");
  const graphCount = graphEntities.length;
  const isQuestion = QUESTION_START.test(raw) || /\?$/.test(raw.trim());
  const startsAsQuestion = QUESTION_START.test(raw);
  const semantics = analyzeRequestSemantics(raw);
  // Preserve historical canonical mode labels while keeping execution safety
  // in the compositional speech-act/side-effect gate. These broad markers only
  // label an interpretation; they do not authorize a mutation.
  const isCorrection = semantics.correction || /\b(?:actually|instead|rather\s+than|i\s+meant|no,|no\b)/i.test(raw);
  const isCancellation = semantics.directPendingCancellation
    || semantics.directRuntimeStop
    || /\b(?:stop|cancel|never\s+mind|nevermind)\b/i.test(raw)
    || /\bdo\s+not\s+run\b/i.test(raw);
  const hasRouteFormat = /\b(h2v|v2h|h2h|csr|csc)\b/i.test(raw);
  const routeFormatContext = hasRouteFormat && /\b(route|format|export|input|tab|preview|use|open|switch)\b/i.test(raw);
  const exactLegacyAction = findActionIntentForText(raw);
  const helpSeeking = !exactLegacyAction && isHelpSeekingQuestionText(raw);
  const candidates = [];

  let helpScore = 0;
  const helpReasons = [];
  if (helpSeeking) {
    helpScore += helpSeekingMentionsActionCommand(raw) ? 2.4 : 1.25;
    helpReasons.push("global help-seeking frame");
  }
  if (/\bwhat commands can i use\b|\bwhat can (?:the )?(?:deterministic )?(?:chatbot|assistant) do\b/i.test(raw)) {
    helpScore += 1.1;
    helpReasons.push("catalog overview request");
  }
  if (/\bshow\b[\s\S]{0,60}\b(?:commands?|examples?)\b/i.test(raw) || /\bwhich commands?\b[\s\S]{0,60}\bconfirmation\b/i.test(raw)) {
    helpScore += 1.0;
    helpReasons.push("catalog command-list request");
  }
  if (/\bshow\b[\s\S]{0,40}\bread[- ]only\b[\s\S]{0,40}\bquestions?\b/i.test(raw)) {
    helpScore += 1.0;
    helpReasons.push("catalog read-only question list");
  }
  if (new RegExp(`\\bhow do i\\b[\\s\\S]{0,120}\\b(?:${ACTION_VERB_SOURCE})\\b`, "i").test(raw)) {
    helpScore += 1.55;
    helpReasons.push("how-to command help");
  }
  if (/\bquoted identifiers?\b|\bclarification\b|\bambiguity\b/i.test(raw)
      || /\b(?:what|which|show|list|supported|help)\b[\s\S]{0,80}\binput formats?\b/i.test(raw)) {
    helpScore += 0.95;
    helpReasons.push("catalog explanation topic");
  }
  if (/\bcan\b[\s\S]{0,80}\b(?:chatbot|assistant)\b[\s\S]{0,80}\b(?:run|execute)\b[\s\S]{0,40}\b(?:bfs|dfs|dijkstra|algorithm|connected components|k-core)\b/i.test(raw)) {
    helpScore += 1.05;
    helpReasons.push("panel-only algorithm help");
  }
  if (/^\s*what\s+would\s+happen\s+if\s+i\s+(?:clear|delete|remove)\s+(?:the\s+)?current\s+(?:graph|hypergraph)\b/i.test(raw)) {
    helpScore += 1.75;
    helpReasons.push("destructive current-graph hypothetical help");
  }
  if (helpScore > 0) candidates.push(candidate("help_query", helpScore, helpReasons));

  const legacyAction = exactLegacyAction;
  if (legacyAction) {
    candidates.push(candidate("legacy_action", exactLegacyAction ? 3.1 : 1.4, [`legacy action registry:${legacyAction.intent}`]));
  }

  const mappingStructurePhrase = /\b(?:vertex|node|author|hyperedge|paper)\s+(?:key|id|identifier|table|file|column)|\b(?:key|identifier|id\s+column|join|relationship|membership|incidence|mapping|hyperedge\s+time|time\s+(?:column|field|metadata)|validation[- ]only|empty\s+hyperedges?)\b/i.test(raw);
  const mappingEditVerb = /\b(use|set|make|treat|mark|map|connect|join|link|keep|retain|preserve|ignore|skip|exclude|drop|deduplicate|fail|warn|separate|group)\b/i.test(raw);
  const hasDatasetContext = Boolean(context.datasetMapping || context.datasetContext || context.batch);
  const explicitGroupingSyntax = /\b(?:first two|first 2|belong together|same group|same dataset|one dataset|parse mode|parsed? separately|validation[- ]only|only for validation|update stream|ignored?|grouping revision|grouped files?|create\s+(?:a\s+)?group\s+(?:called|named)|move\s+\S+\.(?:csv|tsv|json|txt)\s+(?:into|to|in))\b/i.test(raw);

  let mappingScore = 0;
  const mappingReasons = [];
  if (fileCount) { mappingScore += 0.28; mappingReasons.push("verified file mention"); }
  if (columnCount) { mappingScore += 0.24; mappingReasons.push("verified column mention"); }
  if (containsAlias(raw, DOMAIN_LEXICON.datasetRoles)) { mappingScore += 0.22; mappingReasons.push("dataset role alias"); }
  if (containsAlias(raw, DOMAIN_LEXICON.keyTerms)) { mappingScore += 0.18; mappingReasons.push("key term"); }
  if (containsAlias(raw, DOMAIN_LEXICON.relationshipTerms)) { mappingScore += 0.16; mappingReasons.push("relationship term"); }
  if (containsAlias(raw, DOMAIN_LEXICON.policyTerms)) { mappingScore += 0.14; mappingReasons.push("mapping policy term"); }
  if (mappingStructurePhrase) { mappingScore += 0.24; mappingReasons.push("mapping structure phrase"); }
  if (isQuestion && hasDatasetContext && /\b(?:mapping|role|key|identifier|join|relationship|membership|validation|empty hyperedge|deduplicat|author_id|paper_id|year)\b/i.test(raw)) {
    mappingScore += 0.32;
    mappingReasons.push("dataset-mapping question in active batch");
  }
  if (mappingEditVerb) mappingScore += 0.1;
  if (hasDatasetContext && (columnCount || mappingStructurePhrase)) mappingScore += 0.16;
  if (explicitGroupingSyntax && !/\b(?:vertex|node|author|hyperedge|paper)\s+(?:key|id|table)|\bjoin\b/i.test(raw)) mappingScore = Math.max(0, mappingScore - 0.45);
  if (mappingScore > 0) candidates.push(candidate("dataset_mapping", mappingScore, mappingReasons));

  let groupingScore = 0;
  const groupingReasons = [];
  const quotedIgnoreColumn = /\bcolumn\s+["'`]ignore["'`]|\b["'`]ignore["'`]\s+(?:from|in)\b/i.test(raw);
  const negatedIgnoreCommand = /\b(?:do\s+not|don't|not)\s+(?:ignore|skip|exclude)\b/i.test(raw);
  if (containsAlias(raw, DOMAIN_LEXICON.groupingTerms)) { groupingScore += 0.42; groupingReasons.push("grouping term"); }
  if (explicitGroupingSyntax) { groupingScore += 0.55; groupingReasons.push("explicit grouping syntax"); }
  if (/\bcreate\s+(?:a\s+)?group\s+(?:called|named)\b/i.test(raw)) { groupingScore += 0.7; groupingReasons.push("create dataset group"); }
  if (/\b(?:move|put|place)\s+\S+\.(?:csv|tsv|json|txt)\s+(?:into|to|in)\b/i.test(raw)) { groupingScore += 0.7; groupingReasons.push("move file to dataset group"); }
  if (/\b(first two|first 2|separate datasets?|separate dataset|belong together|validation only|validation-only|update stream)\b/i.test(raw)) groupingScore += 0.75;
  if (/\b(ignore|skip|exclude)\b/i.test(raw) && !quotedIgnoreColumn && !negatedIgnoreCommand) groupingScore += 0.3;
  if (/\b(ignore|skip|exclude)\b/i.test(raw) && fileCount && !quotedIgnoreColumn && !negatedIgnoreCommand) groupingScore += 0.55;
  if (isQuestion && hasDatasetContext && /\b(?:group|grouped|grouping|together|separate|independent|validation[- ]only|update stream|ignored|parser input|parse mode)\b/i.test(raw)) {
    groupingScore += 0.72;
    groupingReasons.push("dataset-grouping question in active batch");
  }
  if (fileCount >= 2) groupingScore += 0.18;
  if (groupingScore > 0) candidates.push(candidate("dataset_grouping", groupingScore, groupingReasons));

  let parserScore = 0;
  const parserMatches = findLexiconMatches(raw, DOMAIN_LEXICON.parserPhases);
  if (parserMatches.length) parserScore += 0.45 + parserMatches.length * 0.05;
  if (/\b(parser|transformation plan|plan)\b/i.test(raw)) parserScore += 0.22;
  if (/\b(?:transformation plan|parser workflow|generated parser|parser result)\b/i.test(raw)) parserScore += 0.55;
  if (/\b(?:build|rebuild|create|generate)\b[\s\S]{0,30}\bparser\b/i.test(raw)) parserScore += 0.62;
  if (/\bcontinue\b/i.test(raw) && context.parserWorkflow) parserScore += 0.3;
  if (/\b(status|where am i|what is ready)\b/i.test(raw) && context.parserWorkflow) parserScore += 0.3;
  if (parserScore > 0) candidates.push(candidate("parser_workflow", parserScore, parserMatches.map(match => match.id)));

  const exactHyperedgeId = /\bh\d[A-Za-z0-9_.:-]*\b/i.test(raw);
  const graphEditVerb = /\b(add|include|needs|put|insert|remove|take|detach|rename|call|clear|undo|revert|delete|set|change)\b/i.test(raw);
  const graphScopePhrase = /\b(?:from|to|in|into|out of|everywhere|entire graph|other hyperedges?|selected hyperedge|graph|hypergraph)\b/i.test(raw);
  const mappingMetadataContext = mappingStructurePhrase || (columnCount > 0 && /\b(?:key|column|field|metadata|time|weight|attribute)\b/i.test(raw));
  let graphScore = 0;
  if (graphCount) graphScore += 0.3;
  if (exactHyperedgeId) graphScore += 0.34;
  if (graphEditVerb && (graphCount || exactHyperedgeId || graphScopePhrase)) graphScore += 0.34;
  if (/\b(clear|undo|revert)\b/i.test(raw) && /\b(graph|hypergraph|mutation|change|edit)\b/i.test(raw)) graphScore += 0.42;
  if (/\b(?:remove|delete)\s+all\s+hyperedges\b/i.test(raw)) graphScore += 0.95;
  if (/\b(?:remove|delete)\s+\S[\s\S]{0,80}\bfrom\s+(?:the\s+)?entire\s+graph\b/i.test(raw)) graphScore += 0.95;
  if (context.graph && /\b(?:make|create|add)\s+(?:a\s+)?(?:new\s+)?group\s+(?:called|named)\b[\s\S]{0,80}\bwith\b/i.test(raw)) graphScore += 0.9;
  if (isQuestion && context.graph && /\b(?:graph|hypergraph|hyperedge|vertex|incidence|mutation|preview|selected|rename|remove|clear|undo|weight|attribute|members?)\b/i.test(raw)) {
    graphScore += 0.62;
  }
  if (!isQuestion && context.graph && graphEditVerb && /\b(?:graph|hypergraph|hyperedge|vertex|selected|that|previous|last|recent|weight|time|attribute|everywhere)\b/i.test(raw)) {
    graphScore += 0.82;
  }
  if (mappingMetadataContext && !exactHyperedgeId && !(isQuestion && context.graph)) graphScore = Math.max(0, graphScore - 0.3);
  if (routeFormatContext) graphScore = Math.max(0, graphScore - 0.18);
  if (graphScore > 0) candidates.push(candidate("graph_mutation", graphScore, ["graph edit phrase"]));

  let dashboardScore = 0;
  if (containsAlias(raw, DOMAIN_LEXICON.dashboardSections)) dashboardScore += 0.35;
  if (/\b(use|open|show|export|download|visual|stats|route|csr|json|h2v|v2h)\b/i.test(raw)) dashboardScore += 0.16;
  if (routeFormatContext) dashboardScore += 0.22;
  if (/\b(show only|first \d+|visual(?:ization)? limit|limit)\b/i.test(raw)) dashboardScore += 0.45;
  if (/\b(custom parser|ai prompt|route|tab)\b/i.test(raw)) dashboardScore += 0.35;
  if (dashboardScore > 0) candidates.push(candidate("dashboard_control", dashboardScore, ["dashboard phrase"]));

  let groundedScore = 0;
  if (/\b(why did you interpret|how did you understand|what did you understand|why this interpretation)\b/i.test(raw)) groundedScore += 0.65;
  if (/\bwhat should i do next|next step|status|where am i\b/i.test(raw)) groundedScore += 0.4;
  if (groundedScore > 0) candidates.push(candidate("grounded_question", groundedScore, ["grounded question"]));

  candidates.sort((a, b) => b.score - a.score || a.domain.localeCompare(b.domain));
  const primary = candidates[0] ?? candidate("unknown", 0, []);
  let mode = "unknown";
  if (helpSeeking) mode = "question";
  else if (isCancellation) mode = "cancellation";
  else if (isCorrection) mode = "correction";
  else if (startsAsQuestion && /^(why|how|would|can|should|does|do)\b/i.test(raw)) mode = "question";
  else if (isQuestion && !new RegExp(`\\b(?:${QUESTION_MODE_ACTION_VERB_SOURCE})\\b`, "i").test(raw)) mode = "question";
  else if (isQuestion && /\bnext step|status|why did|how did\b/i.test(raw)) mode = "status_request";
  else if (primary.domain !== "unknown") mode = "action";
  const parserIntent = parserMatches[0]?.canonical;
  const groupingIntent = findLexiconMatches(raw, DOMAIN_LEXICON.groupingTerms)[0]?.canonical;
  const datasetRoleIntent = findLexiconMatches(raw, DOMAIN_LEXICON.datasetRoles)[0]?.canonical;
  const quotedIncidenceExample = semantics.quoted
    && /\b(?:add|include|put|insert|remove|delete|take|detach)\b/i.test(raw)
    && !/\b(?:clear|rename|call)\b/i.test(raw);
  const graphIntent = quotedIncidenceExample ? null : graphIntentForText(raw) ?? findLexiconMatches(raw, DOMAIN_LEXICON.graphOperations)[0]?.canonical;
  const concreteMappingRoleCorrectionIntent = datasetRoleIntent && (
    /\b(?:vertex|vertices|node|nodes|hyperedge|hyperedges|membership|incidence|authorship)\s+(?:table|file|role)\b/i.test(raw)
    || /\b(?:is|are)\s+(?:the\s+)?(?:vertices|nodes|hyperedges|memberships|incidences)\b/i.test(raw)
    || /\bhyperedge\s+time\b|\btime\s+(?:metadata|column|field)\b/i.test(raw)
  ) ? datasetRoleIntent : null;
  const intent = primary.domain === "legacy_action" && legacyAction
    ? legacyAction.intent
    : primary.domain === "graph_mutation"
      ? (graphIntent ?? (mode === "correction" ? "correction" : "domain_action"))
      : primary.domain === "dataset_grouping"
        ? (groupingIntent ?? datasetRoleIntent ?? "domain_action")
      : primary.domain === "dataset_mapping"
          ? (mode === "correction" ? (groupingIntent ?? concreteMappingRoleCorrectionIntent ?? "correction") : datasetRoleIntent ?? groupingIntent ?? "domain_action")
          : primary.domain === "parser_workflow"
            ? (parserIntent ?? "domain_action")
            : mode === "correction" ? "correction" : primary.domain === "unknown" ? "unknown" : "domain_action";
  return {
    primaryDomain: primary.domain,
    primaryIntent: intent,
    mode,
    domainCandidates: candidates,
    intentCandidates: candidates.map(item => ({ intent: item.domain, score: item.score, reasons: item.reasons })),
    requestedHelpTopic: helpSeeking ? helpSeekingTopic(raw) : null,
    isHelpSeeking: helpSeeking,
    dispatchPolicy: helpSeeking ? "catalog_help_only" : "normal",
    safetyClass: ["dataset_mapping", "dataset_grouping"].includes(primary.domain)
      ? "reversible_state_edit"
      : primary.domain === "graph_mutation" ? "graph_edit_confirmation_required"
        : primary.domain === "legacy_action" ? "legacy_deterministic_action"
          : "read_only",
    clauses,
  };
}

function graphIntentForText(text = "") {
  const raw = String(text ?? "");
  if (/\b(?:undo|revert)\b/i.test(raw)) return "undo_last_mutation";
  if (/\bclear\b[\s\S]{0,80}\b(?:graph|hypergraph)|\b(?:remove|delete)\s+all\s+hyperedges\b/i.test(raw)) return "clear_graph";
  if (/\b(?:remove|delete)\b[\s\S]{0,80}\b(?:attribute|attr)\b|\b(?:attribute|attr)\b[\s\S]{0,80}\b(?:remove|delete)\b/i.test(raw)) return "remove_hyperedge_attribute";
  if (/\b(?:weight)\b/i.test(raw)) return "set_hyperedge_weight";
  if (/\b(?:time)\b/i.test(raw)) return "set_hyperedge_time";
  if (/\b(?:rename|call)\b[\s\S]{0,80}\b(?:hyperedge|edge|h\d)\b/i.test(raw)) return "rename_hyperedge";
  if (/\b(?:rename|call)\b/i.test(raw)) return "rename";
  if (/\b(?:remove|delete)\s+(?:the\s+)?(?:selected\s+|previous\s+|that\s+|old\s+)?(?:hyperedge|edge)\b|\b(?:remove|delete)\s+(?:hyperedge|edge)\s+\S+/i.test(raw)) return "remove_hyperedge";
  if (/\b(?:remove|delete|take|detach|no\s+longer)\b/i.test(raw)) return "remove_incidence";
  if (/\b(?:add|include|put|insert|needs|belongs|belong|connect|part\s+of)\b/i.test(raw)) return "add_incidence";
  return null;
}
