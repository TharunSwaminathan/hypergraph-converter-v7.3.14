import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { analyzeDeterministicNlu } from "../../src/agent/deterministicNlu/deterministicNlu.js";
import { compileDeterministicAction } from "../../src/agent/deterministicNlu/compileDeterministicAction.js";
import { prepareDeterministicTurn } from "../../src/agent/deterministicNlu/prepareDeterministicTurn.js";
import { dispatchCompiledAction } from "../../src/agent/deterministicNlu/dispatchCompiledAction.js";
import { createProductionDeterministicHandlers } from "../../src/agent/deterministicNlu/runtime/createProductionDeterministicHandlers.js";
import { sideEffectIsStateChanging } from "../../src/agent/deterministicNlu/sideEffectPolicy.js";
import { buildCompilerContexts } from "./evaluateDeterministicNluCorpus.mjs";

export async function evaluateIntegratedRouting(fixtures, { writeReportPath = null, fullCorpus = true } = {}) {
  const selected = fullCorpus ? fixtures : stratifiedSample(fixtures);
  const observedCalls = createObservedCalls();
  const records = [];
  const sampleComposition = countBy(selected, fixture => fixture.category ?? "core_regressions");

  for (const fixture of selected) {
    const contexts = await buildCompilerContexts(fixture.contextFixture ?? fixture.context);
    const prepared = prepareDeterministicTurn({
      query: fixture.text,
      analysisContext: contexts.analysisContext,
      compileContext: contexts.compileContext,
      contextBinding: fixture.contextBinding ?? null,
      analyze: (text, context) => {
        observedCalls.analysis += 1;
        return analyzeDeterministicNlu(text, context);
      },
      compile: (nlu, context) => {
        observedCalls.compilation += 1;
        return compileDeterministicAction(nlu, context);
      },
    });

    const perFixture = createPerFixtureCalls();
    const instrumentation = {
      recordHandlerCall(name) {
        perFixture.handlerCalls[name] = (perFixture.handlerCalls[name] ?? 0) + 1;
      },
    };
    const callbacks = productionLikeCallbacks({ fixture, prepared, observedCalls, perFixture });
    const handlers = createProductionDeterministicHandlers({
      prepared,
      query: fixture.text,
      options: fixture.runtimeOptions ?? {},
      callbacks,
      instrumentation,
    });
    const dispatch = await dispatchCompiledAction({
      prepared,
      query: fixture.text,
      state: contexts.state ?? stateFromFixture(fixture),
      pendingAction: fixture.pendingAction ?? null,
      handlers,
    });

    const expected = fixture.expected ?? {};
    const actualStateChanging = sideEffectIsStateChanging(prepared.compilation?.sideEffectClass);
    if (actualStateChanging) observedCalls.stateChangingDispatches += 1;
    if (dispatch.runtimeTrace.confirmationStaged) observedCalls.confirmationStaging += 1;
    if (dispatch.runtimeTrace.stateMutationCommitted) observedCalls.stateMutationCommits += 1;
    records.push({
      id: fixture.id,
      category: fixture.category ?? "core_regressions",
      speechAct: prepared.compilation?.speechAct ?? prepared.nlu?.speechAct,
      sideEffectClass: prepared.compilation?.sideEffectClass ?? "read_only",
      expectedSideEffect: expected.expectedSideEffect ?? null,
      domain: prepared.nlu.primaryDomain,
      typedKind: prepared.compilation?.typedKind ?? null,
      handled: dispatch.handled,
      calls: perFixture,
      trace: dispatch.runtimeTrace,
      expected,
    });
  }

  const total = records.length;
  const readOnlyRecords = records.filter(record => record.expected.expectedSideEffect === "read_only"
    || record.expected.stateChangingDispatchExpected === false);
  const questionRecords = records.filter(record => ["informational_question", "explanation_question", "status_question"].includes(record.speechAct));
  const hypotheticalRecords = records.filter(record => record.speechAct === "hypothetical_question");
  const reportedRecords = records.filter(record => record.speechAct === "reported_command");
  const quotedRecords = records.filter(record => record.speechAct === "quoted_command");

  const report = {
    evaluationType: "integrated routing evaluation",
    sampleComposition,
    fixtureIds: selected.map(fixture => fixture.id),
    observedCalls,
    rates: {
      duplicateAnalysisRate: zeroRate(records.filter(record => (record.trace.analysisCount ?? 0) !== 1).length, total),
      duplicateCompilationRate: zeroRate(records.filter(record => (record.trace.compilationCount ?? 0) !== 1).length, total),
      unexpectedModelCallRate: zeroRate(observedCalls.modelPlanner, total),
      genericActionPlanTheftRate: zeroRate(observedCalls.genericActionPlanner, total),
      legacyParserCallRate: zeroRate(observedCalls.legacyParser, total),
      rawDashboardClassifierFallbackRate: zeroRate(observedCalls.rawControlClassifier, total),
      falseStateChangingDispatchRate: zeroRate(readOnlyRecords.filter(record => sideEffectIsStateChanging(record.sideEffectClass)).length, readOnlyRecords.length),
      falseCommittedMutationRate: zeroRate(readOnlyRecords.filter(record => record.trace.stateMutationCommitted).length, readOnlyRecords.length),
      falseConfirmationStagingRate: zeroRate(readOnlyRecords.filter(record => record.trace.confirmationStaged).length, readOnlyRecords.length),
      questionToStateEditRate: zeroRate(questionRecords.filter(record => sideEffectIsStateChanging(record.sideEffectClass)).length, questionRecords.length),
      hypotheticalToStateEditRate: zeroRate(hypotheticalRecords.filter(record => sideEffectIsStateChanging(record.sideEffectClass)).length, hypotheticalRecords.length),
      reportedCommandToStateEditRate: zeroRate(reportedRecords.filter(record => sideEffectIsStateChanging(record.sideEffectClass)).length, reportedRecords.length),
      quotedCommandToStateEditRate: zeroRate(quotedRecords.filter(record => sideEffectIsStateChanging(record.sideEffectClass)).length, quotedRecords.length),
    },
    records,
  };
  if (writeReportPath) {
    await mkdir(dirname(writeReportPath), { recursive: true });
    await writeFile(writeReportPath, `${JSON.stringify(report, null, 2)}\n`);
  }
  return report;
}

