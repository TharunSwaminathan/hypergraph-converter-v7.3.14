import assert from "node:assert/strict";
import { deterministicNluHeldoutCorpus } from "./fixtures/deterministic-nlu/semantic-corpus.mjs";
import { evaluateIntegratedRouting } from "./helpers/evaluateIntegratedRouting.mjs";

const report = await evaluateIntegratedRouting(deterministicNluHeldoutCorpus, { fullCorpus: true });
for (const category of [
  "dataset_mapping_actions",
  "dataset_mapping_questions",
  "dataset_grouping_actions",
  "dataset_grouping_questions",
  "graph_mutation_actions",
  "graph_mutation_questions",
  "parser_workflow",
  "dashboard_control",
  "corrections",
  "negative_ambiguous_adversarial",
]) assert.ok(report.sampleComposition[category] > 0, category);
assert.equal(report.observedCalls.analysis, 840);
assert.equal(report.observedCalls.compilation, 840);
for (const metric of [
  "duplicateAnalysisRate",
  "duplicateCompilationRate",
  "unexpectedModelCallRate",
  "genericActionPlanTheftRate",
  "legacyParserCallRate",
  "rawDashboardClassifierFallbackRate",
  "falseStateChangingDispatchRate",
  "falseCommittedMutationRate",
  "falseConfirmationStagingRate",
  "questionToStateEditRate",
  "hypotheticalToStateEditRate",
  "reportedCommandToStateEditRate",
]) assert.equal(report.rates[metric].rate, 0, metric);
assert.ok(report.observedCalls.mappingTypedHandler > 0);
assert.ok(report.observedCalls.graphTypedHandler > 0);
assert.ok(report.observedCalls.parserWorkflowHandler > 0);
assert.ok(report.observedCalls.dashboardCanonicalHandler > 0);
assert.ok(report.observedCalls.groundedQuestionHandler > 0);

console.log("deterministic NLU integrated cross-domain tests passed.");
