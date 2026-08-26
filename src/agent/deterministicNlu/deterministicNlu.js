import { createNluResult } from "./nluTypes.js";
import { normalizeInput } from "./normalizeInput.js";
import { tokenizeInput } from "./tokenizeInput.js";
import { parseClauses } from "./clauseParser.js";
import { extractEntities } from "./entityExtractor.js";
import { resolveNegations } from "./negationResolver.js";
import { resolveCorrections } from "./correctionResolver.js";
import { resolveDiscourseReferences } from "./discourseReferences.js";
import { buildAmbiguities } from "./ambiguityBuilder.js";
import { scoreConfidence } from "./confidenceScorer.js";
import { classifyDeterministicIntent } from "./intentClassifier.js";
import { classifySpeechAct } from "./speechActClassifier.js";

export function analyzeDeterministicNlu(text = "", context = {}) {
  const result = createNluResult(text);
  const normalized = normalizeInput(text, { maxChars: context.maxChars ?? 5000 });
  result.normalizedText = normalized.normalizedText;
  result.protectedSpans = normalized.protectedSpans;
  result.limits.truncated = normalized.truncated;
  result.modifiers = normalized.modifiers;

  const tokens = tokenizeInput(normalized.normalizedText, normalized.protectedSpans);
  result.tokens = tokens;
  const clauses = parseClauses(normalized.normalizedText, tokens);
  result.clauses = clauses;

  const datasetContext = context.datasetMapping ?? context.datasetContext ?? {};
  const extracted = extractEntities({ text: normalized.normalizedText, tokens, datasetContext, protectedSpans: normalized.protectedSpans });
  result.entities = extracted.entities;
  result.values = extracted.values;
  result.negations = resolveNegations(clauses);
  result.corrections = resolveCorrections(normalized.normalizedText, clauses);
  result.references = resolveDiscourseReferences(normalized.normalizedText, context);

  const classified = classifyDeterministicIntent({
    text: normalized.normalizedText,
    entities: result.entities,
    clauses,
    context,
  });
  Object.assign(result, classified);
  const speech = classifySpeechAct(normalized.normalizedText, { domain: result.primaryDomain, mode: result.mode });
  result.speechAct = speech.speechAct;
  result.speechActReasons = speech.reasons;
  if (["informational_question", "help_seeking_question", "hypothetical_question", "explanation_question"].includes(result.speechAct)) result.mode = "question";
  if (result.speechAct === "status_question") result.mode = "status_request";
  if (result.speechAct === "correction") result.mode = "correction";
  if (result.speechAct === "cancellation") result.mode = "cancellation";
  result.ambiguities = buildAmbiguities({
    references: result.references,
    entities: result.entities,
    context: {
      ...datasetContext,
      rawText: normalized.normalizedText,
    },
  });
  result.unresolvedReferences = result.references.filter(reference => !reference.resolved && (reference.ambiguous || reference.type === "pronoun"));
  result.confidence = scoreConfidence({
    domainScore: classified.domainCandidates[0]?.score ?? 0,
    entityCount: result.entities.length,
    operationCount: 0,
    ambiguityCount: result.ambiguities.length,
    hasCorrection: result.corrections.length > 0,
    hasNegation: result.negations.length > 0,
    reasons: classified.domainCandidates[0]?.reasons ?? [],
  });
  result.trace.matchedRuleIds = [
    `speech_act.${result.speechAct}`,
    ...(classified.domainCandidates[0]?.reasons ?? []).map(reason => `domain.${classified.primaryDomain}.${reason.replaceAll(" ", "_")}`),
  ];
  result.trace.resolvedEntityIds = result.entities.map(entity => entity.id ?? `${entity.type}:${entity.surface}`);
  result.trace.rejectedCandidates = result.ambiguities.map(item => item.type);
  return result;
}
