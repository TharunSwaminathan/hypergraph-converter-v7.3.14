import { writeFile } from "node:fs/promises";
import { analyzeDeterministicNlu } from "../src/agent/deterministicNlu/deterministicNlu.js";
import { compileDeterministicAction } from "../src/agent/deterministicNlu/compileDeterministicAction.js";
import { dispatchCompiledAction } from "../src/agent/deterministicNlu/dispatchCompiledAction.js";
import {
  analyzePositiveAuthorization,
  authorizationAllowsSideEffect,
} from "../src/agent/deterministicNlu/positiveAuthorization.js";
import { analyzeRequestSemantics } from "../src/agent/deterministicNlu/requestSemantics.js";
import {
  buildCompilerContexts,
  extractOperations,
  extractOperationTypes,
} from "../tests/helpers/evaluateDeterministicNluCorpus.mjs";
import {
  STAGE8_APPROVED_STAGE7_ANCESTOR,
  STAGE8_CORRECTIVE_BASELINE_SHA,
  STAGE8_MIXED_REPRESENTATIVE_CASES,
  STAGE8_TRUNCATION_PROBES,
} from "../tests/fixtures/v7.3.14/stage8CorrectiveCorpus.mjs";

function authorizationProbe(probe) {
  const authorization = analyzePositiveAuthorization(probe.query);
  const decision = authorizationAllowsSideEffect(authorization, probe.sideEffectScope);
  return {
    id: probe.id,
    path: probe.path,
    queryLength: probe.query.length,
    expectedExecutable: probe.expectedExecutable,
    authorizationMode: authorization.mode,
    authorizationTruncated: authorization.truncated,
    authorizationScopes: authorization.sideEffectScopes,
    decision,
    handlerReachedIfPlanAccepted: decision.allowed,
  };
}

async function legacyPreparedDispatchProbe(probe) {
  const semantics = analyzeRequestSemantics(probe.query);
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
    runtimeTrace: { requestId: "stage8-corrective-prechange-dispatch", status: "prepared" },
  };
  const result = await dispatchCompiledAction({
    prepared,
    query: probe.query,
    state: {},
    handlers: {
      graphMutation: async () => {
        handlerCalls += 1;
        return { handled: true, outcome: "synthetic_handler_called", stateMutationCommitted: true };
      },
      blockedSideEffect: async () => ({ handled: true, outcome: "authorization_blocked", stateMutationCommitted: false }),
    },
  });
  return {
    id: probe.id,
    path: probe.path,
    queryLength: probe.query.length,
    authorizationMode: semantics.authorization.mode,
    authorizationTruncated: semantics.authorization.truncated,
    authorizationScopes: semantics.authorization.sideEffectScopes,
    productionRoute: result.runtimeTrace.dispatchPath,
    runtimeAuthorizationDecision: result.runtimeTrace.authorizationDecision ?? null,
    handlerCalls,
    stateMutationCommitted: Boolean(result.runtimeTrace.stateMutationCommitted),
  };
}

