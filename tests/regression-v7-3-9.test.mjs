import assert from "node:assert/strict";
import fs from "node:fs";
import { COMMAND_CATALOG, CATALOG_CURRENT_VERSION } from "../src/agent/deterministicNlu/commandCatalog.js";
import {
  ACTION_INTENT_REGISTRY_VERSION,
  PUBLIC_ACTION_INTENTS,
  SPEECH_ACT_ONLY_INTENTS,
} from "../src/agent/actionIntentRegistry.js";

const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));

assert.equal(pkg.name, "hypergraph-converter-studio");
assert.equal(pkg.version, "7.3.13");
assert.equal(CATALOG_CURRENT_VERSION, "7.3.13");
assert.equal(ACTION_INTENT_REGISTRY_VERSION, "7.3.13");
assert.ok(COMMAND_CATALOG.length >= 115, "v7.3.10 should preserve and extend the complete command inventory");
assert.ok(PUBLIC_ACTION_INTENTS.includes("edit_mapping"));
assert.ok(PUBLIC_ACTION_INTENTS.includes("activate_batch_number"));
assert.ok(PUBLIC_ACTION_INTENTS.includes("generate_parser_for_batch"));
assert.ok(PUBLIC_ACTION_INTENTS.includes("local_model_select"));
assert.ok(SPEECH_ACT_ONLY_INTENTS.includes("correction"));

const testScript = pkg.scripts.test;
const usesNodeTestRunner = /scripts\/run-node-tests\.mjs|scripts\\run-node-tests\.mjs/.test(testScript);
for (const expected of [
  "deterministic-help-generalized-speech.test.mjs",
  "deterministic-help-pending-state-protection.test.mjs",
  "deterministic-help-runtime-stop-protection.test.mjs",
  "deterministic-action-registry-exact-match.test.mjs",
  "deterministic-command-catalog-parameterized-actions.test.mjs",
  "deterministic-help-keyboard-accessibility.test.mjs",
]) {
  if (usesNodeTestRunner) {
    assert.ok(fs.existsSync(new URL(`./${expected}`, import.meta.url)), `test runner should discover ${expected}`);
  } else {
    assert.ok(testScript.includes(expected), `test script should include ${expected}`);
  }
}

console.log("v7.3.9 regression tests passed.");
