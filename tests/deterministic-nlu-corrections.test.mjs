import assert from "node:assert/strict";
import { analyzeDeterministicNlu } from "../src/agent/deterministicNlu/deterministicNlu.js";

const correction = analyzeDeterministicNlu("Actually, use paper_id instead of title.", {
  datasetMapping: { fileNames: ["papers.csv"], headersByFile: { "papers.csv": ["paper_id", "title"] } },
});
assert.equal(correction.mode, "correction");
assert(correction.corrections.some(item => item.type === "replace_value"));
assert.equal(correction.corrections.find(item => item.type === "replace_value").newValue, "paper_id");
assert.equal(correction.corrections.find(item => item.type === "replace_value").oldValue, "title");

console.log("deterministic NLU correction tests passed.");
