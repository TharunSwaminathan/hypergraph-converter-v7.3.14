import { APP_NAMESPACE, PROJECT_DATABASE, PROJECT_LIMITS, initialProject, newProjectId, nextProject, validateProject, isProjectId } from "./projectSchema.js";
import { normalizeThreadRecord } from "./threadStateSchema.js";
import { boundedCopy, fault, StorageFault } from "./storageSafety.js";

const STORES = ["projects", "threads", "meta", "migrations", "quarantine"];
const checkId = id => { if (!isProjectId(id)) throw new StorageFault("CORRUPT", "Invalid project identity.", true); };
export function createProjectStore(indexedDB = globalThis.indexedDB, databaseName = PROJECT_DATABASE) {
  let opening = null, blocked = null;
  const listeners = new Set();
  const notify = error => { blocked = error; for (const listener of listeners) listener(error); };
  async function database() {
    if (blocked) throw blocked;
    if (!indexedDB) throw new StorageFault("UNAVAILABLE", "Browser project storage unavailable; this session is not saved.");
    if (!opening) {
      const pending = new Promise((resolve, reject) => {
        let abandoned = false, request;
        try { request = indexedDB.open(databaseName, 1); } catch (error) { reject(fault(error)); return; }
        request.onupgradeneeded = () => { for (const name of STORES) if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, { keyPath: name === "projects" || name === "threads" ? "projectId" : "id" }); };
        request.onerror = () => reject(fault(request.error));
        request.onblocked = () => { abandoned = true; reject(new StorageFault("BLOCKED", "Project storage is blocked. Close older tabs, then retry.")); };
        request.onsuccess = () => {
          const db = request.result;
          if (abandoned) { db.close(); return; }
          db.onversionchange = () => { db.close(); opening = null; notify(new StorageFault("VERSION_CHANGED", "Storage version changed. Reload before writing.", true)); };
          db.onclose = () => { opening = null; notify(new StorageFault("UNAVAILABLE", "Project storage closed unexpectedly; changes are not saved.")); };
          resolve(db);
        };
      });
      opening = pending;
      pending.catch(() => { if (opening === pending) opening = null; });
    }
    return opening;
  }
  async function transaction(names, mode, perform) {
    const db = await database();
    return new Promise((resolve, reject) => {
      let tx, result, failure;
      const abort = error => { failure = error; try { tx.abort(); } catch { reject(fault(error)); } };
      try {
        tx = db.transaction(names, mode);
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => { failure ??= tx.error; };
        tx.onabort = () => reject(fault(failure ?? tx.error ?? new DOMException("Transaction aborted", "AbortError")));
        perform(tx, value => { result = value; }, abort);
      } catch (error) { if (tx) abort(error); else reject(fault(error)); }
    });
  }
  const read = (store, id) => transaction([store], "readonly", (tx, done) => { const req = tx.objectStore(store).get(id); req.onsuccess = () => done(req.result); });
  async function mutate(projectId, expectedRevision, record, migration, deleting = false) {
    checkId(projectId);
    const safe = record === undefined ? undefined : normalizeThreadRecord(record);
    const lineage = migration && boundedCopy(migration, { bytes: 2048, depth: 2, nodes: 12, string: 160 });
    return transaction(["projects", "threads", "migrations"], "readwrite", (tx, done, abort) => {
      const projects = tx.objectStore("projects"), request = projects.get(projectId);
      request.onsuccess = () => {
        try {
          if (!request.result) throw new StorageFault("CONFLICT", "Project no longer exists; stale writes cannot create it.", true);
          let next = nextProject(request.result, expectedRevision, lineage ? { migrationLineage: [...request.result.migrationLineage, lineage] } : {});
          if (deleting) next = validateProject({ ...next, deleted: true, tombstone: { revision: next.revision, deletedAt: next.updatedAt } });
          projects.put(next);
          if (deleting) tx.objectStore("threads").delete(projectId);
          else if (safe) tx.objectStore("threads").put({ projectId, record: safe });
          if (lineage) tx.objectStore("migrations").put({ id: "legacy-thread", schemaVersion: 1, projectId, ...lineage });
          done(Object.freeze({ ok: true, saved: true, status: "committed", projectId, revision: next.revision, manifest: next }));
        } catch (error) { abort(error); }
      };
    });
  }
  return Object.freeze({
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    async retry() { if (blocked?.readOnly) throw blocked; blocked = null; await database(); },
    async close() { const db = await opening?.catch(() => null); db?.close(); opening = null; },
    async defaultProject() {
      return transaction(["projects", "meta"], "readwrite", (tx, done, abort) => {
        const meta = tx.objectStore("meta"), projects = tx.objectStore("projects"), req = meta.get("default-project");
        req.onsuccess = () => {
          try {
            if (req.result) {
              if (req.result.schemaVersion !== 1 || req.result.appNamespace !== APP_NAMESPACE || !isProjectId(req.result.projectId)
                || Object.keys(req.result).sort().join() !== "appNamespace,id,projectId,schemaVersion") throw new StorageFault("INCOMPATIBLE", "Project selection namespace/schema is invalid; records are preserved.", true);
              const current = projects.get(req.result.projectId);
              current.onsuccess = () => { try { if (!current.result) throw new StorageFault("CORRUPT", "Selected project is missing; recovery is read-only.", true); done(validateProject(current.result)); } catch (error) { abort(error); } };
            } else {
              // Never auto-create after an explicit clear; the pointer is retained
              // as a tombstone. Only a truly new namespace reaches this branch.
              const keys = projects.getAllKeys();
              keys.onsuccess = () => {
                try {
                  if (keys.result.length) throw new StorageFault("CORRUPT", "Project selection missing; existing records are preserved.", true);
                  const project = initialProject(); projects.add(project);
                  meta.add({ id: "default-project", schemaVersion: 1, appNamespace: APP_NAMESPACE, projectId: project.projectId }); done(project);
                } catch (error) { abort(error); }
              };
            }
          } catch (error) { abort(error); }
        };
      });
    },
    async createProject(projectId = newProjectId()) {
      const project = initialProject(projectId);
      return transaction(["projects"], "readwrite", (tx, done, abort) => {
        const store = tx.objectStore("projects"), keys = store.getAllKeys();
        keys.onsuccess = () => { if (keys.result.length >= PROJECT_LIMITS.projects) abort(new StorageFault("LIMIT", "Project retention limit reached.", true)); else { store.add(project); done(project); } };
      });
    },
    async load(projectId) {
      checkId(projectId);
      return transaction(["projects", "threads"], "readonly", (tx, done, abort) => {
        const req = tx.objectStore("projects").get(projectId);
        req.onsuccess = () => {
          try {
            if (!req.result) throw new StorageFault("CONFLICT", "Project is missing.", true);
            const manifest = validateProject(req.result), thread = tx.objectStore("threads").get(projectId);
            thread.onsuccess = () => {
              try {
                if (!manifest.deleted && manifest.revision > 1 && !thread.result) throw new StorageFault("CORRUPT", "Published project thread is missing; recovery is read-only.", true);
                done({ manifest, record: manifest.deleted ? null : thread.result ? normalizeThreadRecord(thread.result.record) : null });
              } catch (error) { abort(error); }
            };
          } catch (error) { abort(error); }
        };
      });
    },
    saveThread: (projectId, expectedRevision, record) => mutate(projectId, expectedRevision, record),
    publishMigration: (projectId, expectedRevision, record, lineage) => mutate(projectId, expectedRevision, record, lineage),
    deleteProject: (projectId, expectedRevision) => mutate(projectId, expectedRevision, undefined, null, true),
    migration: () => read("migrations", "legacy-thread"),
    async quarantine(source, error) {
      const entry = boundedCopy({ id: source, source, code: fault(error).code, original: "preserved in source store", at: new Date().toISOString() }, { bytes: 2048, depth: 2, nodes: 12, string: 240 });
      return transaction(["quarantine"], "readwrite", (tx, done) => {
        const store = tx.objectStore("quarantine"); store.put(entry);
        const keys = store.getAllKeys(); keys.onsuccess = () => {
          let excess = keys.result.length - PROJECT_LIMITS.quarantine;
          for (const id of keys.result) if (excess > 0 && id !== source) { store.delete(id); excess--; }
        }; done(entry);
      });
    },
    async recovery() { return read("quarantine", "legacy-thread"); },
    async clearApplicationData() {
      // Retain minimal identity/revision tombstones and the selection/migration
      // markers. Dropping the database would allow old owners to re-migrate.
      return transaction(["projects", "threads", "quarantine"], "readwrite", (tx, done, abort) => {
        const projects = tx.objectStore("projects"), req = projects.getAll();
        req.onsuccess = () => {
          try {
            for (const raw of req.result) {
              const current = validateProject(raw);
              if (!current.deleted) { const next = nextProject(current, current.revision); projects.put(validateProject({ ...next, deleted: true, migrationLineage: [], tombstone: { revision: next.revision, deletedAt: next.updatedAt } })); }
            }
            tx.objectStore("threads").clear(); tx.objectStore("quarantine").clear(); done({ ok: true, saved: true, status: "committed", scope: "project-data; identity tombstones retained" });
          } catch (error) { abort(error); }
        };
      });
    },
  });
}
