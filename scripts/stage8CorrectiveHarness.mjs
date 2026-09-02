import { readFile } from "node:fs/promises";
import { allCatalogExamples } from "../src/agent/deterministicNlu/commandCatalog.js";
import {
  analyzePositiveAuthorization,
  authorizationAllowsSideEffect,
} from "../src/agent/deterministicNlu/positiveAuthorization.js";
import { analyzeRequestSemantics } from "../src/agent/deterministicNlu/requestSemantics.js";
import { dispatchCompiledAction } from "../src/agent/deterministicNlu/dispatchCompiledAction.js";
import { sideEffectIsStateChanging } from "../src/agent/deterministicNlu/sideEffectPolicy.js";
import { routePendingSubmission, PENDING_ROUTE } from "../src/agent/pendingSubmissionRouter.js";
import { isPlausibleGraphMutationText } from "../src/agent/graphMutationModelPlanner.js";
import { buildCompilerContexts } from "../tests/helpers/evaluateDeterministicNluCorpus.mjs";
import { fixtureNameForExample } from "../tests/helpers/deterministicCommandCatalogTestHelpers.mjs";
import {
  STAGE8_MIXED_MATRIX_TEMPLATES,
  STAGE8_MIXED_REPRESENTATIVE_CASES,
  STAGE8_TRUNCATION_PROBES,
  forbiddenScopesExcept,
} from "../tests/fixtures/v7.3.14/stage8CorrectiveCorpus.mjs";
import {
  STAGE8_EXISTING_60_READONLY_FRAMES,
  STAGE8_NEW_40_READONLY_FRAMES,
  STAGE8_PENDING_CORRECTIONS,
  STAGE8_PENDING_READONLY_QUERIES,
} from "../tests/fixtures/v7.3.14/stage8AuthorizationCorpus.mjs";
import { compileAndDispatch, createProtectedState, stateFingerprint } from "./stage8SafetyHarness.mjs";

const bases = allCatalogExamples({ includePanelOnly: false })
  .filter(({ example }) => sideEffectIsStateChanging(example.expectedSideEffect) && !example.expectsClarification);
const mixedBases = bases.filter(({ example }) => example.negatedRun !== true);
const contextCache = new Map();

async function contextsForFixture(fixture) {
  if (!contextCache.has(fixture)) contextCache.set(fixture, await buildCompilerContexts(fixture));
  return contextCache.get(fixture);
}

function expectedOperationTypes(example) {
  if (example.expectedOperationTypes?.length) return example.expectedOperationTypes;
  if (example.expectedOperations?.length) return example.expectedOperations.map(operation => operation.type);
  return example.expectedIntent ? [example.expectedIntent] : [];
}

function expectedProtectedStateChanges(domain) {
  if (domain === "graph_mutation") return ["graphCalls"];
  if (domain === "dataset_mapping" || domain === "dataset_grouping") return ["mappingCalls"];
  if (domain === "parser_workflow") return ["parserCalls"];
  if (domain === "dashboard_control") return ["navigationCalls"];
  if (domain === "legacy_action") return ["legacyCalls"];
  return [];
}

function expectedHandler(domain) {
  if (domain === "graph_mutation") return "graphMutation";
  if (domain === "dataset_mapping" || domain === "dataset_grouping") return "datasetMapping";
  if (domain === "parser_workflow") return "parserWorkflow";
  if (domain === "dashboard_control") return "dashboardControl";
  if (domain === "legacy_action") return "legacyAction";
  return null;
}

function exactArray(left = [], right = []) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function operationSubsetMatches(actual = [], expected = []) {
  return expected.every(expectedOperation => actual.some(actualOperation =>
    Object.entries(expectedOperation).every(([key, value]) => stateFingerprint(actualOperation?.[key]) === stateFingerprint(value))
  ));
}

function operationTargetsForbidden(record, forbiddenTargets = []) {
  if (!forbiddenTargets.length) return false;
  return record.operations.some(operation => Object.entries(operation).some(([key, value]) =>
    /(?:hyperedge|vertex).*id/i.test(key) && forbiddenTargets.includes(String(value))
  ));
}

