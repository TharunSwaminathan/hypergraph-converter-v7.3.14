import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { analyzeDeterministicNlu } from "../src/agent/deterministicNlu/deterministicNlu.js";

const context = {
  datasetMapping: {
    fileNames: ["please.csv", "and.csv", "not.csv"],
    headersByFile: {
      "please.csv": ["group", "run", "ignore", "time"],
      "and.csv": ["id"],
      "not.csv": ["id"],
    },
  },
};
const start = performance.now();
const long = `${"please ".repeat(900)} use "and.csv" as the node table and do not run it (((***)))`;
const nlu = analyzeDeterministicNlu(long, context);
const elapsed = performance.now() - start;
assert(elapsed < 250, `NLU should avoid catastrophic backtracking, got ${elapsed} ms`);
assert.equal(nlu.limits.truncated, true);
assert(nlu.protectedSpans.some(span => span.value === "and.csv"));
assert.equal(analyzeDeterministicNlu("Use `not.csv` as the node table.", context).entities.some(entity => entity.fileName === "not.csv"), true);

console.log("deterministic NLU adversarial tests passed.");
