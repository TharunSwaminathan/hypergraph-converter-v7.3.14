import assert from "node:assert/strict";
import { runStage10Corrective1Corpus } from "../scripts/stage10Corrective1Harness.mjs";

const result = await runStage10Corrective1Corpus();

assert.equal(result.readOnlyNoConsentCases, 640);
assert.equal(result.truePositiveControls, 11);
assert.equal(result.totalCases, 651);
assert.equal(result.wrongPositiveAuthorizations, 0);
assert.equal(result.protectedHandlerCalls, 0);
assert.equal(result.confirmationStages, 0);
assert.equal(result.stateChanges, 0);
assert.equal(result.wrongBlocksOfTruePositiveControls, 0);
assert.deepEqual(result.failures, []);

assert.deepEqual(result.exact.authorizationScopes, []);
assert.equal(result.exact.authorizationMode, "read_only");
assert.equal(result.exact.requestMode, "read_only");
assert.equal(result.exact.readOnlyScope, true);
assert.equal(result.exact.graphMutationHandlerCalls, 0);
assert.equal(result.exact.confirmationStaged, false);
assert.equal(result.exact.stateChanged, false);
assert.equal(result.exact.preparedDomain, "grounded_question");
assert.equal(result.exact.typedKind, "GroundedQuestion");

console.log(`Stage 10 corrective #1 negated-consent corpus passed: ${result.readOnlyNoConsentCases} read-only cases, ${result.truePositiveControls} positive controls.`);
