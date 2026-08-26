import assert from "node:assert/strict";
import { exactCanonicalOperationMatch, partialCanonicalOperationMatch } from "../src/agent/deterministicNlu/canonicalOperation.js";

const actual = [{ type: "SET_FILE_KEY_COLUMNS", fileName: "papers.csv", keyColumns: ["paper_id"], requestId: "dynamic" }];
assert.equal(exactCanonicalOperationMatch(actual, [{ fileName: "papers.csv", keyColumns: ["paper_id"], type: "SET_FILE_KEY_COLUMNS" }]), true);
assert.equal(exactCanonicalOperationMatch(actual, [{ type: "SET_FILE_KEY_COLUMNS", fileName: "papers.csv" }]), false);
assert.equal(partialCanonicalOperationMatch(actual, [{ type: "SET_FILE_KEY_COLUMNS", fileName: "papers.csv" }]), true);

console.log("deterministic NLU canonical-operation match tests passed.");
