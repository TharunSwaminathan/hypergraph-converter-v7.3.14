import assert from "node:assert/strict";
import { analyzeDeterministicNlu } from "../src/agent/deterministicNlu/deterministicNlu.js";
import { compileDeterministicAction } from "../src/agent/deterministicNlu/compileDeterministicAction.js";
import { buildCompilerContexts } from "./helpers/evaluateDeterministicNluCorpus.mjs";

async function compile(text, contextName) {
  const contexts = await buildCompilerContexts(contextName);
  const nlu = analyzeDeterministicNlu(text, contexts.analysisContext);
  return { nlu, compiled: compileDeterministicAction(nlu, contexts.compileContext) };
}

for (const [text, context] of [
  ["How does authorships.csv connect papers to authors?", "three-table-authorship"],
  ["Would paper_id make a better key?", "three-table-authorship"],
  ["What would happen if I removed vertex 4 from h0?", "graph-basic"],
  ["I previously asked you to run the parser.", "parser-generated"],
  ['The guide says "apply the parser result."', "parser-result-ready"],
]) {
  const { compiled } = await compile(text, context);
  assert.equal(compiled.typedKind, "GroundedQuestion", text);
  assert.equal(compiled.sideEffectClass, "read_only", text);
  assert.equal(compiled.dispatchAuthorized, true, text);
  const operations = compiled.compiled?.draft?.operations ?? compiled.compiled?.plan?.operations ?? compiled.compiled?.operations ?? [];
  assert.deepEqual(operations, [], text);
}

const polite = await compile("Could you use paper_id as the hyperedge key?", "three-table-authorship");
assert.equal(polite.nlu.speechAct, "polite_interrogative_request");
assert.equal(polite.compiled.typedKind, "DatasetMappingPatch");
assert.equal(polite.compiled.sideEffectClass, "reversible_mapping_edit");
assert.ok((polite.compiled.compiled?.draft?.operations ?? []).length > 0);

console.log("deterministic NLU question-safety tests passed.");
