import { validateDatasetMappingSpec } from "./mappingSpecValidator.js";
import { validateDatasetMappingSpecV2 } from "./datasetMappingSpecV2Validator.js";

function unique(values) {
  return [...new Set((values ?? []).filter(Boolean))];
}

export function validateMappingWithSeverity(candidate, context = {}) {
  const parsedCandidate = typeof candidate === "string"
    ? (() => {
      try { return JSON.parse(candidate); } catch { return candidate; }
    })()
    : candidate;
  const validation = parsedCandidate?.version === 2
    ? validateDatasetMappingSpecV2(parsedCandidate, {
      batchId: context.batch?.id,
      batchVersion: context.batch?.version,
      groupingRevision: context.batch?.groupingRevision ?? 0,
      fileProfiles: context.batch?.datasetProfile?.files ?? [],
    })
    : validateDatasetMappingSpec(candidate, context);
  const spec = validation.spec;
  const fatalErrors = unique(validation.errors);
  const repairableErrors = unique(validation.repairableErrors);
  const warnings = unique([
    ...(validation.validationWarnings ?? []),
    ...(validation.warnings ?? []),
    ...(spec?.warnings ?? []),
    ...(context.autoRepairWarnings ?? []),
    ...(typeof spec?.confidence === "number" && spec.confidence < 0.6
      ? [`Mapping confidence is low (${Math.round(spec.confidence * 100)}%).`]
      : []),
    ...(spec?.output?.weight?.type === "mapping"
      ? [`Weight mapping is inferred from ${spec.output.weight.sourceFile}.${spec.output.weight.column}.`]
      : []),
    ...(spec?.files?.some(file => file.role === "validation_expected_output") && !context.expectedOutputComparison
      ? ["Expected-output comparison has not been run yet."]
      : []),
  ]);
  const informationalNotes = unique([
    ...(validation.informationalNotes ?? []),
    ...(spec?.files ?? [])
      .filter(file => file.role === "validation_expected_output" && file.useAsInput === false)
      .map(file => `${file.fileName} is validation output and is excluded from parser input.`),
  ]);
  const repairNotes = unique(context.repairNotes);
  const canGenerateParser = fatalErrors.length === 0 && repairableErrors.length === 0;
  const status = fatalErrors.length
    ? "invalid"
    : repairableErrors.length
      ? "needs_repair"
      : repairNotes.length
        ? (warnings.length ? "repaired_with_warnings" : "repaired")
        : warnings.length ? "valid_with_warnings" : "valid";
  return {
    ...validation,
    ok: canGenerateParser,
    canGenerateParser,
    fatalErrors,
    repairableErrors,
    warnings,
    informationalNotes,
    repairNotes,
    status,
    message: fatalErrors.length
      ? `Mapping spec was rejected:\n- ${fatalErrors.join("\n- ")}`
      : repairableErrors.length
        ? `Mapping spec needs repair:\n- ${repairableErrors.join("\n- ")}`
        : "",
  };
}
