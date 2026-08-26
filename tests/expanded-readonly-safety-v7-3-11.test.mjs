import assert from "node:assert/strict";
import {
  EXPANDED_READONLY_FRAMES,
  runExpandedReadOnlySafetyMatrix,
} from "../scripts/verify-expanded-readonly-safety.mjs";

// Regression gate for V7310-D01: the v7.3.10 diagnostics ran an expanded
// 164-base x 97-frame read-only matrix (15,908 requests) and found 1,023
// state-changing dispatches. These 23 frames are exactly the ones that were
// unsafe. Zero state-changing results are required for every one of them,
// against the full production compile pipeline (not just the raw classifier).
assert.equal(Object.keys(EXPANDED_READONLY_FRAMES).length, 23);
const report = await runExpandedReadOnlySafetyMatrix();
assert.equal(report.frameCount, 23);
assert.ok(report.baseCount >= 160, "the release gate must cover the full state-changing command catalog");
assert.equal(report.total, report.baseCount * report.frameCount);
assert.deepEqual(report.allFailures, [], `expanded read-only safety failures:\n${JSON.stringify(report.allFailures.slice(0, 10), null, 2)}`);
assert.equal(report.failures, 0);
console.log(`v7.3.11 expanded read-only safety passed (${report.total} requests, previously-known-unsafe frame set).`);
