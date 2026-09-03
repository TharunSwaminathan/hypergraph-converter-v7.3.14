import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const artifact = JSON.parse(await readFile(
  new URL("./fixtures/v7.3.14/evidence/v7.3.14-stage8-corrective3-preservation.json", import.meta.url),
  "utf8",
));

test("Stage 8 corrective #3 preserves S8-N01 through S8-N04 and corrective #2", () => {
  assert.equal(artifact.parentCommit, "6b0af8a8a33e5dccc0a9cb7f336d82e1bddaa1e7");
  assert.equal(artifact.packageVersion, "7.3.13");
  assert.equal(artifact.noStage9Work, true);
  assert.equal(Object.values(artifact.gates).every(Boolean), true);
  assert.deepEqual(artifact.counts, {
    mixed: 1135,
    mixedUnauthorizedSideEffects: 0,
    mixedMissedAuthorizedClauses: 0,
    mixedWrongSideEffectScopes: 0,
    mixedStateFingerprintViolations: 0,
    truncation: 8,
    truncationBlocked: 8,
    truncationHandlers: 0,
    truncationProtectedStateViolations: 0,
    existingReadOnly: 9840,
    existingReadOnlySafe: 9840,
    independentReadOnly: 6560,
    independentReadOnlySafe: 6560,
    positiveAuthorization: 492,
    positiveWrongBlocks: 0,
    pendingReadOnly: 30,
    pendingReadOnlyPreserved: 30,
    pendingCorrections: 3,
    pendingCorrectionsSucceeded: 3,
    modelFallback: 8,
    modelFallbackExecuted: 0,
    corrective2Cases: 125,
    corrective2ExpectedExecutions: 5,
    corrective2ActualExecutions: 5,
    corrective2Violations: 0,
  });
});
