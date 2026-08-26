function describeIdentifierValue(value) {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value;
}

/**
 * Canonical graph identifiers are non-empty strings. Finite numeric source
 * identifiers remain supported and normalize to the same string form already
 * used by JSON and sparse-matrix imports (for example, 0 and "0" both become
 * "0"). Other value types are rejected before JavaScript can coerce them into
 * accidental IDs such as "[object Object]".
 */
export function normalizeGraphIdentifier(value, { path = "identifier" } = {}) {
  if (typeof value === "string") {
    const normalized = value.trim().replace(/^["']|["']$/g, "");
    if (!normalized) {
      throw new Error(`${path} must be a non-empty string or finite number identifier; received blank string`);
    }
    return normalized;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`${path} must be a finite number identifier; received ${String(value)}`);
    }
    return String(value);
  }
  throw new Error(`${path} must be a string or finite number identifier; received ${describeIdentifierValue(value)}`);
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
