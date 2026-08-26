import { analyzeRequestSemantics } from "./deterministicNlu/requestSemantics.js";
import { isTypedPendingGraphCorrection } from "./graphMutationModelPlanner.js";

export const PENDING_ROUTE = Object.freeze({
  DETERMINISTIC_CONTROL_OR_HELP: "deterministic_control_or_help",
  DATASET_MAPPING: "dataset_mapping",
  GRAPH_IMPACT: "graph_impact",
  GRAPH_REPLACEMENT: "graph_replacement",
  CONVERSATION_OR_BLOCK: "conversation_or_block",
});

/**
 * Pure ordering policy used by the production pending-action path and tests.
 * It deliberately gives exact pending controls and explicitly scoped safe
 * impact questions priority, while replacement requires a typed, authorized
 * pending correction instead of a loose action phrase.
 */
export function routePendingSubmission({
  query = "",
  pendingAction = null,
  mappingCandidate = false,
  graphMutationCandidate = false,
  impactQuestion = false,
} = {}) {
  const semantics = analyzeRequestSemantics(query);
  if (
    semantics.directPendingCancellation
    || semantics.directPendingConfirmation
    || semantics.directRuntimeStop
  ) {
    return { route: PENDING_ROUTE.DETERMINISTIC_CONTROL_OR_HELP, semantics };
  }
  if (mappingCandidate && semantics.mode === "execute" && semantics.executionAuthorized === true) return { route: PENDING_ROUTE.DATASET_MAPPING, semantics };
  if (pendingAction?.actionType === "apply_graph_mutation") {
    if (impactQuestion) return { route: PENDING_ROUTE.GRAPH_IMPACT, semantics };
    if (
      semantics.mode === "execute"
      && semantics.executionAuthorized === true
      && semantics.authorizedPendingCorrection === true
      && graphMutationCandidate
      && isTypedPendingGraphCorrection(query)
    ) {
      return { route: PENDING_ROUTE.GRAPH_REPLACEMENT, semantics };
    }
  }
  if (semantics.readOnlyScope) {
    return { route: PENDING_ROUTE.DETERMINISTIC_CONTROL_OR_HELP, semantics };
  }
  return { route: PENDING_ROUTE.CONVERSATION_OR_BLOCK, semantics };
}
