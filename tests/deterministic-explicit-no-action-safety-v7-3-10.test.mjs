import assert from "node:assert/strict";
import {
  EXPLICIT_NO_ACTION_FRAMES,
  runExplicitNoActionSafetyMatrix,
} from "../scripts/verify-explicit-no-action-safety.mjs";

assert.equal(Object.keys(EXPLICIT_NO_ACTION_FRAMES).length, 20);
const report = await runExplicitNoActionSafetyMatrix();
assert.equal(report.frameCount, 20);
assert.ok(report.baseCount >= 160, "the release gate must cover the full state-changing command catalog");
assert.equal(report.total, report.baseCount * report.frameCount);
assert.deepEqual(report.allFailures, [], `explicit non-execution safety failures:\n${JSON.stringify(report.allFailures.slice(0, 10), null, 2)}`);
assert.equal(report.failures, 0);
console.log(`v7.3.10 explicit no-action safety passed (${report.total} requests).`);
