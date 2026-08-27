function describeIdentifierValue(value) {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value;
}

/**
 * Validate structured graph identifiers without rewriting string payload.
 * Finite numeric source identifiers remain supported and normalize to the
 * string form used by sparse imports (for example, 0 and "0" both denote
 * "0"). Other value types are rejected before JavaScript can coerce them into
 * accidental IDs such as "[object Object]".
 */
export function normalizeGraphIdentifier(value, { path = "identifier" } = {}) {
  if (typeof value === "string") {
    if (!value.trim()) {
      throw new Error(`${path} must be a non-empty string or finite number identifier; received blank string`);
    }
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`${path} must be a finite number identifier; received ${String(value)}`);
    }
    return String(value);
  }
  throw new Error(`${path} must be a string or finite number identifier; received ${describeIdentifierValue(value)}`);
}

/** Preserve the lexical cleanup historically applied at raw/canonical text boundaries. */
export function normalizeTextGraphIdentifier(value, { path = "identifier" } = {}) {
  if (typeof value !== "string") return normalizeGraphIdentifier(value, { path });
  return normalizeGraphIdentifier(value.trim().replace(/^["']|["']$/g, ""), { path });
}

export function normalizeUniqueGraphIdentifiers(values, {
  pathForIndex = index => `identifiers[${index}]`,
} = {}) {
  const seen = new Map();
  return values.map((value, index) => {
    const path = pathForIndex(index);
    const identifier = normalizeGraphIdentifier(value, { path });
    if (seen.has(identifier)) {
      throw new Error(`${path} duplicates ${seen.get(identifier)}: "${identifier}"`);
    }
    seen.set(identifier, path);
    return identifier;
  });
}

export function hasGraphIdentifier(value) {
  return value !== null && value !== undefined;
}

export function graphIdentifiersEqual(left, right) {
  if (!hasGraphIdentifier(left) || !hasGraphIdentifier(right)) return false;
  if (left === right) return true;
  return normalizeGraphIdentifier(left) === normalizeGraphIdentifier(right);
}

export function createGraphIdentifierMap() {
  return new Map();
}

export function setGraphIdentifierValue(map, identifier, value) {
  map.set(normalizeGraphIdentifier(identifier), value);
  return value;
}

export function getGraphIdentifierValue(map, identifier) {
  if (typeof identifier === "string" && map.has(identifier)) return map.get(identifier);
  return map.get(normalizeGraphIdentifier(identifier));
}
