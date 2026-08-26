import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeDeterministicNlu } from "../../src/agent/deterministicNlu/deterministicNlu.js";
import { compileDeterministicAction } from "../../src/agent/deterministicNlu/compileDeterministicAction.js";
import { sideEffectIsStateChanging } from "../../src/agent/deterministicNlu/sideEffectPolicy.js";
import {
  canonicalizeDashboardControlIntent,
  canonicalizeDatasetMappingPatch,
  canonicalizeGraphMutationPlan,
  canonicalizeParserWorkflowOperations,
  exactCanonicalOperationMatch,
  partialCanonicalOperationMatch,
} from "../../src/agent/deterministicNlu/canonicalOperation.js";
import { buildDatasetMappingSpecV2FromBatch } from "../../src/agent/deterministicMappingV2.js";
import { createGraphIdentity } from "../../src/graph/graphIdentity.js";
import { inspectCorpusIntegrity } from "./nluCorpusIntegrity.mjs";

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const contextDir = join(root, "tests", "fixtures", "contexts");

export async function loadContextFixture(name) {
  return JSON.parse(await readFile(join(contextDir, `${name}.json`), "utf8"));
}

function datasetContextFromFixture(name, fixture) {
  const files = (fixture.files ?? []).map((file, index) => ({
    fileId: `f${index + 1}`,
    fileName: file.fileName,
    format: file.fileName.endsWith(".json") ? "json" : "csv",
    columns: (file.columns ?? []).map(column => ({ name: column })),
  }));
  const batch = {
    id: `batch-${name}`,
    version: 1,
    parseMode: fixture.parseMode ?? "together",
    files: files.map(file => ({ name: file.fileName })),
    datasetProfile: { files },
    datasetGroups: [{
      id: "group-main",
      label: "main",
      kind: "static_graph",
      fileNames: files.map(file => file.fileName),
      status: "draft",
    }],
    relationshipEvidence: [],
    mappingRevision: 0,
    groupingRevision: 0,
    groupingQuestions: [],
    mappingHistory: [],
  };
  const mappingSpec = buildDatasetMappingSpecV2FromBatch(batch);
  const fileNames = files.map(file => file.fileName);
  const headersByFile = Object.fromEntries(files.map(file => [file.fileName, file.columns.map(column => column.name)]));
  return {
    analysisContext: { datasetMapping: { fileNames, headersByFile } },
    compileContext: { batch, mappingSpec, datasetProfile: batch.datasetProfile },
    state: { activeBatch: batch, activeBatchId: batch.id },
  };
}

function graphContextFromFixture(fixture) {
  const hyperedges = fixture.hyperedges ?? [];
  const graphIdentity = createGraphIdentity(hyperedges, null, { replace: true });
  return {
    analysisContext: {
      graph: {
        hyperedges: hyperedges.map(edge => edge.id),
        vertices: [...new Set(hyperedges.flatMap(edge => edge.vertices ?? []))],
      },
    },
    compileContext: {
      hyperedges,
      graphIdentity,
      graphHistory: fixture.graphHistory ?? [],
      selectedEntity: fixture.selectedEntity ?? null,
      recentReferences: fixture.recentReferences ?? {},
    },
    state: {
      graphId: graphIdentity.graphId,
      graphVersion: graphIdentity.graphVersion,
      graphFingerprint: graphIdentity.graphFingerprint,
    },
  };
}

function parserContextFromFixture(fixture) {
  const workflow = fixture.parserWorkflow ?? {};
  const transformationPlan = workflow.planStatus === "generated" ? { steps: [] } : null;
  const generatedParserFromMapping = workflow.parserStatus === "generated" ? "async function parseHypergraph(){ return []; }" : "";
  const activeBatch = {
    id: "batch-parser",
    version: 1,
    mappingRevision: 1,
    groupingRevision: 1,
    mappingSpecStatus: workflow.mappingStatus ?? "unknown",
    transformationPlan,
    generatedParserFromMapping,
  };
  return {
    analysisContext: { parserWorkflow: workflow },
    compileContext: {
      state: {
        activeBatch,
        customResultId: workflow.resultStatus === "generated" ? "result-1" : null,
      },
    },
    state: { activeBatch, activeBatchId: activeBatch.id },
  };
}

