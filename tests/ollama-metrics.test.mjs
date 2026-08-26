import assert from "node:assert/strict";
import {
  appendBoundedRequestDiagnostic,
  createLocalModelRequestDiagnostic,
  normalizeOllamaMetrics,
} from "../src/agent/ollamaMetrics.js";

const metrics = normalizeOllamaMetrics({
  total_duration: 2_000_000_000,
  load_duration: 500_000_000,
  prompt_eval_count: 25,
  prompt_eval_duration: 250_000_000,
  eval_count: 50,
  eval_duration: 1_000_000_000,
  done_reason: "stop",
}, { clientElapsedMs: 2300 });

assert.equal(metrics.totalDurationMs, 2000);
assert.equal(metrics.loadDurationMs, 500);
assert.equal(metrics.promptEvalCount, 25);
assert.equal(metrics.evalCount, 50);
assert.equal(metrics.evalTokensPerSecond, 50);
assert.equal(metrics.approximateTransportOverheadMs, 300);
assert.equal(metrics.doneReason, "stop");

const clamped = normalizeOllamaMetrics({ total_duration: 3_000_000_000 }, { clientElapsedMs: 1000 });
assert.equal(clamped.approximateTransportOverheadMs, 0);

const diagnostic = createLocalModelRequestDiagnostic({
  requestId: "r1",
  task: "conversation",
  outcome: "success",
  metrics,
  promptChars: 100,
});
assert.equal("content" in diagnostic, false);
assert.equal(appendBoundedRequestDiagnostic([], diagnostic, 1).length, 1);
assert.equal(appendBoundedRequestDiagnostic([diagnostic], { ...diagnostic, requestId: "r2" }, 1)[0].requestId, "r2");

console.log("ollama metrics tests passed.");
