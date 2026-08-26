import { buildDatasetMappingSpecV2FromBatch } from "./deterministicMappingV2.js";
import { ensureDatasetMappingSpecV2 } from "./datasetMappingMigration.js";
import { validateDatasetMappingSpecV2 } from "./datasetMappingSpecV2Validator.js";

export function ensureDatasetMappingV2ForBatch({
  batch,
  reason = "dataset mapping chat",
  allowDeterministicGeneration = true,
} = {}) {
  if (!batch) return { ok: false, error: "Upload and activate a file batch first." };
  if (batch.mappingSpec) {
    const migrated = ensureDatasetMappingSpecV2(batch.mappingSpec, {
      batchId: batch.id,
      batchVersion: batch.version ?? 1,
      groupingRevision: batch.groupingRevision ?? 0,
    });
    if (!migrated.ok) return { ok: false, error: migrated.errors?.join(" ") || "The active mapping could not be migrated to DatasetMappingSpec v2.", source: "existing_invalid" };
    const validation = validateDatasetMappingSpecV2(migrated.spec, {
      batchId: batch.id,
      batchVersion: batch.version ?? 1,
      groupingRevision: batch.groupingRevision ?? 0,
      fileProfiles: batch.datasetProfile?.files ?? [],
      allowMigration: false,
    });
    if (!validation.ok) return { ok: false, spec: migrated.spec, validation, source: "existing_invalid", error: validation.errors.join(" ") };
    return {
      ok: true,
      spec: validation.spec,
      validation,
      source: batch.mappingSpec.version === 2 ? "existing_v2" : "migrated_v1",
      generated: false,
      notes: migrated.notes ?? [],
    };
  }
  if (!allowDeterministicGeneration) {
    return { ok: false, error: "Generate a DatasetMappingSpec first.", source: "missing" };
  }
  if (!batch.datasetProfile?.files?.length) {
    return {
      ok: false,
      source: "profile_missing",
      error: "The active batch has no dataset profile yet. Re-run upload analysis for this batch, then map the files.",
    };
  }
  const draft = buildDatasetMappingSpecV2FromBatch(batch, { mappingRevision: 0 });
  const validation = validateDatasetMappingSpecV2(draft, {
    batchId: batch.id,
    batchVersion: batch.version ?? 1,
    groupingRevision: batch.groupingRevision ?? 0,
    fileProfiles: batch.datasetProfile.files ?? [],
    allowMigration: false,
  });
  if (!validation.ok) {
    const fileList = (batch.datasetProfile.files ?? [])
      .map(file => `${file.fileName} (${(file.columns ?? []).map(column => column.name).join(", ") || "no headers"})`)
      .join("; ");
    return {
      ok: false,
      spec: draft,
      validation,
      source: "deterministic_bootstrap_failed",
      error: `I could not bootstrap a valid DatasetMappingSpec v2 from the active profile. Active files: ${fileList}. ${validation.errors.join(" ")}`,
    };
  }
  return {
    ok: true,
    spec: validation.spec,
    validation,
    source: "deterministic_bootstrap",
    generated: true,
    reason,
  };
}
