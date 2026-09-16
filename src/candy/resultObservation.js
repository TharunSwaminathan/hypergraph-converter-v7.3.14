const text = (value, limit = 240) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, limit);

export function boundedCandyJobObservation(value) {
  if (!value) return null;
  const summary = value.modelSummary ?? {};
  return Object.freeze({
    jobId: text(value.jobId),
    status: text(value.status ?? value.execution?.status),
    algorithm: text(value.algorithm),
    backend: text(value.backend),
    mode: text(value.mode),
    graphRef: value.graphRef ?? value.inputGraphRef ?? null,
    sourceVertexId: typeof value.sourceVertexId === "number" ? value.sourceVertexId : text(value.sourceVertexId ?? summary.sourceVertexId),
    reachableCount: Number(summary.reachableCount) || 0,
    unreachableCount: Number(summary.unreachableCount) || 0,
    affectedCount: Number(summary.affectedCount) || 0,
    runtimeMs: Number(summary.runtimeMs) || 0,
    validationStatus: text(summary.validationStatus ?? value.validation?.status),
    resultRef: text(value.resultRef ?? value.resultArtifactRef?.id) || null,
    errorClassification: text(value.error?.classification) || null,
    warnings: Array.isArray(value.warnings) ? value.warnings.slice(0, 8).map(item => text(item, 160)) : [],
    lifecycle: Array.isArray(value.lifecycle) ? value.lifecycle.slice(-12).map(item => text(item, 32)) : [],
  });
}
