import assert from "node:assert/strict";
import { prepareDeterministicTurn } from "../src/agent/deterministicNlu/prepareDeterministicTurn.js";
import { SIDE_EFFECT } from "../src/agent/deterministicNlu/commandCatalogSchema.js";
import { buildCompilerContexts } from "./helpers/evaluateDeterministicNluCorpus.mjs";

const dashboardContexts = await buildCompilerContexts("dashboard-workspace");
const graphContexts = await buildCompilerContexts("graph-basic");

const cases = [
  {
    context: dashboardContexts,
    help: "How do I clear the active batch?",
    action: "Clear the active batch",
    actionDomain: "legacy_action",
    actionIntent: "clear_uploaded_files",
    actionSideEffect: SIDE_EFFECT.DESTRUCTIVE_BATCH_STATE,
  },
  {
    context: dashboardContexts,
    help: "Can you tell me how to validate the mapping?",
    action: "Validate the mapping",
    actionDomain: "legacy_action",
    actionIntent: "validate_mapping",
    actionSideEffect: SIDE_EFFECT.WORKFLOW_PREPARATION,
  },
  {
    context: graphContexts,
    help: "Please show me how to add vertex 6 to h2.",
    action: "Add vertex 6 to h2",
    actionDomain: "graph_mutation",
    actionIntent: "add_incidence",
    actionSideEffect: SIDE_EFFECT.GRAPH_EDIT_PREVIEW,
  },
  {
    context: dashboardContexts,
    help: "What command should I use to activate batch 2?",
    action: "Activate batch 2",
    actionDomain: "legacy_action",
    actionIntent: "activate_batch_number",
    actionSideEffect: SIDE_EFFECT.BATCH_STATE_EDIT,
  },
  {
    context: dashboardContexts,
    help: "How do I stop the current request?",
    action: "Stop the current request",
    actionDomain: "legacy_action",
    actionIntent: "runtime_stop",
    actionSideEffect: SIDE_EFFECT.RUNTIME_CONTROL,
  },
];

for (const item of cases) {
  const helpPrepared = prepareDeterministicTurn({
    query: item.help,
    analysisContext: item.context.analysisContext,
    compileContext: item.context.compileContext,
  });
  assert.equal(helpPrepared.nlu.speechAct, "help_seeking_question", item.help);
  assert.equal(helpPrepared.compilation.domain, "help_query", item.help);
  assert.equal(helpPrepared.compilation.sideEffectClass, SIDE_EFFECT.READ_ONLY, item.help);

  const actionPrepared = prepareDeterministicTurn({
    query: item.action,
    analysisContext: item.context.analysisContext,
    compileContext: item.context.compileContext,
  });
  assert.notEqual(actionPrepared.nlu.speechAct, "help_seeking_question", item.action);
  assert.equal(actionPrepared.compilation.domain, item.actionDomain, item.action);
  assert.equal(actionPrepared.compilation.intent, item.actionIntent, item.action);
  assert.equal(actionPrepared.compilation.sideEffectClass, item.actionSideEffect, item.action);
}

console.log("deterministic Help/action contrast matrix tests passed.");
