import test from "node:test";
import assert from "node:assert/strict";
import {
  REGISTERED_IDENTITIES,
  runIdentityCorruptionMatrix,
} from "../scripts/stage8Corrective3Harness.mjs";

const matrix = await runIdentityCorruptionMatrix();

test("canonical plan identity covers every registered domain and typed-kind pair", () => {
  assert.deepEqual(
    matrix.registeredIdentities,
    REGISTERED_IDENTITIES.map(([domain, typedKind]) => ({ domain, typedKind })),
  );
});

test("every protected family is blocked under every wrong typed kind", () => {
  for (const family of matrix.protectedFamilies) {
    const records = matrix.identityRecords.filter(record => record.family === family.id);
    const validKinds = matrix.registeredIdentities.filter(identity => identity.domain === family.domain).length;
    assert.equal(records.length, matrix.typedKinds.length - validKinds, family.id);
    assert.ok(records.some(record => record.typedKind === "GroundedQuestion"), family.id);
    assert.ok(records.some(record => record.typedKind === "DeterministicHelpQuery"), family.id);
    assert.ok(records.every(record => record.dispatchBlockReason === "plan_identity_mismatch"), family.id);
    assert.ok(records.every(record => record.protectedHandlerCalls === 0), family.id);
  }
  assert.equal(matrix.identityMismatchHandlerCalls, 0);
  assert.equal(matrix.identityMismatchWrongReasons, 0);
});

test("nominally read-only plans reject unexpected protected-operation payloads", () => {
  assert.equal(matrix.unexpectedPayloadCases, 4);
  assert.equal(matrix.unexpectedPayloadHandlerCalls, 0);
  assert.equal(matrix.unexpectedPayloadWrongReasons, 0);
  assert.ok(matrix.unexpectedPayloadRecords.every(record => (
    record.dispatchBlockReason === "unexpected_state_changing_payload"
  )));
});

test("model-shaped identity corruption is blocked without confirmation or state change", () => {
  const record = matrix.modelAdversarial;
  assert.equal(record.dispatchBlockReason, "plan_identity_mismatch");
  assert.equal(record.handlerCalls.graphMutation, 0);
  assert.equal(record.handlerCalls.dashboardControl, 0);
  assert.equal(record.confirmationStaged, false);
  assert.equal(record.protectedStateChanged, false);
  assert.equal(matrix.protectedStateViolations, 0);
});
