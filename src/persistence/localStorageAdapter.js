import { APP_NAMESPACE } from "./projectSchema.js";
import { boundedCopy, parseBoundedJSON, StorageFault, failure, utf8Bytes } from "./storageSafety.js";

export function browserLocalStorage() {
  try { return globalThis.localStorage; } catch { return null; }
}

// Value and migration lineage are published together in one atomic setItem.
// Legacy keys are input-only until an explicit clear operation is requested.
export function createLocalStorageAdapter({ key, legacyKeys, limits, validate, legacyVersion, storage = browserLocalStorage() }) {
  function checkedEnvelope(raw) {
    const envelope = parseBoundedJSON(raw, { ...limits, bytes: limits.bytes + 4096, depth: limits.depth + 3, nodes: limits.nodes + 128 });
    if (envelope?.schemaVersion !== 1) throw new StorageFault("INCOMPATIBLE", "Stored adapter schema is incompatible; original data is preserved.", true);
    if (envelope.appNamespace !== APP_NAMESPACE || typeof envelope.deleted !== "boolean" || !Number.isSafeInteger(envelope.revision) || envelope.revision < 1
      || Object.keys(envelope).sort().join() !== "appNamespace,deleted,migrationLineage,revision,schemaVersion,value"
      || (envelope.deleted && envelope.value !== null) || !Array.isArray(envelope.migrationLineage) || envelope.migrationLineage.length > 8) throw new StorageFault("CORRUPT", "Stored adapter metadata is invalid.", true);
    for (const entry of envelope.migrationLineage) {
      if (!entry || Object.keys(entry).sort().join() !== "at,result,source,sourceVersion" || !legacyKeys.includes(entry.source)
        || ![0, 1, 2, 3].includes(entry.sourceVersion) || entry.result !== "COPIED_VALIDATED_PUBLISHED" || typeof entry.at !== "string"
        || entry.at.length > 32 || Number.isNaN(Date.parse(entry.at))) throw new StorageFault("CORRUPT", "Stored migration lineage is invalid.", true);
    }
    return { ...envelope, value: envelope.deleted ? null : validate(envelope.value) };
  }
  function quarantine(source, error) {
    // No raw sensitive payload is duplicated. The original remains at source.
    try { storage?.setItem(`${key}.quarantine`, JSON.stringify({ schemaVersion: 1, source, code: error.code ?? "CORRUPT", original: "preserved", at: new Date().toISOString() })); } catch { /* Original retention does not depend on writing a descriptor. */ }
  }
  function current() {
    if (!storage) throw new StorageFault("UNAVAILABLE", "Browser settings/profile storage unavailable; changes are not saved.");
    const raw = storage.getItem(key);
    return raw == null ? null : checkedEnvelope(raw);
  }
  function write(value, previous, lineage = []) {
    const revision = (previous?.revision ?? 0) + 1;
    if (!Number.isSafeInteger(revision)) throw new StorageFault("LIMIT", "Storage revision limit reached.", true);
    const envelope = { appNamespace: APP_NAMESPACE, schemaVersion: 1, revision, deleted: false, value: validate(value), migrationLineage: lineage };
    const encoded = JSON.stringify(envelope);
    if (utf8Bytes(encoded) > limits.bytes + 4096) throw new StorageFault("LIMIT", "Adapter record exceeds its byte limit.", true);
    storage.setItem(key, encoded);
    return { ok: true, saved: true, status: "committed", revision, value: envelope.value, migrationLineage: lineage };
  }
  return Object.freeze({
    load(fallback) {
      let source = key;
      try {
        const present = current();
        if (present) return { ok: true, saved: true, status: "committed", revision: present.revision, value: present.deleted ? fallback : present.value, migrationLineage: present.migrationLineage, deleted: present.deleted };
        for (const legacy of legacyKeys) {
          source = legacy;
          const raw = storage.getItem(legacy);
          if (raw == null) continue;
          const input = parseBoundedJSON(raw, limits), version = legacyVersion(input);
          const value = validate(input);
          return write(value, null, [{ source: legacy, sourceVersion: version, result: "COPIED_VALIDATED_PUBLISHED", at: new Date().toISOString() }]);
        }
        return { ok: true, saved: false, status: "clean", revision: 0, value: fallback, migrationLineage: [] };
      } catch (error) { quarantine(source, error); return { ...failure(error), value: fallback, recovery: { source, originalPreserved: true } }; }
    },
    save(value) {
      try {
        // A malformed/future current record is never replaced by defaults.
        const previous = current();
        if (!previous) {
          const migrated = this.load(null);
          if (!migrated.ok) return migrated;
        }
        const latest = current();
        if (latest?.deleted) throw new StorageFault("DELETED", "Stored application data was cleared. Reload before saving.", true);
        return write(boundedCopy(value, limits), latest, latest?.migrationLineage ?? []);
      } catch (error) { return failure(error); }
    },
    clear() {
      try {
        if (!storage) throw new StorageFault("UNAVAILABLE", "Browser storage unavailable.");
        // Publish a deletion marker first. Legacy/current fallback is disabled
        // even if a later remove fails. Same-origin localStorage is not CAS.
        const raw = storage.getItem(key);
        let revision = 1;
        try { revision = raw == null ? 1 : checkedEnvelope(raw).revision + 1; } catch { /* Explicit clear can replace corrupt data, never ordinary save. */ }
        storage.setItem(key, JSON.stringify({ appNamespace: APP_NAMESPACE, schemaVersion: 1, revision, deleted: true, value: null, migrationLineage: [] }));
        for (const legacy of legacyKeys) storage.removeItem(legacy);
        storage.removeItem(`${key}.quarantine`);
        return { ok: true, saved: true, status: "committed", revision, deleted: true };
      } catch (error) { return failure(error); }
    },
  });
}
