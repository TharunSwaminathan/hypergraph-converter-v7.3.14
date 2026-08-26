import {
  buildRuleBasedActionPlan,
  validateOllamaActionPlan,
} from "./ollamaActionPlanValidator.js";
export { resolveCanonicalIntent } from "./canonicalIntentResolver.js";

// Single production entry point for deterministic routing.
// The optional local Ollama orchestrator proposes ActionPlan JSON, but every
// fallback, continuation, and validation pass lands back on this same planner.
export function buildDeterministicActionPlan(userQuery, state = {}) {
  return buildRuleBasedActionPlan(userQuery, state);
}

export function validateOrRepairActionPlan(rawResponse, context = {}) {
  return validateOllamaActionPlan(rawResponse, context);
}
