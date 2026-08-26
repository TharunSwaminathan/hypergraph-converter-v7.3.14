import assert from "node:assert/strict";
import { analyzeDeterministicNlu } from "../src/agent/deterministicNlu/deterministicNlu.js";
import { compileDeterministicAction } from "../src/agent/deterministicNlu/compileDeterministicAction.js";
import { sideEffectIsStateChanging } from "../src/agent/deterministicNlu/sideEffectPolicy.js";
import {
  V7_3_13_ADDED_READONLY_FRAMES,
  V7_3_13_READONLY_FRAMES,
  runV7313ReadOnlySafetyMatrix,
  v7313PositiveActionCorpus,
} from "../scripts/verify-v7-3-13-readonly-safety.mjs";
import { buildCompilerContexts } from "./helpers/evaluateDeterministicNluCorpus.mjs";
import { fixtureNameForExample } from "./helpers/deterministicCommandCatalogTestHelpers.mjs";

assert.equal(Object.keys(V7_3_13_ADDED_READONLY_FRAMES).length, 10);
assert.equal(Object.keys(V7_3_13_READONLY_FRAMES).length, 40);

const report = await runV7313ReadOnlySafetyMatrix();
assert.equal(report.baseCount, 164, "v7.3.13 gate must keep all 164 public state-changing catalog examples");
assert.equal(report.frameCount, 40);
assert.equal(report.total, 6560);
assert.equal(report.failures, 0, `v7.3.13 expanded read-only safety failures:\n${JSON.stringify(report.allFailures.slice(0, 10), null, 2)}`);
assert.deepEqual(report.allFailures, []);

const positiveFailures = [];
for (const { entry, example } of v7313PositiveActionCorpus()) {
  const contexts = await buildCompilerContexts(fixtureNameForExample(example));
  const nlu = analyzeDeterministicNlu(example.text, contexts.analysisContext);
  const compilation = compileDeterministicAction(nlu, contexts.compileContext);
  if (!sideEffectIsStateChanging(compilation.sideEffectClass) || compilation.dispatchAuthorized !== true) {
    positiveFailures.push({
      entryId: entry.id,
      text: example.text,
      expectedSideEffect: example.expectedSideEffect,
      actualSideEffect: compilation.sideEffectClass,
      dispatchAuthorized: compilation.dispatchAuthorized,
      speechAct: compilation.speechAct,
      blockReason: compilation.dispatchBlockReason,
    });
  }
}
assert.deepEqual(positiveFailures, [], `valid direct public action examples must remain executable:\n${JSON.stringify(positiveFailures.slice(0, 10), null, 2)}`);

console.log("v7.3.13 expanded read-only safety passed (6,560 requests, positive action contrast intact).");
