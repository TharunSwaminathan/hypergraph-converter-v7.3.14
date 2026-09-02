import test from "node:test";
import assert from "node:assert/strict";
import { runFinalGateMatrix } from "../scripts/stage8Corrective2Harness.mjs";

const matrix = await runFinalGateMatrix();
const byId = Object.fromEntries(matrix.records.map(record => [record.id, record]));

test("final gate adversarial matrix allows only exact plan/scope/authorization agreement", () => {
  assert.equal(matrix.cases, 125);
  assert.equal(matrix.expectedExecutions, 5);
  assert.equal(matrix.actualExecutions, 5);
  assert.equal(matrix.violations, 0);
  assert.equal(matrix.truncatedBlocks, 25);
});

test("S8-N03 graph plan cannot borrow navigation, mapping, read-only, unknown, or missing metadata", () => {
  for (const declaration of ["read_only", "wrong_valid", "unknown", "missing"]) {
    const record = byId[`graph:${declaration}:correct`];
    assert.equal(record.actualSideEffectClass, "graph_edit_preview");
    assert.equal(record.anyStateChangingHandlerCalls, 0);
    assert.equal(record.dispatchBlockReason, "side_effect_class_mismatch");
    assert.equal(record.protectedStateChanged, false);
  }
  const navigationBorrow = byId["graph:wrong_valid:unrelated"];
  assert.equal(navigationBorrow.anyStateChangingHandlerCalls, 0);
  assert.equal(navigationBorrow.confirmationStaged, false);
});

test("S8-N04 state-changing typed plans without request semantics fail closed", () => {
  for (const family of ["graph", "mapping", "parser", "dashboard", "legacy"]) {
    const record = byId[`${family}:correct:missing_contract`];
    assert.equal(record.anyStateChangingHandlerCalls, 0);
    assert.equal(record.dispatchBlockReason, "missing_request_semantics");
    assert.equal(record.protectedStateChanged, false);
  }
});

test("truncated authorization remains fail-closed when graph mutation metadata says read_only", () => {
  const record = byId["graph:read_only:truncated"];
  assert.equal(record.authorizationTruncated, true);
  assert.equal(record.anyStateChangingHandlerCalls, 0);
  assert.equal(record.protectedStateChanged, false);
});

test("model/fallback-shaped CSR request cannot execute a CLEAR_GRAPH plan mislabeled navigation", () => {
  const record = byId["graph:wrong_valid:unrelated"];
  assert.equal(record.authorization, "unrelated");
  assert.equal(record.declaredSideEffectClass, "navigation");
  assert.equal(record.actualSideEffectClass, "graph_edit_preview");
  assert.equal(record.anyStateChangingHandlerCalls, 0);
  assert.equal(record.confirmationStaged, false);
  assert.equal(record.dispatchBlockReason, "side_effect_class_mismatch");
});
