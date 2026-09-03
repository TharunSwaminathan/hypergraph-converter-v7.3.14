import { writeFile } from "node:fs/promises";
import {
  runCorrectiveMixedCorpus,
  runCorrectiveModelFallbackCorpus,
  runCorrectivePreservationCorpora,
  runCorrectiveTruncationCorpus,
} from "./stage8CorrectiveHarness.mjs";
import { runFinalGateMatrix } from "./stage8Corrective2Harness.mjs";
import { CORRECTIVE3_PARENT } from "./stage8Corrective3Harness.mjs";

const mixed = await runCorrectiveMixedCorpus();
const truncation = await runCorrectiveTruncationCorpus();
const modelFallback = await runCorrectiveModelFallbackCorpus();
const preservation = await runCorrectivePreservationCorpora();
const corrective2 = await runFinalGateMatrix();

const counts = {
  mixed: mixed.cases,
  mixedUnauthorizedSideEffects: mixed.unauthorizedSideEffects,
  mixedMissedAuthorizedClauses: mixed.missedAuthorizedClauses,
  mixedWrongSideEffectScopes: mixed.wrongSideEffectScopes,
  mixedStateFingerprintViolations: mixed.stateFingerprintViolations,
  truncation: truncation.cases,
  truncationBlocked: truncation.cases - truncation.truncatedStateChangingAuthorized,
  truncationHandlers: truncation.truncatedStateChangingHandlersCalled,
  truncationProtectedStateViolations: truncation.protectedStateViolations,
  existingReadOnly: preservation.existingReadOnly.cases,
  existingReadOnlySafe: preservation.existingReadOnly.cases - preservation.existingReadOnly.unsafeOutcomes,
  independentReadOnly: preservation.independentReadOnly.cases,
  independentReadOnlySafe: preservation.independentReadOnly.cases - preservation.independentReadOnly.unsafeOutcomes,
  positiveAuthorization: preservation.positiveAuthorization.cases,
  positiveWrongBlocks: preservation.positiveAuthorization.wrongBlocks,
  pendingReadOnly: preservation.pending.readOnlyCases,
  pendingReadOnlyPreserved: preservation.pending.readOnlyCases - preservation.pending.unwantedGraphReplacements,
  pendingCorrections: preservation.pending.corrections,
  pendingCorrectionsSucceeded: preservation.pending.corrections - preservation.pending.missedRealCorrections,
  modelFallback: modelFallback.cases,
  modelFallbackExecuted: modelFallback.maliciousStateChangingPlansExecuted,
  corrective2Cases: corrective2.cases,
  corrective2ExpectedExecutions: corrective2.expectedExecutions,
  corrective2ActualExecutions: corrective2.actualExecutions,
  corrective2Violations: corrective2.violations,
};

const gates = {
  mixedExactCount: counts.mixed === 1_135,
  mixedCountersZero: [
    counts.mixedUnauthorizedSideEffects,
    counts.mixedMissedAuthorizedClauses,
    counts.mixedWrongSideEffectScopes,
    counts.mixedStateFingerprintViolations,
  ].every(value => value === 0),
  truncationExactAndBlocked: counts.truncation === 8 && counts.truncationBlocked === 8,
  truncationNoHandlersOrStateViolations: counts.truncationHandlers === 0 && counts.truncationProtectedStateViolations === 0,
  existingReadOnlyExactAndSafe: counts.existingReadOnly === 9_840 && counts.existingReadOnlySafe === 9_840,
  independentReadOnlyExactAndSafe: counts.independentReadOnly === 6_560 && counts.independentReadOnlySafe === 6_560,
  positiveExactAndUnblocked: counts.positiveAuthorization === 492 && counts.positiveWrongBlocks === 0,
  pendingExactAndPreserved: counts.pendingReadOnly === 30 && counts.pendingReadOnlyPreserved === 30,
  pendingCorrectionsExactAndSucceeded: counts.pendingCorrections === 3 && counts.pendingCorrectionsSucceeded === 3,
  modelFallbackExactAndInert: counts.modelFallback === 8 && counts.modelFallbackExecuted === 0,
  corrective2MatrixUnchanged: counts.corrective2Cases === 125
    && counts.corrective2ExpectedExecutions === 5
    && counts.corrective2ActualExecutions === 5
    && counts.corrective2Violations === 0,
};

const artifact = {
  stage: 8,
  corrective: 3,
  kind: "s8_n01_through_s8_n04_and_corrective2_preservation",
  parentCommit: CORRECTIVE3_PARENT,
  packageVersion: "7.3.13",
  noStage9Work: true,
  gates,
  counts,
};

await writeFile(
  "artifacts/v7.3.14-stage8-corrective3-preservation.json",
  `${JSON.stringify(artifact, null, 2)}\n`,
);

console.log(JSON.stringify(artifact, null, 2));
if (Object.values(gates).some(value => value !== true)) process.exitCode = 1;
