import assert from "node:assert/strict";
import { dispatchCompiledAction } from "../src/agent/deterministicNlu/dispatchCompiledAction.js";

const prepared = {
  handled: true,
  nlu: { primaryDomain: "dashboard_control", ambiguities: [], limits: { truncated: false } },
  compilation: {
    domain: "dashboard_control",
    typedKind: "DashboardControlIntent",
    typedValue: { canonicalIntent: "NAVIGATE_STATS", slots: {} },
    semanticConfidence: { level: "high", score: 0.97 },
  },
  runtimeTrace: { analysisCount: 1, compilationCount: 1, modelCalls: [], genericActionPlannerCallCount: 0, legacyRawParserCallCount: 0 },
};
let dashboardCalls = 0;
const result = await dispatchCompiledAction({
  prepared,
  handlers: {
    dashboardControl: async () => {
      dashboardCalls += 1;
      return { handled: true, outcome: "responded" };
    },
  },
});

assert.equal(result.handled, true);
assert.equal(dashboardCalls, 1);
assert.equal(result.runtimeTrace.dispatchPath, "typed_dashboard_control");

console.log("deterministic NLU runtime dispatch tests passed.");
