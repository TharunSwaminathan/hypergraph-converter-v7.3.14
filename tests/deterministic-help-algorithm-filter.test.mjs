import assert from "node:assert/strict";
import { composeHelpQueryResponse } from "../src/agent/deterministicNlu/commandCatalogFormatter.js";

const response = composeHelpQueryResponse({
  intent: "EXPLAIN_PANEL_ONLY_FEATURE",
  searchText: "BFS",
});

assert.match(response.text, /Algorithms are panel-only/i);
assert.match(response.text, /Breadth-First Search/i);
assert.match(response.text, /Depth-First Search/i);
assert.match(response.text, /Connected Components/i);
assert.doesNotMatch(response.text, /Can the chatbot run algorithms\?/i, "panel-only algorithm list must not include the explanatory helper entry");

console.log("deterministic help algorithm filter tests passed.");
