import assert from "node:assert/strict";
import { PENDING_ROUTE, routePendingSubmission } from "../src/agent/pendingSubmissionRouter.js";

const pendingGraph = { id: "pending-1", actionType: "apply_graph_mutation" };
const readOnlyCancelQuestions = [
  "Would you mind explaining how to cancel the pending action?",
  "Can you explain the steps to cancel the pending action?",
  "Could you tell me what to type to stop the current request?",
  "I was wondering how to discard the pending action.",
  "What button do I click to cancel the pending action?",
  "Which menu lets me discard the preview?",
];
for (const query of readOnlyCancelQuestions) {
  const decision = routePendingSubmission({ query, pendingAction: pendingGraph });
  assert.equal(decision.route, PENDING_ROUTE.DETERMINISTIC_CONTROL_OR_HELP, query);
  assert.equal(decision.semantics.readOnlyScope, true, query);
  assert.equal(decision.semantics.directPendingCancellation, false, query);
}

for (const query of ["Cancel pending action", "Discard the pending action", "Never mind"]) {
  const decision = routePendingSubmission({ query, pendingAction: pendingGraph });
  assert.equal(decision.route, PENDING_ROUTE.DETERMINISTIC_CONTROL_OR_HELP, query);
  assert.equal(decision.semantics.directPendingCancellation, true, query);
  assert.equal(decision.semantics.readOnlyScope, false, query);
}

for (const query of ["Confirm pending action", "Proceed"]) {
  const decision = routePendingSubmission({ query, pendingAction: pendingGraph });
  assert.equal(decision.route, PENDING_ROUTE.DETERMINISTIC_CONTROL_OR_HELP, query);
  assert.equal(decision.semantics.directPendingConfirmation, true, query);
}

assert.equal(routePendingSubmission({
  query: "Actually add vertex 7 instead",
  pendingAction: pendingGraph,
  graphMutationCandidate: true,
}).route, PENDING_ROUTE.CONVERSATION_OR_BLOCK);

assert.equal(routePendingSubmission({
  query: "Change the pending vertex from 6 to 7.",
  pendingAction: pendingGraph,
  graphMutationCandidate: true,
}).route, PENDING_ROUTE.GRAPH_REPLACEMENT);

assert.equal(routePendingSubmission({
  query: "Use paper_id as the key",
  pendingAction: pendingGraph,
  mappingCandidate: true,
}).route, PENDING_ROUTE.DATASET_MAPPING);

assert.equal(routePendingSubmission({
  query: "What will this pending edit change?",
  pendingAction: pendingGraph,
  impactQuestion: true,
}).route, PENDING_ROUTE.GRAPH_IMPACT);

assert.equal(routePendingSubmission({
  query: "Open exports",
  pendingAction: pendingGraph,
}).route, PENDING_ROUTE.CONVERSATION_OR_BLOCK);

console.log("v7.3.10 pending submission router tests passed.");
