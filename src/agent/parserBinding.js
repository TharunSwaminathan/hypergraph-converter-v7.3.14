export function validateParserBatchBinding(binding, activeBatch, batches = []) {
  if (!binding?.batchId) return { ok: true };
  const generatedBatch = batches.find(batch => batch.id === binding.batchId);
  const generatedLabel = generatedBatch?.label ?? binding.batchId;
  if (!activeBatch || activeBatch.id !== binding.batchId) {
    return {
      ok: false,
      error: `This parser was generated for ${generatedLabel}, but ${activeBatch?.label ?? "no batch"} is active. Switch back to ${generatedLabel} or regenerate the parser for the active batch.`,
    };
  }
  if ((activeBatch.version ?? 1) !== binding.batchVersion) {
    return {
      ok: false,
      error: "The active batch changed after this parser was generated. Regenerate the parser before running it.",
    };
  }
  if (binding.parseMode && activeBatch.parseMode !== binding.parseMode) {
    return {
      ok: false,
      error: "The batch parse mode changed after this parser was generated. Regenerate the parser before running it.",
    };
  }
  if (binding.mappingRevision !== undefined && (activeBatch.mappingRevision ?? 0) !== binding.mappingRevision) {
    return {
      ok: false,
      error: "The DatasetMappingSpec changed after this parser was generated. Regenerate the parser from the active mapping before running it.",
    };
  }
  return { ok: true };
}
