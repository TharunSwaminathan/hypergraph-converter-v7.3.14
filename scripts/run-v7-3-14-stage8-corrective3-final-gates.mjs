import { writeFile } from "node:fs/promises";
import {
  CORRECTIVE3_PARENT,
  runIdentityCorruptionMatrix,
  runLegacyAuthorityMatrix,
} from "./stage8Corrective3Harness.mjs";

const identity = await runIdentityCorruptionMatrix();
const legacy = await runLegacyAuthorityMatrix();

const common = {
  stage: 8,
  corrective: 3,
  parentCommit: CORRECTIVE3_PARENT,
  packageVersion: "7.3.13",
  noStage9Work: true,
};

await writeFile(
  "artifacts/v7.3.14-stage8-corrective3-plan-identity.json",
  `${JSON.stringify({ ...common, kind: "canonical_plan_identity_corruption_matrix", ...identity }, null, 2)}\n`,
);
await writeFile(
  "artifacts/v7.3.14-stage8-corrective3-legacy-authority.json",
  `${JSON.stringify({ ...common, kind: "authoritative_legacy_side_effect_matrix", ...legacy }, null, 2)}\n`,
);

console.log(JSON.stringify({
  identity: {
    cases: identity.identityCases,
    handlerCalls: identity.identityMismatchHandlerCalls,
    wrongReasons: identity.identityMismatchWrongReasons,
    readOnlyKindPairings: identity.readOnlyKindPairings,
    unexpectedPayloadCases: identity.unexpectedPayloadCases,
    unexpectedPayloadHandlerCalls: identity.unexpectedPayloadHandlerCalls,
    protectedStateViolations: identity.protectedStateViolations,
    modelBlockReason: identity.modelAdversarial.dispatchBlockReason,
  },
  legacy: {
    publicActions: legacy.publicActionCount,
    cases: legacy.cases,
    expectedExecutions: legacy.expectedExecutions,
    actualExecutions: legacy.actualExecutions,
    failures: legacy.expectedExecutionFailures,
    metadataBypassCalls: legacy.legacyMetadataBypassCalls,
    corruptMetadataHandlerCalls: legacy.corruptMetadataHandlerCalls,
    kindOnlySelfDeclaredPrivilegeCalls: legacy.kindOnlySelfDeclaredPrivilegeCalls,
    compiledActionSelfDeclaredPrivilegeCalls: legacy.compiledActionSelfDeclaredPrivilegeCalls,
    unregisteredHandlerCalls: legacy.unregisteredHandlerCalls,
    protectedStateViolations: legacy.protectedStateViolations,
  },
}, null, 2));

if (
  identity.identityMismatchHandlerCalls
  || identity.identityMismatchWrongReasons
  || identity.unexpectedPayloadHandlerCalls
  || identity.unexpectedPayloadWrongReasons
  || identity.protectedStateViolations
  || identity.modelAdversarial.protectedHandlerCalls
  || identity.modelAdversarial.dispatchBlockReason !== "plan_identity_mismatch"
  || legacy.expectedExecutionFailures
  || legacy.legacyMetadataBypassCalls
  || legacy.corruptMetadataHandlerCalls
  || legacy.kindOnlySelfDeclaredPrivilegeCalls
  || legacy.compiledActionSelfDeclaredPrivilegeCalls
  || legacy.unregisteredHandlerCalls
  || legacy.protectedStateViolations
) process.exitCode = 1;