function dashboardContextFromFixture(fixture) {
  return {
    analysisContext: { dashboard: fixture },
    compileContext: { state: fixture },
    state: fixture,
  };
}

export async function buildCompilerContexts(name) {
  const fixture = await loadContextFixture(name);
  if (fixture.files) return datasetContextFromFixture(name, fixture);
  if (fixture.hyperedges) return graphContextFromFixture(fixture);
  if (fixture.parserWorkflow) return parserContextFromFixture(fixture);
  return dashboardContextFromFixture(fixture);
}

function arrayEquals(left = [], right = []) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

export function extractOperations(result) {
  const compiled = result.compiled ?? result;
  return compiled.plan?.operations
    ?? compiled.draft?.operations
    ?? compiled.operations
    ?? result.typedValue?.operations
    ?? (Array.isArray(result.typedValue) ? result.typedValue : [])
    ?? [];
}

export function extractOperationTypes(result) {
  return result.diagnostics?.operationTypes
    ?? result.compiled?.diagnostics?.operationTypes
    ?? extractOperations(result).map(operation => operation.type);
}

export function extractResolvedEntities(result) {
  return result.diagnostics?.resolvedEntities
    ?? result.compiled?.diagnostics?.resolvedEntities
    ?? result.compiled?.diagnostics?.nluTrace?.resolvedEntityIds
    ?? [];
}

export function extractCanonicalOperations(result) {
  const sourceDomain = result.domain ?? result.diagnostics?.authoritativeDomain;
  if (result.typedKind === "GroundedQuestion") return [];
  if (sourceDomain === "dataset_mapping" || sourceDomain === "dataset_grouping") {
    return canonicalizeDatasetMappingPatch(result.compiled ?? result.typedValue ?? {});
  }
  if (sourceDomain === "graph_mutation") return canonicalizeGraphMutationPlan(result.compiled ?? result.typedValue ?? {});
  if (sourceDomain === "parser_workflow") return canonicalizeParserWorkflowOperations(result.compiled ?? result.typedValue ?? {});
  if (sourceDomain === "dashboard_control") return canonicalizeDashboardControlIntent(result.compiled ?? result.typedValue ?? {});
  return [];
}

function confusionKey(expected, actual) {
  return `${expected ?? "any"}->${actual ?? "unknown"}`;
}

