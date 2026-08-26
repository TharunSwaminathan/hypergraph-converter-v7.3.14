import { DATASET_TYPES, isExpectedOutputFileName, MAPPING_FILE_ROLES } from "./datasetMappingSpec.js";
import { extractFirstJsonObject } from "./modelResponseValidator.js";

function stringArray(value) {
  return Array.isArray(value) && value.every(item => typeof item === "string");
}

function referencedColumns(file) {
  const columns = file?.columns ?? {};
  return Object.entries(columns)
    .filter(([key, value]) => key !== "attributes" && typeof value === "string" && value)
    .map(([, value]) => value)
    .concat(Array.isArray(columns.attributes) ? columns.attributes : []);
}

export function validateDatasetMappingSpec(candidate, { batch, preview } = {}) {
  const errors = [];
  const repairableErrors = [];
  const validationWarnings = [];
  const informationalNotes = [];
  const spec = typeof candidate === "string" ? extractFirstJsonObject(candidate) : candidate;
  if (!spec || typeof spec !== "object" || Array.isArray(spec)) {
    return {
      ok: false,
      spec: null,
      errors: ["Mapping spec must be one valid JSON object."],
      repairableErrors,
      validationWarnings,
      informationalNotes,
      message: "Mapping spec was rejected:\n- Mapping spec must be one valid JSON object.",
    };
  }
  if (spec.version !== 1) errors.push("version must be 1.");
  if (!DATASET_TYPES.has(spec.datasetType)) errors.push(`Unsupported datasetType: ${spec.datasetType ?? "(missing)"}.`);
  if (!["together", "separate", "unknown"].includes(spec.parseMode)) errors.push("parseMode must be together, separate, or unknown.");
  if (["together", "separate"].includes(batch?.parseMode) && spec.parseMode !== batch.parseMode) {
    errors.push(`parseMode must match the active batch mode ${batch.parseMode}.`);
  }
  if (spec.confidence !== undefined && (typeof spec.confidence !== "number" || spec.confidence < 0 || spec.confidence > 1)) errors.push("confidence must be a number from 0 to 1.");
  if (typeof spec.summary !== "string" || !spec.summary.trim()) errors.push("summary is required.");
  if (!Array.isArray(spec.files)) errors.push("files must be an array.");
  if (spec.output?.format !== "canonicalHyperedges") errors.push("output.format must be canonicalHyperedges.");
  for (const key of ["warnings", "questionsForUser", "assumptions"]) {
    if (!stringArray(spec[key])) errors.push(`${key} must be an array of strings.`);
  }

  const activeNames = new Set((batch?.files ?? []).map(file => file.name));
  const headerMap = new Map((preview?.files ?? []).map(file => [file.fileName, new Set(file.headers ?? [])]));
  const mappedNames = new Set();
  for (const file of spec.files ?? []) {
    if (!file || typeof file !== "object") {
      errors.push("Every files entry must be an object.");
      continue;
    }
    if (mappedNames.has(file.fileName)) errors.push(`Mapping contains duplicate file entry: ${file.fileName}.`);
    mappedNames.add(file.fileName);
    if (!activeNames.has(file.fileName)) errors.push(`Mapping references a file outside the active batch: ${file.fileName ?? "(missing)"}.`);
    if (!MAPPING_FILE_ROLES.has(file.role)) errors.push(`Unsupported role for ${file.fileName ?? "file"}: ${file.role ?? "(missing)"}.`);
    if (typeof file.useAsInput !== "boolean") repairableErrors.push(`${file.fileName ?? "file"} must define useAsInput as true or false.`);
    if ((file.role === "validation_expected_output" || isExpectedOutputFileName(file.fileName)) && file.useAsInput !== false) {
      repairableErrors.push(`${file.fileName} is validation output and must useAsInput=false.`);
    }
    if (file.role === "validation_expected_output" && file.useAsInput === false) {
      informationalNotes.push(`${file.fileName} is validation output and is excluded from parser input.`);
    }
    if (["membership", "incidence"].includes(file.role)) {
      if (!file.columns?.hyperedgeId) errors.push(`${file.fileName} is ${file.role} but has no hyperedge/group column.`);
      if (!file.columns?.vertexId) errors.push(`${file.fileName} is ${file.role} but has no vertex/member column.`);
    }
    const headers = headerMap.get(file.fileName);
    if (headers?.size && file.role !== "matrix_coordinate_list") {
      for (const column of referencedColumns(file)) {
        if (!headers.has(column)) {
          errors.push(`${file.fileName} references column ${column}, but available headers are ${[...headers].join(", ")}.`);
        }
      }
      if (file.primaryKey && !headers.has(file.primaryKey)) errors.push(`${file.fileName} primaryKey ${file.primaryKey} is not present in its headers.`);
    }
    if (file.join) {
      for (const side of ["left", "right"]) {
        const joinFile = file.join[`${side}File`];
        const joinKey = file.join[`${side}Key`];
        if (!activeNames.has(joinFile)) errors.push(`Join references a file outside the active batch: ${joinFile ?? "(missing)"}.`);
        const joinHeaders = headerMap.get(joinFile);
        if (joinHeaders?.size && !joinHeaders.has(joinKey)) errors.push(`Join key ${joinKey} is not present in ${joinFile}.`);
      }
    }
  }
  for (const activeName of activeNames) {
    if (!mappedNames.has(activeName)) {
      if (isExpectedOutputFileName(activeName)) {
        repairableErrors.push(`${activeName} is missing from the mapping but was detected as validation_expected_output.`);
      } else {
        errors.push(`Graph-input active-batch file is missing from the mapping: ${activeName}.`);
      }
    }
  }
  const outputRules = [];
  if (spec.output?.hyperedgeId) outputRules.push(spec.output.hyperedgeId);
  if (spec.output?.time) outputRules.push(spec.output.time);
  if (spec.output?.weight) outputRules.push(spec.output.weight);
  if (Array.isArray(spec.output?.vertices)) outputRules.push(...spec.output.vertices);
  else if (spec.output?.vertices) outputRules.push(spec.output.vertices);
  for (const attributeRule of spec.output?.attributes ?? []) outputRules.push(attributeRule);
  for (const rule of outputRules) {
    if (!rule || typeof rule !== "object") continue;
    for (const nameKey of ["sourceFile", "fromFile"]) {
      const fileName = rule[nameKey];
      if (fileName && !activeNames.has(fileName)) errors.push(`Output rule references a file outside the active batch: ${fileName}.`);
    }
    const sourceFile = rule.sourceFile ?? rule.fromFile;
    const headers = headerMap.get(sourceFile);
    for (const columnKey of ["column", "lookupColumn", "keyColumn", "fromColumn", "groupBy"]) {
      const column = rule[columnKey];
      if (column
        && headers?.size
        && !headers.has(column)
        && !["rowIndex", "columnIndex"].includes(column)
        && !(spec.datasetType === "matrix_coordinate_graph")) {
        errors.push(`Output rule references column ${column}, but it is not present in ${sourceFile}.`);
      }
    }
    for (const column of rule.columns ?? []) {
      if (headers?.size && !headers.has(column)) errors.push(`Output attribute column ${column} is not present in ${sourceFile}.`);
    }
  }
  const graphRoles = new Set((spec.files ?? []).filter(file => file.useAsInput).map(file => file.role));
  if (spec.datasetType !== "metadata_only" && ![...graphRoles].some(role => ["membership", "incidence", "edge_list", "hyperedge_list", "matrix_coordinate_list", "csr", "csc", "cornell_simplices"].includes(role))) {
    errors.push("The mapping has no membership, incidence, edge, hyperedge, matrix, sparse, or Cornell input from which to build a graph.");
  }
  if (spec.datasetType === "matrix_coordinate_graph") {
    const matrix = (spec.files ?? []).find(file => file.role === "matrix_coordinate_list" && file.useAsInput);
    if (!matrix) errors.push("Matrix coordinate mapping requires a matrix_coordinate_list input file.");
    const vertices = spec.output?.vertices;
    if (!Array.isArray(vertices) || vertices.length < 2) errors.push("Matrix coordinate mapping requires row and column vertex lookup rules.");
    if (Array.isArray(vertices) && !vertices.some(rule => rule.fromColumn === "rowIndex")) errors.push("Matrix coordinate mapping must identify rowIndex.");
    if (Array.isArray(vertices) && !vertices.some(rule => rule.fromColumn === "columnIndex")) errors.push("Matrix coordinate mapping must identify columnIndex.");
  }

  return {
    ok: errors.length === 0 && repairableErrors.length === 0,
    spec,
    errors,
    repairableErrors,
    validationWarnings,
    informationalNotes,
    message: errors.length
      ? `Mapping spec was rejected:\n- ${errors.join("\n- ")}`
      : repairableErrors.length ? `Mapping spec needs repair:\n- ${repairableErrors.join("\n- ")}` : "",
  };
}

export function validateMappingModelResponse(rawResponse, context) {
  return validateDatasetMappingSpec(rawResponse, context);
}
