import assert from "node:assert/strict";
import { searchCommandCatalog } from "../src/agent/deterministicNlu/commandCatalogSearch.js";
import { COMMAND_CATALOG } from "../src/agent/deterministicNlu/commandCatalog.js";
import { prepareDeterministicTurn } from "../src/agent/deterministicNlu/prepareDeterministicTurn.js";
import { buildCompilerContexts } from "./helpers/evaluateDeterministicNluCorpus.mjs";

function idsFor(query) {
  return searchCommandCatalog({ query, limit: 12 }).map(entry => entry.id);
}

assert.ok(idsFor("v2v mapping").includes("navigation.show-mappings"));
assert.ok(idsFor("vertex to vertex mapping").includes("navigation.show-mappings"));
assert.ok(idsFor("projected graph mapping").includes("navigation.show-mappings"));

const mappings = COMMAND_CATALOG.find(entry => entry.id === "navigation.show-mappings");
assert.match(mappings.summary, /V2V 2-section projection/i);
assert.ok(mappings.examples.some(example => /V2V/i.test(example.text)));
assert.ok(mappings.patterns.some(pattern => /v2v/i.test(pattern)));

const contexts = await buildCompilerContexts("dashboard-workspace");
const prepared = prepareDeterministicTurn({
  query: "Show V2V mapping",
  analysisContext: contexts.analysisContext,
  compileContext: contexts.compileContext,
});
assert.equal(prepared.compilation.domain, "legacy_action");
assert.equal(prepared.compilation.typedValue.intent, "show_mappings");

console.log("deterministic Help V2V search tests passed.");