export async function evaluateDeterministicNluCorpus(fixtures, { writeReportPath = null } = {}) {
  const integrity = inspectCorpusIntegrity(fixtures);
  const records = [];
  const confusionMatrices = { domain: {}, intent: {}, speechAct: {}, sideEffectClass: {} };
  const counts = Object.fromEntries([
    "domainAccuracy", "intentAccuracy", "modeAccuracy", "speechActAccuracy", "sideEffectClassAccuracy",
    "handledAccuracy", "typedKindAccuracy", "operationTypeExactMatch", "operationObjectExactMatch",
    "operationObjectPartialMatch", "entityResolutionExactMatch", "safeRejectionAccuracy",
    "missedValidActionAccuracy", "staleDispatchRejectionAccuracy",
  ].map(name => [name, counter()]));
  let expectedClarifications = 0;
  let actualClarifications = 0;
  let correctClarifications = 0;
  const sideEffectCounters = {
    falseStateChangingDispatch: 0,
    falseCommittedMutation: 0,
    falseConfirmationStaging: 0,
    questionToStateEdit: 0,
    hypotheticalToStateEdit: 0,
    reportedCommandToStateEdit: 0,
    quotedCommandToStateEdit: 0,
    missedRequestedSideEffect: 0,
  };
  let genericActionPlannerThefts = 0;
  let unexpectedModelCalls = 0;
  let legacyParserRuntimeCalls = 0;
  let rawDashboardClassifierFallbacks = 0;
  let duplicateAnalyses = 0;
  let duplicateCompilations = 0;

  for (const fixture of fixtures) {
    const { analysisContext, compileContext } = await buildCompilerContexts(fixture.contextFixture ?? fixture.context);
    const nlu = analyzeDeterministicNlu(fixture.text, analysisContext);
    const compiled = compileDeterministicAction(nlu, { ...compileContext, ...(fixture.compileOverrides ?? {}) });
    const operations = extractOperations(compiled);
    const operationTypes = extractOperationTypes(compiled);
    const resolvedEntities = extractResolvedEntities(compiled);
    const canonicalOperations = extractCanonicalOperations(compiled);
    const expected = fixture.expected ?? {};
    const actualIntent = compiled.compiled?.canonicalIntent ?? compiled.intent ?? nlu.primaryIntent;
    const actualSpeechAct = compiled.speechAct ?? nlu.speechAct ?? "unknown";
    const actualSideEffect = compiled.sideEffectClass ?? "read_only";
    const expectedSideEffect = expected.expectedSideEffect ?? expected.sideEffectClass ?? legacyExpectedSideEffect(expected);
    const stateChanging = sideEffectIsStateChanging(actualSideEffect);
    const expectedStateChanging = typeof expected.stateChangingDispatchExpected === "boolean"
      ? expected.stateChangingDispatchExpected
      : expectedSideEffect ? sideEffectIsStateChanging(expectedSideEffect) : null;
    const clarification = Boolean(compiled.compiled?.needsClarification || compiled.compiled?.draft?.classification === "clarification");

    addExpected(counts.domainAccuracy, expected.domain, nlu.primaryDomain === expected.domain);
    addConfusion(confusionMatrices.domain, expected.domain, nlu.primaryDomain);
    addExpected(counts.intentAccuracy, expected.intent, actualIntent === expected.intent);
    addConfusion(confusionMatrices.intent, expected.intent, actualIntent);
    addExpected(counts.modeAccuracy, expected.mode, nlu.mode === expected.mode);
    addExpected(counts.speechActAccuracy, expected.speechAct, actualSpeechAct === expected.speechAct);
    addConfusion(confusionMatrices.speechAct, expected.speechAct, actualSpeechAct);
    addExpected(counts.sideEffectClassAccuracy, expectedSideEffect, actualSideEffect === expectedSideEffect);
    addConfusion(confusionMatrices.sideEffectClass, expectedSideEffect, actualSideEffect);
    addExpected(counts.handledAccuracy, typeof expected.handled === "boolean" ? expected.handled : null, compiled.handled === expected.handled);
    addExpected(counts.typedKindAccuracy, expected.typedKind, compiled.typedKind === expected.typedKind);
    addExpected(counts.operationTypeExactMatch, expected.operationTypes, arrayEquals(operationTypes, expected.operationTypes ?? []));
    addExpected(counts.operationObjectExactMatch, expected.canonicalOperations, exactCanonicalOperationMatch(canonicalOperations, expected.canonicalOperations ?? []));
    addExpected(counts.operationObjectPartialMatch, expected.operationContains, partialCanonicalOperationMatch(operations, expected.operationContains ?? []));
    addExpected(counts.entityResolutionExactMatch, expected.resolvedEntities, arrayEquals([...resolvedEntities].sort(), [...(expected.resolvedEntities ?? [])].sort()));
    addExpected(counts.safeRejectionAccuracy, expectedStateChanging === false, expectedStateChanging === false ? !stateChanging : true);
    addExpected(counts.missedValidActionAccuracy, expectedStateChanging === true, expectedStateChanging === true ? stateChanging : true);
    addExpected(counts.staleDispatchRejectionAccuracy, expected.staleDispatchRejected, expected.staleDispatchRejected ? Boolean(compiled.stale) : true);

    if (expected.clarification) expectedClarifications += 1;
    if (clarification) actualClarifications += 1;
    if (expected.clarification && clarification) correctClarifications += 1;

    if (expectedStateChanging === false && stateChanging) sideEffectCounters.falseStateChangingDispatch += 1;
    if (expected.commitExpected === false && compiled.diagnostics?.stateMutationCommitted) sideEffectCounters.falseCommittedMutation += 1;
    if (expected.confirmationExpected === false && compiled.diagnostics?.confirmationStaged) sideEffectCounters.falseConfirmationStaging += 1;
    if (["informational_question", "explanation_question", "status_question"].includes(actualSpeechAct) && stateChanging) sideEffectCounters.questionToStateEdit += 1;
    if (actualSpeechAct === "hypothetical_question" && stateChanging) sideEffectCounters.hypotheticalToStateEdit += 1;
    if (actualSpeechAct === "reported_command" && stateChanging) sideEffectCounters.reportedCommandToStateEdit += 1;
    if (actualSpeechAct === "quoted_command" && stateChanging) sideEffectCounters.quotedCommandToStateEdit += 1;
    if (expectedStateChanging === true && !stateChanging) sideEffectCounters.missedRequestedSideEffect += 1;
    if (expected.forbiddenOperationTypes?.some(type => operationTypes.includes(type))) sideEffectCounters.falseStateChangingDispatch += 1;

    if (compiled.diagnostics?.genericActionPlannerCalled) genericActionPlannerThefts += 1;
    if (compiled.diagnostics?.modelCalled) unexpectedModelCalls += 1;
    if (compiled.diagnostics?.legacyParserCalled) legacyParserRuntimeCalls += 1;
    if (compiled.diagnostics?.rawControlClassifierCalled) rawDashboardClassifierFallbacks += 1;
    if ((compiled.diagnostics?.analysisCount ?? 1) > 1) duplicateAnalyses += 1;
    if ((compiled.diagnostics?.compilationCount ?? 1) > 1) duplicateCompilations += 1;

    records.push({
      id: fixture.id,
      family: fixture.family,
      category: fixture.category,
      text: fixture.text,
      expected,
      actual: {
        domain: nlu.primaryDomain,
        intent: actualIntent,
        mode: nlu.mode,
        speechAct: actualSpeechAct,
        sideEffectClass: actualSideEffect,
        stateChanging,
        handled: compiled.handled,
        typedKind: compiled.typedKind,
        operationTypes,
        canonicalOperations,
        resolvedEntities,
        clarification,
        authoritativeCompiler: compiled.diagnostics?.authoritativeCompiler,
        semanticConfidence: compiled.semanticConfidence,
        dispatchAuthorized: compiled.dispatchAuthorized,
        blockedSideEffect: compiled.diagnostics?.blockedSideEffect ?? null,
        legacyParserCalled: Boolean(compiled.diagnostics?.legacyParserCalled),
        modelCalled: Boolean(compiled.diagnostics?.modelCalled),
        genericActionPlannerCalled: Boolean(compiled.diagnostics?.genericActionPlannerCalled),
      },
    });
  }

  const total = records.length;
  const categoryCounts = countBy(records, record => record.category ?? "core_regressions");
  const familyCounts = countBy(records, record => record.family);
  const domainCounts = countBy(records, record => record.expected.domain ?? "unspecified");
  const readOnlyExpected = records.filter(record => (record.expected.expectedSideEffect ?? legacyExpectedSideEffect(record.expected)) === "read_only").length;
  const stateChangingExpected = records.filter(record => record.expected.stateChangingDispatchExpected === true
    || sideEffectIsStateChanging(record.expected.expectedSideEffect ?? legacyExpectedSideEffect(record.expected))).length;
  const report = {
    evaluationType: "compiler evaluation",
    corpusAuthenticity: {
      literalUnique: integrity.literalUnique,
      normalizedUnique: integrity.normalizedUnique,
      substantiveSkeletonUnique: integrity.substantiveSkeletonUnique,
      clauseSkeletonUnique: integrity.clauseSkeletonUnique,
      semanticFamilyCount: integrity.semanticFamilyCount,
      opaqueSuffixViolations: integrity.opaqueSuffixViolations,
      minimalSubstitutionClusters: integrity.dominatingSkeletons,
      groundTruthReviewed: {
        reviewed: total - integrity.groundTruthViolations.length,
        total,
      },
    },
    corpus: {
      uniqueTotal: integrity.normalizedUnique,
      categoryCounts,
      familyCounts,
      duplicates: integrity.duplicateNormalizedUtterances,
      highSimilarityClusters: integrity.highSimilarityClusters,
    },
    uniqueUtteranceCounts: { total: integrity.normalizedUnique, byExpectedDomain: domainCounts },
    categoryCounts,
    familyCounts,
    metrics: {
      domainAccuracy: metric(counts.domainAccuracy, total),
      intentAccuracy: metric(counts.intentAccuracy, total),
      modeAccuracy: metric(counts.modeAccuracy, total),
      speechActAccuracy: metric(counts.speechActAccuracy, total),
      sideEffectClassAccuracy: metric(counts.sideEffectClassAccuracy, total),
      handledAccuracy: metric(counts.handledAccuracy, total),
      typedKindAccuracy: metric(counts.typedKindAccuracy, total),
      operationTypeExactMatch: metric(counts.operationTypeExactMatch, total),
      operationObjectExactMatch: metric(counts.operationObjectExactMatch, total),
      operationObjectPartialMatch: metric(counts.operationObjectPartialMatch, total),
      entityResolutionExactMatch: metric(counts.entityResolutionExactMatch, total),
      clarificationPrecision: metric({ correct: correctClarifications, evaluated: actualClarifications }, total),
      clarificationRecall: metric({ correct: correctClarifications, evaluated: expectedClarifications }, total),
      safeRejectionAccuracy: metric(counts.safeRejectionAccuracy, total),
      missedValidActionAccuracy: metric(counts.missedValidActionAccuracy, total),
      falseStateChangingDispatchRate: rateMetric(sideEffectCounters.falseStateChangingDispatch, readOnlyExpected, total - readOnlyExpected, true),
      falseCommittedMutationRate: rateMetric(sideEffectCounters.falseCommittedMutation, total, 0, true),
      falseConfirmationStagingRate: rateMetric(sideEffectCounters.falseConfirmationStaging, total, 0, true),
      questionToStateEditRate: rateMetric(sideEffectCounters.questionToStateEdit, total, 0, true),
      hypotheticalToStateEditRate: rateMetric(sideEffectCounters.hypotheticalToStateEdit, total, 0, true),
      reportedCommandToStateEditRate: rateMetric(sideEffectCounters.reportedCommandToStateEdit, total, 0, true),
      quotedCommandToStateEditRate: rateMetric(sideEffectCounters.quotedCommandToStateEdit, total, 0, true),
      missedRequestedSideEffectRate: rateMetric(sideEffectCounters.missedRequestedSideEffect, stateChangingExpected, total - stateChangingExpected, true),
      unexpectedModelCallRate: rateMetric(unexpectedModelCalls, total, 0, true),
      genericActionPlanTheftRate: rateMetric(genericActionPlannerThefts, total, 0, true),
      legacyRawParserCallRate: rateMetric(legacyParserRuntimeCalls, total, 0, true),
      rawDashboardClassifierFallbackRate: rateMetric(rawDashboardClassifierFallbacks, total, 0, true),
      duplicateAnalysisRate: rateMetric(duplicateAnalyses, total, 0, true),
      duplicateCompilationRate: rateMetric(duplicateCompilations, total, 0, true),
      staleDispatchRejectionAccuracy: metric(counts.staleDispatchRejectionAccuracy, total),
    },
    confusionMatrices,
    integrity,
    records,
  };
  // Backward-compatible aliases used by earlier reports/tests.
  report.domainAccuracy = legacyAccuracy(report.metrics.domainAccuracy);
  report.intentAccuracy = legacyAccuracy(report.metrics.intentAccuracy);
  report.operationTypeExactMatch = legacyAccuracy(report.metrics.operationTypeExactMatch);
  report.operationObjectExactMatch = legacyAccuracy(report.metrics.operationObjectExactMatch);
  report.operationObjectPartialMatch = legacyAccuracy(report.metrics.operationObjectPartialMatch);
  report.entityResolutionExactMatch = legacyAccuracy(report.metrics.entityResolutionExactMatch);
  report.clarificationPrecision = report.metrics.clarificationPrecision.rate;
  report.clarificationRecall = report.metrics.clarificationRecall.rate;
  report.falseMutationRate = report.metrics.falseStateChangingDispatchRate.rate;
  report.genericActionPlannerTheftRate = report.metrics.genericActionPlanTheftRate.rate;
  report.unexpectedModelCallRate = report.metrics.unexpectedModelCallRate.rate;
  report.legacyParserRuntimeCallRate = report.metrics.legacyRawParserCallRate.rate;

  if (writeReportPath) {
    await mkdir(dirname(writeReportPath), { recursive: true });
    await writeFile(writeReportPath, `${JSON.stringify(report, null, 2)}\n`);
  }
  return report;
}

