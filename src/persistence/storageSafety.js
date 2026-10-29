export class StorageFault extends Error {
  constructor(code, message, readOnly = false) {
    super(message); this.name = "StorageFault"; this.code = code; this.readOnly = readOnly;
  }
}

export function fault(error) {
  if (error instanceof StorageFault) return error;
  if (error?.name === "VersionError") return new StorageFault("INCOMPATIBLE", "Database version is incompatible; original data is preserved.", true);
  if (error?.name === "ConstraintError") return new StorageFault("CONFLICT", "Storage identity already exists; the current record was preserved.", true);
  const code = error?.name === "QuotaExceededError" ? "QUOTA" : error?.name === "AbortError" ? "ABORTED" : "UNAVAILABLE";
  return new StorageFault(code, code === "QUOTA" ? "Storage quota exceeded; changes are not saved." : "Storage operation failed; changes are not saved.");
}

export function failure(error) {
  const value = fault(error);
  return Object.freeze({ ok: false, saved: false, status: value.readOnly ? "read_only" : "error", code: value.code, error: value.message });
}

export const utf8Bytes = value => new TextEncoder().encode(value).byteLength;

// Inspect bounded data before serialization. Accessors, exotic prototypes,
// cycles, non-finite numbers and prototype-mutating keys are never normalized.
export function boundedCopy(input, { bytes = 262144, depth = 12, nodes = 12000, array = 1000, string = 60000 } = {}) {
  let count = 0, textBytes = 0;
  const active = new Set();
  const limit = () => { throw new StorageFault("LIMIT", "Stored data exceeds its bounded storage limit.", true); };
  function visit(value, level) {
    if (++count > nodes || level > depth) limit();
    if (value === null || typeof value === "boolean") return value;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      if (value.length > string || value.length > bytes) limit();
      textBytes += utf8Bytes(value);
      if (textBytes > bytes) limit();
      return value;
    }
    if (!value || typeof value !== "object" || active.has(value)) throw new StorageFault("CORRUPT", "Storage requires finite, acyclic plain data.", true);
    if (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new StorageFault("CORRUPT", "Stored object has an unsupported prototype.", true);
    if (Array.isArray(value) && value.length > array) limit();
    active.add(value);
    const result = Array.isArray(value) ? [] : {};
    for (const key in value) {
      if (!Object.hasOwn(value, key)) continue;
      if (["__proto__", "prototype", "constructor"].includes(key)) throw new StorageFault("CORRUPT", "Stored object has an unsafe key.", true);
      if (key.length > 240) limit();
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.hasOwn(descriptor, "value")) throw new StorageFault("CORRUPT", "Stored accessors are not data.", true);
      textBytes += utf8Bytes(key);
      if (textBytes > bytes) limit();
      if (descriptor.value !== undefined) result[key] = visit(descriptor.value, level + 1);
    }
    active.delete(value);
    return result;
  }
  const result = visit(input, 0);
  if (utf8Bytes(JSON.stringify(result)) > bytes) limit();
  return result;
}

export function parseBoundedJSON(raw, limits) {
  if (typeof raw !== "string" || raw.length > limits.bytes || utf8Bytes(raw) > limits.bytes) throw new StorageFault("LIMIT", "Stored JSON exceeds its byte limit.", true);
  let value;
  try { value = JSON.parse(raw); } catch { throw new StorageFault("CORRUPT", "Stored JSON is malformed; original data is preserved.", true); }
  return boundedCopy(value, limits);
}
