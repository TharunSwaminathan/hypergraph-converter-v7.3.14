import { ensureDatasetMappingSpecV2 } from "./datasetMappingMigration.js";

export function interpretCustomParserConversation(text = "", mappingSpec = null, batch = null) {
  const raw = String(text ?? "").trim();
  if (!raw || !mappingSpec) return { ok: false, noMatch: true };
  const q = raw.toLowerCase();
  if (/\b(add|remove|delete|rename|undo|clear|set|change)\b/.test(q)
    && /\b(graph|hyperedge|edge|vertex|vertices)\b/.test(q)
    && !/\b(mapping|parser|column|file|role)\b/.test(q)) {
    return { ok: false, noMatch: true };
  }
  if (!/\b(mapping|parser|file|column|author|paper|vertex|vertices|hyperedge|hyperedges|expected output|ignore|metadata|time|weight|key|join|group|node)\b/.test(q)) {
    return { ok: false, noMatch: true };
  }

  if (mappingSpec.version === 2) {
    return {
      ok: false,
      noMatch: true,
      diagnostics: {
        authoritativeCompiler: "dataset_mapping_v1",
        legacyParserCalled: false,
      },
      message: "DatasetMappingSpec v2 conversational edits are handled by the deterministic NLU typed patch path.",
    };
  }

  const migrated = ensureDatasetMappingSpecV2(mappingSpec, {
    batchId: batch?.id ?? "",
    batchVersion: batch?.version ?? 1,
    groupingRevision: batch?.groupingRevision ?? 0,
    mappingRevision: batch?.mappingRevision ?? 0,
  });

  if (!migrated.ok) {
    return {
      ok: false,
      needsClarification: true,
      message: `I cannot safely migrate this legacy mapping before applying chat edits. ${migrated.errors?.join(" ") ?? ""}`.trim(),
      diagnostics: {
        authoritativeCompiler: "dataset_mapping_v1",
        legacyParserCalled: false,
        migrationStatus: "failed",
      },
    };
  }

  return {
    ok: false,
    needsClarification: true,
    migratedSpec: migrated.spec,
    notes: migrated.notes,
    message: "This legacy DatasetMappingSpec v1 mapping was migrated in memory. Apply conversational edits through the DatasetMappingSpec v2 typed patch workflow so validation, revision history, and no-op handling stay authoritative.",
    diagnostics: {
      authoritativeCompiler: "dataset_mapping_v1",
      legacyParserCalled: false,
      migrationStatus: "migrated_requires_typed_patch",
    },
  };
}
