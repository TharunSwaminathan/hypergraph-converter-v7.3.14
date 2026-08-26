import assert from "node:assert/strict";
import { normalizeInput } from "../src/agent/deterministicNlu/normalizeInput.js";
import { scanProtectedSpans } from "../src/agent/deterministicNlu/protectedText.js";

const normalized = normalizeInput("Please don't split \"papers.and.authors.csv\"; I'd like `h0 again` preserved.\r\nNow use author_id.");
assert.match(normalized.normalizedText, /do not split/);
assert.match(normalized.normalizedText, /i would like/);
assert.equal(normalized.protectedSpans.length, 2);
assert.equal(normalized.protectedSpans[0].value, "papers.and.authors.csv");
assert.equal(normalized.protectedSpans[1].value, "h0 again");
assert.match(normalized.comparisonText, /papers.and.authors.csv/);

const spans = scanProtectedSpans("Use 'and.csv' and not title.");
assert.equal(spans[0].value, "and.csv");
assert.equal(spans[0].start, 4);

console.log("deterministic NLU normalization tests passed.");
