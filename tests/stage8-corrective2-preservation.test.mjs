import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const artifact = JSON.parse(await readFile(
  new URL("../artifacts/v7.3.14-stage8-corrective2-preservation.json", import.meta.url),
  "utf8",
));

test("Stage 8 corrective #2 preserves every approved Stage 8 oracle gate", () => {
  assert.equal(artifact.parentCommit, "ea6c442b5219f7452fd1dc32663cec580790911e");
  assert.equal(artifact.packageVersion, "7.3.13");
  assert.equal(artifact.noStage9Work, true);
  assert.equal(Object.values(artifact.gates).every(Boolean), true);
  assert.equal(artifact.counts.mixed >= 1000, true);
  assert.equal(artifact.counts.mixedUnauthorizedSideEffects, 0);
  assert.equal(artifact.counts.mixedMissedAuthorizedClauses, 0);
  assert.equal(artifact.counts.mixedWrongSideEffectScopes, 0);
  assert.equal(artifact.counts.mixedStateFingerprintViolations, 0);
  assert.equal(artifact.counts.truncationHandlers, 0);
  assert.equal(artifact.counts.truncationProtectedStateViolations, 0);
  assert.equal(artifact.counts.existingReadOnlySafe, 9840);
  assert.equal(artifact.counts.independentReadOnlySafe, 6560);
  assert.equal(artifact.counts.positiveWrongBlocks, 0);
  assert.equal(artifact.counts.pendingReadOnlyPreserved, 30);
  assert.equal(artifact.counts.pendingCorrectionsSucceeded, 3);
  assert.equal(artifact.counts.modelFallbackExecuted, 0);
});
