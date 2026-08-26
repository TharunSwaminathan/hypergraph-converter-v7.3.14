import assert from "node:assert/strict";
import { dispatchCompiledAction } from "../src/agent/deterministicNlu/dispatchCompiledAction.js";
import { createRuntimeTrace, upsertRuntimeTrace } from "../src/agent/deterministicNlu/runtimeInstrumentation.js";

const preparedTrace = { ...createRuntimeTrace({ requestId: "trace-1", startedAt: 1 }), analysisCount: 1, compilationCount: 1, authoritativeCompiler: "graph_mutation_v1", typedKind: "GraphMutationPlan" };
const prepared = {
  handled: true,
  nlu: { primaryDomain: "graph_mutation", ambiguities: [] },
  compilation: {
    domain: "graph_mutation",
    typedKind: "GraphMutationPlan",
    sideEffectClass: "graph_edit_preview",
    dispatchAuthorized: true,
    semanticConfidence: { level: "high", score: 1 },
  },
  runtimeTrace: preparedTrace,
};
const dispatch = await dispatchCompiledAction({
  prepared,
  handlers: {
    graphMutation: async () => ({
      handled: true,
      outcome: "staged_confirmation",
      confirmationStaged: true,
      tracePatch: { modelCalls: [], graphRecompileCount: 0, validatorCalls: ["previewGraphMutation"] },
    }),
  },
});
assert.equal(dispatch.runtimeTrace.status, "completed");
assert.equal(dispatch.runtimeTrace.dispatchPath, "typed_graph_mutation");
assert.equal(dispatch.runtimeTrace.confirmationStaged, true);
assert.equal(dispatch.runtimeTrace.graphRecompileCount, 0);
assert.deepEqual(dispatch.runtimeTrace.validatorCalls, ["previewGraphMutation"]);

let history = upsertRuntimeTrace([], preparedTrace);
history = upsertRuntimeTrace(history, dispatch.runtimeTrace);
assert.equal(history.length, 1);
assert.equal(history[0].requestId, "trace-1");
assert.equal(history[0].status, "completed");
assert.equal(history[0].dispatchPath, "typed_graph_mutation");

console.log("deterministic NLU completed-trace lifecycle tests passed.");
