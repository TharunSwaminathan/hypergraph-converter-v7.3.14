import { extractActionArguments, findActionIntentForText } from "../../actionIntentRegistry.js";
import { defaultMissingArgumentMessage, missingActionArguments } from "../../actionContextPolicy.js";
import { CONFIRMATION, SIDE_EFFECT } from "../commandCatalogSchema.js";

export function compileLegacyActionGrammar(text = "", { nlu = null } = {}) {
  const match = findActionIntentForText(text);
  if (!match) return { ok: false, noMatch: true };
  const args = extractActionArguments(match, text);
  const missingArguments = missingActionArguments(match, args);
  const needsClarification = missingArguments.length > 0;
  return {
    ok: true,
    needsClarification,
    clarificationQuestion: needsClarification ? defaultMissingArgumentMessage(match, missingArguments) : null,
    domain: "legacy_action",
    intent: match.intent,
    typedKind: "LegacyActionIntent",
    action: {
      intent: match.intent,
      registryId: match.id,
      handlerKind: needsClarification ? "clarification" : match.handlerKind,
      sideEffect: needsClarification ? SIDE_EFFECT.READ_ONLY : match.sideEffect,
      confirmation: needsClarification ? CONFIRMATION.CLARIFICATION_ONLY : match.confirmation,
      requiredContext: match.requiredContext ?? [],
      argumentSlots: match.argumentSlots ?? [],
      missingArguments,
      modelPolicy: match.modelPolicy,
      destructive: needsClarification ? false : Boolean(match.destructive),
      ...args,
    },
    diagnostics: {
      plannerPath: "deterministic_nlu",
      nluDomain: "legacy_action",
      nluIntent: match.intent,
      nluConfidence: nlu?.confidence,
      nluTrace: {
        matchedRuleIds: [`legacy_action.${match.intent}`],
        resolvedEntityIds: [`action:${match.id}`],
        rejectedCandidates: needsClarification ? missingArguments.map(slot => `missing:${slot}`) : [],
      },
      operationTypes: needsClarification ? [] : [match.intent],
      missingArguments,
      legacyParserCalled: false,
      modelCalled: false,
      genericActionPlannerCalled: false,
      semanticConfidence: {
        score: needsClarification ? 0.74 : 0.92,
        level: needsClarification ? "medium" : "high",
        reasons: [needsClarification ? "public action missing required arguments" : "public legacy action registry match"],
      },
    },
  };
}
