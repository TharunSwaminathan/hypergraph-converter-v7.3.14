import assert from "node:assert/strict";
import {
  ACTION_INTENT_REGISTRY,
  ACTION_INTENT_REGISTRY_VERSION,
  ACTION_INTENT_VISIBILITY,
  INTERNAL_ACTION_INTENTS,
  PUBLIC_ACTION_INTENTS,
  SPEECH_ACT_ONLY_INTENTS,
  extractActionArguments,
  findActionIntentForText,
} from "../src/agent/actionIntentRegistry.js";

assert.equal(ACTION_INTENT_REGISTRY_VERSION, "7.3.13");

const ids = ACTION_INTENT_REGISTRY.map(action => action.id);
const intents = ACTION_INTENT_REGISTRY.map(action => action.intent);
assert.equal(new Set(ids).size, ids.length, "action registry IDs must be unique");
assert.equal(new Set(intents).size, intents.length, "action registry intents must be unique");
assert.ok(PUBLIC_ACTION_INTENTS.length >= 20, "public legacy action inventory should be complete enough for v7.3.10");
assert.ok(INTERNAL_ACTION_INTENTS.length >= 8, "internal-only legacy intents should be explicitly classified");
assert.ok(SPEECH_ACT_ONLY_INTENTS.includes("correction"), "correction is a speech-act-only concept, not a public planner action");

for (const action of ACTION_INTENT_REGISTRY) {
  assert.ok(Object.values(ACTION_INTENT_VISIBILITY).includes(action.visibility), `${action.id} visibility`);
  assert.equal(typeof action.handlerKind, "string", `${action.id} handlerKind`);
  if (action.visibility === ACTION_INTENT_VISIBILITY.PUBLIC) {
    assert.ok(action.examples.length > 0, `${action.id} public command needs examples`);
    assert.ok(action.summary.length > 20, `${action.id} public command needs an effect summary`);
  } else if (action.visibility === ACTION_INTENT_VISIBILITY.SPEECH_ACT_ONLY) {
    assert.ok(action.internalReason, `${action.id} needs an internal reason`);
    assert.ok(action.requiredContext.length > 0, `${action.id} needs explicit context`);
  } else {
    assert.equal(action.examples.length, 0, `${action.id} internal/deprecated command must not advertise examples`);
    assert.ok(action.internalReason, `${action.id} needs an internal reason`);
  }
}

assert.equal(findActionIntentForText("Clear the active batch")?.intent, "clear_uploaded_files");
assert.equal(findActionIntentForText("Could you clear the active batch?")?.intent, "clear_uploaded_files");
assert.equal(findActionIntentForText("Validate the mapping")?.intent, "validate_mapping");
assert.equal(findActionIntentForText("Please connect local model")?.intent, "local_model_connect");
assert.equal(findActionIntentForText("Edit the mapping")?.intent, "edit_mapping");
assert.equal(findActionIntentForText("Activate batch 12")?.intent, "activate_batch_number");
assert.equal(findActionIntentForText("Generate parser for batch 2")?.intent, "generate_parser_for_batch");
assert.equal(findActionIntentForText("Use model qwen3:8b")?.intent, "local_model_select");
assert.equal(findActionIntentForText("How do I clear the active batch?"), null, "help-seeking text must not be treated as a direct action phrase");
assert.equal(findActionIntentForText("Actually, use paper_id instead of title"), null, "correction speech acts must not be direct public actions");

const activate = findActionIntentForText("Activate batch 12");
assert.equal(extractActionArguments(activate, "Activate batch 12").batchNumber, 12);
const generateParser = findActionIntentForText("Generate parser for batch 2");
assert.equal(extractActionArguments(generateParser, "Generate parser for batch 2").batchNumber, 2);
const useModel = findActionIntentForText("Use model qwen3:8b");
assert.equal(extractActionArguments(useModel, "Use model qwen3:8b").modelName, "qwen3:8b");

console.log("deterministic action intent registry tests passed.");
