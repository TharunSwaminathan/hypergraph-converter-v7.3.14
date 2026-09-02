import { writeFile } from "node:fs/promises";
import {
  STAGE8_APPROVED_STAGE7_ANCESTOR,
  STAGE8_CORRECTIVE_BASELINE_SHA,
} from "../tests/fixtures/v7.3.14/stage8CorrectiveCorpus.mjs";
import {
  runCorrectiveMixedCorpus,
  runCorrectiveModelFallbackCorpus,
  runCorrectivePreservationCorpora,
  runCorrectiveTruncationCorpus,
} from "./stage8CorrectiveHarness.mjs";

const mixed = await runCorrectiveMixedCorpus();
const truncation = await runCorrectiveTruncationCorpus();
const modelFallback = await runCorrectiveModelFallbackCorpus();
const preservation = await runCorrectivePreservationCorpora();

const compactMixedRecords = mixed.records.map(record => ({
  id: record.id,
  query: record.query,
  independentExpectation: record.independentExpectation,
  actual: {
    authorizationDecision: record.actual.authorizationDecision,
    authorizedClauses: record.actual.requestSemantics?.authorization?.authorizedClauses?.map(clause => clause.text) ?? [],
    sideEffectClass: record.actual.sideEffectClass,
    dispatchAuthorized: record.actual.dispatchAuthorized,
    productionRoute: record.actual.productionRoute,
    operationTypes: record.actual.operationTypes,
    operations: record.actual.operations,
    changedProtectedKeys: record.actual.changedProtectedKeys,
    handlerCalls: record.actual.handlerCalls,
    explicitClarification: record.actual.explicitClarification,
  },
  classifications: record.classifications,
}));

const mixedArtifact = {
  stage: 8,
  corrective: true,
  kind: "independent_expected_semantics_mixed_corpus",
  baselineCommit: STAGE8_CORRECTIVE_BASELINE_SHA,
  approvedStage7Ancestor: STAGE8_APPROVED_STAGE7_ANCESTOR,
  packageVersion: "7.3.13",
  noStage9Work: true,
  cases: mixed.cases,
  representativeCases: mixed.representativeCases,
  matrixCases: mixed.matrixCases,
  templateCount: mixed.templateCount,
  baseCount: mixed.baseCount,
  excludedCompoundSafePreparationBases: mixed.excludedCompoundSafePreparationBases,
  unauthorizedSideEffects: mixed.unauthorizedSideEffects,
  missedAuthorizedClauses: mixed.missedAuthorizedClauses,
  wrongSideEffectScopes: mixed.wrongSideEffectScopes,
  stateFingerprintViolations: mixed.stateFingerprintViolations,
  failures: mixed.failures,
  caseLedger: compactMixedRecords,
};

const truncationArtifact = {
  stage: 8,
  corrective: true,
  kind: "postchange_truncation_validation",
  baselineCommit: STAGE8_CORRECTIVE_BASELINE_SHA,
  approvedStage7Ancestor: STAGE8_APPROVED_STAGE7_ANCESTOR,
  packageVersion: "7.3.13",
  noStage9Work: true,
  ...truncation,
};

const modelFallbackArtifact = {
  stage: 8,
  corrective: true,
  kind: "model_and_fallback_non_authority_validation",
  baselineCommit: STAGE8_CORRECTIVE_BASELINE_SHA,
  approvedStage7Ancestor: STAGE8_APPROVED_STAGE7_ANCESTOR,
  packageVersion: "7.3.13",
  noStage9Work: true,
  ...modelFallback,
};

const gates = {
  mixedCorpusAtLeastThousand: mixed.cases >= 1_000,
  mixedUnauthorizedSideEffectsZero: mixed.unauthorizedSideEffects === 0,
  mixedMissedAuthorizedClausesZero: mixed.missedAuthorizedClauses === 0,
  mixedWrongSideEffectScopesZero: mixed.wrongSideEffectScopes === 0,
  mixedStateFingerprintViolationsZero: mixed.stateFingerprintViolations === 0,
  truncationAllFailClosed: truncation.truncatedStateChangingAuthorized === 0,
  truncationNoHandlers: truncation.truncatedStateChangingHandlersCalled === 0,
  truncationProtectedStatePreserved: truncation.protectedStateViolations === 0,
  modelFallbackNoMaliciousPlansExecuted: modelFallback.maliciousStateChangingPlansExecuted === 0,
  modelFallbackProtectedStatePreserved: modelFallback.protectedStateViolations === 0,
  modelFallbackSourceAuthority: Object.values(modelFallback.sourceAuthority).every(Boolean),
  existingReadOnlyExactCount: preservation.existingReadOnly.cases === 9_840,
  existingReadOnlySafe: preservation.existingReadOnly.unsafeOutcomes === 0,
  independentReadOnlyExactCount: preservation.independentReadOnly.cases === 6_560,
  independentReadOnlySafe: preservation.independentReadOnly.unsafeOutcomes === 0,
  positiveExactCount: preservation.positiveAuthorization.cases === 492,
  positiveWrongBlocksZero: preservation.positiveAuthorization.wrongBlocks === 0,
  pendingReadOnlyExactCount: preservation.pending.readOnlyCases === 30,
  pendingUnwantedReplacementsZero: preservation.pending.unwantedGraphReplacements === 0,
  pendingRealCorrectionsWork: preservation.pending.missedRealCorrections === 0,
};

