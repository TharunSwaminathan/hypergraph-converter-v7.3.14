import assert from "node:assert/strict";
import { runStage10Corrective3 } from "../scripts/stage10Corrective3Harness.mjs";

const result = await runStage10Corrective3();

assert.equal(result.positiveEvidence.negativeEvidenceAbsenceIsAuthority, false);
assert.equal(result.positiveEvidence.graphMutationVerbAloneIsAuthority, false);

assert.ok(result.heldOut.cases >= 250);
assert.equal(result.heldOut.wrongPositiveAuthorizations, 0);
assert.equal(result.heldOut.protectedHandlerCalls, 0);
assert.equal(result.heldOut.confirmationStages, 0);
assert.equal(result.heldOut.stateChanges, 0);
assert.equal(result.heldOut.truePositives, 8);
assert.equal(result.heldOut.wrongTruePositiveBlocks, 0);
assert.equal(result.heldOut.freshExact.length, 8);
assert.ok(result.heldOut.freshExact.every(record => record.authorizationMode === "read_only"
  && record.sideEffectScopes.length === 0
  && record.protectedHandlerCalls === 0
  && record.confirmationStages === 0
  && record.stateChanged === false));

assert.equal(result.caseBinding.graphIds.hyperedges.join(","), "h1,H1");
assert.equal(result.caseBinding.graphIds.vertices.join(","), "a,A");
assert.equal(result.caseBinding.cases, 11);
assert.equal(result.caseBinding.exactAllowed, 4);
assert.equal(result.caseBinding.invalidBlocked, 7);
assert.equal(result.caseBinding.protectedHandlerCallsForInvalid, 0);
assert.equal(result.caseBinding.confirmationStagesForInvalid, 0);
assert.equal(result.caseBinding.stateChanges, 0);
assert.deepEqual(result.caseBinding.failures, []);

const byId = new Map(result.caseBinding.records.map(record => [record.id, record]));
assert.equal(byId.get("exact-h1-to-h1").allowed, true);
assert.equal(byId.get("exact-h1-to-H1").allowed, false);
assert.equal(byId.get("exact-H1-to-H1").allowed, true);
assert.equal(byId.get("exact-H1-to-h1").allowed, false);
assert.equal(byId.get("vertex-a-to-A").allowed, false);
assert.equal(byId.get("vertex-a-hyperedge-substitution").allowed, false);
assert.equal(byId.get("unique-case-insensitive-hyperedge").allowed, true);
assert.equal(byId.get("unique-case-insensitive-wrong-raw").allowed, false);
assert.equal(byId.get("unique-case-insensitive-vertex").allowed, true);
assert.equal(byId.get("ambiguous-case-insensitive-to-h1").allowed, false);
assert.equal(byId.get("ambiguous-case-insensitive-to-H1").allowed, false);

assert.equal(result.corrective1.totalCases, 651);
assert.equal(result.corrective1.wrongPositiveAuthorizations, 0);
assert.equal(result.corrective1.protectedHandlerCalls, 0);
assert.equal(result.corrective1.confirmationStages, 0);
assert.equal(result.corrective1.stateChanges, 0);
assert.equal(result.corrective1.wrongBlocksOfTruePositiveControls, 0);

assert.equal(result.corrective2.heldOut.cases, 605);
assert.equal(result.corrective2.heldOut.wrongPositiveAuthorizations, 0);
assert.equal(result.corrective2.heldOut.protectedHandlerCalls, 0);
assert.equal(result.corrective2.heldOut.confirmationStages, 0);
assert.equal(result.corrective2.heldOut.stateChanges, 0);
assert.equal(result.corrective2.heldOut.wrongTruePositiveBlocks, 0);
assert.equal(result.corrective2.operationBinding.cases, 26);
assert.equal(result.corrective2.operationBinding.protectedHandlerCallsForInvalidPlans, 0);
assert.equal(result.corrective2.operationBinding.validMatchingPlanExecutions, 9);
assert.equal(result.corrective2.operationBinding.wrongValidPlanBlocks, 0);

console.log("Stage 10 corrective #3 positive-evidence and graph-aware case-binding tests passed.");
