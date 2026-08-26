import {
  DATASET_MAPPING_V2_FILE_ROLES,
  DATASET_MAPPING_V2_POLICIES,
} from "./datasetMappingSpecV2.js";
import { ensureDatasetMappingSpecV2 } from "./datasetMappingMigration.js";

const TOP_LEVEL_KEYS = new Set([
  "version",
  "batchId",
  "batchVersion",
  "groupingRevision",
  "mappingRevision",
  "datasetType",
  "parseMode",
  "confidence",
  "summary",
  "activeGroupId",
  "groups",
  "files",
  "entities",
  "relationships",
  "filters",
  "policies",
  "output",
  "evidence",
  "warnings",
  "questionsForUser",
  "assumptions",
]);

const FILE_KEYS = new Set(["fileName", "groupId", "role", "useAsInput", "delimiter", "hasHeader", "keyColumns", "columns", "listColumns"]);
const ENTITY_KEYS = new Set(["id", "groupId", "entityType", "sourceFile", "keyColumns", "labelColumn", "namespace", "idRule", "timeColumn", "weightColumn", "attributes", "retainUnmatched"]);
const REL_KEYS = new Set(["id", "groupId", "type", "sourceFile", "sourceColumns", "targetFile", "targetColumns", "vertexSourceFile", "vertexColumns", "cardinality", "joinType", "confidence", "evidenceIds"]);
const FILTER_KEYS = new Set(["id", "groupId", "fileName", "column", "operator", "value", "values"]);
const FILTER_OPS = new Set(["eq", "neq", "lt", "lte", "gt", "gte", "in", "not_in", "is_null", "not_null", "starts_with", "contains"]);

function unknownKeys(object, allowed, label, errors) {
  for (const key of Object.keys(object ?? {})) {
    if (!allowed.has(key)) errors.push(`${label} contains unknown property ${key}.`);
    if (/code|javascript|expression|sql|eval|function/i.test(key)) errors.push(`${label} contains executable-looking property ${key}.`);
  }
}

function arrayOfStrings(value) {
  return Array.isArray(value) && value.every(item => typeof item === "string");
}

function headersFor(fileProfiles = []) {
  return new Map(fileProfiles.map(file => [file.fileName, new Set((file.columns ?? []).map(column => column.name))]));
}

function requireColumns(headers, fileName, columns, errors, label) {
  const set = headers.get(fileName);
  if (!set?.size) return;
  for (const column of columns ?? []) {
    if (column && !set.has(column)) errors.push(`${label} references missing column ${fileName}.${column}.`);
  }
}

