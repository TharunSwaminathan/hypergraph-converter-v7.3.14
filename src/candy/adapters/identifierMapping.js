import { CANDY_ERROR_CODES, failCandy } from "../contracts/errorClasses.js";

export function canonicalIdentifierKey(id, label = "identifier") {
  if (typeof id === "string") {
    if (id.length > 512) failCandy(CANDY_ERROR_CODES.RESOURCE_LIMIT, "Semantic identifiers are limited to 512 characters.");
    if (!id.trim()) failCandy(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA, `${label} cannot be blank.`);
    return `string:${id.length}:${id}`;
  }
  if (typeof id === "number" && Number.isSafeInteger(id)) {
    const magnitude = String(Math.abs(id)).padStart(16, "0");
    return `number:${id < 0 ? "-" : "+"}:${magnitude}`;
  }
  failCandy(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA, `${label} must be a non-empty string or safe integer.`, {
    valueType: typeof id,
  });
}

export function createCanonicalIdentifierMapping(ids, { schemaVersion, label }) {
  if (!Array.isArray(ids)) failCandy(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA, `${label} IDs must be an array.`);
  const keyed = ids.map(canonicalId => ({
    canonicalId,
    key: canonicalIdentifierKey(canonicalId, `${label} ID`),
  }));
  const seen = new Set();
  for (const entry of keyed) {
    if (seen.has(entry.key)) {
      failCandy(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA, `Duplicate ${label} ID.`, { canonicalId: entry.canonicalId });
    }
    seen.add(entry.key);
  }
  keyed.sort((left, right) => (left.key < right.key ? -1 : left.key > right.key ? 1 : 0));
  const entries = keyed.map((entry, nativeIndex) => Object.freeze({ ...entry, nativeIndex }));
  const indexByKey = new Map(entries.map(entry => [entry.key, entry.nativeIndex]));
  return Object.freeze({
    schemaVersion,
    ordering: "CANONICAL_TYPE_TAG_THEN_CODEPOINT_V1",
    entries: Object.freeze(entries),
    toNative(canonicalId) {
      const key = canonicalIdentifierKey(canonicalId, `${label} ID`);
      if (!indexByKey.has(key)) {
        failCandy(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA, `Unknown ${label} ID.`, { canonicalId });
      }
      return indexByKey.get(key);
    },
    toCanonical(nativeIndex) {
      if (!Number.isInteger(nativeIndex) || nativeIndex < 0 || nativeIndex >= entries.length) {
        failCandy(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA, `Unknown native ${label} index.`, { nativeIndex });
      }
      return entries[nativeIndex].canonicalId;
    },
  });
}
