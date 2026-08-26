import assert from "node:assert/strict";
import { prepareDeterministicTurn } from "../src/agent/deterministicNlu/prepareDeterministicTurn.js";
import { dispatchCompiledAction } from "../src/agent/deterministicNlu/dispatchCompiledAction.js";
import { executeCompiledHelpQuery } from "../src/agent/deterministicNlu/runtime/executeCompiledHelpQuery.js";
import { buildCompilerContexts } from "./helpers/evaluateDeterministicNluCorpus.mjs";

const contexts = await buildCompilerContexts("dashboard-workspace");
const graphContexts = await buildCompilerContexts("graph-basic");
const cases = [
  ["What commands can I use?", "SHOW_HELP_OVERVIEW", /deterministic chatbot/i],
  ["Show graph commands", "LIST_COMMAND_CATEGORY", /Graph Editing commands/i],
  ["How do I add a vertex to a hyperedge?", "EXPLAIN_ACTION_COMMAND", /Add vertices to a hyperedge/i],
  ["Which commands require confirmation?", "LIST_CONFIRMATION_COMMANDS", /require confirmation/i],
  ["Show read-only questions", "LIST_READ_ONLY_COMMANDS", /Read-only deterministic/i],
  ["How do quoted identifiers work?", "EXPLAIN_QUOTED_IDENTIFIERS", /Quoted identifiers preserve literal graph IDs/i],
  ["What input formats are supported?", "LIST_INPUT_FORMATS", /Supported input routes/i],
  ["Can the chatbot run BFS?", "EXPLAIN_PANEL_ONLY_FEATURE", /Algorithms are panel-only/i],
];

for (const [query, expectedIntent, expectedText] of cases) {
  const prepared = prepareDeterministicTurn({
    query,
    analysisContext: contexts.analysisContext,
    compileContext: contexts.compileContext,
  });
  assert.equal(prepared.compilation.domain, "help_query", query);
  assert.equal(prepared.compilation.typedKind, "DeterministicHelpQuery", query);
  assert.equal(prepared.compilation.sideEffectClass, "read_only", query);
  assert.equal(prepared.compilation.typedValue.intent, expectedIntent, query);
  let response = null;
  const dispatch = await dispatchCompiledAction({
    prepared,
    query,
    state: contexts.state,
    handlers: {
      helpQuery: async preparedHelp => {
        const outcome = await executeCompiledHelpQuery({ prepared: preparedHelp });
        response = outcome.response;
        return outcome;
      },
    },
  });
  assert.equal(dispatch.handled, true, query);
  assert.equal(dispatch.diagnostics.dispatchPath, "typed_help_query", query);
  assert.equal(dispatch.diagnostics.modelCalled, false, query);
  assert.equal(dispatch.diagnostics.genericActionPlannerCalled, false, query);
  assert.equal(dispatch.diagnostics.legacyParserCalled, false, query);
  assert.match(response?.text ?? "", expectedText, query);
  assert.ok(Array.isArray(response?.actions), query);
}

const graphHelpPrepared = prepareDeterministicTurn({
  query: "How do I add a vertex to a hyperedge?",
  analysisContext: graphContexts.analysisContext,
  compileContext: graphContexts.compileContext,
});
assert.equal(graphHelpPrepared.compilation.domain, "help_query");
assert.equal(graphHelpPrepared.compilation.typedKind, "DeterministicHelpQuery");

console.log("deterministic help query tests passed.");