async function characterizeMixedCase(fixture) {
  const contexts = await buildCompilerContexts(fixture.contextFixture);
  const nlu = analyzeDeterministicNlu(fixture.query, contexts.analysisContext);
  const compilation = compileDeterministicAction(nlu, contexts.compileContext);
  const operations = extractOperations(compilation);
  const operationTypes = extractOperationTypes(compilation);
  const actualSideEffectScope = compilation.sideEffectClass ?? "read_only";
  const authorization = compilation.requestSemantics?.authorization ?? analyzePositiveAuthorization(fixture.query);
  const expectedOperationTypes = fixture.expectedOperationTypes ?? [];
  const missingOperation = expectedOperationTypes.some(type => !operationTypes.includes(type));
  const dispatchRepresented = actualSideEffectScope === fixture.expectedSideEffectScope
    && (!expectedOperationTypes.length || !missingOperation)
    && compilation.dispatchAuthorized !== false;
  const clarificationRepresented = fixture.clarificationRequired === true
    && Boolean(compilation.compiled?.needsClarification
      || compilation.compiled?.classification === "clarification"
      || compilation.typedValue?.needsResolution
      || compilation.typedValue?.classification === "clarification");
  const missedAuthorizedClause = fixture.dispatchRequired
    ? !dispatchRepresented
    : (fixture.clarificationRequired === true && !clarificationRepresented);
  return {
    id: fixture.id,
    query: fixture.query,
    independentExpectation: {
      authorizationMode: fixture.expectedAuthorizationMode,
      executableClause: fixture.expectedExecutableClause,
      sideEffectScope: fixture.expectedSideEffectScope,
      dispatchRequired: fixture.dispatchRequired,
      noOpPermitted: fixture.noOpPermitted,
      noOpReason: fixture.noOpReason,
      operationTypes: expectedOperationTypes,
    },
    actual: {
      authorizationMode: authorization.mode,
      authorizedClauses: authorization.authorizedClauses?.map(clause => clause.text) ?? [],
      sideEffectScope: actualSideEffectScope,
      dispatchAuthorized: compilation.dispatchAuthorized !== false,
      handled: Boolean(compilation.handled),
      typedKind: compilation.typedKind ?? null,
      operationTypes,
      operations,
      explicitClarification: clarificationRepresented,
    },
    missedAuthorizedClause,
  };
}

const contractRecords = STAGE8_TRUNCATION_PROBES.map(authorizationProbe);
const dispatchProbeFixture = STAGE8_TRUNCATION_PROBES.find(probe => probe.path === "dispatch_compiled_action");
const dispatchRecord = await legacyPreparedDispatchProbe(dispatchProbeFixture);
const mixedRepresentativePrechange = [];
for (const fixture of STAGE8_MIXED_REPRESENTATIVE_CASES) {
  mixedRepresentativePrechange.push(await characterizeMixedCase(fixture));
}

const vulnerableContracts = contractRecords.filter(record => record.authorizationTruncated && record.decision.allowed);
const missedMixedClauses = mixedRepresentativePrechange.filter(record => record.missedAuthorizedClause);
const output = {
  stage: 8,
  corrective: true,
  kind: "prechange_characterization",
  baselineCommit: STAGE8_CORRECTIVE_BASELINE_SHA,
  approvedStage7Ancestor: STAGE8_APPROVED_STAGE7_ANCESTOR,
  packageVersion: "7.3.13",
  noStage9Work: true,
  finding: {
    id: "S8-N02",
    severity: "High",
    category: "authorization-boundary safety",
    status: vulnerableContracts.length > 0 && dispatchRecord.handlerCalls > 0 ? "confirmed" : "not_reproduced",
  },
  truncation: {
    probeCount: contractRecords.length,
    vulnerableContractCount: vulnerableContracts.length,
    stateChangingHandlersCalled: dispatchRecord.handlerCalls,
    records: contractRecords,
    dispatchRecord,
  },
  mixedRepresentativePrechange: {
    cases: mixedRepresentativePrechange.length,
    missedAuthorizedClauses: missedMixedClauses.length,
    records: mixedRepresentativePrechange,
  },
};

await writeFile(
  "artifacts/v7.3.14-stage8-corrective-truncation-prechange.json",
  `${JSON.stringify(output, null, 2)}\n`,
);

console.log(JSON.stringify({
  finding: output.finding,
  truncation: {
    probes: contractRecords.length,
    vulnerableContracts: vulnerableContracts.length,
    stateChangingHandlersCalled: dispatchRecord.handlerCalls,
  },
  mixedRepresentative: {
    cases: mixedRepresentativePrechange.length,
    missedAuthorizedClauses: missedMixedClauses.length,
    missedIds: missedMixedClauses.map(record => record.id),
  },
}, null, 2));

if (output.finding.status !== "confirmed" || missedMixedClauses.length === 0) process.exitCode = 1;
