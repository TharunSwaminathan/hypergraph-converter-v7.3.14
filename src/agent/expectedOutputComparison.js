function canonicalize(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.canonicalHyperedges)) return value.canonicalHyperedges;
  if (value?.h2v && typeof value.h2v === "object") {
    return Object.entries(value.h2v).map(([id, vertices]) => ({ id, vertices }));
  }
  if (Array.isArray(value?.incidences)) {
    const groups = new Map();
    for (const item of value.incidences) {
      const id = String(item.edge ?? item.hyperedge ?? "");
      const vertex = String(item.node ?? item.vertex ?? "");
      if (!groups.has(id)) groups.set(id, new Set());
      if (vertex) groups.get(id).add(vertex);
    }
    return [...groups].map(([id, vertices]) => ({ id, vertices: [...vertices] }));
  }
  return null;
}

export function parseExpectedOutputText(text, fileName = "") {
  const source = String(text ?? "").trim();
  if (!source) return null;
  try {
    return JSON.parse(source);
  } catch {
    // Continue with compact text/CSV forms.
  }
  const lines = source.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (/\.csv$/i.test(fileName) && lines.length > 1) {
    const headers = lines[0].split(",").map(value => value.trim().toLowerCase());
    const edgeIndex = headers.findIndex(header => /^(?:edge|hyperedge|hyperedge_id|id)$/.test(header));
    const vertexIndex = headers.findIndex(header => /^(?:vertex|node|member|vertex_id)$/.test(header));
    if (edgeIndex >= 0 && vertexIndex >= 0) {
      return {
        incidences: lines.slice(1).map(line => {
          const cells = line.split(",").map(value => value.trim());
          return { edge: cells[edgeIndex], node: cells[vertexIndex] };
        }),
      };
    }
  }
  // Preserve the plain-object API while removing prototype semantics from
  // arbitrary user-supplied hyperedge identifiers.
  const h2v = Object.create(null);
  for (const line of lines) {
    const separator = line.indexOf(":");
    if (separator < 0) return null;
    h2v[line.slice(0, separator).trim()] = line.slice(separator + 1).split(/[\s,]+/).filter(Boolean);
  }
  return { h2v };
}

function stats(hyperedges) {
  const vertices = new Set(hyperedges.flatMap(edge => (edge.vertices ?? []).map(String)));
  return {
    hyperedges: hyperedges.length,
    vertices: vertices.size,
    incidences: hyperedges.reduce((sum, edge) => sum + (edge.vertices?.length ?? 0), 0),
  };
}

export function compareWithExpectedOutput(actualHyperedges, expectedValue) {
  const expected = canonicalize(expectedValue);
  if (!expected) return { ok: false, warnings: ["Expected output format was not recognized."] };
  const actual = canonicalize(actualHyperedges) ?? [];
  const actualById = new Map(actual.map(edge => [String(edge.id), edge]));
  const expectedById = new Map(expected.map(edge => [String(edge.id), edge]));
  let vertexSetsMatched = 0;
  let attributeDifferences = 0;
  let timeValuesCompared = 0;
  let timeValuesMatched = 0;
  let weightValuesCompared = 0;
  let weightValuesMatched = 0;
  for (const [id, expectedEdge] of expectedById) {
    const actualEdge = actualById.get(id);
    if (!actualEdge) continue;
    const left = [...new Set((actualEdge.vertices ?? []).map(String))].sort();
    const right = [...new Set((expectedEdge.vertices ?? []).map(String))].sort();
    if (JSON.stringify(left) === JSON.stringify(right)) vertexSetsMatched += 1;
    const expectedKeys = Object.keys(expectedEdge.attributes ?? {}).sort();
    const actualKeys = Object.keys(actualEdge.attributes ?? {}).sort();
    if (JSON.stringify(expectedKeys) !== JSON.stringify(actualKeys)) attributeDifferences += 1;
    if (expectedEdge.time !== undefined && expectedEdge.time !== null) {
      timeValuesCompared += 1;
      if (String(actualEdge.time ?? "") === String(expectedEdge.time)) timeValuesMatched += 1;
    }
    if (expectedEdge.weight !== undefined && expectedEdge.weight !== null) {
      weightValuesCompared += 1;
      if (Number(actualEdge.weight) === Number(expectedEdge.weight)) weightValuesMatched += 1;
    }
  }
  const actualStats = stats(actual);
  const expectedStats = stats(expected);
  const missingIds = [...expectedById.keys()].filter(id => !actualById.has(id));
  const extraIds = [...actualById.keys()].filter(id => !expectedById.has(id));
  const warnings = [];
  if (attributeDifferences) warnings.push(`Attribute keys differ for ${attributeDifferences} hyperedge(s).`);
  if (missingIds.length) warnings.push(`Missing expected IDs: ${missingIds.slice(0, 20).join(", ")}.`);
  if (extraIds.length) warnings.push(`Unexpected IDs: ${extraIds.slice(0, 20).join(", ")}.`);
  if (timeValuesCompared && timeValuesMatched !== timeValuesCompared) warnings.push(`Time values matched for ${timeValuesMatched}/${timeValuesCompared} comparable hyperedges.`);
  if (weightValuesCompared && weightValuesMatched !== weightValuesCompared) warnings.push(`Weight values matched for ${weightValuesMatched}/${weightValuesCompared} comparable hyperedges.`);
  return {
    ok: true,
    actualStats,
    expectedStats,
    hyperedgeCountMatched: actualStats.hyperedges === expectedStats.hyperedges,
    vertexCountMatched: actualStats.vertices === expectedStats.vertices,
    incidenceCountMatched: actualStats.incidences === expectedStats.incidences,
    allHyperedgeIdsMatched: missingIds.length === 0 && extraIds.length === 0,
    vertexSetsMatched,
    vertexSetsTotal: expected.length,
    timeValuesMatched,
    timeValuesCompared,
    weightValuesMatched,
    weightValuesCompared,
    warnings,
  };
}
