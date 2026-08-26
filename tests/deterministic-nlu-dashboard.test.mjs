import assert from "node:assert/strict";
import { analyzeDeterministicNlu } from "../src/agent/deterministicNlu/deterministicNlu.js";
import { compileDashboardActionGrammar } from "../src/agent/deterministicNlu/domains/dashboardActionGrammar.js";

const cases = [
  ["Show graph stats.", "NAVIGATE_STATS"],
  ["Open runtime diagnostics.", "OPEN_RUNTIME_DIAGNOSTICS"],
  ["Export as CSR CSV.", "SET_EXPORT_FORMAT"],
  ["Use H2V route.", "SET_INPUT_ROUTE"],
];

for (const [text, canonicalIntent] of cases) {
  const nlu = analyzeDeterministicNlu(text);
  const compiled = compileDashboardActionGrammar(text, { nlu });
  assert.equal(compiled.ok, true, text);
  assert.equal(compiled.typedKind, "DashboardControlIntent");
  assert.equal(compiled.canonicalIntent, canonicalIntent);
  assert.equal(compiled.diagnostics.authoritativeCompiler, "dashboard_control_v1");
  assert.equal(compiled.diagnostics.legacyParserCalled, false);
  assert.equal(compiled.delegateToExistingControlPlanner, undefined);
}

console.log("deterministic NLU dashboard tests passed.");
