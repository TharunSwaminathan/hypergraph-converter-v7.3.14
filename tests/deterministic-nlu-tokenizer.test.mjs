import assert from "node:assert/strict";
import { normalizeInput } from "../src/agent/deterministicNlu/normalizeInput.js";
import { tokenizeInput } from "../src/agent/deterministicNlu/tokenizeInput.js";

const normalized = normalizeInput("Use authors.csv and `paper_id` for h0.");
const tokens = tokenizeInput(normalized.normalizedText, normalized.protectedSpans);
assert.equal(tokens.find(token => token.text === "authors.csv").type, "filename");
assert.equal(tokens.find(token => token.text === "`paper_id`").type, "quoted");
assert.equal(tokens.find(token => token.normalized === "and").type, "connector");
assert(tokens.every(token => Number.isInteger(token.start) && token.end > token.start));

console.log("deterministic NLU tokenizer tests passed.");