function productionLikeCallbacks({ fixture, prepared, observedCalls, perFixture }) {
  const inject = fixture.injectForbiddenCall ?? null;
  const maybeInject = () => {
    if (inject === "model") { observedCalls.modelPlanner += 1; perFixture.modelPlanner += 1; }
    if (inject === "generic") { observedCalls.genericActionPlanner += 1; perFixture.genericActionPlanner += 1; }
    if (inject === "legacy") { observedCalls.legacyParser += 1; perFixture.legacyParser += 1; }
    if (inject === "rawControl") { observedCalls.rawControlClassifier += 1; perFixture.rawControlClassifier += 1; }
  };
  return {
    truncated: async () => ({ handled: true, outcome: "responded" }),
    clarification: async () => ({ handled: true, outcome: "clarification" }),
    stale: async () => ({ handled: true, outcome: "clarification", tracePatch: { staleDispatchRejected: true } }),
    blockedSideEffect: async () => ({ handled: true, outcome: "responded" }),
    groundedQuestion: async () => {
      observedCalls.groundedQuestionHandler += 1;
      perFixture.groundedQuestionHandler += 1;
      maybeInject();
      return { handled: true, outcome: "responded" };
    },
    datasetMapping: async (_prepared, _query, options) => {
      observedCalls.mappingTypedHandler += 1;
      perFixture.mappingTypedHandler += 1;
      perFixture.receivedPrecompiledDraft = Boolean(options.precompiledDraft);
      observedCalls.mappingValidator += 1;
      maybeInject();
      return {
        handled: true,
        outcome: "applied_reversible_edit",
        stateMutationCommitted: prepared.compilation?.sideEffectClass !== "read_only",
        tracePatch: { mappingRecompileCount: options.precompiledDraft ? 0 : 1, validatorCalls: ["mappingPatchValidator"] },
      };
    },
    parserWorkflow: async () => {
      observedCalls.parserWorkflowHandler += 1;
      perFixture.parserWorkflowHandler += 1;
      maybeInject();
      const operations = prepared.compilation?.compiled?.operations ?? [];
      const confirmation = operations.some(operation => operation.type.endsWith("_CONFIRMATION"));
      return { handled: true, outcome: confirmation ? "staged_confirmation" : "responded", confirmationStaged: confirmation };
    },
    graphMutation: async (_query, options) => {
      observedCalls.graphTypedHandler += 1;
      perFixture.graphTypedHandler += 1;
      perFixture.receivedPrecompiledPlan = Boolean(options.precompiledPlan);
      perFixture.receivedDeterministicFirst = options.deterministicFirst === true;
      maybeInject();
      if (!options.precompiledPlan && prepared.compilation?.semanticConfidence?.level !== "high") {
        observedCalls.modelPlanner += 1;
        perFixture.modelPlanner += 1;
      }
      observedCalls.graphValidator += 1;
      return {
        handled: true,
        outcome: "staged_confirmation",
        confirmationStaged: true,
        tracePatch: {
          graphRecompileCount: options.precompiledPlan ? 0 : 1,
          modelCalls: perFixture.modelPlanner ? [{ task: "plan_graph_mutation" }] : [],
          validatorCalls: ["previewGraphMutation"],
        },
      };
    },
    dashboardControl: async () => {
      observedCalls.dashboardCanonicalHandler += 1;
      perFixture.dashboardCanonicalHandler += 1;
      maybeInject();
      return { handled: true, outcome: "responded", tracePatch: { rawControlClassifierCallCount: perFixture.rawControlClassifier } };
    },
  };
}

