import assert from "node:assert/strict";
import { analyzePositiveAuthorization } from "../src/agent/deterministicNlu/positiveAuthorization.js";
import { routePendingSubmission, PENDING_ROUTE } from "../src/agent/pendingSubmissionRouter.js";
import { isPlausibleGraphMutationText } from "../src/agent/graphMutationModelPlanner.js";
import { createProtectedState, stateFingerprint } from "../scripts/stage8SafetyHarness.mjs";

const pendingAction = createProtectedState().pendingAction;
const pendingReadOnlyQueries = [
  "Explain the pending change.",
  "What happens if I change 6 to 7?",
  "How do I change the pending vertex from 6 to 7?",
  "Read this as text: change the pending vertex from 6 to 7.",
  "Keep the pending action exactly as it is.",
];
for (const query of pendingReadOnlyQueries) {
  const before = stateFingerprint(pendingAction);
  const routed = routePendingSubmission({
    query,
    pendingAction,
    graphMutationCandidate: isPlausibleGraphMutationText(query, { pendingAction }),
  });
  assert.notEqual(routed.route, PENDING_ROUTE.GRAPH_REPLACEMENT, query);
  assert.equal(stateFingerprint(pendingAction), before, query);
}

for (const query of [
  "Create hyperedge h3 with vertices 8 and 9; this is information only.",
  "Create hyperedge h3 with vertices 8 and 9; retain all current application state.",
  "Generate the plan and parser, but do not run it (permission is expressly withheld).",
]) {
  const auth = analyzePositiveAuthorization(query);
  assert.notEqual(auth.mode, "authorized", query);
  assert.equal(auth.token, null, query);
}

const longInput = `Explain this request without acting. ${"word ".repeat(900)}`.slice(0, 5_000);
const longAuth = analyzePositiveAuthorization(longInput);
assert.notEqual(longAuth.mode, "authorized");
assert.equal(longAuth.truncated, false);

console.log("Stage 8 pending preservation and bounded-input tests passed.");
