import assert from "node:assert/strict";
import { prepareDeterministicTurn } from "../src/agent/deterministicNlu/prepareDeterministicTurn.js";
import { dispatchCompiledAction } from "../src/agent/deterministicNlu/dispatchCompiledAction.js";
import { executeCompiledHelpQuery } from "../src/agent/deterministicNlu/runtime/executeCompiledHelpQuery.js";
import { buildCompilerContexts } from "./helpers/evaluateDeterministicNluCorpus.mjs";

const contexts = await buildCompilerContexts("dashboard-workspace");
const queries = [
  ["How do I clear the active batch?", "help_seeking_question"],
  ["How do I connect the local model?", "help_seeking_question"],
  ["How do I validate the mapping?", "help_seeking_question"],
  ["What command do I use to upload files?", "help_seeking_question"],
  ["Show me how to apply parser result", "help_seeking_question"],
];

for (const [query, expectedSpeechAct] of queries) {
  const calls = {
    graphMutation: 0,
    datasetMapping: 0,
    parserWorkflow: 0,
    dashboardControl: 0,
    groundedQuestion: 0,
    legacyAction: 0,
    helpQuery: 0,
  };
  const prepared = prepareDeterministicTurn({
    query,
    analysisContext: contexts.analysisContext,
    compileContext: contexts.compileContext,
  });
  assert.equal(prepared.nlu.speechAct, expectedSpeechAct, query);
  assert.equal(prepared.compilation.domain, "help_query", query);
  assert.equal(prepared.compilation.typedKind, "DeterministicHelpQuery", query);
  assert.equal(prepared.compilation.sideEffectClass, "read_only", query);
  assert.equal(prepared.compilation.typedValue.intent, "EXPLAIN_ACTION_COMMAND", query);

  const dispatch = await dispatchCompiledAction({
    prepared,
    query,
    state: contexts.state,
    handlers: {
      graphMutation: async () => { calls.graphMutation += 1; return { handled: true, outcome: "staged_confirmation", confirmationStaged: true }; },
      datasetMapping: async () => { calls.datasetMapping += 1; return { handled: true, outcome: "applied_reversible_edit", stateMutationCommitted: true }; },
      parserWorkflow: async () => { calls.parserWorkflow += 1; return { handled: true, outcome: "staged_confirmation", confirmationStaged: true }; },
      dashboardControl: async () => { calls.dashboardControl += 1; return { handled: true, outcome: "responded" }; },
      groundedQuestion: async () => { calls.groundedQuestion += 1; return { handled: true, outcome: "responded" }; },
      legacyAction: async () => { calls.legacyAction += 1; return { handled: true, outcome: "applied_legacy_action", stateMutationCommitted: true }; },
      helpQuery: async preparedHelp => {
        calls.helpQuery += 1;
        return executeCompiledHelpQuery({ prepared: preparedHelp });
      },
    },
  });

  assert.equal(dispatch.handled, true, query);
  assert.equal(dispatch.diagnostics.dispatchPath, "typed_help_query", query);
  assert.equal(dispatch.diagnostics.modelCalled, false, query);
  assert.equal(dispatch.diagnostics.genericActionPlannerCalled, false, query);
  assert.equal(dispatch.diagnostics.legacyParserCalled, false, query);
  assert.deepEqual(calls, {
    graphMutation: 0,
    datasetMapping: 0,
    parserWorkflow: 0,
    dashboardControl: 0,
    groundedQuestion: 0,
    legacyAction: 0,
    helpQuery: 1,
  }, query);
  assert.equal(dispatch.runtimeTrace.confirmationStaged, false, query);
  assert.equal(dispatch.runtimeTrace.stateMutationCommitted, false, query);
}

{
  const query = "What would happen if I clear the current graph?";
  const prepared = prepareDeterministicTurn({
    query,
    analysisContext: contexts.analysisContext,
    compileContext: contexts.compileContext,
  });
  assert.equal(prepared.nlu.speechAct, "hypothetical_question", query);
  assert.equal(prepared.compilation.typedKind, "DeterministicHelpQuery", query);
  assert.equal(prepared.compilation.sideEffectClass, "read_only", query);
  const calls = { groundedQuestion: 0, legacyAction: 0, graphMutation: 0, helpQuery: 0 };
  const dispatch = await dispatchCompiledAction({
    prepared,
    query,
    state: contexts.state,
    handlers: {
      groundedQuestion: async () => { calls.groundedQuestion += 1; return { handled: true, outcome: "responded" }; },
      legacyAction: async () => { calls.legacyAction += 1; return { handled: true, outcome: "applied_legacy_action", stateMutationCommitted: true }; },
      graphMutation: async () => { calls.graphMutation += 1; return { handled: true, outcome: "staged_confirmation", confirmationStaged: true }; },
      helpQuery: async preparedHelp => {
        calls.helpQuery += 1;
        return executeCompiledHelpQuery({ prepared: preparedHelp });
      },
    },
  });
  assert.equal(dispatch.handled, true, query);
  assert.equal(dispatch.diagnostics.dispatchPath, "typed_help_query", query);
  assert.deepEqual(calls, { groundedQuestion: 0, legacyAction: 0, graphMutation: 0, helpQuery: 1 }, query);
  assert.equal(dispatch.runtimeTrace.confirmationStaged, false, query);
  assert.equal(dispatch.runtimeTrace.stateMutationCommitted, false, query);
}

console.log("deterministic help safety boundary tests passed.");