function createObservedCalls() {
  return {
    analysis: 0,
    compilation: 0,
    mappingTypedHandler: 0,
    graphTypedHandler: 0,
    parserWorkflowHandler: 0,
    dashboardCanonicalHandler: 0,
    groundedQuestionHandler: 0,
    modelPlanner: 0,
    genericActionPlanner: 0,
    legacyParser: 0,
    rawControlClassifier: 0,
    mappingValidator: 0,
    graphValidator: 0,
    confirmationStaging: 0,
    stateChangingDispatches: 0,
    stateMutationCommits: 0,
  };
}

function createPerFixtureCalls() {
  return {
    handlerCalls: {},
    mappingTypedHandler: 0,
    graphTypedHandler: 0,
    parserWorkflowHandler: 0,
    dashboardCanonicalHandler: 0,
    groundedQuestionHandler: 0,
    modelPlanner: 0,
    genericActionPlanner: 0,
    legacyParser: 0,
    rawControlClassifier: 0,
    receivedPrecompiledDraft: false,
    receivedPrecompiledPlan: false,
    receivedDeterministicFirst: false,
  };
}

function stratifiedSample(fixtures) {
  const limits = {
    dataset_mapping_actions: 20,
    dataset_mapping_questions: 10,
    dataset_grouping_actions: 8,
    dataset_grouping_questions: 4,
    graph_mutation_actions: 20,
    graph_mutation_questions: 10,
    parser_workflow: 12,
    dashboard_control: 12,
    corrections: 10,
    negative_ambiguous_adversarial: 12,
    core_regressions: 10,
  };
  const used = {};
  return fixtures.filter(fixture => {
    const category = fixture.category ?? "core_regressions";
    const max = limits[category] ?? 4;
    used[category] = used[category] ?? 0;
    if (used[category] >= max) return false;
    used[category] += 1;
    return true;
  });
}

function stateFromFixture(fixture) {
  return {
    activeBatch: fixture.state?.activeBatch ?? null,
    activeBatchId: fixture.state?.activeBatch?.id ?? null,
    graphId: fixture.state?.graphId ?? null,
    graphVersion: fixture.state?.graphVersion ?? null,
    graphFingerprint: fixture.state?.graphFingerprint ?? null,
  };
}

function zeroRate(count, evaluated) {
  return {
    correct: evaluated ? evaluated - count : 0,
    count,
    evaluated,
    excluded: 0,
    rate: evaluated ? Number((count / evaluated).toFixed(4)) : null,
    status: evaluated ? "evaluated" : "not_evaluated",
  };
}

function countBy(values, keyFn) {
  const counts = {};
  for (const value of values) {
    const key = keyFn(value) ?? "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}
