export function semanticConfidenceFromCompilation(nlu, {
  operationCount = 0,
  resolvedEntityCount = 0,
  ambiguityCount = 0,
  validatorStatus = "not_run",
} = {}) {
  const lexical = Number(nlu?.confidence?.score ?? 0);
  let score = lexical;
  if (operationCount > 0) score += 0.18;
  if (resolvedEntityCount > 0) score += Math.min(0.12, resolvedEntityCount * 0.03);
  if (validatorStatus === "valid" || validatorStatus === "pending_preview") score += 0.08;
  if (ambiguityCount > 0) score -= Math.min(0.35, ambiguityCount * 0.12);
  score = Math.max(0, Math.min(0.99, score));
  return {
    score: Number(score.toFixed(2)),
    level: score >= 0.8 ? "high" : score >= 0.45 ? "medium" : "low",
    reasons: [
      ...(nlu?.confidence?.reasons ?? []),
      operationCount > 0 ? "typed operation compiled" : "no typed operation compiled",
      resolvedEntityCount > 0 ? "verified entities resolved" : "no verified entities resolved",
      validatorStatus ? `validator status: ${validatorStatus}` : null,
    ].filter(Boolean),
  };
}

