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

function referenceSchema(entityType) {
  return {
    ...ENTITY_REFERENCE_SCHEMA,
    properties: {
      ...ENTITY_REFERENCE_SCHEMA.properties,
      entityType: { type: "string", enum: [entityType] },
    },
  };
}

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

const JSON_VALUE_SCHEMA = {
  type: ["string", "number", "boolean", "object", "array", "null"],
};

const VERTEX_REFERENCE_SCHEMA = referenceSchema("vertex");
const HYPEREDGE_REFERENCE_SCHEMA = referenceSchema("hyperedge");
const VERTEX_REFERENCE_REF = { $ref: "#/$defs/vertexReference" };
const HYPEREDGE_REFERENCE_REF = { $ref: "#/$defs/hyperedgeReference" };
const EMPTY_POLICY_REF = { $ref: "#/$defs/emptyHyperedgePolicy" };
const JSON_VALUE_REF = { $ref: "#/$defs/jsonValue" };

function operationSchema(type, properties = {}, required = Object.keys(properties)) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["type", ...required],
    properties: {
      type: { enum: [type] },
      ...properties,
    },
  };
}

export const GRAPH_MUTATION_OPERATION_SCHEMAS = Object.freeze([
  operationSchema(GRAPH_MUTATION_OPS.ADD_HYPEREDGE, {
    newHyperedgeId: { type: "string", maxLength: GRAPH_MUTATION_DRAFT_LIMITS.maxIdentifierChars },
    vertexReferences: {
      type: "array",
      minItems: 1,
      maxItems: GRAPH_MUTATION_DRAFT_LIMITS.maxOperations * 2,
      items: VERTEX_REFERENCE_REF,
    },
  }),
  operationSchema(GRAPH_MUTATION_OPS.REMOVE_HYPEREDGE, { hyperedgeReference: HYPEREDGE_REFERENCE_REF }),
  operationSchema(GRAPH_MUTATION_OPS.ADD_INCIDENCE, {
    vertexReference: VERTEX_REFERENCE_REF,
    hyperedgeReference: HYPEREDGE_REFERENCE_REF,
  }),
  operationSchema(GRAPH_MUTATION_OPS.REMOVE_INCIDENCE, {
    vertexReference: VERTEX_REFERENCE_REF,
    hyperedgeReference: HYPEREDGE_REFERENCE_REF,
    emptyHyperedgePolicy: EMPTY_POLICY_REF,
  }),
  operationSchema(GRAPH_MUTATION_OPS.RENAME_HYPEREDGE, {
    hyperedgeReference: HYPEREDGE_REFERENCE_REF,
    newHyperedgeId: { type: "string", maxLength: GRAPH_MUTATION_DRAFT_LIMITS.maxIdentifierChars },
  }),
  operationSchema(GRAPH_MUTATION_OPS.RENAME_VERTEX, {
    vertexReference: VERTEX_REFERENCE_REF,
    newVertexId: { type: "string", maxLength: GRAPH_MUTATION_DRAFT_LIMITS.maxIdentifierChars },
  }),
  operationSchema(GRAPH_MUTATION_OPS.REMOVE_VERTEX_GLOBAL, {
    vertexReference: VERTEX_REFERENCE_REF,
    emptyHyperedgePolicy: EMPTY_POLICY_REF,
  }),
  operationSchema(GRAPH_MUTATION_OPS.SET_HYPEREDGE_WEIGHT, {
    hyperedgeReference: HYPEREDGE_REFERENCE_REF,
    weight: { type: "number" },
  }),
  operationSchema(GRAPH_MUTATION_OPS.SET_HYPEREDGE_TIME, {
    hyperedgeReference: HYPEREDGE_REFERENCE_REF,
    time: JSON_VALUE_REF,
  }),
  operationSchema(GRAPH_MUTATION_OPS.SET_HYPEREDGE_ATTRIBUTE, {
    hyperedgeReference: HYPEREDGE_REFERENCE_REF,
    key: { type: "string", maxLength: GRAPH_MUTATION_DRAFT_LIMITS.maxAttributeKeyChars },
    value: JSON_VALUE_REF,
  }),
  operationSchema(GRAPH_MUTATION_OPS.REMOVE_HYPEREDGE_ATTRIBUTE, {
    hyperedgeReference: HYPEREDGE_REFERENCE_REF,
    key: { type: "string", maxLength: GRAPH_MUTATION_DRAFT_LIMITS.maxAttributeKeyChars },
  }),
  operationSchema(GRAPH_MUTATION_OPS.CLEAR_GRAPH),
  operationSchema(GRAPH_MUTATION_OPS.UNDO_LAST_MUTATION),
]);

export const GRAPH_MUTATION_DRAFT_SCHEMA = {
  type: "object",
  $defs: {
    vertexReference: VERTEX_REFERENCE_SCHEMA,
    hyperedgeReference: HYPEREDGE_REFERENCE_SCHEMA,
    emptyHyperedgePolicy: EMPTY_POLICY_SCHEMA,
    jsonValue: JSON_VALUE_SCHEMA,
  },
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
        oneOf: GRAPH_MUTATION_OPERATION_SCHEMAS,
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
