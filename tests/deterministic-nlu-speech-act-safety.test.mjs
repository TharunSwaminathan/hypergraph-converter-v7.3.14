import assert from "node:assert/strict";
import { classifySpeechAct } from "../src/agent/deterministicNlu/speechActClassifier.js";
import { authorizeSpeechActSideEffect, sideEffectIsStateChanging } from "../src/agent/deterministicNlu/sideEffectPolicy.js";

const cases = [
  ["Set papers.csv as the hyperedge table.", "imperative_request"],
  ["Could you use paper_id as the hyperedge key?", "polite_interrogative_request"],
  ["Why is papers.csv the hyperedge table?", "explanation_question"],
  ["What would happen if I removed vertex 4 from h0?", "hypothetical_question"],
  ["I previously asked you to run the parser.", "reported_command"],
  ['The guide says "apply the parser result."', "reported_command"],
  ["Actually, use paper_id instead.", "correction"],
  ["Do not run it.", "cancellation"],
];
for (const [text, expected] of cases) {
  assert.equal(classifySpeechAct(text).speechAct, expected, text);
}
for (const readOnly of ["informational_question", "explanation_question", "hypothetical_question", "status_question", "reported_command", "quoted_command"]) {
  assert.equal(authorizeSpeechActSideEffect({ speechAct: readOnly, sideEffectClass: "reversible_mapping_edit" }).allowed, false, readOnly);
}
assert.equal(authorizeSpeechActSideEffect({ speechAct: "polite_interrogative_request", sideEffectClass: "reversible_mapping_edit" }).allowed, true);
assert.equal(sideEffectIsStateChanging("reversible_mapping_edit"), true);
assert.equal(sideEffectIsStateChanging("reversible_grouping_edit"), true);
assert.equal(sideEffectIsStateChanging("graph_edit_preview"), true);
assert.equal(sideEffectIsStateChanging("read_only"), false);

console.log("deterministic NLU speech-act and side-effect safety tests passed.");
