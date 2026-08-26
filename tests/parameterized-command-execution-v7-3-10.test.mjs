import assert from "node:assert/strict";
import { planAgentAction } from "../src/agent/actionPlanner.js";
import { validatePlannedAction } from "../src/agent/actionContextPolicy.js";
import { findActionIntentForText } from "../src/agent/actionIntentRegistry.js";
import { prepareDeterministicTurn } from "../src/agent/deterministicNlu/prepareDeterministicTurn.js";
import { executeModelSelectionPlan, executeNumberedBatchPlan } from "../src/agent/parameterizedCommandExecutor.js";
import { buildCompilerContexts } from "./helpers/evaluateDeterministicNluCorpus.mjs";

const contexts = await buildCompilerContexts("dashboard-workspace");
for (const [query, slot] of [
  ["Activate batch", "batchNumber"],
  ["Generate parser for batch", "batchNumber"],
  ["Use model", "modelName"],
]) {
  const prepared = prepareDeterministicTurn({ query, analysisContext: contexts.analysisContext, compileContext: contexts.compileContext });
  assert.equal(prepared.compilation.domain, "legacy_action", query);
  assert.equal(prepared.compilation.compiled.needsClarification, true, query);
  assert.deepEqual(prepared.compilation.typedValue.missingArguments, [slot], query);
  assert.equal(prepared.compilation.typedValue.sideEffect, "read_only", query);
  assert.doesNotMatch(prepared.compilation.compiled.clarificationQuestion ?? "", /undefined/, query);
}

const batchState = {
  activeBatchId: "batch-1",
  agentBatches: [
    { id: "batch-1", label: "Batch 1", mappingSpec: { files: [] }, mappingSpecStatus: "valid", fileNames: ["a.csv"] },
    { id: "batch-2", label: "Batch 2", mappingSpec: { files: [] }, mappingSpecStatus: "valid", fileNames: ["b.csv"] },
  ],
  activeBatch: { id: "batch-1", mappingSpec: { files: [] }, mappingSpecStatus: "valid" },
  localModel: { config: { enabled: true, model: "qwen3:8b" }, status: "connected" },
};
const generatePlan = planAgentAction({ intent: "generate_parser_for_batch", batchNumber: 2, normalized: "generate parser for batch 2" }, batchState);
assert.equal(generatePlan.kind, "activate_batch_then_generate_parser");
assert.equal(validatePlannedAction(findActionIntentForText("Generate parser for batch 2"), generatePlan).ok, true);

const calls = [];
const mutableState = { ...batchState };
const execution = await executeNumberedBatchPlan({
  plan: generatePlan,
  getState: () => mutableState,
  setActiveBatch: batchId => {
    calls.push(["activate", batchId]);
    mutableState.activeBatchId = batchId;
    mutableState.activeBatch = mutableState.agentBatches.find(batch => batch.id === batchId);
    return { ok: true };
  },
  verifyActiveBatch: async batchId => {
    calls.push(["verify", batchId]);
    return mutableState.activeBatchId === batchId;
  },
  dispatchPlan: async plan => {
    calls.push(["dispatch", plan.kind]);
    return { ok: true, outcome: "parser_generated", stateMutationCommitted: true };
  },
});
assert.equal(execution.ok, true);
assert.equal(execution.outcome, "batch_activated_then_parser_generated");
assert.equal(execution.changedState, true);
assert.equal(execution.stateMutationCommitted, true);
assert.deepEqual(calls, [
  ["activate", "batch-2"],
  ["verify", "batch-2"],
  ["dispatch", "generate_parser_from_mapping"],
]);

const alreadyActiveCalls = [];
const alreadyActive = await executeNumberedBatchPlan({
  plan: { kind: "activate_batch", batchId: "batch-1" },
  getState: () => batchState,
  setActiveBatch: batchId => {
    alreadyActiveCalls.push(batchId);
    return { ok: true };
  },
  verifyActiveBatch: async batchId => batchId === "batch-1",
});
assert.equal(alreadyActive.outcome, "batch_already_active");
assert.equal(alreadyActive.changedState, false);
assert.equal(alreadyActive.stateMutationCommitted, false);

const modelPlan = planAgentAction({ intent: "local_model_select", modelName: "qwen3:8b", normalized: "use model qwen3:8b" }, batchState);
assert.equal(modelPlan.kind, "set_local_model_name");
let modelPatch = null;
const modelExecution = executeModelSelectionPlan({
  plan: modelPlan,
  updateLocalModelSettings: patch => {
    modelPatch = patch;
    return { ok: true };
  },
});
assert.equal(modelExecution.ok, true);
assert.equal(modelExecution.changedState, true);
assert.deepEqual(modelPatch, { model: "qwen3:8b" });

console.log("v7.3.10 parameterized command execution tests passed.");
