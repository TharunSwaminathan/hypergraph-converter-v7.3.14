import { EMPTY_HYPEREDGE_POLICIES, GRAPH_MUTATION_OPS } from "../graph/graphMutationSchema.js";

export const GRAPH_MUTATION_DRAFT_TASK = "plan_graph_mutation";

export const GRAPH_MUTATION_DRAFT_CLASSIFICATIONS = Object.freeze([
  "mutation",
  "clarification",
  "not_mutation",
  "unsupported",
]);

export const GRAPH_MUTATION_DRAFT_CONFIDENCE = Object.freeze([
  "high",
  "medium",
  "low",
]);

export const GRAPH_MUTATION_DRAFT_ENTITY_TYPES = Object.freeze([
  "vertex",
  "hyperedge",
]);

export const GRAPH_MUTATION_DRAFT_REFERENCE_KINDS = Object.freeze([
  "literal",
  "selected",
  "pronoun",
  "recent",
  "last_created",
]);

export const GRAPH_MUTATION_DRAFT_SUPPORTED_OPS = Object.freeze([
  GRAPH_MUTATION_OPS.ADD_HYPEREDGE,
  GRAPH_MUTATION_OPS.REMOVE_HYPEREDGE,
  GRAPH_MUTATION_OPS.ADD_INCIDENCE,
  GRAPH_MUTATION_OPS.REMOVE_INCIDENCE,
  GRAPH_MUTATION_OPS.RENAME_HYPEREDGE,
  GRAPH_MUTATION_OPS.RENAME_VERTEX,
  GRAPH_MUTATION_OPS.REMOVE_VERTEX_GLOBAL,
  GRAPH_MUTATION_OPS.SET_HYPEREDGE_WEIGHT,
  GRAPH_MUTATION_OPS.SET_HYPEREDGE_TIME,
  GRAPH_MUTATION_OPS.SET_HYPEREDGE_ATTRIBUTE,
  GRAPH_MUTATION_OPS.REMOVE_HYPEREDGE_ATTRIBUTE,
  GRAPH_MUTATION_OPS.CLEAR_GRAPH,
  GRAPH_MUTATION_OPS.UNDO_LAST_MUTATION,
]);

export const GRAPH_MUTATION_DRAFT_LIMITS = Object.freeze({
  maxOperations: 10,
  maxQueryChars: 2000,
  maxAcknowledgementChars: 300,
  maxIntentSummaryChars: 300,
  maxClarificationChars: 500,
  maxReferenceSurfaceTextChars: 200,
  maxIdentifierChars: 200,
  maxAttributeKeyChars: 80,
  maxAttributeValueChars: 1000,
});

const ENTITY_REFERENCE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["entityType", "referenceKind", "surfaceText"],
  properties: {
    entityType: { type: "string", enum: GRAPH_MUTATION_DRAFT_ENTITY_TYPES },
    referenceKind: { type: "string", enum: GRAPH_MUTATION_DRAFT_REFERENCE_KINDS },
    surfaceText: { type: "string", maxLength: GRAPH_MUTATION_DRAFT_LIMITS.maxReferenceSurfaceTextChars },
  },
};

const CORRECTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["isCorrection", "replacePendingPlan"],
  properties: {
    isCorrection: { type: "boolean" },
    replacePendingPlan: { type: "boolean" },
  },
};

const EMPTY_POLICY_SCHEMA = {
  type: "string",
  enum: Object.values(EMPTY_HYPEREDGE_POLICIES),
};

const NULLABLE_ENTITY_REFERENCE_SCHEMA = {
  anyOf: [ENTITY_REFERENCE_SCHEMA, { type: "null" }],
};

const NULLABLE_EMPTY_POLICY_SCHEMA = {
  anyOf: [EMPTY_POLICY_SCHEMA, { type: "null" }],
};

const JSON_VALUE_SCHEMA = {
  type: ["string", "number", "boolean", "object", "array", "null"],
};

export const GRAPH_MUTATION_DRAFT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "task",
    "classification",
    "intentSummary",
    "operations",
    "clarificationQuestion",
    "correction",
    "previewOnly",
    "acknowledgement",
    "confidence",
  ],
  properties: {
    task: { type: "string", enum: [GRAPH_MUTATION_DRAFT_TASK] },
    classification: { type: "string", enum: GRAPH_MUTATION_DRAFT_CLASSIFICATIONS },
    intentSummary: { type: "string", maxLength: GRAPH_MUTATION_DRAFT_LIMITS.maxIntentSummaryChars },
    operations: {
      type: "array",
      maxItems: GRAPH_MUTATION_DRAFT_LIMITS.maxOperations,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "type",
          "vertexReference",
          "hyperedgeReference",
          "vertexReferences",
          "newHyperedgeId",
          "newVertexId",
          "emptyHyperedgePolicy",
          "weight",
          "time",
          "key",
          "value",
        ],
        properties: {
          type: { type: "string", enum: GRAPH_MUTATION_DRAFT_SUPPORTED_OPS },
          vertexReference: NULLABLE_ENTITY_REFERENCE_SCHEMA,
          hyperedgeReference: NULLABLE_ENTITY_REFERENCE_SCHEMA,
          vertexReferences: { type: "array", maxItems: GRAPH_MUTATION_DRAFT_LIMITS.maxOperations * 2, items: ENTITY_REFERENCE_SCHEMA },
          newHyperedgeId: { type: ["string", "null"], maxLength: GRAPH_MUTATION_DRAFT_LIMITS.maxIdentifierChars },
          newVertexId: { type: ["string", "null"], maxLength: GRAPH_MUTATION_DRAFT_LIMITS.maxIdentifierChars },
          emptyHyperedgePolicy: NULLABLE_EMPTY_POLICY_SCHEMA,
          weight: { type: ["number", "null"] },
          time: JSON_VALUE_SCHEMA,
          key: { type: ["string", "null"], maxLength: GRAPH_MUTATION_DRAFT_LIMITS.maxAttributeKeyChars },
          value: JSON_VALUE_SCHEMA,
        },
      },
    },
    clarificationQuestion: { type: ["string", "null"], maxLength: GRAPH_MUTATION_DRAFT_LIMITS.maxClarificationChars },
    correction: CORRECTION_SCHEMA,
    previewOnly: { type: "boolean" },
    acknowledgement: { type: "string", maxLength: GRAPH_MUTATION_DRAFT_LIMITS.maxAcknowledgementChars },
    confidence: { type: "string", enum: GRAPH_MUTATION_DRAFT_CONFIDENCE },
  },
};

export function emptyGraphMutationDraft(overrides = {}) {
  return {
    task: GRAPH_MUTATION_DRAFT_TASK,
    classification: "not_mutation",
    intentSummary: "",
    operations: [],
    clarificationQuestion: null,
    correction: {
      isCorrection: false,
      replacePendingPlan: false,
    },
    previewOnly: false,
    acknowledgement: "",
    confidence: "low",
    ...overrides,
  };
}
