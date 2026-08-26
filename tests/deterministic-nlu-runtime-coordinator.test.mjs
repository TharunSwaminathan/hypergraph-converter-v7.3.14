import assert from "node:assert/strict";
import { prepareDeterministicTurn } from "../src/agent/deterministicNlu/prepareDeterministicTurn.js";

let analyzeCount = 0;
let compileCount = 0;
const prepared = prepareDeterministicTurn({
  query: "Could you take me to the statistics view?",
  analyze: () => {
    analyzeCount += 1;
    return {
      rawText: "Could you take me to the statistics view?",
      primaryDomain: "dashboard_control",
      primaryIntent: "domain_action",
      mode: "action",
      confidence: { level: "high", score: 0.9, reasons: [] },
      ambiguities: [],
      unresolvedReferences: [],
      limits: { truncated: false },
    };
  },
  compile: nlu => {
    compileCount += 1;
    return {
      ok: true,
      handled: true,
      domain: nlu.primaryDomain,
      intent: "NAVIGATE_STATS",
      typedKind: "DashboardControlIntent",
      typedValue: { canonicalIntent: "NAVIGATE_STATS", slots: {} },
      semanticConfidence: { level: "high", score: 0.98, reasons: [] },
      diagnostics: { authoritativeCompiler: "dashboard_control_v1" },
    };
  },
});

assert.equal(analyzeCount, 1);
assert.equal(compileCount, 1);
assert.equal(prepared.runtimeTrace.analysisCount, 1);
assert.equal(prepared.runtimeTrace.compilationCount, 1);
assert.equal(prepared.runtimeTrace.authoritativeCompiler, "dashboard_control_v1");

console.log("deterministic NLU runtime coordinator tests passed.");
