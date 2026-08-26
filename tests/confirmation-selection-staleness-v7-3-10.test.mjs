import assert from "node:assert/strict";
import { createConfirmationSnapshot, isConfirmationStale } from "../src/agent/confirmationState.js";
import { selectionFingerprint } from "../src/graph/entityResolver.js";

const selectionA = { type: "hyperedge", id: "h1" };
const selectionB = { type: "hyperedge", id: "h2" };
const state = {
  activeBatchId: null,
  batchVersion: 0,
  activeBatch: null,
  customResultId: null,
  graphId: "g1",
  graphVersion: 4,
  graphFingerprint: "fingerprint",
  customCodeVersion: 0,
  selectedGraphEntity: selectionA,
};
const bound = createConfirmationSnapshot("apply_graph_mutation", state, {
  selectionFingerprint: selectionFingerprint(selectionA),
});
assert.equal(isConfirmationStale(bound, state), false);
assert.equal(isConfirmationStale(bound, { ...state, selectedGraphEntity: selectionB }), true, "selection-only changes invalidate selection-bound confirmations");

const unbound = createConfirmationSnapshot("clear_graph", state);
assert.equal(isConfirmationStale(unbound, { ...state, selectedGraphEntity: selectionB }), false, "unbound confirmations ignore selection-only changes");

console.log("v7.3.10 confirmation selection staleness tests passed.");
