import assert from "node:assert/strict";
import { isPlausibleGraphMutationText } from "../src/agent/graphMutationModelPlanner.js";
import { routePendingSubmission, PENDING_ROUTE } from "../src/agent/pendingSubmissionRouter.js";
import { EXPANDED_READONLY_FRAMES } from "../scripts/verify-expanded-readonly-safety.mjs";
import { COMPOSITIONAL_HELP_FRAMES } from "../scripts/verify-compositional-help-safety.mjs";
import { EXPLICIT_NO_ACTION_FRAMES } from "../scripts/verify-explicit-no-action-safety.mjs";

const pendingAction = { actionType: "apply_graph_mutation" };

// V7310-D02 required accepted replacements: a typed correction names the
// pending target and supplies a concrete new field/operand/value.
const acceptedCorrections = [
  "Change the pending vertex from 6 to 7.",
  "Use h3 instead of h2 in the pending graph edit.",
  "Replace author_id with researcher_id in the pending mapping.",
];
for (const query of acceptedCorrections) {
  assert.equal(isPlausibleGraphMutationText(query, { pendingAction }), true, `expected a typed correction to be recognized: ${query}`);
  const route = routePendingSubmission({ query, pendingAction, graphMutationCandidate: true });
  assert.equal(route.route, PENDING_ROUTE.GRAPH_REPLACEMENT, `expected GRAPH_REPLACEMENT for: ${query}`);
}

// V7310-D02 required read-only examples: these must preserve the pending
// snapshot rather than being reinterpreted as a replacement.
const mustStayReadOnly = [
  "Information only: Add vertex 6 to h2.",
  "Explain the meaning of add vertex 6 to h2.",
  "What button cancels the pending action?",
  "Tell me the consequences before I cancel the pending action.",
  "I only need the syntax for cancel pending action.",
];
for (const query of mustStayReadOnly) {
  const candidate = isPlausibleGraphMutationText(query, { pendingAction });
  const route = routePendingSubmission({ query, pendingAction, graphMutationCandidate: candidate });
  assert.equal(route.route, PENDING_ROUTE.DETERMINISTIC_CONTROL_OR_HELP, `expected read-only routing to be preserved for: ${query}`);
}

// Stress test: wrap plausible pending-relevant base commands in every known
// read-only frame (expanded + compositional-help + explicit-no-action) and
// assert none of them get routed as a graph-mutation replacement while a
// mutation is pending. Generic candidacy tokens ("only", "use", "it",
// "that", "cancel" appearing anywhere) must not cause a false positive.
const stressBases = [
  "Add vertex 6 to h2",
  "Cancel pending action",
  "Create hyperedge h3 with vertices 8 and 9",
];
const allFrames = { ...EXPANDED_READONLY_FRAMES, ...COMPOSITIONAL_HELP_FRAMES, ...EXPLICIT_NO_ACTION_FRAMES };
let total = 0;
const misrouted = [];
for (const base of stressBases) {
  for (const [frameName, wrap] of Object.entries(allFrames)) {
    const query = wrap(base);
    total += 1;
    const candidate = isPlausibleGraphMutationText(query, { pendingAction });
    const route = routePendingSubmission({ query, pendingAction, graphMutationCandidate: candidate });
    if (route.route === PENDING_ROUTE.GRAPH_REPLACEMENT) misrouted.push({ frameName, query });
  }
}
assert.deepEqual(misrouted, [], `pending-state read-only frames must never route as a replacement:\n${JSON.stringify(misrouted.slice(0, 10), null, 2)}`);

console.log(`v7.3.11 pending-state correction typing passed (${total} wrapped requests, 0 misrouted as replacement).`);
