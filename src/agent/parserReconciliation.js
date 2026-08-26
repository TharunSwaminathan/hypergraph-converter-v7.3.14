export function buildParserReconciliationReport({
  batchId = null,
  groupId = null,
  mappingRevision = 0,
  planFingerprint = null,
  parserResult = null,
  expectedOutputComparison = null,
  warnings = [],
  errors = [],
} = {}) {
  const diagnostics = parserResult?.diagnostics ?? {};
  const hyperedges = parserResult?.canonicalHyperedges ?? parserResult?.hyperedges ?? [];
  const vertices = new Set();
  let incidences = 0;
  for (const edge of hyperedges) {
    for (const vertex of edge.vertices ?? []) {
      vertices.add(String(vertex));
      incidences += 1;
    }
  }
  const fatalErrors = [...errors];
  if (!Array.isArray(hyperedges)) fatalErrors.push("Parser did not return canonical hyperedges.");
  if (expectedOutputComparison?.status === "failed") fatalErrors.push("Expected-output comparison failed.");
  return {
    status: fatalErrors.length ? "failed" : warnings.length || (diagnostics.warnings ?? []).length ? "warnings" : "clean",
    groupId,
    batchId,
    mappingRevision,
    planFingerprint,
    sourceRows: diagnostics.sourceRows ?? {},
    acceptedRows: diagnostics.acceptedRows ?? {},
    skippedRows: diagnostics.filteredRows ?? {},
    unmatchedReferences: [
      ...(diagnostics.unmatchedHyperedgeReferences?.examples ?? []).map(value => ({ type: "hyperedge", value })),
      ...(diagnostics.unmatchedVertexReferences?.examples ?? []).map(value => ({ type: "vertex", value })),
    ].slice(0, 20),
    duplicateMembershipsRemoved: diagnostics.duplicateMembershipsRemoved ?? 0,
    emptyHyperedges: diagnostics.emptyHyperedgesPreserved ?? hyperedges.filter(edge => (edge.vertices ?? []).length === 0).length,
    emitted: {
      hyperedges: diagnostics.emittedHyperedges ?? hyperedges.length,
      vertices: diagnostics.emittedVertices ?? vertices.size,
      incidences: diagnostics.emittedIncidences ?? incidences,
    },
    expectedOutputComparison,
    warnings: [...warnings, ...(diagnostics.warnings ?? [])].slice(0, 40),
    errors: fatalErrors,
  };
}

export function parserReconciliationAllowsApply(report, { allowEmptyGraph = false } = {}) {
  if (!report || report.status === "failed") return false;
  if (!allowEmptyGraph && (report.emitted?.hyperedges ?? 0) === 0) return false;
  return true;
}
