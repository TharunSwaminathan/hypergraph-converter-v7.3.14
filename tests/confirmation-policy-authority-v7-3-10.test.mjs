import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  CAPABILITY_CONFIRMATION_ALIASES,
  CONFIRMATION_POLICY,
  confirmationActionTypeForCapability,
  getConfirmationCopy,
  requiresConfirmation,
  validateConfirmationPolicy,
} from "../src/agent/confirmationPolicy.js";

const componentSource = await readFile(new URL("../src/components/AgentChatPanel.jsx", import.meta.url), "utf8");
const plannerSource = await readFile(new URL("../src/agent/actionPlanner.js", import.meta.url), "utf8");

const stagedActionTypes = new Set();
for (const match of componentSource.matchAll(/actionType:\s*["']([^"']+)["']/g)) stagedActionTypes.add(match[1]);
for (const match of plannerSource.matchAll(/confirmation\(["']([^"']+)["']/g)) stagedActionTypes.add(match[1]);

const expectedStagedActions = [
  "parse_current_input",
  "run_custom_parser",
  "apply_custom_parser_result",
  "apply_graph_mutation",
  "export_training_full_files",
  "export_mapping_training_full_files",
  "parse_uploaded_files",
  "clear_graph",
];
for (const actionType of expectedStagedActions) {
  assert.ok(stagedActionTypes.has(actionType), `test extraction should find staged action ${actionType}`);
}

const validation = validateConfirmationPolicy({
  stagedActionTypes: [...stagedActionTypes],
  capabilityTypes: Object.keys(CAPABILITY_CONFIRMATION_ALIASES),
});
assert.deepEqual(validation, {
  ok: true,
  missingStagedPolicies: [],
  missingCapabilityPolicies: [],
});

for (const [capabilityType, actionType] of Object.entries(CAPABILITY_CONFIRMATION_ALIASES)) {
  assert.equal(confirmationActionTypeForCapability(capabilityType), actionType);
  assert.equal(requiresConfirmation(actionType), true, `${actionType} must require confirmation`);
  const copy = getConfirmationCopy(actionType);
  assert.equal(copy.missingPolicy, undefined);
  assert.ok(copy.title.length > 0 && copy.message.length > 0);
}

for (const [actionType, policy] of Object.entries(CONFIRMATION_POLICY)) {
  assert.equal(policy.required, true, `${actionType} should be an explicit required-confirmation policy`);
  assert.equal(Object.isFrozen(policy), true, `${actionType} policy should be immutable`);
}
assert.equal(Object.isFrozen(CONFIRMATION_POLICY), true);

const missing = getConfirmationCopy("not_registered");
assert.equal(missing.missingPolicy, true, "missing confirmation copy must fail closed");
assert.equal(requiresConfirmation("not_registered"), false);

console.log("v7.3.10 confirmation policy authority tests passed.");