export function validateDatasetMappingSpecV2(candidate, {
  batchId = null,
  batchVersion = null,
  groupingRevision = null,
  fileProfiles = [],
  allowMigration = true,
} = {}) {
  const migrated = allowMigration ? ensureDatasetMappingSpecV2(candidate, { batchId, batchVersion, groupingRevision }) : { ok: true, spec: candidate, notes: [] };
  const spec = migrated.spec;
  const errors = [...(migrated.errors ?? [])];
  const warnings = [];
  if (!spec || typeof spec !== "object" || Array.isArray(spec)) errors.push("DatasetMappingSpec v2 must be an object.");
  if (errors.length) return { ok: false, spec, errors, warnings, notes: migrated.notes ?? [] };
  unknownKeys(spec, TOP_LEVEL_KEYS, "DatasetMappingSpec", errors);
  if (spec.version !== 2) errors.push("version must be 2.");
  if (batchId && spec.batchId !== batchId) errors.push(`batchId ${spec.batchId} does not match active batch ${batchId}.`);
  if (batchVersion != null && Number(spec.batchVersion) !== Number(batchVersion)) errors.push("batchVersion is stale.");
  if (groupingRevision != null && Number(spec.groupingRevision) !== Number(groupingRevision)) errors.push("groupingRevision is stale.");
  if (!["together", "separate", "grouped", "unknown"].includes(spec.parseMode)) errors.push("parseMode must be together, separate, grouped, or unknown.");
  if (spec.output?.format !== "canonicalHyperedges") errors.push("output.format must be canonicalHyperedges.");
  for (const key of ["warnings", "questionsForUser", "assumptions"]) {
    if (!arrayOfStrings(spec[key])) errors.push(`${key} must be an array of strings.`);
  }
  const profileNames = new Set(fileProfiles.map(file => file.fileName));
  const headerMap = headersFor(fileProfiles);
  const groupIds = new Set((spec.groups ?? []).map(group => group.id));
  if (!groupIds.has(spec.activeGroupId) && spec.groups?.length) errors.push(`activeGroupId ${spec.activeGroupId} does not exist.`);
  const fileNames = new Set();
  for (const file of spec.files ?? []) {
    unknownKeys(file, FILE_KEYS, `file ${file?.fileName ?? "(unknown)"}`, errors);
    if (fileNames.has(file.fileName)) errors.push(`Duplicate file mapping for ${file.fileName}.`);
    fileNames.add(file.fileName);
    if (profileNames.size && !profileNames.has(file.fileName)) errors.push(`Mapping references unavailable file ${file.fileName}.`);
    if (!DATASET_MAPPING_V2_FILE_ROLES.includes(file.role)) errors.push(`Unsupported file role ${file.role} for ${file.fileName}.`);
    if (["validation_expected_output", "update_stream", "ignored"].includes(file.role) && file.useAsInput) errors.push(`${file.fileName} role ${file.role} must useAsInput=false.`);
    if (file.groupId && !groupIds.has(file.groupId)) errors.push(`${file.fileName} references unknown group ${file.groupId}.`);
    if (!arrayOfStrings(file.keyColumns)) errors.push(`${file.fileName}.keyColumns must be an array of strings.`);
    if ((file.keyColumns ?? []).length > 3) errors.push(`${file.fileName}.keyColumns exceeds composite-key width 3.`);
    requireColumns(headerMap, file.fileName, file.keyColumns, errors, "file key");
    const columns = file.columns ?? {};
    requireColumns(headerMap, file.fileName, [
      columns.hyperedgeId,
      columns.vertexId,
      columns.source,
      columns.target,
      columns.time,
      columns.weight,
      columns.label,
      ...(columns.attributes ?? []),
    ].filter(Boolean), errors, "file columns");
    for (const listColumn of file.listColumns ?? []) requireColumns(headerMap, file.fileName, [listColumn.column], errors, "list column");
  }
  for (const entity of [...(spec.entities?.vertices ?? []), ...(spec.entities?.hyperedges ?? [])]) {
    unknownKeys(entity, ENTITY_KEYS, `entity ${entity?.id ?? "(unknown)"}`, errors);
    if (!groupIds.has(entity.groupId)) errors.push(`Entity ${entity.id} references unknown group ${entity.groupId}.`);
    if (!fileNames.has(entity.sourceFile)) errors.push(`Entity ${entity.id} references unavailable source file ${entity.sourceFile}.`);
    if (!arrayOfStrings(entity.keyColumns) || entity.keyColumns.length < 1 || entity.keyColumns.length > 3) errors.push(`Entity ${entity.id} keyColumns must contain 1-3 columns.`);
    requireColumns(headerMap, entity.sourceFile, [...(entity.keyColumns ?? []), entity.labelColumn, entity.timeColumn, entity.weightColumn, ...(entity.attributes ?? [])].filter(Boolean), errors, `entity ${entity.id}`);
  }
  for (const rel of spec.relationships ?? []) {
    unknownKeys(rel, REL_KEYS, `relationship ${rel?.id ?? "(unknown)"}`, errors);
    if (!groupIds.has(rel.groupId)) errors.push(`Relationship ${rel.id} references unknown group ${rel.groupId}.`);
    for (const name of [rel.sourceFile, rel.targetFile, rel.vertexSourceFile].filter(Boolean)) {
      if (!fileNames.has(name)) errors.push(`Relationship ${rel.id} references unavailable file ${name}.`);
    }
    for (const columns of [rel.sourceColumns, rel.targetColumns, rel.vertexColumns]) {
      if (!arrayOfStrings(columns) || columns.length > 3) errors.push(`Relationship ${rel.id} columns must be string arrays of width <= 3.`);
    }
    requireColumns(headerMap, rel.sourceFile, rel.sourceColumns, errors, `relationship ${rel.id}`);
    requireColumns(headerMap, rel.targetFile, rel.targetColumns, errors, `relationship ${rel.id}`);
    requireColumns(headerMap, rel.vertexSourceFile, rel.vertexColumns, errors, `relationship ${rel.id}`);
    if (rel.type === "membership" && (!rel.vertexSourceFile || !(rel.vertexColumns ?? []).length)) errors.push(`Membership relationship ${rel.id} must identify vertex columns.`);
  }
  for (const filter of spec.filters ?? []) {
    unknownKeys(filter, FILTER_KEYS, `filter ${filter?.id ?? "(unknown)"}`, errors);
    if (!FILTER_OPS.has(filter.operator)) errors.push(`Unsupported filter operator ${filter.operator}.`);
    if (!fileNames.has(filter.fileName)) errors.push(`Filter ${filter.id} references unavailable file ${filter.fileName}.`);
    requireColumns(headerMap, filter.fileName, [filter.column], errors, `filter ${filter.id}`);
  }
  for (const [key, value] of Object.entries(spec.policies ?? {})) {
    if (!DATASET_MAPPING_V2_POLICIES[key]) errors.push(`Unknown policy ${key}.`);
    else if (!DATASET_MAPPING_V2_POLICIES[key].includes(value)) errors.push(`Unsupported policy value ${key}=${value}.`);
  }
  if ((spec.files ?? []).some(file => file.role === "update_stream" && file.useAsInput)) errors.push("Update streams cannot be used as static graph input in v7.3.0.");
  if (!(spec.relationships ?? []).some(rel => rel.type === "membership")
    && !(spec.files ?? []).some(file => ["edge_list", "hyperedge_list", "matrix_coordinate_list", "csr", "csc", "cornell_simplices"].includes(file.role))) {
    warnings.push("No explicit membership, edge-list, hyperedge-list, matrix, or built-in sparse source is mapped.");
  }
  return {
    ok: errors.length === 0,
    spec,
    errors,
    warnings,
    notes: migrated.notes ?? [],
    message: errors.length ? `DatasetMappingSpec v2 rejected:\n- ${errors.join("\n- ")}` : "",
  };
}