async function evaluateMixedFixture(fixture) {
  const contexts = await contextsForFixture(fixture.contextFixture);
  const record = await compileAndDispatch(fixture.query, contexts);
  const expectedHandlerName = fixture.expectedHandler ?? expectedHandler(fixture.expectedDomain);
  const actualHandlerCount = expectedHandlerName ? record.handlerCalls[expectedHandlerName] ?? 0 : 0;
  const authorizationModeMismatch = record.authorizationDecision !== fixture.expectedAuthorizationMode;
  const forbiddenScope = record.stateChangingSideEffect
    && fixture.forbiddenSideEffectScopes.includes(record.sideEffectClass);
  const forbiddenTarget = operationTargetsForbidden(record, fixture.forbiddenOperationTargets);
  const operationTypesMismatch = fixture.expectedOperationTypes?.length
    ? !exactArray(record.operationTypes, fixture.expectedOperationTypes)
    : false;
  const operationSubsetMismatch = fixture.expectedOperationSubset?.length
    ? !operationSubsetMatches(record.operations, fixture.expectedOperationSubset)
    : false;
  const expectedDispatch = fixture.dispatchRequired === true;
  const missedAuthorizedClause = expectedDispatch
    ? (record.sideEffectClass !== fixture.expectedSideEffectScope
      || record.dispatchAuthorized === false
      || !record.stateMutationCommitted
      || !record.stateChanged
      || actualHandlerCount !== 1
      || operationTypesMismatch
      || operationSubsetMismatch)
    : (fixture.clarificationRequired === true && !record.explicitClarification);
  const wrongSideEffectScope = expectedDispatch
    ? record.sideEffectClass !== fixture.expectedSideEffectScope || forbiddenScope
    : record.stateChangingSideEffect;
  const unauthorizedSideEffect = authorizationModeMismatch
    ? record.stateChanged || record.stateMutationCommitted
    : forbiddenScope || forbiddenTarget;
  const expectedChanges = [...fixture.expectedProtectedStateChanges].sort();
  const actualChanges = [...record.changedProtectedKeys].sort();
  const stateFingerprintViolation = !exactArray(actualChanges, expectedChanges);
  return {
    id: fixture.id,
    query: fixture.query,
    independentExpectation: {
      authorizationMode: fixture.expectedAuthorizationMode,
      executableClause: fixture.expectedExecutableClause,
      sideEffectScope: fixture.expectedSideEffectScope,
      forbiddenSideEffectScopes: fixture.forbiddenSideEffectScopes,
      dispatchRequired: fixture.dispatchRequired,
      noOpPermitted: fixture.noOpPermitted,
      noOpReason: fixture.noOpReason,
      operationTypes: fixture.expectedOperationTypes ?? [],
      operationSubset: fixture.expectedOperationSubset ?? [],
      protectedStateChanges: fixture.expectedProtectedStateChanges,
      expectedHandler: expectedHandlerName,
    },
    actual: record,
    classifications: {
      unauthorizedSideEffect,
      missedAuthorizedClause,
      wrongSideEffectScope,
      stateFingerprintViolation,
      forbiddenTarget,
      operationTypesMismatch,
      operationSubsetMismatch,
    },
  };
}

function matrixFixture({ entry, example }, template, index) {
  const expectedScope = template.expectedScope(example);
  const expectedDomain = template.expectedOperationTypes ? "dashboard_control" : example.expectedDomain;
  const operationTypes = template.expectedOperationTypes ?? expectedOperationTypes(example);
  return {
    id: `matrix-${String(index + 1).padStart(4, "0")}-${template.id}-${entry.id}`,
    contextFixture: fixtureNameForExample(example),
    query: template.buildQuery(example.text),
    expectedAuthorizationMode: "authorized",
    expectedExecutableClause: template.expectedExecutableClause(example),
    expectedSideEffectScope: expectedScope,
    forbiddenSideEffectScopes: forbiddenScopesExcept(expectedScope),
    dispatchRequired: true,
    noOpPermitted: false,
    noOpReason: null,
    expectedOperationTypes: operationTypes,
    expectedProtectedStateChanges: expectedProtectedStateChanges(expectedDomain),
    expectedDomain,
    expectedHandler: expectedHandler(expectedDomain),
    sourceFixtureMetadata: {
      catalogEntryId: entry.id,
      baseText: example.text,
      expectedDomain: example.expectedDomain,
      expectedSideEffect: example.expectedSideEffect,
      expectedOperationTypes: expectedOperationTypes(example),
    },
  };
}

