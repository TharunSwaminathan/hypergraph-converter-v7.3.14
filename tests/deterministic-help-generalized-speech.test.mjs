import assert from "node:assert/strict";
import { prepareDeterministicTurn } from "../src/agent/deterministicNlu/prepareDeterministicTurn.js";
import { isHelpSeekingQuestionText, helpSeekingTopic } from "../src/agent/deterministicNlu/helpSeekingGuards.js";
import { classifySpeechAct } from "../src/agent/deterministicNlu/speechActClassifier.js";
import { SIDE_EFFECT } from "../src/agent/deterministicNlu/commandCatalogSchema.js";
import { executeCompiledHelpQuery } from "../src/agent/deterministicNlu/runtime/executeCompiledHelpQuery.js";
import { buildCompilerContexts } from "./helpers/evaluateDeterministicNluCorpus.mjs";

const contexts = await buildCompilerContexts("graph-basic");

const helpFrames = [
  ["Please show me how to add vertex 6 to h2.", /add vertex 6 to h2/i],
  ["Can you tell me how to run the custom parser?", /run the custom parser/i],
  ["Tell me how to apply parser result.", /apply parser result/i],
  ["I want to know how to clear the graph.", /clear the graph/i],
  ["Could you explain how to validate the mapping?", /validate the mapping/i],
  ["Walk me through how to activate batch 2.", /activate batch 2/i],
  ["What is the procedure to stop the current request?", /stop the current request/i],
  ["Which command should I use to generate parser for batch 2?", /generate parser for batch 2/i],
  ["Where do I go to export CSR CSV?", /export csr csv/i],
  ["What syntax do I use to rename vertex Alice to Bob?", /rename vertex alice to bob/i],
  ["For the manual, explain Apply parser result.", /apply parser result/i],
  ["Write instructions showing how I would run the parser.", /run the parser/i],
  ["Describe the delete-edge command without changing anything.", /delete hyperedge/i],
];

for (const [query, topicPattern] of helpFrames) {
  assert.equal(isHelpSeekingQuestionText(query), true, query);
  assert.match(helpSeekingTopic(query), topicPattern, query);
  assert.equal(classifySpeechAct(query).speechAct, "help_seeking_question", query);
  const prepared = prepareDeterministicTurn({
    query,
    analysisContext: contexts.analysisContext,
    compileContext: contexts.compileContext,
  });
  assert.equal(prepared.compilation.domain, "help_query", query);
  assert.equal(prepared.compilation.typedKind, "DeterministicHelpQuery", query);
  assert.equal(prepared.compilation.sideEffectClass, SIDE_EFFECT.READ_ONLY, query);
  assert.equal(prepared.compilation.typedValue.intent, "EXPLAIN_ACTION_COMMAND", query);
}

const answerQualityCases = [
  ["For the manual, explain Apply parser result.", /Apply parser result to graph:[\s\S]*confirmation/i],
  ["Write instructions showing how I would run the parser.", /Run the custom parser:[\s\S]*confirmation/i],
  ["Describe the delete-edge command without changing anything.", /Remove one hyperedge:[\s\S]*preview and confirmation/i],
];
const differentiatedAnswers = [];
for (const [query, expected] of answerQualityCases) {
  const prepared = prepareDeterministicTurn({
    query,
    analysisContext: contexts.analysisContext,
    compileContext: contexts.compileContext,
  });
  const result = await executeCompiledHelpQuery({ prepared });
  assert.equal(result.outcome, "responded", query);
  assert.match(result.response.text, expected, query);
  assert.match(result.response.text, /Nothing has changed, no confirmation was staged/i, query);
  differentiatedAnswers.push(result.response.text);
}
assert.equal(new Set(differentiatedAnswers).size, answerQualityCases.length, "read-only command explanations must be specific rather than shared boilerplate");

console.log("deterministic generalized Help speech tests passed.");
