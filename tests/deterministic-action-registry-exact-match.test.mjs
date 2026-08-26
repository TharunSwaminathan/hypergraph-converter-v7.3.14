import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  ACTION_INTENT_VISIBILITY,
  ACTION_INTENT_REGISTRY,
  LEGACY_CONTROL_INTENT_SET,
  SPEECH_ACT_ONLY_INTENTS,
  findActionIntentForText,
} from "../src/agent/actionIntentRegistry.js";


const plannerSource = await readFile(new URL("../src/agent/actionPlanner.js", import.meta.url), "utf8");
const plannerCases = [...plannerSource.matchAll(/\bcase\s+["']([^"']+)["']\s*:/g)].map(match => match[1]);
const uniquePlannerCases = [...new Set(plannerCases)].sort();
const registryLegacyIntents = [...LEGACY_CONTROL_INTENT_SET].sort();
assert.equal(plannerCases.length, uniquePlannerCases.length, "actionPlanner must not contain duplicate literal switch cases");
assert.deepEqual(
  uniquePlannerCases,
  registryLegacyIntents,
  "literal actionPlanner switch cases must exactly match legacy-control registry intents",
);

for (const action of ACTION_INTENT_REGISTRY) {
  if (action.visibility !== ACTION_INTENT_VISIBILITY.PUBLIC) {
    for (const phrase of [...(action.examples ?? []), ...(action.aliases ?? [])]) {
      assert.equal(findActionIntentForText(phrase), null, `${action.id} must not be public-matchable`);
    }
  }
}

assert.equal(findActionIntentForText("Clear active batch")?.intent, "clear_uploaded_files");
assert.equal(findActionIntentForText("How do I clear active batch?"), null);
assert.equal(findActionIntentForText("Actually use paper_id instead of title"), null);
assert.equal(findActionIntentForText("No, use paper_id instead"), null);

for (const intent of SPEECH_ACT_ONLY_INTENTS) {
  assert.equal(LEGACY_CONTROL_INTENT_SET.has(intent), false, `${intent} must not be a legacy control planner action`);
}

console.log("deterministic action registry exact-match tests passed.");