function legacyExpectedSideEffect(expected = {}) {
  if (expected.noMutation === true) return "read_only";
  if (expected.mutationExpected === true) return expected.typedKind === "GraphMutationPlan" ? "graph_edit_preview" : "reversible_mapping_edit";
  return null;
}

function counter() { return { correct: 0, evaluated: 0 }; }
function addExpected(target, expectedValue, isCorrect) {
  if (expectedValue === undefined || expectedValue === null) return;
  target.evaluated += 1;
  if (isCorrect) target.correct += 1;
}
function addConfusion(matrix, expected, actual) {
  if (!expected) return;
  const key = confusionKey(expected, actual);
  matrix[key] = (matrix[key] ?? 0) + 1;
}
function metric({ correct, evaluated }, total) {
  return {
    correct,
    evaluated,
    excluded: Math.max(0, total - evaluated),
    rate: evaluated ? Number((correct / evaluated).toFixed(4)) : null,
    status: evaluated ? "evaluated" : "not_evaluated",
  };
}
function rateMetric(count, evaluated, excluded = 0, lowerIsBetter = false) {
  return {
    correct: lowerIsBetter ? Math.max(0, evaluated - count) : count,
    count,
    evaluated,
    excluded,
    rate: evaluated ? Number((count / evaluated).toFixed(4)) : null,
    status: evaluated ? "evaluated" : "not_evaluated",
  };
}
function legacyAccuracy(metricValue) {
  return { overall: metricValue.rate, correct: metricValue.correct, total: metricValue.evaluated };
}
function countBy(values, keyFn) {
  const counts = {};
  for (const value of values) {
    const key = keyFn(value) ?? "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export function assertCorpusRecord(record) {
  const expected = record.expected ?? {};
  if (expected.domain && record.actual.domain !== expected.domain) throw new Error(`${record.id}: expected domain ${expected.domain}, got ${record.actual.domain}`);
  if (typeof expected.handled === "boolean" && record.actual.handled !== expected.handled) throw new Error(`${record.id}: expected handled=${expected.handled}, got ${record.actual.handled}`);
  if (expected.typedKind && record.actual.typedKind !== expected.typedKind) throw new Error(`${record.id}: expected typedKind ${expected.typedKind}, got ${record.actual.typedKind}`);
  if (expected.intent && record.actual.intent !== expected.intent) throw new Error(`${record.id}: expected intent ${expected.intent}, got ${record.actual.intent}`);
  if (expected.speechAct && record.actual.speechAct !== expected.speechAct) throw new Error(`${record.id}: expected speechAct ${expected.speechAct}, got ${record.actual.speechAct}`);
  if (expected.expectedSideEffect && record.actual.sideEffectClass !== expected.expectedSideEffect) throw new Error(`${record.id}: expected side effect ${expected.expectedSideEffect}, got ${record.actual.sideEffectClass}`);
  if (expected.operationTypes && !arrayEquals(record.actual.operationTypes, expected.operationTypes)) throw new Error(`${record.id}: expected operation types ${expected.operationTypes.join(",")}, got ${record.actual.operationTypes.join(",")}`);
  if (expected.forbiddenOperationTypes?.some(type => record.actual.operationTypes.includes(type))) throw new Error(`${record.id}: forbidden operation type present`);
  if (expected.clarification && !record.actual.clarification) throw new Error(`${record.id}: expected clarification`);
  if (expected.stateChangingDispatchExpected === false && record.actual.stateChanging) throw new Error(`${record.id}: produced a state-changing compilation for a read-only fixture`);
  if (record.actual.legacyParserCalled) throw new Error(`${record.id}: legacy parser was called`);
  if (record.actual.modelCalled) throw new Error(`${record.id}: model was called`);
  if (record.actual.genericActionPlannerCalled) throw new Error(`${record.id}: generic ActionPlan was called`);
}
