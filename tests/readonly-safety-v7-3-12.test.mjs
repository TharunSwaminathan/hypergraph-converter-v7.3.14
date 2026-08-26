import assert from "node:assert/strict";
import {
  V7_3_12_READONLY_FRAMES,
  runV7312ReadOnlySafetyMatrix,
} from "../scripts/verify-v7-3-12-readonly-safety.mjs";

assert.equal(Object.keys(V7_3_12_READONLY_FRAMES).length, 30);
const report = await runV7312ReadOnlySafetyMatrix();
assert.equal(report.baseCount, 164, "v7.3.12 release gate must cover the 164 public state-changing command examples");
assert.equal(report.frameCount, 30);
assert.equal(report.total, 4920);
assert.equal(report.failures, 0, `v7.3.12 independent read-only safety failures:\n${JSON.stringify(report.allFailures.slice(0, 10), null, 2)}`);
assert.deepEqual(report.allFailures, []);
console.log("v7.3.12 independent read-only safety passed (4,920 requests).");
