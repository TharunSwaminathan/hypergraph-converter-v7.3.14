import assert from "node:assert/strict";
import { isPlausibleGraphMutationText } from "../src/agent/graphMutationModelPlanner.js";
import { PENDING_ROUTE, routePendingSubmission } from "../src/agent/pendingSubmissionRouter.js";

const pendingAction = Object.freeze({
  actionType: "apply_graph_mutation",
  planId: "pending-plan-1",
  nonce: "nonce-1",
  graphSnapshot: [{ id: "h2", vertices: ["6"] }],
});

const readonlyPendingFrames = [
  command => `Explain: ${command}`,
  command => `No execution: ${command}`,
  command => `Preserve current state and explain ${command.toLowerCase()}.`,
  command => `Explain \`${command}\`.`,
  command => `What does "${command}" mean?`,
  command => `Tell me what would happen if I ${command.toLowerCase()}.`,
  command => `Show me the syntax for ${command.toLowerCase()}.`,
  command => `Compare ${command.toLowerCase()} with doing nothing.`,
  command => `I may ${command.toLowerCase()} later; explain it now.`,
  command => `The documentation says "${command}". What does that command do?`,
  command => `Read-only request: ${command}`,
  command => `No changes: ${command}`,
  command => `No mutation: ${command}`,
  command => `Before doing anything, explain ${command.toLowerCase()}.`,
  command => `Hold off on ${command.toLowerCase()}; explain it first.`,
  command => `This is not a request to execute: ${command}`,
  command => `You do not have permission to ${command.toLowerCase()}; only explain it.`,
  command => `Informational only — ${command}`,
  command => `Describe ${command.toLowerCase()}.`,
  command => `Sample command only: ${command}`,
];

const base = "Change the pending vertex from 6 to 7";
const failures = [];
for (const wrap of readonlyPendingFrames) {
  const query = wrap(base);
  const candidate = isPlausibleGraphMutationText(query, { pendingAction });
  const routed = routePendingSubmission({ query, pendingAction, graphMutationCandidate: candidate });
  if (routed.route === PENDING_ROUTE.GRAPH_REPLACEMENT) failures.push({ query, route: routed.route, semantics: routed.semantics });
}
assert.equal(readonlyPendingFrames.length, 20);
assert.deepEqual(failures, [], `read-only pending requests must preserve the staged action:\n${JSON.stringify(failures, null, 2)}`);

const direct = routePendingSubmission({
  query: base,
  pendingAction,
  graphMutationCandidate: isPlausibleGraphMutationText(base, { pendingAction }),
});
assert.equal(direct.route, PENDING_ROUTE.GRAPH_REPLACEMENT);

for (const control of ["Confirm pending action", "Cancel pending action"]) {
  const routed = routePendingSubmission({ query: control, pendingAction });
  assert.equal(routed.route, PENDING_ROUTE.DETERMINISTIC_CONTROL_OR_HELP, control);
}

console.log("v7.3.12 pending-state preservation passed (20 read-only wrappers, direct correction/control contrasts).");
