import assert from "node:assert/strict";
import { createGraphIdentity, nextCommittedGraphIdentity } from "../src/graph/graphIdentity.js";
import { applyGraphMutationPlan } from "../src/graph/graphMutationEngine.js";
import { previewGraphMutation } from "../src/graph/graphMutationPreview.js";
import { createGraphHistoryEvent } from "../src/graph/graphHistory.js";
import { createMutationPlan } from "../src/graph/graphMutationValidator.js";

const base = [{ id: "h0", vertices: ["Alice", "Bob"], time: null, weight: 1, attributes: {} }];
const identity = createGraphIdentity(base, null, { replace: true });

assert.equal(identity.graphVersion, 1, "first committed non-empty graph starts at version 1");
assert.equal(nextCommittedGraphIdentity(identity, base).graphVersion, 1, "same canonical graph does not increment graphVersion");

const addPlan = createMutationPlan({
  graphIdentity: identity,
  summary: "Add Charlie to h0",
  operations: [{ type: "ADD_INCIDENCE", hyperedgeId: "h0", vertexId: "Charlie" }],
});
const addPreview = previewGraphMutation(base, addPlan, identity);
assert.equal(addPreview.ok, true);
assert.equal(addPreview.after.incidences, 3);
assert.equal(addPreview.graphChanged, true);

const afterIdentity = nextCommittedGraphIdentity(identity, addPreview.hyperedges);
assert.equal(afterIdentity.graphVersion, 2);
assert.equal(applyGraphMutationPlan(addPreview.hyperedges, addPlan, afterIdentity).ok, false, "old mutation plans become stale after graph changes");

const duplicatePreview = previewGraphMutation(addPreview.hyperedges, createMutationPlan({
  graphIdentity: afterIdentity,
  operations: [{ type: "ADD_INCIDENCE", hyperedgeId: "h0", vertexId: "Charlie" }],
}), afterIdentity);
assert.equal(duplicatePreview.ok, true);
assert.equal(duplicatePreview.graphChanged, false, "duplicate incidence is a no-op warning, not a content change");

const removeEmptyPlan = createMutationPlan({
  graphIdentity: afterIdentity,
  operations: [{ type: "REMOVE_INCIDENCE", hyperedgeId: "h0", vertexId: "Alice", emptyHyperedgePolicy: "remove_empty" }],
});
assert.equal(previewGraphMutation(addPreview.hyperedges, removeEmptyPlan, afterIdentity).ok, true);

const blockedAttrPlan = createMutationPlan({
  graphIdentity: afterIdentity,
  operations: [{ type: "SET_HYPEREDGE_ATTRIBUTE", hyperedgeId: "h0", key: "__proto__", value: "pollute" }],
});
assert.equal(previewGraphMutation(addPreview.hyperedges, blockedAttrPlan, afterIdentity).ok, false, "prototype-pollution keys are rejected");

const history = [createGraphHistoryEvent({
  graphIdentity: afterIdentity,
  beforeHyperedges: base,
  afterHyperedges: addPreview.hyperedges,
  plan: addPlan,
  preview: addPreview,
  source: "test",
})];
const undoPlan = createMutationPlan({
  graphIdentity: afterIdentity,
  operations: [{ type: "UNDO_LAST_MUTATION" }],
});
const undo = applyGraphMutationPlan(addPreview.hyperedges, undoPlan, afterIdentity, history);
assert.equal(undo.ok, true);
assert.deepEqual(undo.hyperedges, base);

console.log("graph mutation tests passed.");
