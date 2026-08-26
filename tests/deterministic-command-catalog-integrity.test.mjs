import assert from "node:assert/strict";
import {
  COMMAND_CATALOG,
  CATALOG_CURRENT_VERSION,
  CATALOG_VERSION,
  QUICK_START_COMMAND_IDS,
  UNSUPPORTED_EXAMPLES_REJECTED,
  getQuickStartEntries,
} from "../src/agent/deterministicNlu/commandCatalog.js";
import {
  COMMAND_AVAILABILITY,
  COMMAND_CATEGORIES,
  validateCommandCatalogEntry,
} from "../src/agent/deterministicNlu/commandCatalogSchema.js";

const ids = COMMAND_CATALOG.map(entry => entry.id);
const idSet = new Set(ids);
assert.equal(idSet.size, ids.length, "catalog IDs must be unique");
assert.ok(COMMAND_CATALOG.length >= 90, "catalog should cover the v7.3.9 deterministic command surface");

const validationErrors = COMMAND_CATALOG.flatMap(entry => validateCommandCatalogEntry(entry, idSet));
assert.deepEqual(validationErrors, [], `catalog validation errors:\n${validationErrors.join("\n")}`);

for (const category of Object.values(COMMAND_CATEGORIES)) {
  assert.ok(COMMAND_CATALOG.some(entry => entry.category === category), `missing category ${category}`);
}

for (const entry of COMMAND_CATALOG) {
  assert.equal(typeof entry.title, "string", `${entry.id} title must be text`);
  assert.equal(typeof entry.summary, "string", `${entry.id} summary must be text`);
  assert.ok(entry.summary.length > 12, `${entry.id} summary should be useful`);
  assert.ok(Array.isArray(entry.patterns), `${entry.id} patterns must be an array`);
  assert.ok(Array.isArray(entry.examples), `${entry.id} examples must be an array`);
  assert.ok(Array.isArray(entry.requiredContext), `${entry.id} requiredContext must be an array`);
  assert.ok(Array.isArray(entry.relatedCommandIds), `${entry.id} relatedCommandIds must be an array`);
  assert.ok(
    [CATALOG_VERSION, CATALOG_CURRENT_VERSION].includes(entry.sinceVersion),
    `${entry.id} should be introduced/verified in ${CATALOG_VERSION} or ${CATALOG_CURRENT_VERSION}`,
  );
  if (entry.domain === "legacy_action") {
    assert.equal(entry.sinceVersion, CATALOG_CURRENT_VERSION, `${entry.id} legacy action entry should be introduced in v7.3.9`);
  }
  assert.doesNotThrow(() => JSON.stringify(entry), `${entry.id} must be serializable`);
  if (entry.availability === COMMAND_AVAILABILITY.CHAT_COMMAND) {
    assert.ok(entry.examples.length > 0, `${entry.id} chat command needs an executable example`);
  }
  if (entry.availability === COMMAND_AVAILABILITY.PANEL_ONLY) {
    assert.deepEqual(entry.patterns, [], `${entry.id} panel-only feature must not advertise chat syntax`);
  }
}

assert.deepEqual(getQuickStartEntries().map(entry => entry.id), QUICK_START_COMMAND_IDS);
for (const id of QUICK_START_COMMAND_IDS) assert.ok(idSet.has(id), `quick-start ID ${id} must exist`);
assert.ok(UNSUPPORTED_EXAMPLES_REJECTED.includes("Run BFS from vertex 1"));
assert.ok(UNSUPPORTED_EXAMPLES_REJECTED.includes("Search for vertex Alice"));

console.log("deterministic command catalog integrity tests passed.");
