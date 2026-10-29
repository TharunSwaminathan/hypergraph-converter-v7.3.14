import { createThreadStore } from "./threadStore.js";
import { StorageFault } from "./storageSafety.js";
import { clearStoredModelSettings } from "../agent/localModelSettings.js";
import { clearStoredParserProfiles } from "../agent/parserProfiles.js";

export async function initializeProjectThread(store, legacy = createThreadStore()) {
  const project = await store.defaultProject();
  if (project.deleted) throw new StorageFault("DELETED", "The saved project is deleted. This session is not saved.", true);
  if (await store.recovery()) throw new StorageFault("QUARANTINED", "Legacy thread needs recovery. Original data is preserved; storage is read-only.", true);
  const migrated = await store.migration();
  if (migrated) {
    if (migrated.schemaVersion !== 1 || migrated.projectId !== project.projectId || migrated.result !== "COPIED_VALIDATED_PUBLISHED"
      || !project.migrationLineage.some(entry => entry.source === migrated.source && entry.sourceVersion === migrated.sourceVersion && entry.at === migrated.at)) {
      throw new StorageFault("CORRUPT", "Migration lineage does not match this project; recovery is read-only.", true);
    }
    return store.load(project.projectId);
  }
  // The legacy reader validates and explicitly strips authority. No writes,
  // defaults or destructive migration are issued to the legacy record.
  try {
    const loaded = legacy.loadThreadWithSource ? await legacy.loadThreadWithSource() : { record: await legacy.loadThread() };
    const record = loaded?.record;
    const lineage = { source: "hypergraph-chat-threads/threads/main", sourceVersion: loaded?.sourceSchemaVersion ?? record?.schemaVersion ?? 1,
      result: "COPIED_VALIDATED_PUBLISHED", at: new Date().toISOString() };
    try {
      await store.publishMigration(project.projectId, project.revision, record ?? { schemaVersion: 1, id: "main", messages: [], summary: "", workspace: {} }, lineage);
    } catch (error) {
      // Two first mounts may race to copy the same legacy source. Only adopt a
      // completed winner; never retry a stale user edit against a new revision.
      if (error.code !== "CONFLICT" || !(await store.migration())) throw error;
    }
    return store.load(project.projectId);
  } catch (error) {
    if (!["CONFLICT", "DELETED", "QUOTA", "UNAVAILABLE", "ABORTED"].includes(error.code)) {
      await store.quarantine("legacy-thread", error).catch(() => {});
      throw new StorageFault("QUARANTINED", "Legacy thread is incompatible or corrupt. Original data is preserved; storage is read-only.", true);
    }
    throw error;
  } finally { await legacy.close?.(); }
}

// Storage foundation API, not a Resume UI. Tombstones commit first. Cross-store
// clearing is not atomic: callers receive PARTIAL if any later clear fails.
export async function clearLocalApplicationData({ store, legacy = createThreadStore(), clearSettings = clearStoredModelSettings, clearProfiles = clearStoredParserProfiles,
  clearPairing = () => globalThis.sessionStorage?.removeItem("hypergraph-studio.candy-runtime-token.session") } = {}) {
  await store.clearApplicationData();
  const results = await Promise.allSettled([legacy.clearThreads(), Promise.resolve().then(clearSettings), Promise.resolve().then(clearProfiles), Promise.resolve().then(clearPairing)]);
  await legacy.close?.();
  const incomplete = results.some(value => value.status === "rejected" || value.value?.ok === false);
  return Object.freeze({ ok: !incomplete, saved: !incomplete, status: incomplete ? "partial" : "committed", code: incomplete ? "PARTIAL" : null,
    projectTombstonesCommitted: true, scope: "application browser stores only; identity tombstones retained", externalCopiesDeleted: false });
}