export async function runCorrectiveMixedCorpus() {
  const representative = [];
  for (const fixture of STAGE8_MIXED_REPRESENTATIVE_CASES) {
    representative.push(await evaluateMixedFixture({
      ...fixture,
      expectedDomain: fixture.expectedProtectedStateChanges.includes("graphCalls") ? "graph_mutation"
        : fixture.expectedProtectedStateChanges.includes("parserCalls") ? "parser_workflow"
          : fixture.expectedProtectedStateChanges.includes("navigationCalls") ? "dashboard_control"
            : "grounded_question",
    }));
  }
  const matrix = [];
  let index = 0;
  for (const base of mixedBases) {
    for (const template of STAGE8_MIXED_MATRIX_TEMPLATES) {
      matrix.push(await evaluateMixedFixture(matrixFixture(base, template, index)));
      index += 1;
    }
  }
  const records = [...representative, ...matrix];
  const failuresFor = key => records.filter(record => record.classifications[key]);
  return {
    cases: records.length,
    representativeCases: representative.length,
    matrixCases: matrix.length,
    templateCount: STAGE8_MIXED_MATRIX_TEMPLATES.length,
    baseCount: mixedBases.length,
    excludedCompoundSafePreparationBases: bases.length - mixedBases.length,
    unauthorizedSideEffects: failuresFor("unauthorizedSideEffect").length,
    missedAuthorizedClauses: failuresFor("missedAuthorizedClause").length,
    wrongSideEffectScopes: failuresFor("wrongSideEffectScope").length,
    stateFingerprintViolations: failuresFor("stateFingerprintViolation").length,
    failures: records.filter(record => Object.values(record.classifications).some(Boolean)),
    representative,
    records,
  };
}

async function finalDispatchProbe(probe) {
  const semantics = analyzeRequestSemantics(probe.query);
  const protectedState = { handlerMarker: 0 };
  const before = stateFingerprint(protectedState);
  let handlerCalls = 0;
  const prepared = {
    handled: true,
    nlu: { primaryDomain: "graph_mutation", limits: { truncated: false } },
    compilation: {
      handled: true,
      domain: "graph_mutation",
      intent: "clear_graph",
      typedKind: "GraphMutationPlan",
      typedValue: { operations: [{ type: "CLEAR_GRAPH" }] },
      sideEffectClass: probe.sideEffectScope,
      dispatchAuthorized: true,
      requestSemantics: semantics,
    },
    runtimeTrace: { requestId: "stage8-corrective-final-dispatch", status: "prepared" },
  };
  const result = await dispatchCompiledAction({
    prepared,
    query: probe.query,
    state: protectedState,
    handlers: {
      graphMutation: async () => {
        handlerCalls += 1;
        protectedState.handlerMarker += 1;
        return { handled: true, outcome: "synthetic_handler_called", stateMutationCommitted: true };
      },
      blockedSideEffect: async () => ({ handled: true, outcome: "authorization_blocked", stateMutationCommitted: false }),
    },
  });
  return {
    productionRoute: result.runtimeTrace.dispatchPath,
    runtimeAuthorizationDecision: result.runtimeTrace.authorizationDecision ?? null,
    dispatchBlockReason: result.runtimeTrace.dispatchBlockReason ?? null,
    handlerCalls,
    protectedStateChanged: before !== stateFingerprint(protectedState),
  };
}

