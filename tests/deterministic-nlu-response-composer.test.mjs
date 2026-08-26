import assert from "node:assert/strict";
import { composeInterpretationTraceResponse, composeParserWorkflowStatus } from "../src/agent/deterministicNlu/responseComposer.js";

const response = composeInterpretationTraceResponse({}, {
  nluDomain: "dataset_mapping",
  nluIntent: "set_entity_roles",
  nluConfidence: { level: "high", score: 0.91 },
  nluTrace: {
    matchedRuleIds: ["mapping.role.vertex_table"],
    resolvedEntityIds: ["file:authors.csv", "column:authors.csv.author_id"],
    rejectedCandidates: [],
  },
});
assert.match(response, /deterministic NLU path/);
assert.match(response, /authors\.csv/);

assert.match(composeParserWorkflowStatus({ activeBatch: null }), /No active upload batch/);
assert.match(composeParserWorkflowStatus({ activeBatch: { mappingSpecStatus: "valid", transformationPlan: null } }), /generate the transformation plan/);

console.log("deterministic NLU response composer tests passed.");
