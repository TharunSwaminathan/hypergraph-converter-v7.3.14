import assert from "node:assert/strict";
import {
  generationStateForOutcome,
  generationStateForStart,
  runtimeBannerText,
} from "../src/agent/localModelRuntimeState.js";

const running = generationStateForStart({ task: "plan_dataset_mapping_patch", requestId: "m1" });
const degraded = generationStateForOutcome(running, { outcome: "fallback", fallbackUsed: true, classification: "structured_output_invalid" });
assert.equal(degraded.status, "degraded");
assert.equal(
  runtimeBannerText({ model: "qwen3:8b", connectionStatus: "connected", generation: degraded }),
  "QWEN3:8B DEGRADED · DETERMINISTIC MAPPING FALLBACK AVAILABLE",
);

const timedOut = generationStateForOutcome(running, { outcome: "timeout", classification: "model_generation_timeout", fallbackUsed: true });
assert.equal(timedOut.status, "timed_out");
assert.match(runtimeBannerText({ model: "qwen3:8b", connectionStatus: "connected", generation: timedOut }), /DETERMINISTIC MAPPING FALLBACK AVAILABLE/);
assert.match(runtimeBannerText({ model: "qwen3:8b", connectionStatus: "disconnected", generation: degraded }), /DISCONNECTED/);

console.log("dataset mapping runtime state tests passed.");
