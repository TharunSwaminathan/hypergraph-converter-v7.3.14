import { extractFirstJsonObject } from "./modelResponseValidator.js";
import { isExpectedOutputFileName } from "./datasetMappingSpec.js";

const GRAPH_ROLES = new Set([
  "hyperedge_list",
  "membership",
  "incidence",
  "edge_list",
  "matrix_coordinate_list",
  "csr",
  "csc",
  "cornell_nverts",
  "cornell_simplices",
  "cornell_times",
  "hyperedge_metadata",
  "vertex_metadata",
]);

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeRole(file, draftFile) {
  const role = String(file.role ?? "").toLowerCase();
  if (role === "metadata" && (file.primaryKey || file.join || draftFile?.role === "hyperedge_metadata")) return "hyperedge_metadata";
  if (role === "edges" && /\.mtx$/i.test(file.fileName)) return "matrix_coordinate_list";
  if (role === "nodes" && /(?:row|col).*(?:node|label|vert)/i.test(file.fileName)) return "vertex_metadata";
  return role || draftFile?.role || "unknown";
}

function graphInputFiles(spec) {
  return (spec.files ?? []).filter(file => file.useAsInput && GRAPH_ROLES.has(file.role));
}

export function autoRepairMappingSpec(candidate, {
  batch,
  preview,
  deterministicDraft = null,
  diagnostics = null,
} = {}) {
  const parsed = typeof candidate === "string" ? extractFirstJsonObject(candidate) : clone(candidate);
  const originalSpec = clone(parsed);
  const draft = clone(deterministicDraft);
  const spec = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : clone(draft);
  const repairNotes = [];
  const warnings = [];
  if (!spec) return { spec: null, originalSpec, repairNotes, warnings, changed: false };
  if (spec.version === 2) {
    return { spec, originalSpec, repairNotes, warnings, changed: false };
  }
  if (!parsed && draft) repairNotes.push("Used the deterministic draft because no mapping JSON could be extracted.");

  spec.version = spec.version ?? 1;
  spec.parseMode = ["together", "separate", "unknown"].includes(spec.parseMode)
    ? spec.parseMode
    : batch?.parseMode ?? draft?.parseMode ?? "unknown";
  if (!Array.isArray(spec.files)) spec.files = [];
  spec.output = spec.output && typeof spec.output === "object" ? spec.output : {};
  if (!spec.output.format) {
    spec.output.format = "canonicalHyperedges";
    repairNotes.push("Inferred output.format as canonicalHyperedges.");
  }
  for (const key of ["warnings", "questionsForUser", "assumptions"]) {
    if (!Array.isArray(spec[key])) spec[key] = [];
  }
  if (typeof spec.summary !== "string" || !spec.summary.trim()) spec.summary = draft?.summary ?? "Auto-repaired dataset mapping.";
  if (typeof spec.confidence !== "number") spec.confidence = draft?.confidence ?? 0.5;

  const activeNames = new Set((batch?.files ?? []).map(file => file.name));
  const draftFiles = new Map((draft?.files ?? []).map(file => [file.fileName, file]));
  const validationNames = new Set([
    ...((diagnostics?.validationFiles ?? []).map(file => file.fileName)),
    ...(preview?.files ?? []).filter(file => isExpectedOutputFileName(file.fileName)).map(file => file.fileName),
  ]);

  spec.files = spec.files.map(file => {
    const next = { ...file };
    const draftFile = draftFiles.get(next.fileName);
    const normalizedRole = normalizeRole(next, draftFile);
    if (normalizedRole !== next.role) {
      repairNotes.push(`Normalized ${next.fileName} role from ${next.role ?? "(missing)"} to ${normalizedRole}.`);
      next.role = normalizedRole;
    }
    if (validationNames.has(next.fileName)) {
      if (next.role !== "validation_expected_output" || next.useAsInput !== false) {
        repairNotes.push(`Marked ${next.fileName} as validation_expected_output and excluded it from parser input.`);
      }
      next.role = "validation_expected_output";
      next.useAsInput = false;
    } else if (next.useAsInput === undefined && GRAPH_ROLES.has(next.role)) {
      next.useAsInput = true;
      repairNotes.push(`Set useAsInput=true for graph input ${next.fileName}.`);
    } else if (next.useAsInput === undefined) {
      next.useAsInput = false;
    }
    return next;
  });

  const mappedNames = new Set(spec.files.map(file => file.fileName));
  for (const fileName of validationNames) {
    if (!activeNames.has(fileName) || mappedNames.has(fileName)) continue;
    spec.files.push({ fileName, role: "validation_expected_output", useAsInput: false });
    mappedNames.add(fileName);
    repairNotes.push(`Added ${fileName} as validation_expected_output.`);
  }

  for (const file of spec.files) {
    if (!activeNames.has(file.fileName)) continue;
    const draftFile = draftFiles.get(file.fileName);
    if (!file.join && draftFile?.join) {
      file.join = clone(draftFile.join);
      repairNotes.push(`Inferred ${file.join.leftFile}.${file.join.leftKey} joins ${file.join.rightFile}.${file.join.rightKey}.`);
    }
    if ((!file.columns || typeof file.columns !== "object") && draftFile?.columns) {
      file.columns = clone(draftFile.columns);
      repairNotes.push(`Restored deterministic column mapping for ${file.fileName}.`);
    }
    if (!file.primaryKey && draftFile?.primaryKey) {
      file.primaryKey = draftFile.primaryKey;
      repairNotes.push(`Inferred ${file.fileName}.${file.primaryKey} as the primary key.`);
    }
  }

  const inputCount = graphInputFiles(spec).filter(file => !["cornell_times", "vertex_metadata", "hyperedge_metadata"].includes(file.role)).length
    + graphInputFiles(spec).filter(file => ["hyperedge_metadata"].includes(file.role)).length;
  const multipleInputs = graphInputFiles(spec).length > 1;
  if (graphInputFiles(spec).some(file => file.role === "matrix_coordinate_list") && spec.datasetType !== "matrix_coordinate_graph") {
    repairNotes.push(`Changed datasetType from ${spec.datasetType ?? "(missing)"} to matrix_coordinate_graph.`);
    spec.datasetType = "matrix_coordinate_graph";
  } else if (multipleInputs && /^single_file_/.test(spec.datasetType ?? "")) {
    const nextType = graphInputFiles(spec).some(file => ["membership", "incidence", "hyperedge_list"].includes(file.role))
      ? "multi_file_hypergraph"
      : "multi_file_graph_edges";
    repairNotes.push(`Changed datasetType from ${spec.datasetType} to ${nextType}.`);
    spec.datasetType = nextType;
  }
  if (!spec.datasetType) {
    spec.datasetType = draft?.datasetType ?? (inputCount > 1 ? "multi_file_hypergraph" : "unknown");
    repairNotes.push(`Inferred datasetType as ${spec.datasetType}.`);
  }

  if (!spec.output.vertices && draft?.output?.vertices) {
    spec.output.vertices = clone(draft.output.vertices);
    repairNotes.push("Restored deterministic output vertex mapping.");
  }
  for (const key of ["hyperedgeMode", "hyperedgeId", "time", "weight", "attributes"]) {
    if (spec.output[key] === undefined && draft?.output?.[key] !== undefined) {
      spec.output[key] = clone(draft.output[key]);
      repairNotes.push(`Restored deterministic output.${key} mapping.`);
    }
  }

  if (validationNames.size && !spec.files.some(file => validationNames.has(file.fileName))) {
    warnings.push("Validation files were detected but could not be added because they are not in the active batch.");
  }
  return {
    spec,
    originalSpec,
    repairNotes: [...new Set(repairNotes)],
    warnings: [...new Set(warnings)],
    changed: repairNotes.length > 0,
  };
}
