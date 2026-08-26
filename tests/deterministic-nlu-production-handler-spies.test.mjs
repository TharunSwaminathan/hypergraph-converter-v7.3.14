import assert from "node:assert/strict";
import { deterministicNluHeldoutCorpus } from "./fixtures/deterministic-nlu/semantic-corpus.mjs";
import { evaluateIntegratedRouting } from "./helpers/evaluateIntegratedRouting.mjs";

const base = deterministicNluHeldoutCorpus.find(fixture => fixture.category === "dashboard_control" && fixture.expected?.expectedSideEffect !== "read_only");
assert.ok(base);
for (const [injected, metric] of [
  ["model", "unexpectedModelCallRate"],
  ["generic", "genericActionPlanTheftRate"],
  ["legacy", "legacyParserCallRate"],
  ["rawControl", "rawDashboardClassifierFallbackRate"],
]) {
  const report = await evaluateIntegratedRouting([{ ...base, id: `${base.id}-${injected}`, injectForbiddenCall: injected }], { fullCorpus: true });
  assert.ok(report.rates[metric].rate > 0, `${metric} must observe injected ${injected} calls`);
}

console.log("deterministic NLU production-handler spy tests passed.");
