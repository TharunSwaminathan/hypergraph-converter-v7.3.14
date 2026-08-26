import assert from "node:assert/strict";
import { analyzeDeterministicNlu } from "../src/agent/deterministicNlu/deterministicNlu.js";

const datasetMapping = {
  fileNames: ["authors.csv", "papers.csv", "authorships.csv"],
  headersByFile: {
    "authors.csv": ["author_id", "name"],
    "papers.csv": ["paper_id", "title", "year"],
    "authorships.csv": ["paper_id", "author_id"],
  },
};

assert.equal(analyzeDeterministicNlu("Use paper_id as the key.", { datasetMapping }).primaryDomain, "dataset_mapping");
assert.equal(analyzeDeterministicNlu("Why use paper_id as the key?", { datasetMapping }).mode, "question");
assert.equal(analyzeDeterministicNlu("Would using paper_id help?", { datasetMapping }).mode, "question");
assert.equal(analyzeDeterministicNlu("Generate the parser.", { parserWorkflow: {} }).primaryDomain, "parser_workflow");
assert.equal(analyzeDeterministicNlu("h0 should include 4 too.").primaryDomain, "graph_mutation");
assert.equal(analyzeDeterministicNlu("Show graph stats.").primaryDomain, "dashboard_control");

console.log("deterministic NLU intent tests passed.");
