import assert from "node:assert/strict";
import { bindingMismatch, createDeterministicContextBinding, createStateContextBinding, staleBindingMessage } from "../src/agent/deterministicNlu/contextBinding.js";

const staleGraph = bindingMismatch(
  { graphId: "g1", graphVersion: 1, graphFingerprint: "a", pendingActionType: null, pendingActionPlanHash: null },
  { graphId: "g1", graphVersion: 2, graphFingerprint: "b", pendingActionType: null, pendingActionPlanHash: null },
  "graph",
);

assert.equal(staleGraph.stale, true);
assert.match(staleBindingMessage("graph"), /graph (?:or selected graph entity )?changed/);

const baseGraph = { graphId: "g1", graphVersion: 1, graphFingerprint: "same" };
const selectionBound = createDeterministicContextBinding({
  graphIdentity: baseGraph,
  selectedEntity: { type: "hyperedge", id: "h1" },
});
const changedSelection = createStateContextBinding({
  ...baseGraph,
  selectedGraphEntity: { type: "hyperedge", id: "h2" },
});
const selectionMismatch = bindingMismatch(selectionBound, changedSelection, "graph");
assert.equal(selectionMismatch.stale, true);
assert.equal(selectionMismatch.key, "selectedEntityFingerprint");

const unbound = createDeterministicContextBinding({ graphIdentity: baseGraph });
assert.equal(bindingMismatch(unbound, changedSelection, "graph").stale, false, "unbound graph requests do not become stale only because selection changed");

console.log("deterministic NLU stale-binding tests passed.");
