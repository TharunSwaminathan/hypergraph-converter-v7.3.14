import { CANDY_ERROR_CODES, failCandy } from "./errorClasses.js";
import { requireNonEmptyString } from "./contractValidation.js";

export function requireBoundedMotifString(value, label, code) {
  requireNonEmptyString(value, label, code);
  if (value.length > 512) failCandy(CANDY_ERROR_CODES.RESOURCE_LIMIT, `${label} exceeds 512 characters.`);
  return value;
}

// Provenance is bounded inert JSON, never executable authority. Clone it so
// callers cannot change a canonical snapshot through nested shared objects.
export function cloneBoundedMotifProvenance(value) {
  let nodes = 0;
  let characters = 0;
  const ancestors = new Set();
  const visit = (item, depth) => {
    nodes += 1;
    if (depth > 8 || nodes > 1024) failCandy(CANDY_ERROR_CODES.RESOURCE_LIMIT, "Provenance exceeds depth/node limits.");
    if (typeof item === "string") {
      characters += item.length;
      if (characters > 16384) failCandy(CANDY_ERROR_CODES.RESOURCE_LIMIT, "Provenance exceeds text limits.");
      return item;
    }
    if (item === null || typeof item === "boolean" || (typeof item === "number" && Number.isFinite(item))) return item;
    if (typeof item !== "object" || (!Array.isArray(item) && Object.getPrototypeOf(item) !== Object.prototype)
      || ancestors.has(item)) {
      failCandy(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA, "Provenance must be acyclic inert JSON.");
    }
    ancestors.add(item);
    const entries = Object.entries(item);
    if (entries.length > 1024) failCandy(CANDY_ERROR_CODES.RESOURCE_LIMIT, "Provenance exceeds entry limits.");
    const copy = Array.isArray(item) ? [] : {};
    for (const [key, child] of entries) {
      characters += key.length;
      if (characters > 16384) failCandy(CANDY_ERROR_CODES.RESOURCE_LIMIT, "Provenance exceeds text limits.");
      Object.defineProperty(copy, key, { value: visit(child, depth + 1), enumerable: true });
    }
    ancestors.delete(item);
    return Object.freeze(copy);
  };
  return visit(value, 0);
}