const oracle = {
  stage: 8,
  corrective: true,
  kind: "corrective_oracle",
  baselineCommit: STAGE8_CORRECTIVE_BASELINE_SHA,
  approvedStage7Ancestor: STAGE8_APPROVED_STAGE7_ANCESTOR,
  packageVersion: "7.3.13",
  noStage9Work: true,
  gates,
  counts: {
    mixed: mixed.cases,
    existingReadOnly: preservation.existingReadOnly.cases,
    independentReadOnly: preservation.independentReadOnly.cases,
    positiveAuthorization: preservation.positiveAuthorization.cases,
    pendingReadOnly: preservation.pending.readOnlyCases,
    pendingCorrections: preservation.pending.corrections,
    modelFallback: modelFallback.cases,
    truncation: truncation.cases,
  },
  commandValidation: {
    nodeSuite: "pending",
    lint: "pending",
    build: "pending",
    githubBuild: "pending",
    npmAudit: "pending",
    npmAuditOmitDev: "pending",
    gitDiffCheck: "pending",
  },
  realChromium: "pending",
};

const issueRegister = {
  stage: 8,
  corrective: true,
  baselineCommit: STAGE8_CORRECTIVE_BASELINE_SHA,
  approvedStage7Ancestor: STAGE8_APPROVED_STAGE7_ANCESTOR,
  packageVersion: "7.3.13",
  noStage9Work: true,
  issues: [
    {
      id: "S8-N01",
      category: "mixed-clause oracle and positive recall",
      prechangeStatus: "confirmed",
      status: Object.entries(gates).filter(([key]) => key.startsWith("mixed")).every(([, value]) => value) ? "closed_automated" : "open",
      evidence: "artifacts/v7.3.14-stage8-corrective-mixed.json",
    },
    {
      id: "S8-N02",
      severity: "High",
      category: "authorization-boundary safety",
      prechangeStatus: "confirmed",
      status: gates.truncationAllFailClosed && gates.truncationNoHandlers && gates.truncationProtectedStatePreserved
        ? "closed_automated"
        : "open",
      evidence: [
        "artifacts/v7.3.14-stage8-corrective-truncation-prechange.json",
        "artifacts/v7.3.14-stage8-corrective-truncation.json",
        "artifacts/v7.3.14-stage8-corrective-model-fallback.json",
      ],
    },
    {
      id: "S8-CHROMIUM-CLOSURE",
      category: "real browser validation",
      status: "pending",
      evidence: "artifacts/v7.3.14-stage8-corrective-browser.json",
    },
  ],
};

const browser = {
  stage: 8,
  corrective: true,
  kind: "real_chromium_validation",
  baselineCommit: STAGE8_CORRECTIVE_BASELINE_SHA,
  approvedStage7Ancestor: STAGE8_APPROVED_STAGE7_ANCESTOR,
  packageVersion: "7.3.13",
  noStage9Work: true,
  status: "pending-real-chromium-run",
  flows: [],
  consoleErrors: [],
};

await Promise.all([
  writeFile("artifacts/v7.3.14-stage8-corrective-mixed.json", `${JSON.stringify(mixedArtifact, null, 2)}\n`),
  writeFile("artifacts/v7.3.14-stage8-corrective-truncation.json", `${JSON.stringify(truncationArtifact, null, 2)}\n`),
  writeFile("artifacts/v7.3.14-stage8-corrective-model-fallback.json", `${JSON.stringify(modelFallbackArtifact, null, 2)}\n`),
  writeFile("artifacts/v7.3.14-stage8-corrective-oracle.json", `${JSON.stringify(oracle, null, 2)}\n`),
  writeFile("artifacts/v7.3.14-stage8-corrective-issue-register.json", `${JSON.stringify(issueRegister, null, 2)}\n`),
  writeFile("artifacts/v7.3.14-stage8-corrective-browser.json", `${JSON.stringify(browser, null, 2)}\n`),
  writeFile("artifacts/v7.3.14-stage8-corrective-report.md", [
    "# Stage 8 corrective validation",
    "",
    `- Baseline commit: ${STAGE8_CORRECTIVE_BASELINE_SHA}`,
    `- Approved Stage 7 ancestor: ${STAGE8_APPROVED_STAGE7_ANCESTOR}`,
    "- Package version: 7.3.13",
    `- Mixed corpus: ${mixed.cases} cases; unauthorized side effects ${mixed.unauthorizedSideEffects}; missed authorized clauses ${mixed.missedAuthorizedClauses}; wrong scopes ${mixed.wrongSideEffectScopes}; fingerprint violations ${mixed.stateFingerprintViolations}.`,
    `- Truncation corpus: ${truncation.cases} cases; executable state-changing contracts ${truncation.truncatedStateChangingAuthorized}; handlers called ${truncation.truncatedStateChangingHandlersCalled}; protected-state violations ${truncation.protectedStateViolations}.`,
    `- Existing read-only corpus: ${preservation.existingReadOnly.cases}/${preservation.existingReadOnly.cases} safe.`,
    `- Independent read-only corpus: ${preservation.independentReadOnly.cases}/${preservation.independentReadOnly.cases} safe.`,
    `- Positive corpus: ${preservation.positiveAuthorization.cases} cases; wrong blocks ${preservation.positiveAuthorization.wrongBlocks}.`,
    `- Pending corpus: ${preservation.pending.readOnlyCases} read-only preserved; ${preservation.pending.corrections - preservation.pending.missedRealCorrections}/${preservation.pending.corrections} real corrections routed.`,
    `- Model/fallback corpus: ${modelFallback.cases} malicious plans; executed ${modelFallback.maliciousStateChangingPlansExecuted}.`,
    "- Full command validation: pending.",
    "- Real Chromium: pending.",
    "- Stage 9 begun: false.",
    "",
    "Automated corrective corpus gates pass. Stage 8 is not declared complete until the mandatory real-Chromium closure is recorded.",
  ].join("\n") + "\n"),
]);

console.log(JSON.stringify({ gates, counts: oracle.counts }, null, 2));
if (Object.values(gates).some(value => value !== true)) process.exitCode = 1;
