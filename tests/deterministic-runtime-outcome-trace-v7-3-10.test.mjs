import assert from "node:assert/strict";
import { dispatchCompiledAction } from "../src/agent/deterministicNlu/dispatchCompiledAction.js";

function preparedFor(domain, typedKind) {
  return {
    handled: true,
    nlu: { primaryDomain: domain, ambiguities: [], confidence: { level: "high" } },
    compilation: {
      domain,
      typedKind,
      dispatchAuthorized: true,
      ambiguities: [],
      semanticConfidence: { level: "high" },
      sideEffectClass: domain === "graph_mutation" ? "graph_edit_preview" : "read_only",
    },
    runtimeTrace: {
      status: "compiled",
      speechAct: "imperative_action",
      sideEffectClass: domain === "graph_mutation" ? "graph_edit_preview" : "read_only",
      modelCalls: [],
      validatorCalls: [],
      stateMutationCommitted: false,
      confirmationStaged: false,
    },
  };
}

const navigation = await dispatchCompiledAction({
  prepared: preparedFor("dashboard_control", "DashboardControlIntent"),
  handlers: {
    dashboardControl: async () => ({ handled: true, outcome: "navigation_updated", navigationChanged: true }),
  },
});
assert.equal(navigation.outcome, "navigation_updated");
assert.equal(navigation.runtimeTrace.stateMutationCommitted, false, "navigation must not be reported as a committed state mutation");
assert.equal(navigation.runtimeTrace.confirmationStaged, false);

const staged = await dispatchCompiledAction({
  prepared: preparedFor("graph_mutation", "GraphMutationPlan"),
  handlers: {
    graphMutation: async () => ({ handled: true, outcome: "staged_confirmation", confirmationStaged: true, stateMutationCommitted: false }),
  },
});
assert.equal(staged.runtimeTrace.confirmationStaged, true);
assert.equal(staged.runtimeTrace.stateMutationCommitted, false, "staging a confirmation must not be reported as a committed graph edit");

const failed = await dispatchCompiledAction({
  prepared: preparedFor("parser_workflow", "ParserWorkflowOperation"),
  handlers: {
    parserWorkflow: async () => ({ handled: true, ok: false, outcome: "failed", stateMutationCommitted: false }),
  },
});
assert.equal(failed.outcome, "failed");
assert.equal(failed.runtimeTrace.stateMutationCommitted, false, "failed actions must not be reported as mutations");

const committed = await dispatchCompiledAction({
  prepared: preparedFor("dataset_mapping", "DatasetMappingPatch"),
  handlers: {
    datasetMapping: async () => ({ handled: true, outcome: "mapping_committed", stateMutationCommitted: true }),
  },
});
assert.equal(committed.runtimeTrace.stateMutationCommitted, true, "only an explicit committed outcome may set the mutation trace");

console.log("v7.3.10 deterministic runtime outcome trace tests passed.");
