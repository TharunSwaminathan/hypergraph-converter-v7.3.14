import { CANDY_ERROR_CODES, failCandy } from "./errorClasses.js";

export function requirePlainObject(value, label, code = CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA) {
  if (value == null || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    failCandy(code, `${label} must be a plain object.`, { label });
  }
  return value;
}

export function requireExactKeys(object, required, optional, label, code = CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA) {
  const allowed = new Set([...required, ...optional]);
  const missing = required.filter(key => !Object.hasOwn(object, key));
  const unknown = Object.keys(object).filter(key => !allowed.has(key));
  if (missing.length || unknown.length) {
    failCandy(code, `${label} has missing or unknown fields.`, { missing, unknown });
  }
}

export function requireNonEmptyString(value, label, code = CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA) {
  if (typeof value !== "string" || !value.trim()) {
    failCandy(code, `${label} must be a non-empty string.`, { label });
  }
  return value;
}

export function requireNonNegativeSafeInteger(value, label, code = CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA) {
  if (!Number.isSafeInteger(value) || value < 0) {
    failCandy(code, `${label} must be a non-negative safe integer.`, { label, value });
  }
  return value;
}

export function requireBoolean(value, label, code = CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA) {
  if (typeof value !== "boolean") {
    failCandy(code, `${label} must be a boolean.`, { label, value });
  }
  return value;
}

export function validateArtifactRef(value, label = "artifactRef", code = CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA) {
  requirePlainObject(value, label, code);
  requireExactKeys(value, ["id", "mediaType"], ["byteLength"], label, code);
  requireNonEmptyString(value.id, `${label}.id`, code);
  if (!/^sha256:[a-f0-9]{64}$/.test(value.id)) {
    failCandy(code, `${label}.id must be a lowercase SHA-256 artifact ID.`, { label, id: value.id });
  }
  requireNonEmptyString(value.mediaType, `${label}.mediaType`, code);
  if (Object.hasOwn(value, "byteLength")) requireNonNegativeSafeInteger(value.byteLength, `${label}.byteLength`, code);
  return Object.freeze({ ...value });
}

export function validateGraphRef(value, label = "graphRef", code = CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA) {
  requirePlainObject(value, label, code);
  requireExactKeys(value, ["graphId", "graphVersion"], [], label, code);
  requireNonEmptyString(value.graphId, `${label}.graphId`, code);
  requireNonNegativeSafeInteger(value.graphVersion, `${label}.graphVersion`, code);
  return Object.freeze({ graphId: value.graphId, graphVersion: value.graphVersion });
}
