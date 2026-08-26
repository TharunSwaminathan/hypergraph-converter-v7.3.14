import assert from "node:assert/strict";
import { prepareDeterministicTurn } from "../src/agent/deterministicNlu/prepareDeterministicTurn.js";
import { dispatchCompiledAction } from "../src/agent/deterministicNlu/dispatchCompiledAction.js";
import { executeCompiledHelpQuery } from "../src/agent/deterministicNlu/runtime/executeCompiledHelpQuery.js";
import { buildCompilerContexts } from "./helpers/evaluateDeterministicNluCorpus.mjs";

const contexts = await buildCompilerContexts("graph-basic");
const pendingAction = Object.freeze({
  kind: "confirmation",
  actionType: "apply_graph_mutation",
  message: "Pending graph edit",
});

const helpWhilePending = [
  "How do I cancel the pending action?",
  "How do I confirm the pending action?",
  "Please show me how to clear the graph.",
  "Can you tell me how to apply parser result?",
  "What command should I use to stop the current request?",
];

for (const query of helpWhilePending) {
  const calls = { helpQuery: 0, legacyAction: 0, graphMutation: 0, parserWorkflow: 0, dashboardControl: 0 };
  const prepared = prepareDeterministicTurn({
    query,
    analysisContext: contexts.analysisContext,
    compileContext: { ...contexts.compileContext, pendingAction },
  });
  assert.equal(prepared.nlu.speechAct, "help_seeking_question", query);
  assert.equal(prepared.compilation.domain, "help_query", query);

  const dispatch = await dispatchCompiledAction({
    prepared,
    query,
    state: contexts.state,
    pendingAction,
    handlers: {
      helpQuery: async preparedHelp => {
        calls.helpQuery += 1;
        return executeCompiledHelpQuery({ prepared: preparedHelp });
      },
      legacyAction: async () => { calls.legacyAction += 1; return { handled: true, outcome: "applied_legacy_action", stateMutationCommitted: true }; },
      graphMutation: async () => { calls.graphMutation += 1; return { handled: true, outcome: "staged_confirmation", confirmationStaged: true }; },
      parserWorkflow: async () => { calls.parserWorkflow += 1; return { handled: true, outcome: "staged_confirmation", confirmationStaged: true }; },
      dashboardControl: async () => { calls.dashboardControl += 1; return { handled: true, outcome: "responded" }; },
    },
  });

  assert.equal(dispatch.handled, true, query);
  assert.equal(dispatch.diagnostics.dispatchPath, "typed_help_query", query);
  assert.equal(dispatch.runtimeTrace.confirmationStaged, false, query);
  assert.equal(dispatch.runtimeTrace.stateMutationCommitted, false, query);
  assert.deepEqual(calls, { helpQuery: 1, legacyAction: 0, graphMutation: 0, parserWorkflow: 0, dashboardControl: 0 }, query);
}

console.log("deterministic Help pending-state protection tests passed.");
