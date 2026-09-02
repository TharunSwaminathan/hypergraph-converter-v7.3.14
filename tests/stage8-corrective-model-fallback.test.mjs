import test from "node:test";
import assert from "node:assert/strict";
import { runCorrectiveModelFallbackCorpus } from "../scripts/stage8CorrectiveHarness.mjs";

test("model and deterministic fallback plans never create execution authority", async () => {
  const result = await runCorrectiveModelFallbackCorpus();
  assert.ok(result.cases > 0);
  assert.equal(result.maliciousStateChangingPlansExecuted, 0);
  assert.equal(result.protectedStateViolations, 0);
  assert.ok(Object.values(result.sourceAuthority).every(Boolean));
  assert.ok(result.records.every(record => record.handlerCalls === 0));
});
