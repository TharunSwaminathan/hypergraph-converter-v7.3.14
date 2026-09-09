import { CANDY_SCHEMA_VERSIONS } from "../contracts/schemaVersions.js";
import { CANDY_ERROR_CODES, failCandy } from "../contracts/errorClasses.js";

function canonicalVertexKey(id) {
  if (typeof id === "string") {
    if (!id.length) failCandy(CANDY_ERROR_CODES.INVALID_VERTEX, "Vertex IDs cannot be empty strings.");
    return `string:${id.length}:${id}`;
  }
  if (typeof id === "number" && Number.isSafeInteger(id)) {
    return `number:${id < 0 ? "-" : "+"}:${String(Math.abs(id)).padStart(16, "0")}`;
  }
  failCandy(CANDY_ERROR_CODES.INVALID_VERTEX, "Vertex IDs must be non-empty strings or safe integers.", { idType: typeof id });
}

export function createVertexMapping(vertexIds) {
  if (!Array.isArray(vertexIds)) failCandy(CANDY_ERROR_CODES.INVALID_VERTEX, "vertices must be an array.");
  const keyed = vertexIds.map(canonicalId => ({ canonicalId, key: canonicalVertexKey(canonicalId) }));
  const seen = new Set();
  for (const entry of keyed) {
    if (seen.has(entry.key)) failCandy(CANDY_ERROR_CODES.INVALID_VERTEX, "Duplicate canonical vertex ID.", { canonicalId: entry.canonicalId });
    seen.add(entry.key);
  }
  keyed.sort((left, right) => (left.key < right.key ? -1 : left.key > right.key ? 1 : 0));
  const entries = keyed.map((entry, nativeIndex) => Object.freeze({ ...entry, nativeIndex }));
  const indexByKey = new Map(entries.map(entry => [entry.key, entry.nativeIndex]));
  return Object.freeze({
    schemaVersion: CANDY_SCHEMA_VERSIONS.VERTEX_MAPPING,
    ordering: "CANONICAL_TYPE_TAG_THEN_CODEPOINT_V1",
    entries: Object.freeze(entries),
    toNative(canonicalId) {
      const key = canonicalVertexKey(canonicalId);
      if (!indexByKey.has(key)) failCandy(CANDY_ERROR_CODES.INVALID_VERTEX, "Unknown canonical vertex ID.", { canonicalId });
      return indexByKey.get(key);
    },
    toCanonical(nativeIndex) {
      if (!Number.isInteger(nativeIndex) || nativeIndex < 0 || nativeIndex >= entries.length) failCandy(CANDY_ERROR_CODES.INVALID_VERTEX, "Unknown native vertex index.", { nativeIndex });
      return entries[nativeIndex].canonicalId;
    },
  });
}
