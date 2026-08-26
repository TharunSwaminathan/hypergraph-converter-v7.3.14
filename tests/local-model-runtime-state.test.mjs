import assert from "node:assert/strict";
import {
  generationStateForOutcome,
  generationStateForStart,
  generationStateForStopping,
  runtimeBannerText,
} from "../src/agent/localModelRuntimeState.js";

const running = generationStateForStart({ task: "graph_mutation_planner", requestId: "r1" });
assert.equal(running.status, "generating");
assert.equal(runtimeBannerText({ model: "qwen3:8b", connectionStatus: "connected", generation: running }), "QWEN3:8B WORKING · GRAPH EDIT PLANNER");

const stopping = generationStateForStopping(running);
assert.equal(stopping.status, "stopping");
assert.equal(stopping.lastClassification, "request_aborted");

const timedOut = generationStateForOutcome(running, { outcome: "timeout", classification: "model_generation_timeout" });
assert.equal(timedOut.status, "timed_out");
assert.match(runtimeBannerText({ model: "qwen3:8b", connectionStatus: "connected", generation: timedOut }), /TIMED OUT/);

const degraded = generationStateForOutcome(running, { outcome: "fallback", fallbackUsed: true });
assert.equal(degraded.status, "degraded");
assert.match(runtimeBannerText({ model: "qwen3:8b", connectionStatus: "connected", generation: degraded }), /DEGRADED/);

const success = generationStateForOutcome(running, { outcome: "success" });
assert.equal(success.status, "idle");
assert.match(runtimeBannerText({ model: "qwen3:8b", connectionStatus: "connected", generation: success }), /CONNECTED/);
assert.match(runtimeBannerText({ connectionStatus: "disconnected", generation: success }), /DISCONNECTED/);

console.log("local model runtime state tests passed.");
