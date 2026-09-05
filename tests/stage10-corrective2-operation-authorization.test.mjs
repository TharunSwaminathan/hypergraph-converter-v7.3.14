import assert from "node:assert/strict";
import { runStage10Corrective2 } from "../scripts/stage10Corrective2Harness.mjs";

const result = await runStage10Corrective2();

assert.equal(result.original.protectedHandlerCalls, 0);
assert.equal(result.original.confirmationStages, 0);
assert.equal(result.original.stateChanged, false);

assert.ok(result.heldOut.cases >= 300);
assert.equal(result.heldOut.wrongPositiveAuthorizations, 0);
assert.equal(result.heldOut.protectedHandlerCalls, 0);
assert.equal(result.heldOut.confirmationStages, 0);
assert.equal(result.heldOut.stateChanges, 0);
assert.ok(result.heldOut.truePositives >= 9);
assert.equal(result.heldOut.wrongTruePositiveBlocks, 0);

assert.ok(result.operationBinding.invalidCases >= 12);
assert.equal(result.operationBinding.operationFamilySubstitutionsBlocked, result.operationBinding.operationFamilySubstitutions);
assert.equal(result.operationBinding.targetSubstitutionsBlocked, result.operationBinding.targetSubstitutions);
assert.equal(result.operationBinding.parameterSubstitutionsBlocked, result.operationBinding.parameterSubstitutions);
assert.equal(result.operationBinding.mixedSubstitutionsBlocked, result.operationBinding.mixedSubstitutions);
assert.equal(result.operationBinding.protectedHandlerCallsForInvalidPlans, 0);
assert.equal(result.operationBinding.confirmationStagesForInvalidPlans, 0);
assert.equal(result.operationBinding.stateChangesForInvalidPlans, 0);
assert.equal(result.operationBinding.validMatchingPlanExecutions, result.operationBinding.validMatchingPlans);

assert.equal(result.corrective1.totalCases, 651);
assert.equal(result.corrective1.readOnlyNoConsentCases, 640);
assert.equal(result.corrective1.truePositiveControls, 11);
assert.equal(result.corrective1.wrongPositiveAuthorizations, 0);
assert.equal(result.corrective1.protectedHandlerCalls, 0);
assert.equal(result.corrective1.confirmationStages, 0);
assert.equal(result.corrective1.stateChanges, 0);
assert.equal(result.corrective1.wrongBlocksOfTruePositiveControls, 0);

console.log("Stage 10 corrective #2 negation and operation-bound authorization tests passed.");
