import assert from "node:assert/strict";
import { evaluateActionContext, validatePlannedAction } from "../src/agent/actionContextPolicy.js";
import { findActionIntentForText } from "../src/agent/actionIntentRegistry.js";
import { dispatchCompiledAction } from "../src/agent/deterministicNlu/dispatchCompiledAction.js";
import { prepareDeterministicTurn } from "../src/agent/deterministicNlu/prepareDeterministicTurn.js";
import { buildCompilerContexts } from "./helpers/evaluateDeterministicNluCorpus.mjs";

const contexts = await buildCompilerContexts("dashboard-workspace");

async function dispatchQuery(query, state = {}, pendingAction = null) {
  const prepared = prepareDeterministicTurn({ query, analysisContext: contexts.analysisContext, compileContext: contexts.compileContext });
  const calls = [];
  const result = await dispatchCompiledAction({
    prepared,
    query,
    state,
    pendingAction,
    handlers: {
      contextMissing: async (_prepared, _query, context) => {
        calls.push(["contextMissing", context.requirement]);
        return { handled: true, outcome: "clarification" };
      },
      legacyAction: async () => {
        calls.push(["legacyAction"]);
        return { handled: true, outcome: "executed", stateMutationCommitted: true };
      },
      clarification: async () => {
        calls.push(["clarification"]);
        return { handled: true, outcome: "clarification" };
      },
    },
  });
  return { prepared, result, calls };
}

const stopWithoutWork = await dispatchQuery("Stop", { activeRequestCount: 0 });
assert.deepEqual(stopWithoutWork.calls, [["contextMissing", "active_cancellable_work"]]);
assert.equal(stopWithoutWork.result.outcome, "clarification");
assert.equal(stopWithoutWork.result.runtimeTrace.stateMutationCommitted, false);

const cancelWithoutPending = await dispatchQuery("Cancel pending action", {});
assert.deepEqual(cancelWithoutPending.calls, [["contextMissing", "pending_action"]]);

const confirmWithPending = await dispatchQuery("Confirm pending action", {}, {
  kind: "confirmation",
  actionType: "apply_graph_mutation",
});
assert.deepEqual(confirmWithPending.calls, [["legacyAction"]]);
assert.equal(confirmWithPending.result.runtimeTrace.stateMutationCommitted, true);

const missingBatch = findActionIntentForText("Activate batch 9");
assert.equal(evaluateActionContext(missingBatch, { agentBatches: [] }, null, { batchNumber: 9 }).ok, false);
const validBatch = { id: "batch-9", mappingSpec: { files: [] }, mappingSpecStatus: "valid" };
assert.equal(evaluateActionContext(missingBatch, { agentBatches: [validBatch] }, null, { batchNumber: 9 }).ok, true);

const generateAction = findActionIntentForText("Generate parser for batch 9");
assert.equal(evaluateActionContext(generateAction, { agentBatches: [{ id: "batch-9" }] }, null, { batchNumber: 9 }).ok, false);
assert.equal(evaluateActionContext(generateAction, { agentBatches: [validBatch] }, null, { batchNumber: 9 }).ok, true);

const modelAction = findActionIntentForText("Use model qwen3:8b");
assert.equal(validatePlannedAction(modelAction, { kind: "set_local_model_name" }).ok, true);
const rejected = validatePlannedAction(modelAction, { kind: "clear_graph" });
assert.equal(rejected.ok, false);
assert.match(rejected.message, /Registry authority rejected/);

console.log("v7.3.10 action registry runtime authority tests passed.");
