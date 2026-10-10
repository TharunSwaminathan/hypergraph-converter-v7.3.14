import assert from "node:assert/strict";
import { GRAPH_TYPES } from "../src/candy/contracts/graphTypes.js";
import { createConfirmationSnapshot, isConfirmationStale } from "../src/agent/confirmationState.js";
import { requiresConfirmation } from "../src/agent/confirmationPolicy.js";
import { createMutationPlan } from "../src/graph/graphMutationValidator.js";
import { commitGraphState, createGraphState, graphIdentityFromState } from "../src/graph/graphState.js";
import {
  APPLY_PENDING_HYPERGRAPH_UPDATE_ACTION,
  createPendingHypergraphUpdateController,
} from "../src/graph/pendingHypergraphUpdate.js";

let graphState = createGraphState([{ id: "h1", vertices: ["a"], time: null, weight: 1, attributes: {} }]);
graphState = commitGraphState(graphState, graphState.hyperedges, { graphType: GRAPH_TYPES.DYNAMIC_HYPERGRAPH });
const controller = createPendingHypergraphUpdateController({ getGraphState: () => graphState });
const plan = createMutationPlan({
  graphIdentity: graphIdentityFromState(graphState),
  operations: [{ type: "ADD_HYPEREDGE", hyperedgeId: "h2", vertices: ["b"] }],
});
const first = (await controller.stage(plan)).pendingUpdate;
const state = confirmationState(graphState, first);
const applyConfirmation = createConfirmationSnapshot(APPLY_PENDING_HYPERGRAPH_UPDATE_ACTION, state, {
  mutationPlan: first.plan,
  pendingUpdate: first,
});

assert.equal(requiresConfirmation(APPLY_PENDING_HYPERGRAPH_UPDATE_ACTION), true);
assert.equal(isConfirmationStale(applyConfirmation, state), false);
assert.equal(applyConfirmation.pendingUpdateId, first.updateId);
assert.equal(applyConfirmation.pendingUpdateRevision, first.revision);
assert.equal(applyConfirmation.pendingUpdateDigest, first.updateDigest);
assert.equal(applyConfirmation.proposedGraphFingerprint, first.proposedGraphFingerprint);
assert.equal(applyConfirmation.nextGraphVersion, first.nextGraphVersion);

// A07: editing creates a new exact binding and invalidates the old Apply authorization.
const replacementPlan = createMutationPlan({
  graphIdentity: graphIdentityFromState(graphState),
  operations: [{ type: "REMOVE_HYPEREDGE", hyperedgeId: "h1" }],
});
const second = (await controller.stage(replacementPlan)).pendingUpdate;
assert.equal(isConfirmationStale(applyConfirmation, confirmationState(graphState, second)), true);

// Analysis confirmation is a different action and cannot authorize Apply.
const analysisConfirmation = createConfirmationSnapshot("run_candy_expensive_compute", confirmationState(graphState, second), {
  mutationPlan: second.plan,
  pendingUpdate: second,
});
await assert.rejects(controller.apply(analysisConfirmation), error => error?.code === "INVALID_UPDATE_BATCH");

// Digest/proposed-state substitution also invalidates the confirmation.
const tamperedState = confirmationState(graphState, { ...second, updateDigest: `sha256:${"0".repeat(64)}` });
const secondConfirmation = createConfirmationSnapshot(APPLY_PENDING_HYPERGRAPH_UPDATE_ACTION, confirmationState(graphState, second), {
  mutationPlan: second.plan,
  pendingUpdate: second,
});
assert.equal(isConfirmationStale(secondConfirmation, tamperedState), true);

// A08: graph replacement/type authority changes invalidate the Apply token.
const replacementGraph = commitGraphState(graphState, [{ id: "replacement", vertices: ["z"], time: null, weight: 1, attributes: {} }], { replacement: true });
assert.equal(isConfirmationStale(secondConfirmation, confirmationState(replacementGraph, second)), true);

function confirmationState(state, pendingDynamicUpdate) {
  return {
    graphId: state.graphId,
    graphVersion: state.graphVersion,
    graphType: state.graphType,
    graphFingerprint: state.graphFingerprint,
    pendingDynamicUpdate,
  };
}

console.log("CANDY Scope 5B confirmation-boundary tests passed.");
