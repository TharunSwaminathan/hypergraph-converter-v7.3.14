import { extractFirstJsonObject } from "./modelResponseValidator.js";
import {
  DATASET_INTERPRETATION_CLASSIFICATIONS,
  DATASET_INTERPRETATION_TASK,
} from "./datasetInterpretationDraftSchema.js";

const ROLES = new Set(["vertex_table", "hyperedge_table", "membership", "incidence", "edge_list", "hyperedge_list", "matrix_coordinate_list", "validation_expected_output", "update_stream", "ignored", "unknown"]);
const CONFIDENCE = new Set(["low", "medium", "high"]);
const GROUP_KINDS = new Set(["static_graph", "validation_only", "update_stream", "ignored", "unknown"]);

function objectFrom(candidate) {
  if (typeof candidate === "string") {
    const extracted = extractFirstJsonObject(candidate);
    return extracted && typeof extracted === "object" ? extracted : null;
  }
  return candidate;
}

function profileContext(datasetProfile = {}, relationshipEvidence = []) {
  const files = datasetProfile.files ?? [];
  const fileNames = new Set(files.map(file => file.fileName));
  const headersByFile = new Map(files.map(file => [file.fileName, new Set((file.columns ?? []).map(column => column.name))]));
  const evidenceIds = new Set((relationshipEvidence ?? []).map(evidence => evidence.id));
  return { fileNames, headersByFile, evidenceIds };
}

function requireKnownColumns(headersByFile, fileName, columns, errors, label) {
  const headers = headersByFile.get(fileName);
  if (!headers?.size) return;
  for (const column of columns ?? []) {
    if (!headers.has(column)) errors.push(`${label} references missing column ${fileName}.${column}.`);
  }
}

export function validateDatasetInterpretationDraft(candidate, {
  datasetProfile = {},
  relationshipEvidence = [],
} = {}) {
  const draft = objectFrom(candidate);
  const errors = [];
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) return { ok: false, draft: null, errors: ["Interpretation draft must be one JSON object."] };
  if (draft.task !== DATASET_INTERPRETATION_TASK) errors.push("task must be plan_dataset_interpretation.");
  if (!DATASET_INTERPRETATION_CLASSIFICATIONS.includes(draft.classification)) errors.push(`Unsupported interpretation classification ${draft.classification}.`);
  if (!["together", "separate", "grouped", "unknown"].includes(draft.parseModeRecommendation)) errors.push("parseModeRecommendation is invalid.");
  if (!CONFIDENCE.has(draft.confidence)) errors.push("confidence must be low, medium, or high.");
  for (const key of Object.keys(draft)) {
    if (/code|javascript|expression|sql|eval|function|parser/i.test(key)) errors.push(`Interpretation draft contains executable-looking property ${key}.`);
  }
  const { fileNames, headersByFile, evidenceIds } = profileContext(datasetProfile, relationshipEvidence);
  for (const group of draft.groups ?? []) {
    if (!GROUP_KINDS.has(group.kind)) errors.push(`Unsupported group kind ${group.kind}.`);
    for (const name of group.fileNames ?? []) if (!fileNames.has(name)) errors.push(`Group references unavailable file ${name}.`);
    for (const id of group.evidenceIds ?? []) if (!evidenceIds.has(id)) errors.push(`Group references unavailable evidence ID ${id}.`);
  }
  for (const role of draft.fileRoles ?? []) {
    if (!fileNames.has(role.fileName)) errors.push(`File role references unavailable file ${role.fileName}.`);
    if (!ROLES.has(role.role)) errors.push(`Unsupported file role ${role.role}.`);
    if (!CONFIDENCE.has(role.confidence)) errors.push(`${role.fileName} confidence must be low, medium, or high.`);
    if (["validation_expected_output", "update_stream", "ignored"].includes(role.role) && role.useAsInput) errors.push(`${role.fileName} role ${role.role} must not be used as static graph input.`);
  }
  for (const rel of draft.relationships ?? []) {
    for (const name of [rel.leftFile, rel.rightFile]) if (!fileNames.has(name)) errors.push(`Relationship references unavailable file ${name}.`);
    requireKnownColumns(headersByFile, rel.leftFile, rel.leftColumns, errors, "relationship");
    requireKnownColumns(headersByFile, rel.rightFile, rel.rightColumns, errors, "relationship");
    for (const id of rel.evidenceIds ?? []) if (!evidenceIds.has(id)) errors.push(`Relationship references unavailable evidence ID ${id}.`);
  }
  for (const entity of draft.entitySuggestions ?? []) {
    if (!fileNames.has(entity.sourceFile)) errors.push(`Entity suggestion references unavailable file ${entity.sourceFile}.`);
    requireKnownColumns(headersByFile, entity.sourceFile, entity.keyColumns, errors, "entity suggestion");
    requireKnownColumns(headersByFile, entity.sourceFile, [entity.labelColumn].filter(Boolean), errors, "entity suggestion");
  }
  for (const key of ["clarifications", "warnings", "assumptions"]) {
    if (!Array.isArray(draft[key]) || draft[key].some(item => typeof item !== "string")) errors.push(`${key} must be an array of strings.`);
  }
  return {
    ok: errors.length === 0,
    draft,
    errors,
    message: errors.length ? `Dataset interpretation draft rejected:\n- ${errors.join("\n- ")}` : "",
  };
}
