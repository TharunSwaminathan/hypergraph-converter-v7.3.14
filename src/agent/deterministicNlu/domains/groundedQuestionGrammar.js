export function compileGroundedQuestionGrammar(text = "", { nlu = null } = {}) {
  const raw = String(text ?? "");
  if (/\b(why did you interpret|how did you understand|what did you understand|why this interpretation)\b/i.test(raw)) {
    return {
      ok: true,
      domain: "grounded_question",
      intent: "explain_last_interpretation",
      diagnostics: {
        plannerPath: "deterministic_nlu",
        nluDomain: "grounded_question",
        nluIntent: "explain_last_interpretation",
        nluConfidence: nlu?.confidence,
        nluTrace: nlu?.trace,
      },
    };
  }
  if (/\b(what should i do next|next step|where am i|status)\b/i.test(raw)) {
    return {
      ok: true,
      domain: "grounded_question",
      intent: "workflow_status",
      diagnostics: {
        plannerPath: "deterministic_nlu",
        nluDomain: "grounded_question",
        nluIntent: "workflow_status",
        nluConfidence: nlu?.confidence,
        nluTrace: nlu?.trace,
      },
    };
  }
  return { ok: false, noMatch: true };
}
