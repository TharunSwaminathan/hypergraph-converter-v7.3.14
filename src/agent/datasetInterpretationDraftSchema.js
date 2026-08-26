export const DATASET_INTERPRETATION_TASK = "plan_dataset_interpretation";

export const DATASET_INTERPRETATION_CLASSIFICATIONS = Object.freeze([
  "interpretation",
  "clarification",
  "built_in_route",
  "unsupported",
  "not_dataset_mapping",
]);

export const DATASET_INTERPRETATION_DRAFT_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: [
    "task",
    "classification",
    "summary",
    "parseModeRecommendation",
    "groups",
    "fileRoles",
    "relationships",
    "entitySuggestions",
    "clarifications",
    "warnings",
    "assumptions",
    "confidence",
  ],
  properties: {
    task: { type: "string", enum: [DATASET_INTERPRETATION_TASK] },
    classification: { type: "string", enum: DATASET_INTERPRETATION_CLASSIFICATIONS },
    summary: { type: "string" },
    parseModeRecommendation: { type: "string", enum: ["together", "separate", "grouped", "unknown"] },
    groups: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "kind", "fileNames", "confidence", "reason"],
        properties: {
          label: { type: "string" },
          kind: { type: "string", enum: ["static_graph", "validation_only", "update_stream", "ignored", "unknown"] },
          fileNames: { type: "array", items: { type: "string" } },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
          reason: { type: "string" },
          evidenceIds: { type: "array", items: { type: "string" } },
        },
      },
    },
    fileRoles: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["fileName", "groupLabel", "role", "useAsInput", "confidence", "reason"],
        properties: {
          fileName: { type: "string" },
          groupLabel: { type: ["string", "null"] },
          role: {
            type: "string",
            enum: ["vertex_table", "hyperedge_table", "membership", "incidence", "edge_list", "hyperedge_list", "matrix_coordinate_list", "validation_expected_output", "update_stream", "ignored", "unknown"],
          },
          useAsInput: { type: "boolean" },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
          reason: { type: "string" },
        },
      },
    },
    relationships: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "leftFile", "leftColumns", "rightFile", "rightColumns", "cardinality", "joinTypeRecommendation", "confidence", "evidenceIds"],
        properties: {
          type: { type: "string", enum: ["membership", "metadata_join", "lookup", "validation_match", "unknown"] },
          leftFile: { type: "string" },
          leftColumns: { type: "array", items: { type: "string" } },
          rightFile: { type: "string" },
          rightColumns: { type: "array", items: { type: "string" } },
          cardinality: { type: "string", enum: ["one_to_one", "one_to_many", "many_to_one", "many_to_many", "unknown"] },
          joinTypeRecommendation: { type: "string", enum: ["inner", "left", "right", "outer", "none"] },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
          evidenceIds: { type: "array", items: { type: "string" } },
        },
      },
    },
    entitySuggestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["entityType", "sourceFile", "keyColumns", "labelColumn", "confidence"],
        properties: {
          entityType: { type: "string", enum: ["vertex", "hyperedge"] },
          sourceFile: { type: "string" },
          keyColumns: { type: "array", items: { type: "string" } },
          labelColumn: { type: ["string", "null"] },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
        },
      },
    },
    clarifications: { type: "array", items: { type: "string" } },
    warnings: { type: "array", items: { type: "string" } },
    assumptions: { type: "array", items: { type: "string" } },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
  },
});
