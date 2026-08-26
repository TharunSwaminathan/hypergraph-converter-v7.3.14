import assert from "node:assert/strict";
import { searchCommandCatalog } from "../src/agent/deterministicNlu/commandCatalogSearch.js";

const cases = [
  ["connect local model", "runtime.connect-local-model"],
  ["auto detect uploaded files", "files.auto-detect"],
  ["use deterministic draft", "mapping.use-deterministic-draft"],
  ["list local models", "runtime.list-models"],
  ["view previous batch", "files.view-previous-batch"],
  ["clear active batch", "files.clear-active-batch"],
  ["validate mapping", "mapping.validate"],
  ["repair mapping", "mapping.auto-repair"],
  ["confirm pending action", "pending.confirm"],
  ["cancel pending action", "pending.cancel"],
  ["undo graph edit", "graph.undo-last-mutation"],
];

for (const [query, expectedId] of cases) {
  const results = searchCommandCatalog({ query, limit: 5 });
  assert.ok(results.some(entry => entry.id === expectedId), `${query} should find ${expectedId}; got ${results.map(entry => entry.id).join(", ")}`);
}

console.log("deterministic help search legacy action tests passed.");