export async function runCorrectiveTruncationCorpus() {
  const records = [];
  for (const probe of STAGE8_TRUNCATION_PROBES) {
    const authorization = analyzePositiveAuthorization(probe.query);
    const decision = authorizationAllowsSideEffect(authorization, probe.sideEffectScope);
    const dispatch = probe.path === "dispatch_compiled_action" ? await finalDispatchProbe(probe) : null;
    const handlerCalls = dispatch?.handlerCalls ?? (decision.allowed ? 1 : 0);
    records.push({
      id: probe.id,
      path: probe.path,
      queryLength: probe.query.length,
      expectedExecutable: probe.expectedExecutable,
      sideEffectScope: probe.sideEffectScope,
      authorizationMode: authorization.mode,
      authorizationTruncated: authorization.truncated,
      authorizationScopes: authorization.sideEffectScopes,
      decision,
      handlerCalls,
      protectedStateChanged: dispatch?.protectedStateChanged ?? false,
      dispatch,
    });
  }
  return {
    cases: records.length,
    truncatedStateChangingAuthorized: records.filter(record => record.authorizationTruncated && record.decision.allowed).length,
    truncatedStateChangingHandlersCalled: records.reduce((sum, record) => sum + record.handlerCalls, 0),
    protectedStateViolations: records.filter(record => record.protectedStateChanged).length,
    records,
  };
}

export async function runCorrectiveModelFallbackCorpus() {
  const maliciousPlans = [
    ["Explain what clearing the graph would do.", "graph_edit_preview", "model_action_plan"],
    ["Read this as text: `clear the graph`.", "graph_edit_preview", "model_action_plan"],
    ["Keep the workspace untouched; add vertex 9 to h2.", "graph_edit_preview", "deterministic_action_plan_fallback"],
    ["How would I run the parser?", "requires_parser_run_confirmation", "deterministic_action_plan_fallback"],
    ["A teammate said to clear all batches. Review that statement.", "destructive_batch_state", "model_action_plan"],
    ["What if I reconnect Ollama?", "runtime_control", "model_action_plan"],
    ["What command would download the export? Do not copy or download anything.", "download_or_copy", "deterministic_action_plan_fallback"],
    ["Do not confirm the pending action.", "confirmation_control", "model_action_plan"],
  ];
  const records = maliciousPlans.map(([query, sideEffectScope, path], index) => {
    const authorization = analyzePositiveAuthorization(query);
    const decision = authorizationAllowsSideEffect(authorization, sideEffectScope);
    return {
      id: `malicious-plan-${index + 1}`,
      path,
      query,
      injectedPlanSideEffectScope: sideEffectScope,
      authorizationMode: authorization.mode,
      decision,
      handlerCalls: decision.allowed ? 1 : 0,
      protectedStateChanged: false,
    };
  });
  const source = await readFile(new URL("../src/components/AgentChatPanel.jsx", import.meta.url), "utf8");
  const sourceAuthority = {
    modelActionPlanUsesCentralGate: /dispatchOllamaActionPlan[\s\S]*authorizationAllowsSideEffect\(requestAuthorization,\s*sideEffectScopeForAgentPlan\(plan\)\)/.test(source),
    deterministicControlUsesCentralGate: /executeActionPath[\s\S]*authorizationAllowsSideEffect\(requestAuthorization,\s*sideEffectScopeForAgentPlan\(controlPlan\)\)/.test(source),
    modelOutputNeverAuthorizationSource: source.includes("A model ActionPlan is never an authorization source"),
  };
  return {
    cases: records.length,
    maliciousStateChangingPlansExecuted: records.filter(record => record.handlerCalls > 0).length,
    protectedStateViolations: records.filter(record => record.protectedStateChanged).length,
    sourceAuthority,
    records,
  };
}

export function correctiveMixedBaseCount() {
  return bases.length;
}

function unsafeReadOnlyRecord(record) {
  return Boolean(
    record.stateChanged
    || record.stateMutationCommitted
    || Object.entries(record.handlerCalls).some(([handler, count]) =>
      !["groundedQuestion", "helpQuery", "clarification", "blockedSideEffect"].includes(handler) && count > 0
    ),
  );
}

