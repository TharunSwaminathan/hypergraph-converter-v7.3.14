import assert from "node:assert/strict";
import { COMMAND_CATALOG, CATALOG_CURRENT_VERSION } from "../src/agent/deterministicNlu/commandCatalog.js";
import { TYPED_KINDS } from "../src/agent/deterministicNlu/commandCatalogSchema.js";
import {
  ACTION_INTENT_REGISTRY,
  ACTION_INTENT_VISIBILITY,
  INTERNAL_ACTION_INTENTS,
  PUBLIC_ACTION_INTENTS,
  SPEECH_ACT_ONLY_INTENTS,
} from "../src/agent/actionIntentRegistry.js";

const catalogById = new Map(COMMAND_CATALOG.map(entry => [entry.id, entry]));
const catalogOps = new Set(COMMAND_CATALOG.flatMap(entry => entry.operationTypes ?? []));

for (const action of ACTION_INTENT_REGISTRY.filter(item => item.visibility === ACTION_INTENT_VISIBILITY.PUBLIC)) {
  const entry = catalogById.get(action.id);
  assert.ok(entry, `missing catalog entry for ${action.id}`);
  assert.equal(entry.domain, "legacy_action", action.id);
  assert.equal(entry.typedKind, TYPED_KINDS.LEGACY_ACTION_INTENT, action.id);
  assert.equal(entry.intent, action.intent, action.id);
  assert.deepEqual(entry.operationTypes, [action.intent], action.id);
  assert.equal(entry.sinceVersion, CATALOG_CURRENT_VERSION, action.id);
}

for (const intent of PUBLIC_ACTION_INTENTS) {
  assert.ok(catalogOps.has(intent), `catalog must expose public legacy intent ${intent}`);
}
for (const intent of INTERNAL_ACTION_INTENTS) {
  assert.ok(!catalogOps.has(intent), `catalog must not expose internal-only intent ${intent}`);
}
for (const intent of SPEECH_ACT_ONLY_INTENTS) {
  assert.ok(catalogOps.has(intent), `catalog documents speech-act-only concept ${intent}`);
  assert.notEqual(
    COMMAND_CATALOG.find(entry => entry.operationTypes?.includes(intent))?.domain,
    "legacy_action",
    `${intent} must not be a public legacy planner action`,
  );
}

console.log("deterministic command catalog legacy action tests passed.");
