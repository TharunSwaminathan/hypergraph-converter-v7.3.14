import { DATASET_MAPPING_SPEC_SCHEMA } from "./datasetMappingSpec.js";
import { DATASET_INTERPRETATION_DRAFT_SCHEMA } from "./datasetInterpretationDraftSchema.js";
import { DATASET_MAPPING_PATCH_SCHEMA } from "./datasetMappingPatchSchema.js";
import { GRAPH_MUTATION_DRAFT_SCHEMA } from "./graphMutationDraftSchema.js";

const STRING_ARRAY = { type: "array", items: { type: "string" } };
const FILE_ROLE = {
  type: "object",
  additionalProperties: false,
  required: ["fileName", "role", "reason", "confidence"],
  properties: {
    fileName: { type: "string" },
    role: {
      type: "string",
      enum: [
        "nodes",
        "edges",
        "incidence",
        "hyperedges",
        "metadata",
        "weights",
        "timestamps",
        "labels",
        "expected_shape",
        "csr",
        "csc",
        "json",
        "unknown",
      ],
    },
    reason: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
};

const SCHEMAS = {
  generate_mapping_spec: DATASET_MAPPING_SPEC_SCHEMA,
  repair_mapping_spec: DATASET_MAPPING_SPEC_SCHEMA,
  plan_dataset_interpretation: DATASET_INTERPRETATION_DRAFT_SCHEMA,
  plan_dataset_mapping_patch: DATASET_MAPPING_PATCH_SCHEMA,
  plan_graph_mutation: GRAPH_MUTATION_DRAFT_SCHEMA,
  analyze_file_roles: {
    type: "object",
    additionalProperties: false,
    required: ["task", "summary", "parseModeRecommendation", "fileRoles", "joinKeys", "questionsForUser", "warnings"],
    properties: {
      task: { type: "string", enum: ["analyze_file_roles"] },
      summary: { type: "string" },
      parseModeRecommendation: { type: "string", enum: ["together", "separate", "unknown"] },
      fileRoles: { type: "array", items: FILE_ROLE },
      joinKeys: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["fileName", "column", "reason"],
          properties: {
            fileName: { type: "string" },
            column: { type: "string" },
            reason: { type: "string" },
          },
        },
      },
      hyperedgeIdColumns: STRING_ARRAY,
      vertexIdColumns: STRING_ARRAY,
      metadataColumns: STRING_ARRAY,
      questionsForUser: STRING_ARRAY,
      warnings: STRING_ARRAY,
    },
  },
  generate_custom_parser: {
    type: "object",
    additionalProperties: false,
    required: ["task", "summary", "parseMode", "fileRoles", "parserCode", "expectedOutput", "warnings", "assumptions", "testPlan"],
    properties: {
      task: { type: "string", enum: ["generate_custom_parser"] },
      summary: { type: "string" },
      parseMode: { type: "string", enum: ["together", "separate"] },
      fileRoles: { type: "array", items: FILE_ROLE },
      parserCode: { type: "string" },
      expectedOutput: { type: "string", enum: ["canonicalHyperedges"] },
      warnings: STRING_ARRAY,
      assumptions: STRING_ARRAY,
      testPlan: STRING_ARRAY,
    },
  },
  repair_custom_parser: {
    type: "object",
    additionalProperties: false,
    required: ["task", "summary", "parserCode", "fixes", "warnings"],
    properties: {
      task: { type: "string", enum: ["repair_custom_parser"] },
      summary: { type: "string" },
      parserCode: { type: "string" },
      fixes: STRING_ARRAY,
      warnings: STRING_ARRAY,
    },
  },
  explain_parser_strategy: {
    type: "object",
    additionalProperties: false,
    required: ["task", "summary", "parseModeRecommendation", "fileRoles", "questionsForUser", "warnings"],
    properties: {
      task: { type: "string", enum: ["explain_parser_strategy"] },
      summary: { type: "string" },
      parseModeRecommendation: { type: "string", enum: ["together", "separate", "unknown"] },
      fileRoles: { type: "array", items: FILE_ROLE },
      questionsForUser: STRING_ARRAY,
      warnings: STRING_ARRAY,
    },
  },
};

export function getModelResponseSchema(task) {
  return SCHEMAS[task] ?? SCHEMAS.explain_parser_strategy;
}

export { SCHEMAS as MODEL_RESPONSE_SCHEMAS };
