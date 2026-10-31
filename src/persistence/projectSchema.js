import { boundedCopy, StorageFault } from "./storageSafety.js";

export const APP_NAMESPACE = "hypergraph-converter-studio";
export const PROJECT_DATABASE = "hypergraph-studio-projects";
export const PROJECT_DATABASE_VERSION = 4;
export const PROJECT_SCHEMA_VERSION = 1;
export const PROJECT_LIMITS = Object.freeze({ bytes: 256 * 1024, projects: 80, lineage: 32, quarantine: 40 });
export const isProjectId = value => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
export function newProjectId() {
  const id = globalThis.crypto?.randomUUID?.();
  if (!isProjectId(id)) throw new StorageFault("UNAVAILABLE", "Secure project identity is unavailable.");
  return id;
}
const keys = ["appNamespace", "schemaVersion", "projectId", "revision", "previousRevision", "createdAt", "updatedAt", "deleted", "tombstone", "storageState", "migrationLineage"];
const timestamp = value => typeof value === "string" && value.length <= 32 && !Number.isNaN(Date.parse(value));
export function validateProject(input) {
  const value = boundedCopy(input, { bytes: PROJECT_LIMITS.bytes, depth: 5, nodes: 600, array: PROJECT_LIMITS.lineage, string: 240 });
  if (value?.schemaVersion !== PROJECT_SCHEMA_VERSION) throw new StorageFault("INCOMPATIBLE", "Project schema is incompatible; original data is preserved.", true);
  if (!value || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))
    || value.appNamespace !== APP_NAMESPACE || !isProjectId(value.projectId)
    || !Number.isSafeInteger(value.revision) || value.revision < 1
    || value.previousRevision !== value.revision - 1 || !timestamp(value.createdAt) || !timestamp(value.updatedAt)
    || typeof value.deleted !== "boolean" || value.storageState !== "committed" || !Array.isArray(value.migrationLineage)
    || value.migrationLineage.length > PROJECT_LIMITS.lineage) throw new StorageFault("CORRUPT", "Project metadata is invalid; original data is preserved.", true);
  for (const entry of value.migrationLineage) {
    if (!entry || Object.keys(entry).sort().join() !== "at,result,source,sourceVersion" || typeof entry.source !== "string"
      || entry.source.length > 160 || ![0, 1, 2, 3].includes(entry.sourceVersion)
      || entry.result !== "COPIED_VALIDATED_PUBLISHED" || !timestamp(entry.at)) throw new StorageFault("CORRUPT", "Migration lineage is invalid.", true);
  }
  const tombstone = value.tombstone;
  if (value.deleted ? !tombstone || Object.keys(tombstone).sort().join() !== "deletedAt,revision" || tombstone.revision !== value.revision || !timestamp(tombstone.deletedAt) : tombstone !== null) throw new StorageFault("CORRUPT", "Project tombstone is invalid.", true);
  return Object.freeze(value);
}

export function initialProject(projectId = newProjectId(), now = new Date().toISOString()) {
  return validateProject({ appNamespace: APP_NAMESPACE, schemaVersion: PROJECT_SCHEMA_VERSION, projectId,
    revision: 1, previousRevision: 0, createdAt: now, updatedAt: now, deleted: false, tombstone: null,
    storageState: "committed", migrationLineage: [] });
}

export function nextProject(current, expectedRevision, patch = {}) {
  const value = validateProject(current);
  if (value.deleted) throw new StorageFault("DELETED", "Project was deleted; stale writes cannot recreate it.", true);
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision !== value.revision) throw new StorageFault("CONFLICT", "Saved project changed in another owner. Local changes are not saved; reload to review the current revision.", true);
  if (value.revision === Number.MAX_SAFE_INTEGER) throw new StorageFault("LIMIT", "Project revision limit reached.", true);
  return validateProject({ ...value, ...patch, revision: value.revision + 1, previousRevision: value.revision, updatedAt: new Date().toISOString() });
}
