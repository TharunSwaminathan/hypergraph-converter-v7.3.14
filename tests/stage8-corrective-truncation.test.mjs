import test from "node:test";
import assert from "node:assert/strict";
import { runCorrectiveTruncationCorpus } from "../scripts/stage8CorrectiveHarness.mjs";

test("Stage 8 authorization fails closed for every truncated state-changing path", async () => {
  const result = await runCorrectiveTruncationCorpus();
  assert.equal(result.cases, 8);
  assert.equal(result.truncatedStateChangingAuthorized, 0);
  assert.equal(result.truncatedStateChangingHandlersCalled, 0);
  assert.equal(result.protectedStateViolations, 0);
  assert.ok(result.records.every(record => record.authorizationTruncated));
  assert.ok(result.records.every(record => record.decision.reason === "authorization_input_truncated"));
});
