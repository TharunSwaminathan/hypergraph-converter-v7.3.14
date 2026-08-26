import { DATASET_MAPPING_PATCH_OPS, DATASET_MAPPING_PATCH_TASK } from "./datasetMappingPatchSchema.js";
import {
  DATASET_MAPPING_V2_FILE_ROLES,
  DATASET_MAPPING_V2_POLICIES,
} from "./datasetMappingSpecV2.js";
import { extractFirstJsonObject } from "./modelResponseValidator.js";

export function validateDatasetMappingPatchDraft(candidate, {
  fileNames = [],
  headersByFile = {},
  groupIds = [],
} = {}) {
  const errors = [];
  const draft = typeof candidate === "string" ? extractFirstJsonObject(candidate) : candidate;
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) return { ok: false, draft: null, errors: ["Patch draft must be an object."] };
  if (draft.task !== DATASET_MAPPING_PATCH_TASK) errors.push("task must be plan_dataset_mapping_patch.");
  if (!["patch", "clarification", "not_mapping"].includes(draft.classification)) errors.push("Unsupported patch classification.");
  if (!["low", "medium", "high"].includes(draft.confidence)) errors.push("confidence must be low, medium, or high.");
  if (typeof draft.summary !== "string") errors.push("summary must be a string.");
  if (!Array.isArray(draft.operations)) errors.push("operations must be an array.");
  for (const key of Object.keys(draft)) {
    if (/code|javascript|expression|sql|eval|function|parser/i.test(key)) errors.push(`Patch draft contains executable-looking property ${key}.`);
  }
  const fileSet = new Set(fileNames);
  const groupSet = new Set(groupIds);
  const createdGroupSet = new Set((draft.operations ?? [])
    .filter(operation => operation.type === "CREATE_GROUP" && operation.groupId)
    .map(operation => operation.groupId));
  const headerSet = fileName => new Set(headersByFile[fileName] ?? []);
  const requireFile = (fileName, type, errorsForOperation) => {
    if (fileName && !fileSet.has(fileName)) errorsForOperation.push(`${type} references unavailable file ${fileName}.`);
  };
  const requireColumns = (fileName, columns, label, errorsForOperation) => {
    if (!fileName) return;
    const headers = headerSet(fileName);
    if (!headers.size) return;
    for (const column of columns ?? []) {
      if (column && !headers.has(column)) errorsForOperation.push(`${label} references missing column ${fileName}.${column}.`);
    }
  };
  for (const operation of draft.operations ?? []) {
    if (!DATASET_MAPPING_PATCH_OPS.includes(operation.type)) errors.push(`Unsupported patch operation ${operation.type}.`);
    for (const key of Object.keys(operation)) {
      if (/code|javascript|expression|sql|eval|function/i.test(key)) errors.push(`Patch operation ${operation.type} contains executable-looking property ${key}.`);
    }
    for (const fileKey of ["fileName", "sourceFile", "targetFile", "vertexSourceFile"]) {
      if (operation[fileKey] && !fileSet.has(operation[fileKey])) errors.push(`${operation.type} references unavailable file ${operation[fileKey]}.`);
    }
    if (operation.groupId && groupSet.size && !groupSet.has(operation.groupId) && !createdGroupSet.has(operation.groupId) && operation.type !== "CREATE_GROUP") errors.push(`${operation.type} references unknown group ${operation.groupId}.`);
    if (operation.type === "SET_FILE_ROLE" && !DATASET_MAPPING_V2_FILE_ROLES.includes(operation.role)) errors.push(`Unsupported file role ${operation.role}.`);
    if (operation.type === "SET_PARSE_MODE" && !["together", "separate", "grouped", "unknown"].includes(operation.value)) errors.push(`Unsupported parse mode ${operation.value}.`);
    if (operation.type === "SET_POLICY") {
      if (!DATASET_MAPPING_V2_POLICIES[operation.policy]) errors.push(`Unknown policy ${operation.policy}.`);
      else if (!DATASET_MAPPING_V2_POLICIES[operation.policy].includes(operation.value)) errors.push(`Unsupported policy value ${operation.policy}=${operation.value}.`);
    }
    for (const [fileKey, columnKeys] of [
      ["fileName", ["keyColumns", "attributes"]],
      ["sourceFile", ["sourceColumns", "keyColumns", "attributes"]],
      ["targetFile", ["targetColumns"]],
      ["vertexSourceFile", ["vertexColumns"]],
    ]) {
      const fileName = operation[fileKey];
      if (!fileName) continue;
      const headers = headerSet(fileName);
      if (!headers.size) continue;
      for (const key of columnKeys) {
        for (const column of operation[key] ?? []) {
          if (!headers.has(column)) errors.push(`${operation.type} references missing column ${fileName}.${column}.`);
        }
      }
      for (const key of ["labelColumn", "timeColumn", "weightColumn", "listColumn"]) {
        if (operation[key] && !headers.has(operation[key])) errors.push(`${operation.type} references missing column ${fileName}.${operation[key]}.`);
      }
    }
    if (operation.relationship && typeof operation.relationship === "object") {
      const rel = operation.relationship;
      requireFile(rel.sourceFile, `${operation.type} relationship`, errors);
      requireFile(rel.targetFile, `${operation.type} relationship`, errors);
      requireFile(rel.vertexSourceFile, `${operation.type} relationship`, errors);
      requireColumns(rel.sourceFile, rel.sourceColumns, `${operation.type} relationship`, errors);
      requireColumns(rel.targetFile, rel.targetColumns, `${operation.type} relationship`, errors);
      requireColumns(rel.vertexSourceFile, rel.vertexColumns, `${operation.type} relationship`, errors);
      if (rel.type === "membership" && (!rel.vertexSourceFile || !(rel.vertexColumns ?? []).length)) errors.push(`${operation.type} membership relationship must identify vertex columns.`);
    }
  }
  return { ok: errors.length === 0, draft, errors };
}
