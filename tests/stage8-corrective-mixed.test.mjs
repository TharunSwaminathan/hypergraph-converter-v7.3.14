import test from "node:test";
import assert from "node:assert/strict";
import { runCorrectiveMixedCorpus } from "../scripts/stage8CorrectiveHarness.mjs";

test("Stage 8 corrective mixed corpus enforces positive recall, scope, and protected state", async () => {
  const result = await runCorrectiveMixedCorpus();
  assert.ok(result.cases >= 1_000);
  assert.equal(result.representativeCases, 8);
  assert.equal(result.unauthorizedSideEffects, 0);
  assert.equal(result.missedAuthorizedClauses, 0);
  assert.equal(result.wrongSideEffectScopes, 0);
  assert.equal(result.stateFingerprintViolations, 0);
  assert.deepEqual(result.failures, []);
});
