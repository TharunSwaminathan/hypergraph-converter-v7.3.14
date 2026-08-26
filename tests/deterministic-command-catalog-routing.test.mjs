import assert from "node:assert/strict";
import { allCatalogExamples } from "../src/agent/deterministicNlu/commandCatalog.js";
import { COMMAND_AVAILABILITY } from "../src/agent/deterministicNlu/commandCatalogSchema.js";
import { dispatchCompiledAction } from "../src/agent/deterministicNlu/dispatchCompiledAction.js";
import { executeCompiledHelpQuery } from "../src/agent/deterministicNlu/runtime/executeCompiledHelpQuery.js";
import { prepareCatalogExample } from "./helpers/deterministicCommandCatalogTestHelpers.mjs";

const calls = {
  graphMutation: 0,
  datasetMapping: 0,
  parserWorkflow: 0,
  dashboardControl: 0,
  groundedQuestion: 0,
  helpQuery: 0,
  legacyAction: 0,
  clarification: 0,
};
const failures = [];
let checked = 0;

for (const { entry, example } of allCatalogExamples({ includePanelOnly: false })) {
  if (entry.availability === COMMAND_AVAILABILITY.PANEL_ONLY) continue;
  const { contexts, prepared } = await prepareCatalogExample(example);
  const expectedClarification = example.expectsClarification === true;
  const dispatch = await dispatchCompiledAction({
    prepared,
    query: example.text,
    state: contexts.state ?? {},
    handlers: {
      clarification: async () => {
        calls.clarification += 1;
        return { handled: true, outcome: "clarification" };
      },
      graphMutation: async () => {
        calls.graphMutation += 1;
        return { handled: true, outcome: "staged_confirmation", confirmationStaged: true };
      },
      datasetMapping: async () => {
        calls.datasetMapping += 1;
        return {
          handled: true,
          outcome: "applied_reversible_edit",
          stateMutationCommitted: prepared.compilation?.sideEffectClass !== "read_only",
        };
      },
      parserWorkflow: async () => {
        calls.parserWorkflow += 1;
        const operations = prepared.compilation?.compiled?.operations ?? [];
        const confirmation = operations.some(operation => String(operation.type).endsWith("_CONFIRMATION"));
        return { handled: true, outcome: confirmation ? "staged_confirmation" : "responded", confirmationStaged: confirmation };
      },
      dashboardControl: async () => {
        calls.dashboardControl += 1;
        return { handled: true, outcome: "responded" };
      },
      groundedQuestion: async () => {
        calls.groundedQuestion += 1;
        return { handled: true, outcome: "responded" };
      },
      helpQuery: async preparedHelp => {
        calls.helpQuery += 1;
        return executeCompiledHelpQuery({ prepared: preparedHelp });
      },
      legacyAction: async () => {
        calls.legacyAction += 1;
        return { handled: true, outcome: "responded" };
      },
    },
  });
  checked += 1;
  if (!dispatch.handled) failures.push({ entry: entry.id, example: example.text, issue: "not handled" });
  if (dispatch.diagnostics.modelCalled) failures.push({ entry: entry.id, example: example.text, issue: "model called" });
  if (dispatch.diagnostics.genericActionPlannerCalled) failures.push({ entry: entry.id, example: example.text, issue: "generic ActionPlan called" });
  if (dispatch.diagnostics.legacyParserCalled) failures.push({ entry: entry.id, example: example.text, issue: "legacy parser called" });
  if (expectedClarification && dispatch.outcome !== "clarification") {
    failures.push({ entry: entry.id, example: example.text, issue: "expected clarification", actual: dispatch.outcome });
  }
  if (!expectedClarification && dispatch.outcome === "not_handled") {
    failures.push({ entry: entry.id, example: example.text, issue: "unexpected not_handled" });
  }
}

assert.equal(failures.length, 0, `routing failures:\n${JSON.stringify(failures, null, 2)}`);
assert.ok(calls.graphMutation >= 10, "graph examples should reach graph preview handler");
assert.ok(calls.datasetMapping >= 10, "mapping/grouping examples should reach dataset mapping handler");
assert.ok(calls.parserWorkflow >= 5, "parser examples should reach parser workflow handler");
assert.ok(calls.dashboardControl >= 5, "dashboard examples should reach dashboard handler");
assert.ok(calls.helpQuery >= 5, "help examples should reach help-query handler");
assert.ok(calls.legacyAction >= 20, "legacy action examples should reach the legacy action handler");
assert.ok(calls.groundedQuestion >= 4, "read-only grounded questions should reach grounded-question handler");
assert.ok(calls.clarification >= 1, "clarifying examples should reach clarification handler");
assert.ok(checked >= 80, "expected broad catalog routing coverage");

console.log("deterministic command catalog routing tests passed.");
