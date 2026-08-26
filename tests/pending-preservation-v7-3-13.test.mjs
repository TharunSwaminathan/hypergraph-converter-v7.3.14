import assert from "node:assert/strict";
import { isPlausibleGraphMutationText } from "../src/agent/graphMutationModelPlanner.js";
import { PENDING_ROUTE, routePendingSubmission } from "../src/agent/pendingSubmissionRouter.js";

const pendingAction = Object.freeze({
  actionType: "apply_graph_mutation",
  planId: "pending-plan-v7313",
  nonce: "nonce-v7313",
  plan: {
    operations: [{ type: "ADD_INCIDENCE", hyperedgeId: "h2", vertexId: "6" }],
  },
  graphSnapshot: [{ id: "h2", vertices: ["6"] }],
});

const readonlyPendingQueries = Object.freeze([
  ["curious", "I'm curious what change the pending vertex from 6 to 7 means."],
  ["clarify", "Clarify the meaning of: Change the pending vertex from 6 to 7"],
  ["review", "I am reviewing this command, not authorizing it: Change the pending vertex from 6 to 7"],
  ["do_not_act", "Do not act on this; Change the pending vertex from 6 to 7"],
  ["leave", "Leave everything unchanged; Change the pending vertex from 6 to 7"],
  ["keep", "Keep the graph exactly as it is; Change the pending vertex from 6 to 7"],
  ["discussion", "This is for discussion, not execution: Change the pending vertex from 6 to 7"],
  ["explanation", "I want an explanation, not an action: Change the pending vertex from 6 to 7"],
  ["dont_touch", "Answer only; don't touch the graph: Change the pending vertex from 6 to 7"],
  ["dont_alter", "Do not alter anything; Change the pending vertex from 6 to 7"],
  ["state_intact", "Keep state intact and discuss: Change the pending vertex from 6 to 7"],
  ["considering", "I am considering change the pending vertex from 6 to 7; tell me about it."],
  ["before_auth", "Before I authorize anything, explain change the pending vertex from 6 to 7."],
  ["no_auth", "I haven't authorized change the pending vertex from 6 to 7; explain it."],
  ["dont_act_yet", "Don't act yet—tell me about change the pending vertex from 6 to 7."],
  ["pause", "Pause before doing this and explain: Change the pending vertex from 6 to 7"],
  ["reference", "For reference purposes, the command is: Change the pending vertex from 6 to 7"],
  ["auditing", "I'm auditing the behavior of change the pending vertex from 6 to 7, not requesting it."],
  ["tell_about", "Please tell me about change the pending vertex from 6 to 7, but don't do it."],
  ["consequences", "Could you explain the consequences of change the pending vertex from 6 to 7?"],
]);

const failures = [];
for (const [name, query] of readonlyPendingQueries) {
  const candidate = isPlausibleGraphMutationText(query, { pendingAction });
  const routed = routePendingSubmission({ query, pendingAction, graphMutationCandidate: candidate });
  if (routed.route === PENDING_ROUTE.GRAPH_REPLACEMENT) {
    failures.push({
      name,
      query,
      route: routed.route,
      mode: routed.semantics.mode,
      authorized: routed.semantics.executionAuthorized,
      authorizedPendingCorrection: routed.semantics.authorizedPendingCorrection,
      readOnlyScope: routed.semantics.readOnlyScope,
    });
  }
}

assert.equal(readonlyPendingQueries.length, 20);
assert.deepEqual(failures, [], `v7.3.13 read-only pending corpus must preserve staged state:\n${JSON.stringify(failures, null, 2)}`);

const direct = routePendingSubmission({
  query: "Change the pending vertex from 6 to 7",
  pendingAction,
  graphMutationCandidate: isPlausibleGraphMutationText("Change the pending vertex from 6 to 7", { pendingAction }),
});
assert.equal(direct.route, PENDING_ROUTE.GRAPH_REPLACEMENT);
assert.equal(direct.semantics.authorizedPendingCorrection, true);

for (const control of ["Confirm pending action", "Cancel pending action"]) {
  const routed = routePendingSubmission({ query: control, pendingAction });
  assert.equal(routed.route, PENDING_ROUTE.DETERMINISTIC_CONTROL_OR_HELP, control);
}

console.log("v7.3.13 pending-state corpus passed (20/20 preserve, direct correction/control contrasts intact).");
