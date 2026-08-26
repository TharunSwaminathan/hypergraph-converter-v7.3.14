import assert from "node:assert/strict";
import {
  COMPOSITIONAL_HELP_FRAMES,
  runCompositionalHelpSafetyMatrix,
} from "../scripts/verify-compositional-help-safety.mjs";

assert.equal(Object.keys(COMPOSITIONAL_HELP_FRAMES).length, 40);
const report = await runCompositionalHelpSafetyMatrix();
assert.equal(report.frameCount, 40);
assert.ok(report.baseCount >= 160, "the release gate must cover the full state-changing command catalog");
assert.equal(report.total, report.baseCount * report.frameCount);
assert.deepEqual(report.allFailures, [], `instructional Help safety failures:\n${JSON.stringify(report.allFailures.slice(0, 10), null, 2)}`);
assert.equal(report.failures, 0);
console.log(`v7.3.10 compositional Help safety passed (${report.total} requests).`);
