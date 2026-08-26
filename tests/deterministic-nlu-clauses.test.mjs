import assert from "node:assert/strict";
import { normalizeInput } from "../src/agent/deterministicNlu/normalizeInput.js";
import { tokenizeInput } from "../src/agent/deterministicNlu/tokenizeInput.js";
import { parseClauses } from "../src/agent/deterministicNlu/clauseParser.js";

const normalized = normalizeInput("Use authors.csv for nodes; then papers.csv for groups, but do not run it.");
const clauses = parseClauses(normalized.normalizedText, tokenizeInput(normalized.normalizedText, normalized.protectedSpans));
assert(clauses.length >= 3);
assert.equal(clauses[1].connectorFromPrevious, "then");
assert.equal(clauses.at(-1).polarity, "negative");

const quoted = normalizeInput("Use \"A and B.csv\" for nodes and papers.csv for groups.");
const quotedClauses = parseClauses(quoted.normalizedText, tokenizeInput(quoted.normalizedText, quoted.protectedSpans));
assert(quotedClauses.some(clause => clause.text.includes("\"A and B.csv\"")));

console.log("deterministic NLU clause tests passed.");
