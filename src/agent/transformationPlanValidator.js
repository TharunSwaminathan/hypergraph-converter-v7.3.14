import { TRANSFORMATION_STEP_TYPES } from "./transformationPlan.js";
import { stablePlanFingerprint } from "./transformationPlanFingerprint.js";

export function validateTransformationPlan(plan, {
  mappingFingerprint = null,
  fileNames = [],
} = {}) {
  const errors = [];
  if (!plan || typeof plan !== "object") return { ok: false, errors: ["TransformationPlan must be an object."] };
  if (plan.version !== 1) errors.push("TransformationPlan version must be 1.");
  if (mappingFingerprint && plan.mappingFingerprint !== mappingFingerprint) errors.push("TransformationPlan mapping fingerprint is stale.");
  const knownFiles = new Set(fileNames.length ? fileNames : (plan.expectedInputs ?? []).map(input => input.fileName));
  const emitted = (plan.steps ?? []).filter(step => step.type === "EMIT_CANONICAL").length;
  if (emitted !== 1) errors.push("TransformationPlan must contain exactly one EMIT_CANONICAL step.");
  for (const step of plan.steps ?? []) {
    if (!TRANSFORMATION_STEP_TYPES.includes(step.type)) errors.push(`Unsupported transformation step ${step.type}.`);
    for (const key of Object.keys(step)) if (/code|javascript|function|eval|sql/i.test(key)) errors.push(`Step ${step.id} contains executable-looking property ${key}.`);
    for (const fileKey of ["fileName", "sourceFile", "targetFile"]) {
      if (step[fileKey] && knownFiles.size && !knownFiles.has(step[fileKey])) errors.push(`Step ${step.id} references unavailable file ${step[fileKey]}.`);
    }
  }
  const expectedFingerprint = stablePlanFingerprint({
    ...plan,
    planFingerprint: undefined,
  });
  if (plan.planFingerprint && plan.planFingerprint !== expectedFingerprint) errors.push("TransformationPlan fingerprint does not match its contents.");
  return { ok: errors.length === 0, errors, warnings: [] };
}
