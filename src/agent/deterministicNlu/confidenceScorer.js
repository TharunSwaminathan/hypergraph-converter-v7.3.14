import { clamp, confidenceLevel } from "./nluTypes.js";

export function scoreConfidence({
  domainScore = 0,
  entityCount = 0,
  operationCount = 0,
  ambiguityCount = 0,
  hasCorrection = false,
  hasNegation = false,
  reasons = [],
} = {}) {
  let score = domainScore;
  score += Math.min(entityCount, 4) * 0.06;
  score += Math.min(operationCount, 4) * 0.08;
  if (hasCorrection) score += 0.06;
  if (hasNegation) score -= 0.04;
  score -= ambiguityCount * 0.2;
  const clamped = clamp(score, 0, 0.99);
  return {
    score: Number(clamped.toFixed(2)),
    level: confidenceLevel(clamped),
    reasons,
  };
}
