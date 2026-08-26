import assert from "node:assert/strict";
import { prepareDeterministicTurn } from "../src/agent/deterministicNlu/prepareDeterministicTurn.js";
import { dispatchCompiledAction } from "../src/agent/deterministicNlu/dispatchCompiledAction.js";
import { executeCompiledHelpQuery } from "../src/agent/deterministicNlu/runtime/executeCompiledHelpQuery.js";
import { buildCompilerContexts } from "./helpers/evaluateDeterministicNluCorpus.mjs";

const contexts = await buildCompilerContexts("graph-basic");

const dangerousTopicsAsHelp = [
  "How do I add vertex 6 to h2?",
  "How do I remove Alice from the graph?",
  "How do I clear the graph?",
  "How do I run the custom parser?",
  "How do I apply parser result?",
  "How do I clear all batches?",
  "How do I connect local model?",
  "How do I stop active work?",
  "How do I download an export?",
  "How do I undo the last mutation?",
];

for (const query of dangerousTopicsAsHelp) {
  const calls = {
    helpQuery: 0,
    graphMutation: 0,
    parserWorkflow: 0,
    legacyAction: 0,
    dashboardControl: 0,
  };
  const prepared = prepareDeterministicTurn({
    query,
    analysisContext: contexts.analysisContext,
    compileContext: contexts.compileContext,
  });
  assert.equal(prepared.compilation.domain, "help_query", query);
  assert.equal(prepared.compilation.sideEffectClass, "read_only", query);
  const dispatch = await dispatchCompiledAction({
    prepared,
    query,
    state: contexts.state,
    handlers: {
      helpQuery: async preparedHelp => {
        calls.helpQuery += 1;
        return executeCompiledHelpQuery({ prepared: preparedHelp });
      },
      graphMutation: async () => { calls.graphMutation += 1; return { handled: true, outcome: "staged_confirmation", confirmationStaged: true }; },
      parserWorkflow: async () => { calls.parserWorkflow += 1; return { handled: true, outcome: "staged_confirmation", confirmationStaged: true }; },
      legacyAction: async () => { calls.legacyAction += 1; return { handled: true, outcome: "applied_legacy_action", stateMutationCommitted: true }; },
      dashboardControl: async () => { calls.dashboardControl += 1; return { handled: true, outcome: "applied_dashboard_action", stateMutationCommitted: true }; },
    },
  });
  assert.equal(dispatch.diagnostics.dispatchPath, "typed_help_query", query);
  assert.equal(dispatch.runtimeTrace.confirmationStaged, false, query);
  assert.equal(dispatch.runtimeTrace.stateMutationCommitted, false, query);
  assert.deepEqual(calls, { helpQuery: 1, graphMutation: 0, parserWorkflow: 0, legacyAction: 0, dashboardControl: 0 }, query);
}

console.log("deterministic Help state-preservation matrix tests passed.");
