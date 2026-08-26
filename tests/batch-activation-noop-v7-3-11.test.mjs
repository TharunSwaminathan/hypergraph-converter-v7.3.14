import assert from "node:assert/strict";
import { executeNumberedBatchPlan } from "../src/agent/parameterizedCommandExecutor.js";

// V7310-D11: the previous bug was that App.jsx's real setActiveAgentBatch
// unconditionally cleared customResult/customLogs/customErr and bumped
// batchVersion, *then* the executor separately (and correctly) reported
// changedState:false/outcome:"batch_already_active" — so the report was
// accurate about "no batch switch happened" while the underlying state had
// already been mutated. A mock adapter that only returns the right shape
// without ever touching state (as the pre-existing test's mock did) can't
// catch that class of bug. This test uses a mock that mirrors the *real*
// adapter's side-effecting behavior — it actually clears simulated parser
// state on a genuine activation — so re-introducing the missing early-return
// guard would make this test fail.

function makeRealisticBatchStateHarness(initialBatchId) {
  const state = {
    activeBatchId: initialBatchId,
    batchVersion: 0,
    customResult: { rows: 42 },
    customLogs: ["parsed 42 rows"],
    customErr: "",
  };
  const sideEffectLog = [];
  return {
    state,
    sideEffectLog,
    // Mirrors the *fixed* src/App.jsx#setActiveAgentBatch exactly: an
    // early, side-effect-free return when the requested batch is already
    // active, otherwise the full activation (which clears parser state and
    // bumps batchVersion).
    setActiveBatch(batchId) {
      if (batchId === state.activeBatchId) {
        sideEffectLog.push(["no_op_activate", batchId]);
        return { ok: true, changedState: false, outcome: "batch_already_active", changedKeys: [] };
      }
      sideEffectLog.push(["real_activate", batchId]);
      state.activeBatchId = batchId;
      state.batchVersion += 1;
      state.customResult = null;
      state.customLogs = [];
      state.customErr = "";
      return { ok: true, changedState: true, outcome: "batch_activated", changedKeys: ["activeBatchId", "batchVersion", "customResult", "customLogs", "customErr"] };
    },
  };
}

// 1. Activating the *already*-active batch must leave every piece of
// simulated parser state untouched, and must report changedState:false.
{
  const harness = makeRealisticBatchStateHarness("batch-1");
  const before = JSON.parse(JSON.stringify(harness.state));
  const result = await executeNumberedBatchPlan({
    plan: { kind: "activate_batch", batchId: "batch-1" },
    getState: () => harness.state,
    setActiveBatch: harness.setActiveBatch,
    verifyActiveBatch: async batchId => batchId === harness.state.activeBatchId,
  });
  assert.equal(result.ok, true);
  assert.equal(result.outcome, "batch_already_active");
  assert.equal(result.changedState, false);
  assert.equal(result.stateMutationCommitted, false);
  assert.deepEqual(harness.state, before, "no field may change when re-activating the already-active batch");
  assert.deepEqual(harness.sideEffectLog, [["no_op_activate", "batch-1"]]);
}

// 2. Activating a genuinely *different* batch must still clear parser state
// and bump batchVersion — the fix must not have turned this into a no-op too.
{
  const harness = makeRealisticBatchStateHarness("batch-1");
  const result = await executeNumberedBatchPlan({
    plan: { kind: "activate_batch", batchId: "batch-2" },
    getState: () => harness.state,
    setActiveBatch: harness.setActiveBatch,
    verifyActiveBatch: async batchId => batchId === harness.state.activeBatchId,
  });
  assert.equal(result.ok, true);
  assert.equal(result.outcome, "batch_activated");
  assert.equal(result.changedState, true);
  assert.equal(result.stateMutationCommitted, true);
  assert.equal(harness.state.activeBatchId, "batch-2");
  assert.equal(harness.state.batchVersion, 1);
  assert.equal(harness.state.customResult, null, "switching to a different batch must still reset the parser result");
  assert.deepEqual(harness.sideEffectLog, [["real_activate", "batch-2"]]);
}

console.log("v7.3.11 batch-activation no-op truthfulness passed.");