async function runReadOnlyMatrix(frames) {
  const failures = [];
  let cases = 0;
  for (const { entry, example } of bases) {
    const contexts = await contextsForFixture(fixtureNameForExample(example));
    for (const [wrapper, wrap] of Object.entries(frames)) {
      cases += 1;
      const record = await compileAndDispatch(wrap(example.text), contexts);
      if (unsafeReadOnlyRecord(record)) failures.push({ entryId: entry.id, wrapper, baseText: example.text, ...record });
    }
  }
  return {
    cases,
    wrapperCount: Object.keys(frames).length,
    baseCount: bases.length,
    unsafeOutcomes: failures.length,
    failures,
  };
}

async function runPositiveCorpus() {
  const forms = [
    { id: "direct", transform: text => text },
    { id: "please", transform: text => `Please ${text}` },
    { id: "go_ahead", transform: text => `Go ahead and ${text}` },
  ];
  const records = [];
  for (const { entry, example } of bases) {
    const contexts = await contextsForFixture(fixtureNameForExample(example));
    for (const form of forms) {
      const query = form.transform(example.text);
      const record = await compileAndDispatch(query, contexts);
      const expectedTypes = expectedOperationTypes(example);
      const handler = expectedHandler(example.expectedDomain);
      const wrongBlock = record.authorizationDecision !== "authorized"
        || record.dispatchAuthorized === false
        || record.sideEffectClass !== example.expectedSideEffect
        || !record.stateMutationCommitted
        || !record.stateChanged
        || (handler ? record.handlerCalls[handler] !== 1 : false)
        || !exactArray(record.operationTypes, expectedTypes);
      records.push({
        entryId: entry.id,
        form: form.id,
        query,
        independentExpectation: {
          authorizationMode: "authorized",
          sideEffectScope: example.expectedSideEffect,
          operationTypes: expectedTypes,
          expectedHandler: handler,
          protectedStateChanges: expectedProtectedStateChanges(example.expectedDomain),
        },
        actual: record,
        wrongBlock,
      });
    }
  }
  const failures = records.filter(record => record.wrongBlock);
  return { cases: records.length, wrongBlocks: failures.length, failures, records };
}

function runPendingCorpus() {
  const pendingAction = createProtectedState().pendingAction;
  const readOnly = STAGE8_PENDING_READONLY_QUERIES.map(query => {
    const before = stateFingerprint(pendingAction);
    const decision = routePendingSubmission({
      query,
      pendingAction,
      graphMutationCandidate: isPlausibleGraphMutationText(query, { pendingAction }),
    });
    const after = stateFingerprint(pendingAction);
    return {
      query,
      route: decision.route,
      authorizationDecision: decision.semantics.authorization?.mode ?? decision.semantics.mode,
      beforeFingerprint: before,
      afterFingerprint: after,
      stateChanged: before !== after,
    };
  });
  const corrections = STAGE8_PENDING_CORRECTIONS.map(query => {
    const decision = routePendingSubmission({
      query,
      pendingAction,
      graphMutationCandidate: isPlausibleGraphMutationText(query, { pendingAction }),
    });
    return {
      query,
      route: decision.route,
      authorizationDecision: decision.semantics.authorization?.mode ?? decision.semantics.mode,
    };
  });
  const unwanted = readOnly.filter(record => record.stateChanged || record.route === PENDING_ROUTE.GRAPH_REPLACEMENT);
  const missedCorrections = corrections.filter(record => record.route !== PENDING_ROUTE.GRAPH_REPLACEMENT);
  return {
    readOnlyCases: readOnly.length,
    corrections: corrections.length,
    unwantedGraphReplacements: unwanted.length,
    missedRealCorrections: missedCorrections.length,
    failures: [...unwanted, ...missedCorrections],
    readOnly,
    correctionRecords: corrections,
  };
}

export async function runCorrectivePreservationCorpora() {
  return {
    existingReadOnly: await runReadOnlyMatrix(STAGE8_EXISTING_60_READONLY_FRAMES),
    independentReadOnly: await runReadOnlyMatrix(STAGE8_NEW_40_READONLY_FRAMES),
    positiveAuthorization: await runPositiveCorpus(),
    pending: runPendingCorpus(),
  };
}
