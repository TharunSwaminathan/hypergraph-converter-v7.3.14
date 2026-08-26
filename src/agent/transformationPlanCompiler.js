import { validateTransformationPlan } from "./transformationPlanValidator.js";

function embedded(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function compileTransformationPlanToParser(plan) {
  const validation = validateTransformationPlan(plan);
  if (!validation.ok) return { ok: false, error: validation.errors.join(" ") };
  const membership = plan.steps.find(step => step.type === "GROUP_MEMBERSHIP");
  const edgeList = plan.steps.find(step => step.type === "BUILD_EDGE_HYPEREDGES");
  if (!membership && !edgeList) return { ok: false, error: "Transformation plan does not contain a supported membership or edge-list build step." };
  const config = {
    planFingerprint: plan.planFingerprint,
    membership,
    edgeList,
    preserveEmpty: plan.steps.find(step => step.type === "PRESERVE_EMPTY_HYPEREDGES") ?? null,
    filters: plan.steps.filter(step => step.type === "FILTER_ROWS"),
  };
  return {
    ok: true,
    kind: membership ? "transformation_plan_membership" : "transformation_plan_edge_list",
    code: `// Deterministically generated from a validated TransformationPlan.
async function parseHypergraph(files, helpers) {
  const config = ${embedded(config)};
  const byName = Object.fromEntries(files.map(file => [file.name, file]));
  const diagnostics = {
    filesRead: {},
    sourceRows: {},
    filteredRows: {},
    membershipsAccepted: 0,
    membershipsSkipped: 0,
    duplicateMembershipsRemoved: 0,
    unmatchedHyperedgeReferences: { count: 0, examples: [] },
    unmatchedVertexReferences: { count: 0, examples: [] },
    emptyHyperedgesPreserved: 0,
    emittedHyperedges: 0,
    emittedVertices: 0,
    emittedIncidences: 0,
    warnings: [],
    planFingerprint: config.planFingerprint
  };
  const rowsFor = fileName => {
    const file = byName[fileName];
    if (!file) throw new Error("Mapped file is missing: " + fileName);
    diagnostics.filesRead[fileName] = true;
    const rows = helpers.parseDelimited ? helpers.parseDelimited(file.text).records : helpers.parseCSV(file.text);
    diagnostics.sourceRows[fileName] = rows.length;
    return rows;
  };
  const keyOf = (row, columns) => (columns || []).map(column => String(row[column] ?? "").trim()).filter(Boolean).join("::");
  const passesFilters = (fileName, row) => {
    for (const filter of config.filters.filter(item => item.fileName === fileName)) {
      const raw = row[filter.column];
      const value = Number.isFinite(Number(raw)) ? Number(raw) : String(raw ?? "");
      if (filter.operator === "gte" && !(value >= Number(filter.value))) return false;
      if (filter.operator === "gt" && !(value > Number(filter.value))) return false;
      if (filter.operator === "lte" && !(value <= Number(filter.value))) return false;
      if (filter.operator === "lt" && !(value < Number(filter.value))) return false;
      if (filter.operator === "eq" && String(raw) !== String(filter.value)) return false;
      if (filter.operator === "neq" && String(raw) === String(filter.value)) return false;
      if (filter.operator === "not_null" && !String(raw ?? "").trim()) return false;
      if (filter.operator === "is_null" && String(raw ?? "").trim()) return false;
    }
    return true;
  };
  const addExample = (bucket, value) => {
    bucket.count += 1;
    if (bucket.examples.length < 10) bucket.examples.push(String(value).slice(0, 120));
  };
  if (config.edgeList) {
    const rows = rowsFor(config.edgeList.fileName).filter(row => passesFilters(config.edgeList.fileName, row));
    diagnostics.filteredRows[config.edgeList.fileName] = diagnostics.sourceRows[config.edgeList.fileName] - rows.length;
    const canonicalHyperedges = rows.map((row, index) => ({
      id: "edge-" + (index + 1),
      vertices: helpers.unique([row[config.edgeList.sourceColumn], row[config.edgeList.targetColumn]]),
      time: null,
      weight: 1,
      attributes: {}
    }));
    diagnostics.membershipsAccepted = canonicalHyperedges.reduce((sum, edge) => sum + edge.vertices.length, 0);
    diagnostics.emittedHyperedges = canonicalHyperedges.length;
    diagnostics.emittedVertices = helpers.unique(canonicalHyperedges.flatMap(edge => edge.vertices)).length;
    diagnostics.emittedIncidences = diagnostics.membershipsAccepted;
    return { canonicalHyperedges, diagnostics };
  }
  const membershipRows = rowsFor(config.membership.sourceFile).filter(row => passesFilters(config.membership.sourceFile, row));
  diagnostics.filteredRows[config.membership.sourceFile] = diagnostics.sourceRows[config.membership.sourceFile] - membershipRows.length;
  const groups = new Map();
  const addMembership = (edge, vertex) => {
    edge = String(edge ?? "").trim();
    vertex = String(vertex ?? "").trim();
    if (!edge || !vertex) {
      diagnostics.membershipsSkipped += 1;
      return;
    }
    if (!groups.has(edge)) groups.set(edge, new Set());
    const before = groups.get(edge).size;
    groups.get(edge).add(vertex);
    if (groups.get(edge).size === before) diagnostics.duplicateMembershipsRemoved += 1;
    else diagnostics.membershipsAccepted += 1;
  };
  for (const row of membershipRows) {
    const edge = keyOf(row, config.membership.hyperedgeColumns);
    const rawVertex = keyOf(row, config.membership.vertexColumns);
    const listColumn = (config.membership.vertexColumns || []).length === 1 ? config.membership.vertexColumns[0] : null;
    const listValue = listColumn ? String(row[listColumn] ?? "") : "";
    if (listValue && /[;|,]/.test(listValue) && !rawVertex.includes("::")) {
      for (const part of helpers.splitList ? helpers.splitList(listValue, /[;|,]/) : listValue.split(/[;|,]/)) addMembership(edge, part);
    } else {
      addMembership(edge, rawVertex);
    }
  }
  if (config.preserveEmpty?.sourceFile) {
    for (const row of rowsFor(config.preserveEmpty.sourceFile)) {
      const edge = keyOf(row, config.preserveEmpty.keyColumns);
      if (edge && !groups.has(edge)) {
        groups.set(edge, new Set());
        diagnostics.emptyHyperedgesPreserved += 1;
      }
    }
  }
  const canonicalHyperedges = [...groups.entries()].map(([id, vertices]) => ({
    id,
    vertices: [...vertices],
    time: null,
    weight: 1,
    attributes: {}
  }));
  diagnostics.emittedHyperedges = canonicalHyperedges.length;
  diagnostics.emittedVertices = helpers.unique(canonicalHyperedges.flatMap(edge => edge.vertices)).length;
  diagnostics.emittedIncidences = canonicalHyperedges.reduce((sum, edge) => sum + edge.vertices.length, 0);
  return { canonicalHyperedges, diagnostics };
}`,
  };
}
