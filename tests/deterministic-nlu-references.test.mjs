import assert from "node:assert/strict";
import { analyzeDeterministicNlu } from "../src/agent/deterministicNlu/deterministicNlu.js";

const unambiguous = analyzeDeterministicNlu("Run it.", {
  parserWorkflow: { parserStatus: "inserted", resultStatus: "none" },
});
assert.equal(unambiguous.references[0].resolved, "custom_parser");

const ambiguous = analyzeDeterministicNlu("Run it.", {
  parserWorkflow: { parserStatus: "inserted", resultStatus: "preview", planStatus: "generated" },
});
assert.equal(ambiguous.references[0].ambiguous, true);
assert(ambiguous.ambiguities.some(item => item.type === "ambiguous_reference"));

const selected = analyzeDeterministicNlu("Add 4 to the selected hyperedge.", {
  graph: { selectedEntity: { type: "hyperedge", id: "h0" } },
});
assert(selected.references.some(reference => reference.resolved === "h0"));

console.log("deterministic NLU reference tests passed.");
