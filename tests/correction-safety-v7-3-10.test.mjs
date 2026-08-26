import assert from "node:assert/strict";
import { COMMAND_CATALOG } from "../src/agent/deterministicNlu/commandCatalog.js";
import { prepareDeterministicTurn } from "../src/agent/deterministicNlu/prepareDeterministicTurn.js";
import { PENDING_ROUTE, routePendingSubmission } from "../src/agent/pendingSubmissionRouter.js";
import { buildCompilerContexts } from "./helpers/evaluateDeterministicNluCorpus.mjs";

const correctionEntry = COMMAND_CATALOG.find(entry => entry.id === "correction.replace-interpretation");
assert.ok(correctionEntry);
assert.ok(correctionEntry.examples.length >= 2, "correction entry must have executable examples");

const contexts = await buildCompilerContexts("dashboard-workspace");
for (const query of [
  "Actually, explain how to add vertex 6 to h2 instead of doing it.",
  "No, I only want instructions for how to create hyperedge h3.",
  "Actually, this is an example command, not a request: Add vertex 6 to h2.",
]) {
  const prepared = prepareDeterministicTurn({ query, analysisContext: contexts.analysisContext, compileContext: contexts.compileContext });
  assert.ok(["help_seeking_question", "reported_command", "quoted_command"].includes(prepared.nlu.speechAct), query);
  assert.equal(prepared.compilation.sideEffectClass, "read_only", query);
  assert.notEqual(prepared.compilation.typedKind, "GraphMutationPlan", query);
}

const pending = { id: "pending-1", actionType: "apply_graph_mutation" };
const ambiguousReplacement = routePendingSubmission({
  query: "Actually add vertex 7 to h2 instead.",
  pendingAction: pending,
  graphMutationCandidate: true,
});
assert.equal(ambiguousReplacement.route, PENDING_ROUTE.CONVERSATION_OR_BLOCK);
assert.equal(ambiguousReplacement.semantics.readOnlyScope, false);

const replacement = routePendingSubmission({
  query: "Change the pending vertex from 6 to 7.",
  pendingAction: pending,
  graphMutationCandidate: true,
});
assert.equal(replacement.route, PENDING_ROUTE.GRAPH_REPLACEMENT);
assert.equal(replacement.semantics.authorizedPendingCorrection, true);
assert.equal(replacement.semantics.readOnlyScope, false);

const readOnlyCorrection = routePendingSubmission({
  query: "Actually, explain how to cancel this instead.",
  pendingAction: pending,
});
assert.equal(readOnlyCorrection.route, PENDING_ROUTE.DETERMINISTIC_CONTROL_OR_HELP);
assert.equal(readOnlyCorrection.semantics.readOnlyScope, true);
assert.equal(readOnlyCorrection.semantics.directPendingCancellation, false);

console.log("v7.3.10 correction safety tests passed.");
