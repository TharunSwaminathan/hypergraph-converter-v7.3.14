import { extractFirstJsonObject } from "./modelResponseValidator.js";
import {
  GRAPH_MUTATION_DRAFT_CLASSIFICATIONS,
  GRAPH_MUTATION_DRAFT_CONFIDENCE,
  GRAPH_MUTATION_DRAFT_ENTITY_TYPES,
  GRAPH_MUTATION_DRAFT_LIMITS,
  GRAPH_MUTATION_DRAFT_REFERENCE_KINDS,
  GRAPH_MUTATION_DRAFT_SUPPORTED_OPS,
  GRAPH_MUTATION_DRAFT_TASK,
} from "./graphMutationDraftSchema.js";
import { EMPTY_HYPEREDGE_POLICIES, GRAPH_MUTATION_OPS, PROTOTYPE_POLLUTION_KEYS } from "../graph/graphMutationSchema.js";

const TOP_LEVEL_KEYS = new Set([
  "task",
  "classification",
  "intentSummary",
  "operations",
  "clarificationQuestion",
  "correction",
  "previewOnly",
  "acknowledgement",
  "confidence",
]);

const CORRECTION_KEYS = new Set(["isCorrection", "replacePendingPlan"]);
const REFERENCE_KEYS = new Set(["entityType", "referenceKind", "surfaceText"]);
const EMPTY_POLICY_VALUES = new Set(Object.values(EMPTY_HYPEREDGE_POLICIES));
const EXECUTABLE_FIELD_PATTERNS = [
  /```/,
  /<script\b/i,
  /\b(?:eval|Function|require|importScripts|fetch|XMLHttpRequest|WebSocket)\s*\(/i,
  /\b(?:window|document|process|globalThis|localStorage|sessionStorage)\s*\./i,
];

const OPERATION_ALLOWED_KEYS = {
  [GRAPH_MUTATION_OPS.ADD_HYPEREDGE]: new Set(["type", "newHyperedgeId", "vertexReferences"]),
  [GRAPH_MUTATION_OPS.REMOVE_HYPEREDGE]: new Set(["type", "hyperedgeReference"]),
  [GRAPH_MUTATION_OPS.ADD_INCIDENCE]: new Set(["type", "vertexReference", "hyperedgeReference"]),
  [GRAPH_MUTATION_OPS.REMOVE_INCIDENCE]: new Set(["type", "vertexReference", "hyperedgeReference", "emptyHyperedgePolicy"]),
  [GRAPH_MUTATION_OPS.RENAME_HYPEREDGE]: new Set(["type", "hyperedgeReference", "newHyperedgeId"]),
  [GRAPH_MUTATION_OPS.RENAME_VERTEX]: new Set(["type", "vertexReference", "newVertexId"]),
  [GRAPH_MUTATION_OPS.REMOVE_VERTEX_GLOBAL]: new Set(["type", "vertexReference", "emptyHyperedgePolicy"]),
  [GRAPH_MUTATION_OPS.SET_HYPEREDGE_WEIGHT]: new Set(["type", "hyperedgeReference", "weight"]),
  [GRAPH_MUTATION_OPS.SET_HYPEREDGE_TIME]: new Set(["type", "hyperedgeReference", "time"]),
  [GRAPH_MUTATION_OPS.SET_HYPEREDGE_ATTRIBUTE]: new Set(["type", "hyperedgeReference", "key", "value"]),
  [GRAPH_MUTATION_OPS.REMOVE_HYPEREDGE_ATTRIBUTE]: new Set(["type", "hyperedgeReference", "key"]),
  [GRAPH_MUTATION_OPS.CLEAR_GRAPH]: new Set(["type"]),
  [GRAPH_MUTATION_OPS.UNDO_LAST_MUTATION]: new Set(["type"]),
};

const COMPACT_TRANSPORT_OPERATION_KEYS = new Set([
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
]);

function parseDraft(rawResponse) {
  if (rawResponse && typeof rawResponse === "object" && !Array.isArray(rawResponse)) {
    return { data: rawResponse, extracted: false };
  }
  let data;
  let extracted = false;
  try {
    if (typeof rawResponse !== "string" || !rawResponse.trim()) throw new Error("empty");
    data = JSON.parse(rawResponse.trim());
  } catch {
    data = extractFirstJsonObject(rawResponse);
    extracted = Boolean(data);
  }
  return { data, extracted };
}

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function hasExecutableString(value) {
  if (typeof value === "string") {
    return EXECUTABLE_FIELD_PATTERNS.some(pattern => pattern.test(value));
  }
  if (Array.isArray(value)) return value.some(hasExecutableString);
  if (isPlainObject(value)) return Object.values(value).some(hasExecutableString);
  return false;
}

function isJsonSerializable(value) {
  try {
    JSON.stringify(value);
    return typeof value !== "function" && typeof value !== "symbol" && typeof value !== "undefined";
  } catch {
    return false;
  }
}

function textTooLong(value, limit) {
  return typeof value === "string" && value.length > limit;
}

function checkUnknownKeys(value, allowed, path, errors) {
  for (const key of Object.keys(value ?? {})) {
    if (!allowed.has(key)) errors.push(`${path}.${key} is not allowed.`);
  }
}

function compactFieldHasValue(key, value) {
  if (value == null) return false;
  if (key === "vertexReferences" && Array.isArray(value) && value.length === 0) return false;
  return true;
}

function checkUnknownOperationKeys(operation, allowed, path, errors) {
  for (const [key, value] of Object.entries(operation ?? {})) {
    if (allowed.has(key)) continue;
    if (COMPACT_TRANSPORT_OPERATION_KEYS.has(key) && !compactFieldHasValue(key, value)) continue;
    errors.push(`${path}.${key} is not allowed.`);
  }
}

function requireString(value, path, errors, limit = GRAPH_MUTATION_DRAFT_LIMITS.maxIdentifierChars) {
  if (typeof value !== "string" || !value.trim()) {
    errors.push(`${path} must be a non-empty string.`);
    return;
  }
  if (value.length > limit) errors.push(`${path} is too long.`);
}

function validateReference(reference, path, expectedEntityType, errors) {
  if (!isPlainObject(reference)) {
    errors.push(`${path} must be an entity reference object.`);
    return;
  }
  checkUnknownKeys(reference, REFERENCE_KEYS, path, errors);
  if (!GRAPH_MUTATION_DRAFT_ENTITY_TYPES.includes(reference.entityType)) errors.push(`${path}.entityType is not supported.`);
  if (expectedEntityType && reference.entityType !== expectedEntityType) errors.push(`${path}.entityType must be ${expectedEntityType}.`);
  if (!GRAPH_MUTATION_DRAFT_REFERENCE_KINDS.includes(reference.referenceKind)) errors.push(`${path}.referenceKind is not supported.`);
  requireString(reference.surfaceText, `${path}.surfaceText`, errors, GRAPH_MUTATION_DRAFT_LIMITS.maxReferenceSurfaceTextChars);
}

function validateEmptyPolicy(value, path, errors) {
  if (!EMPTY_POLICY_VALUES.has(value)) errors.push(`${path} must be ask, keep_empty, or remove_empty.`);
}

function validateOperation(operation, index, errors) {
  const path = `operations[${index}]`;
  if (!isPlainObject(operation)) {
    errors.push(`${path} must be an object.`);
    return;
  }
  const type = operation.type;
  if (!GRAPH_MUTATION_DRAFT_SUPPORTED_OPS.includes(type)) {
    errors.push(`${path}.type is not supported.`);
    return;
  }
  checkUnknownOperationKeys(operation, OPERATION_ALLOWED_KEYS[type], path, errors);

  if (type === GRAPH_MUTATION_OPS.ADD_HYPEREDGE) {
    requireString(operation.newHyperedgeId, `${path}.newHyperedgeId`, errors);
    if (!Array.isArray(operation.vertexReferences) || operation.vertexReferences.length === 0) {
      errors.push(`${path}.vertexReferences must be a non-empty array.`);
    }
    for (const [refIndex, ref] of (operation.vertexReferences ?? []).entries()) {
      validateReference(ref, `${path}.vertexReferences[${refIndex}]`, "vertex", errors);
    }
  }
  if (type === GRAPH_MUTATION_OPS.REMOVE_HYPEREDGE) {
    validateReference(operation.hyperedgeReference, `${path}.hyperedgeReference`, "hyperedge", errors);
  }
  if (type === GRAPH_MUTATION_OPS.ADD_INCIDENCE) {
    validateReference(operation.vertexReference, `${path}.vertexReference`, "vertex", errors);
    validateReference(operation.hyperedgeReference, `${path}.hyperedgeReference`, "hyperedge", errors);
  }
  if (type === GRAPH_MUTATION_OPS.REMOVE_INCIDENCE) {
    validateReference(operation.vertexReference, `${path}.vertexReference`, "vertex", errors);
    validateReference(operation.hyperedgeReference, `${path}.hyperedgeReference`, "hyperedge", errors);
    validateEmptyPolicy(operation.emptyHyperedgePolicy, `${path}.emptyHyperedgePolicy`, errors);
  }
  if (type === GRAPH_MUTATION_OPS.RENAME_HYPEREDGE) {
    validateReference(operation.hyperedgeReference, `${path}.hyperedgeReference`, "hyperedge", errors);
    requireString(operation.newHyperedgeId, `${path}.newHyperedgeId`, errors);
  }
  if (type === GRAPH_MUTATION_OPS.RENAME_VERTEX) {
    validateReference(operation.vertexReference, `${path}.vertexReference`, "vertex", errors);
    requireString(operation.newVertexId, `${path}.newVertexId`, errors);
  }
  if (type === GRAPH_MUTATION_OPS.REMOVE_VERTEX_GLOBAL) {
    validateReference(operation.vertexReference, `${path}.vertexReference`, "vertex", errors);
    validateEmptyPolicy(operation.emptyHyperedgePolicy, `${path}.emptyHyperedgePolicy`, errors);
  }
  if (type === GRAPH_MUTATION_OPS.SET_HYPEREDGE_WEIGHT) {
    validateReference(operation.hyperedgeReference, `${path}.hyperedgeReference`, "hyperedge", errors);
    if (!Number.isFinite(Number(operation.weight))) errors.push(`${path}.weight must be finite.`);
  }
  if (type === GRAPH_MUTATION_OPS.SET_HYPEREDGE_TIME) {
    validateReference(operation.hyperedgeReference, `${path}.hyperedgeReference`, "hyperedge", errors);
    if (!isJsonSerializable(operation.time)) errors.push(`${path}.time must be JSON-serializable.`);
  }
  if (type === GRAPH_MUTATION_OPS.SET_HYPEREDGE_ATTRIBUTE) {
    validateReference(operation.hyperedgeReference, `${path}.hyperedgeReference`, "hyperedge", errors);
    requireString(operation.key, `${path}.key`, errors, GRAPH_MUTATION_DRAFT_LIMITS.maxAttributeKeyChars);
    if (PROTOTYPE_POLLUTION_KEYS.has(String(operation.key))) errors.push(`${path}.key is blocked.`);
    if (!isJsonSerializable(operation.value)) errors.push(`${path}.value must be JSON-serializable.`);
    if (JSON.stringify(operation.value)?.length > GRAPH_MUTATION_DRAFT_LIMITS.maxAttributeValueChars) errors.push(`${path}.value is too long.`);
  }
  if (type === GRAPH_MUTATION_OPS.REMOVE_HYPEREDGE_ATTRIBUTE) {
    validateReference(operation.hyperedgeReference, `${path}.hyperedgeReference`, "hyperedge", errors);
    requireString(operation.key, `${path}.key`, errors, GRAPH_MUTATION_DRAFT_LIMITS.maxAttributeKeyChars);
    if (PROTOTYPE_POLLUTION_KEYS.has(String(operation.key))) errors.push(`${path}.key is blocked.`);
  }
}

export function draftValidationStatus(validation, repaired = false) {
  if (validation?.ok) return repaired ? "repaired" : "valid";
  return validation?.data ? "invalid" : "invalid_json";
}

export function validateGraphMutationDraft(rawResponse) {
  const errors = [];
  const { data, extracted } = parseDraft(rawResponse);
  if (!isPlainObject(data)) {
    return {
      ok: false,
      data: null,
      extracted,
      errors: ["Response must be one JSON object."],
      message: "The local model did not return a valid GraphMutationDraft JSON object.",
    };
  }

  checkUnknownKeys(data, TOP_LEVEL_KEYS, "draft", errors);
  for (const key of TOP_LEVEL_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(data, key)) errors.push(`draft.${key} is required.`);
  }

  if (data.task !== GRAPH_MUTATION_DRAFT_TASK) errors.push(`draft.task must be ${GRAPH_MUTATION_DRAFT_TASK}.`);
  if (!GRAPH_MUTATION_DRAFT_CLASSIFICATIONS.includes(data.classification)) errors.push("draft.classification is not supported.");
  if (!GRAPH_MUTATION_DRAFT_CONFIDENCE.includes(data.confidence)) errors.push("draft.confidence is not supported.");
  if (typeof data.intentSummary !== "string") errors.push("draft.intentSummary must be a string.");
  if (textTooLong(data.intentSummary, GRAPH_MUTATION_DRAFT_LIMITS.maxIntentSummaryChars)) errors.push("draft.intentSummary is too long.");
  if (typeof data.acknowledgement !== "string") errors.push("draft.acknowledgement must be a string.");
  if (textTooLong(data.acknowledgement, GRAPH_MUTATION_DRAFT_LIMITS.maxAcknowledgementChars)) errors.push("draft.acknowledgement is too long.");
  if (typeof data.previewOnly !== "boolean") errors.push("draft.previewOnly must be a boolean.");
  if (data.clarificationQuestion !== null && typeof data.clarificationQuestion !== "string") errors.push("draft.clarificationQuestion must be a string or null.");
  if (textTooLong(data.clarificationQuestion, GRAPH_MUTATION_DRAFT_LIMITS.maxClarificationChars)) errors.push("draft.clarificationQuestion is too long.");
  if (!isPlainObject(data.correction)) {
    errors.push("draft.correction must be an object.");
  } else {
    checkUnknownKeys(data.correction, CORRECTION_KEYS, "draft.correction", errors);
    if (typeof data.correction.isCorrection !== "boolean") errors.push("draft.correction.isCorrection must be a boolean.");
    if (typeof data.correction.replacePendingPlan !== "boolean") errors.push("draft.correction.replacePendingPlan must be a boolean.");
    if (data.correction.replacePendingPlan && !data.correction.isCorrection) {
      errors.push("draft.correction.replacePendingPlan requires isCorrection.");
    }
  }

  if (!Array.isArray(data.operations)) {
    errors.push("draft.operations must be an array.");
  } else {
    if (data.operations.length > GRAPH_MUTATION_DRAFT_LIMITS.maxOperations) errors.push("draft.operations has too many operations.");
    data.operations.forEach((operation, index) => validateOperation(operation, index, errors));
  }

  if (data.classification === "mutation" && (!Array.isArray(data.operations) || data.operations.length === 0)) {
    errors.push("mutation drafts require at least one operation.");
  }
  if (data.classification === "clarification" && !String(data.clarificationQuestion ?? "").trim()) {
    errors.push("clarification drafts require clarificationQuestion.");
  }
  if (["not_mutation", "unsupported", "clarification"].includes(data.classification) && Array.isArray(data.operations) && data.operations.length > 0) {
    errors.push(`${data.classification} drafts must not include mutation operations.`);
  }
  if (data.previewOnly && data.classification !== "mutation") {
    errors.push("previewOnly is meaningful only for mutation drafts.");
  }
  if (hasExecutableString(data)) errors.push("draft contains executable-looking code text.");

  return {
    ok: errors.length === 0,
    data,
    extracted,
    errors,
    message: errors.length
      ? `GraphMutationDraft failed validation: ${errors.join("; ")}`
      : "",
  };
}
