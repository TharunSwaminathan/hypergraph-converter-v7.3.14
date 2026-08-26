import assert from "node:assert/strict";
import { analyzeDeterministicNlu } from "../src/agent/deterministicNlu/deterministicNlu.js";

const context = {
  datasetMapping: {
    fileNames: ["authors.csv", "papers.csv"],
    headersByFile: { "authors.csv": ["author_id"], "papers.csv": ["paper_id"] },
  },
};
const high = analyzeDeterministicNlu("Use authors.csv as the node table and author_id for the nodes.", context);
assert.equal(high.confidence.level, "high");
const low = analyzeDeterministicNlu("maybe the stuff should be thingy", context);
assert.equal(low.confidence.level, "low");

console.log("deterministic NLU confidence tests passed.");
