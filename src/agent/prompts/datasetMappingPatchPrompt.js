import { DATASET_MAPPING_PATCH_SCHEMA, DATASET_MAPPING_PATCH_TASK } from "../datasetMappingPatchSchema.js";
import { LOCAL_MODEL_TASK_MODES } from "../modelPromptBuilder.js";

function compactMapping(spec = {}) {
  return {
    version: spec.version,
    batchId: spec.batchId,
    batchVersion: spec.batchVersion,
    groupingRevision: spec.groupingRevision,
    mappingRevision: spec.mappingRevision,
    parseMode: spec.parseMode,
    activeGroupId: spec.activeGroupId,
    groups: spec.groups,
    files: spec.files,
    entities: spec.entities,
    relationships: spec.relationships,
    filters: spec.filters,
    policies: spec.policies,
  };
}

function compactProfile(datasetProfile = {}) {
  return {
    profileId: datasetProfile.profileId,
    files: (datasetProfile.files ?? []).map(file => ({
      fileName: file.fileName,
      headers: (file.columns ?? []).map(column => column.name),
      candidateKeys: (file.candidateKeys ?? []).slice(0, 4),
      listLikeColumns: (file.listLikeColumns ?? []).slice(0, 4),
    })),
  };
}

export function buildDatasetMappingPatchPrompt({
  mappingSpec,
  datasetProfile,
  relationshipEvidence = [],
  userIntent = "",
} = {}) {
  const request = {
    task: DATASET_MAPPING_PATCH_TASK,
    instruction: [
      "Return a non-executable mapping patch JSON only.",
      "Use only supported operation types from the schema.",
      "Use exact active file names, columns, group IDs, and relationship evidence IDs.",
      "Never return parserCode, JavaScript, SQL, expressions, or code.",
      "If the request is ambiguous, return classification=clarification with no operations.",
    ],
    userIntent: String(userIntent ?? "").slice(0, 1200),
    currentMappingSpec: compactMapping(mappingSpec),
    datasetProfile: compactProfile(datasetProfile),
    relationshipEvidence: (relationshipEvidence ?? []).slice(0, 24),
    responseSchemaSummary: DATASET_MAPPING_PATCH_SCHEMA,
  };
  const messages = [
    { role: "system", content: "You are a local-only mapping correction helper. You produce typed JSON patch drafts for deterministic validation." },
    { role: "user", content: JSON.stringify(request, null, 2) },
  ];
  return {
    task: DATASET_MAPPING_PATCH_TASK,
    taskMode: LOCAL_MODEL_TASK_MODES.PLAN_DATASET_MAPPING_PATCH,
    messages,
    responseSchema: DATASET_MAPPING_PATCH_SCHEMA,
    promptChars: messages.reduce((sum, message) => sum + message.content.length, 0),
    schemaChars: JSON.stringify(DATASET_MAPPING_PATCH_SCHEMA).length,
  };
}
