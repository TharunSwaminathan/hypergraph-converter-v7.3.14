import { analyzeRequestSemantics } from "./deterministicNlu/requestSemantics.js";
import { requestMustRemainReadOnly } from "./orchestratorLoop.js";

export const DYNAMIC_UPDATE_ACTIONS = Object.freeze([
  "STAGE_DYNAMIC_HYPERGRAPH_UPDATE", "DISCARD_DYNAMIC_HYPERGRAPH_UPDATE",
  "ANALYZE_DYNAMIC_HYPERGRAPH_UPDATE", "APPLY_DYNAMIC_HYPERGRAPH_UPDATE",
]);

export function dynamicUpdateRequest(query) {
  const value = String(query ?? "").trim();
  const action = /^(?:please\s+)?discard (?:the )?pending update[.!]?$/i.test(value) ? DYNAMIC_UPDATE_ACTIONS[1]
    : /^(?:please\s+)?apply (?:the )?pending update[.!]?$/i.test(value) ? DYNAMIC_UPDATE_ACTIONS[3]
      : /^(?:please\s+)?(?:show how motifs? would change|run incremental motif analysis|analy[sz]e (?:the )?(?:pending )?motif delta)[.!]?$/i.test(value) ? DYNAMIC_UPDATE_ACTIONS[2] : null;
  return action ? { action } : null;
}

export function authorizeDynamicUpdateAction(action, query) {
  if (action === DYNAMIC_UPDATE_ACTIONS[2] && dynamicUpdateRequest(query)?.action === action) return { allowed: true };
  if (requestMustRemainReadOnly(query, analyzeRequestSemantics(query))) return { allowed: false, reason: "Quoted, negated, hypothetical or explanatory requests remain read-only." };
  if (action === DYNAMIC_UPDATE_ACTIONS[0]) return { allowed: true }; // exact typed operations are authorized again at the planner boundary
  return { allowed: dynamicUpdateRequest(query)?.action === action, reason: "The request did not authorize this exact pending-update action." };
}

export function pendingSelectorErrors(value) {
  return [
    ...(typeof value.updateId !== "string" || !/^pending-[A-Za-z0-9-]{1,100}$/.test(value.updateId) ? ["updateId must be a bounded application-issued pending ID."] : []),
    ...(!Number.isSafeInteger(value.revision) || value.revision < 1 ? ["revision must be a positive safe integer."] : []),
  ];
}
