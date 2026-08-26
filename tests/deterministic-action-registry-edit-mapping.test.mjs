import assert from "node:assert/strict";
import { findActionIntentForText, getActionIntentByIntent } from "../src/agent/actionIntentRegistry.js";
import { planAgentAction } from "../src/agent/actionPlanner.js";
import { CONFIRMATION, REQUIRED_CONTEXT, SIDE_EFFECT } from "../src/agent/deterministicNlu/commandCatalogSchema.js";

const action = getActionIntentByIntent("edit_mapping");
assert.ok(action, "edit_mapping must be a registry action");
assert.equal(action.sideEffect, SIDE_EFFECT.NAVIGATION);
assert.equal(action.confirmation, CONFIRMATION.NAVIGATION_ONLY);
assert.ok(action.requiredContext.includes(REQUIRED_CONTEXT.VALID_MAPPING));
assert.equal(findActionIntentForText("Edit the mapping")?.intent, "edit_mapping");
assert.equal(findActionIntentForText("Open the mapping editor")?.intent, "edit_mapping");
assert.equal(findActionIntentForText("How do I edit the mapping?"), null);

const withMapping = planAgentAction({ intent: "edit_mapping", normalized: "edit the mapping" }, {
  activeBatch: { mappingSpec: { summary: "test mapping" } },
});
assert.equal(withMapping.kind, "focus_mapping_editor");

const withoutMapping = planAgentAction({ intent: "edit_mapping", normalized: "edit the mapping" }, {});
assert.equal(withoutMapping.kind, "respond");
assert.match(withoutMapping.message, /Generate a mapping spec first/i);

console.log("deterministic edit-mapping action registry tests passed.");
