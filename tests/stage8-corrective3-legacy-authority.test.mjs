import test from "node:test";
import assert from "node:assert/strict";
import { runLegacyAuthorityMatrix } from "../scripts/stage8Corrective3Harness.mjs";

const matrix = await runLegacyAuthorityMatrix();

test("every public legacy action works with correct or omitted registry side-effect metadata", () => {
  assert.equal(matrix.publicActionCount, 49);
  assert.equal(matrix.correctPositiveFailures, 0);
  assert.equal(matrix.omittedAuthorityFailures, 0);
});

test("legacy actions cannot self-declare a lower or unrelated privilege", () => {
  assert.equal(matrix.legacyMetadataBypassCalls, 0);
  assert.equal(matrix.corruptMetadataHandlerCalls, 0);
  assert.equal(matrix.expectedExecutionFailures, 0);
  assert.equal(matrix.protectedStateViolations, 0);
  assert.equal(matrix.kindOnlySelfDeclaredPrivilegeCalls, 0);
  assert.equal(matrix.kindOnlySelfDeclaredBlockReason, "legacy_side_effect_metadata_mismatch");
  assert.equal(matrix.compiledActionSelfDeclaredPrivilegeCalls, 0);
  assert.equal(matrix.compiledActionSelfDeclaredBlockReason, "legacy_side_effect_metadata_mismatch");
});

test("unregistered legacy kinds fail closed", () => {
  const record = matrix.records.find(item => item.variant === "unregistered");
  assert.equal(record.dispatchBlockReason, "legacy_action_unregistered");
  assert.equal(record.handlerCalls.legacyAction, 0);
  assert.equal(matrix.unregisteredHandlerCalls, 0);
});
