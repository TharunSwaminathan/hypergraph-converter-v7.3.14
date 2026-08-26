import assert from "node:assert/strict";
import { analyzeDeterministicNlu } from "../src/agent/deterministicNlu/deterministicNlu.js";
import { hasNegatedRun, hasNegatedTerm } from "../src/agent/deterministicNlu/negationResolver.js";

const nlu = analyzeDeterministicNlu("Generate the parser but do not run it.");
assert.equal(hasNegatedRun(nlu.clauses), true);
assert(nlu.negations.some(negation => negation.scope === "parser_run"));
assert.equal(hasNegatedTerm("Actually use paper_id and not title.", "title"), true);
assert.equal(hasNegatedTerm("Use title.", "title"), false);

console.log("deterministic NLU negation tests passed.");
