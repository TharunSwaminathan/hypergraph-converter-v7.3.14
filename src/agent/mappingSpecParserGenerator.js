import { ensureDatasetMappingSpecV2 } from "./datasetMappingMigration.js";
import { buildTransformationPlanFromMapping } from "./transformationPlan.js";
import { compileTransformationPlanToParser } from "./transformationPlanCompiler.js";

function embedded(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function fileByRole(spec, roles) {
  return spec.files.find(file => file.useAsInput && roles.includes(file.role));
}

export function generateParserFromMappingSpec(spec) {
  if (spec?.version === 2) {
    const migrated = ensureDatasetMappingSpecV2(spec);
    if (!migrated.ok) return { ok: false, error: migrated.errors.join(" ") };
    const planResult = buildTransformationPlanFromMapping(migrated.spec);
    if (!planResult.ok) return { ok: false, error: planResult.error };
    const compiled = compileTransformationPlanToParser(planResult.plan);
    if (!compiled.ok) return compiled;
    return {
      ...compiled,
      transformationPlan: planResult.plan,
      transformationPlanDescription: planResult.plan.steps?.length ? planResult.plan : null,
    };
  }

  if (["csr", "csc", "cornell_snap"].includes(spec.datasetType)) {
    return {
      ok: false,
      builtinRoute: spec.datasetType === "cornell_snap" ? "cornell" : spec.datasetType === "csc" ? "csr_csv" : "csr_json",
      error: `This mapping matches the existing ${spec.datasetType.toUpperCase()} route. Use that built-in route unless you explicitly need a custom parser.`,
    };
  }

  if (spec.datasetType === "matrix_coordinate_graph") {
    const matrix = fileByRole(spec, ["matrix_coordinate_list"]);
    const lookups = Array.isArray(spec.output.vertices) ? spec.output.vertices : [];
    const rowRule = lookups.find(rule => rule.fromColumn === "rowIndex");
    const colRule = lookups.find(rule => rule.fromColumn === "columnIndex");
    if (!matrix || !rowRule || !colRule) return { ok: false, error: "Matrix mapping is missing its coordinate or lookup rules." };
    const config = { matrix: matrix.fileName, row: rowRule.sourceFile, col: colRule.sourceFile };
    return {
      ok: true,
      kind: "matrix_coordinate",
      code: `// Deterministically generated from a validated DatasetMappingSpec.
async function parseHypergraph(files, helpers) {
  const config = ${embedded(config)};
  const byName = Object.fromEntries(files.map(file => [file.name, file]));
  const matrixFile = byName[config.matrix];
  const rowFile = byName[config.row];
  const colFile = byName[config.col];
  if (!matrixFile || !rowFile || !colFile) throw new Error("The active batch does not match the validated matrix mapping.");

  const labelMap = file => {
    const map = new Map();
    helpers.splitLines(file.text, { comments: true }).forEach((line, index) => {
      const cells = line.split(/[\\t,\\s]+/).filter(Boolean);
      const explicitIndex = /^\\d+$/.test(cells[0] ?? "") ? Number(cells.shift()) : index + 1;
      map.set(explicitIndex, cells.join(" ") || String(explicitIndex));
    });
    return map;
  };
  const rowLabels = labelMap(rowFile);
  const colLabels = labelMap(colFile);
  const lines = String(matrixFile.text).split(/\\r?\\n/).map(line => line.trim()).filter(Boolean);
  const dataLines = lines.filter(line => !line.startsWith("%"));
  if (dataLines.length < 1) return { canonicalHyperedges: [] };
  const dimensions = dataLines.shift().split(/\\s+/).map(Number);
  const hyperedges = dataLines.map((line, index) => {
    const [rowIndex, columnIndex, rawWeight] = line.split(/\\s+/).map(Number);
    return {
      id: \`matrix-\${index + 1}\`,
      vertices: [rowLabels.get(rowIndex) ?? String(rowIndex), colLabels.get(columnIndex) ?? String(columnIndex)],
      time: null,
      weight: Number.isFinite(rawWeight) ? rawWeight : 1,
      attributes: { matrixRow: rowIndex, matrixColumn: columnIndex, matrixRows: dimensions[0], matrixColumns: dimensions[1] },
    };
  });
  return { canonicalHyperedges: hyperedges };
}`,
    };
  }

  const membership = fileByRole(spec, ["membership", "incidence"]);
  const metadata = fileByRole(spec, ["hyperedge_metadata"]);
  if (membership) {
    const outputAttributeRule = (spec.output?.attributes ?? []).find(rule => rule.sourceFile === metadata?.fileName);
    const config = {
      membership: membership.fileName,
      metadata: metadata?.fileName ?? null,
      edgeColumn: membership.columns?.hyperedgeId,
      vertexColumn: membership.columns?.vertexId,
      metadataKey: metadata?.primaryKey ?? metadata?.columns?.hyperedgeId ?? null,
      timeRule: spec.output?.time ?? (metadata?.columns?.time ? { sourceFile: metadata.fileName, column: metadata.columns.time } : null),
      weightRule: spec.output?.weight ?? (metadata?.columns?.weight ? { sourceFile: metadata.fileName, column: metadata.columns.weight } : null),
      attributeColumns: outputAttributeRule?.columns ?? metadata?.columns?.attributes ?? [],
    };
    return {
      ok: true,
      kind: metadata ? "membership_with_metadata" : "incidence",
      code: `// Deterministically generated from a validated DatasetMappingSpec.
async function parseHypergraph(files, helpers) {
  const config = ${embedded(config)};
  const byName = Object.fromEntries(files.map(file => [file.name, file]));
  const membershipFile = byName[config.membership];
  if (!membershipFile) throw new Error("Membership file is missing from the active batch.");
  const objects = helpers.parseCSV(membershipFile.text);
  if (!objects.length) return { canonicalHyperedges: [] };
  const groups = new Map();
  for (const row of objects) {
    const edge = String(row[config.edgeColumn] ?? "").trim();
    const vertex = String(row[config.vertexColumn] ?? "").trim();
    if (!edge || !vertex) continue;
    if (!groups.has(edge)) groups.set(edge, new Set());
    groups.get(edge).add(vertex);
  }
  const metadata = new Map();
  if (config.metadata && byName[config.metadata]) {
    const metadataRows = helpers.parseCSV(byName[config.metadata].text);
    for (const object of metadataRows) {
      metadata.set(String(object[config.metadataKey] ?? "").trim(), object);
    }
  }
  const hyperedges = [...groups].map(([id, vertices]) => {
    const meta = metadata.get(id) ?? {};
    const attributes = Object.fromEntries(config.attributeColumns.filter(column => meta[column] !== undefined).map(column => [column, meta[column]]));
    const rawWeight = config.weightRule?.column ? meta[config.weightRule.column] : undefined;
    const mappedWeight = config.weightRule?.type === "mapping"
      ? (config.weightRule.map?.[rawWeight] ?? config.weightRule.default ?? 1)
      : rawWeight;
    const numericWeight = Number(mappedWeight);
    return {
      id,
      vertices: [...vertices],
      time: config.timeRule?.column ? (meta[config.timeRule.column] ?? null) : null,
      weight: Number.isFinite(numericWeight) ? numericWeight : 1,
      attributes,
    };
  });
  return { canonicalHyperedges: hyperedges };
}`,
    };
  }

  const edgeList = fileByRole(spec, ["edge_list"]);
  if (edgeList) {
    const config = {
      fileName: edgeList.fileName,
      source: edgeList.columns?.source,
      target: edgeList.columns?.target,
      weight: edgeList.columns?.weight ?? null,
      time: edgeList.columns?.time ?? null,
    };
    return {
      ok: true,
      kind: "edge_list",
      code: `// Deterministically generated from a validated DatasetMappingSpec.
async function parseHypergraph(files, helpers) {
  const config = ${embedded(config)};
  const file = files.find(item => item.name === config.fileName);
  if (!file) throw new Error("Mapped edge-list file is missing.");
  const rows = helpers.parseCSV(file.text);
  const hyperedges = rows.map((object, index) => {
    const numericWeight = Number(object[config.weight]);
    return {
      id: \`edge-\${index + 1}\`,
      vertices: helpers.unique([object[config.source], object[config.target]].map(String)),
      time: config.time ? (object[config.time] ?? null) : null,
      weight: config.weight && Number.isFinite(numericWeight) ? numericWeight : 1,
      attributes: {},
    };
  });
  return { canonicalHyperedges: hyperedges };
}`,
    };
  }

  const h2v = fileByRole(spec, ["hyperedge_list"]);
  if (h2v) {
    return {
      ok: true,
      kind: "hyperedge_list",
      code: `// Deterministically generated from a validated DatasetMappingSpec.
async function parseHypergraph(files, helpers) {
  const file = files.find(item => item.name === ${embedded(h2v.fileName)});
  if (!file) throw new Error("Mapped hyperedge-list file is missing.");
  const hyperedges = helpers.splitLines(file.text, { comments: true }).map((line, index) => {
    const separator = line.indexOf(":");
    if (separator < 0) return null;
    return {
      id: line.slice(0, separator).trim() || \`h\${index + 1}\`,
      vertices: helpers.unique(line.slice(separator + 1).split(/[\\s,]+/).filter(Boolean)),
      time: null,
      weight: 1,
      attributes: {},
    };
  }).filter(Boolean);
  return { canonicalHyperedges: hyperedges };
}`,
    };
  }

  return { ok: false, error: "The validated mapping does not match a deterministic parser-generator case yet. Correct the mapping or use the advanced manual parser workflow." };
}
