import assert from "node:assert/strict";
import { searchCommandCatalog, findCatalogEntriesForHelpQuery } from "../src/agent/deterministicNlu/commandCatalogSearch.js";

function idsFor(query) {
  return searchCommandCatalog({ query, limit: 8 }).map(entry => entry.id);
}

assert.ok(idsFor("add vertex").includes("graph.add-incidence"));
assert.ok(idsFor("paper key").includes("mapping.key-columns"));
assert.ok(idsFor("paper key").includes("questions.question-action-contrast"));
assert.ok(idsFor("confirmation").some(id => id.startsWith("graph.") || id.includes("confirmation")));
assert.ok(idsFor("quoted").includes("quoted.identifiers"));
assert.ok(idsFor("offline").includes("help.model-offline"));
assert.ok(idsFor("graph preview").includes("graph.add-incidence"));
assert.ok(idsFor("validation file").includes("grouping.validation-files"));

const helpEntries = findCatalogEntriesForHelpQuery("remove vertex everywhere");
assert.ok(helpEntries.some(entry => entry.id === "graph.remove-vertex-global"));

console.log("deterministic help search tests passed.");
