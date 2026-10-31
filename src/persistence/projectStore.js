import { APP_NAMESPACE, PROJECT_DATABASE, PROJECT_DATABASE_VERSION, PROJECT_LIMITS, initialProject, newProjectId, nextProject, validateProject, isProjectId } from "./projectSchema.js";
import { normalizeThreadRecord } from "./threadStateSchema.js";
import { boundedCopy, fault, StorageFault } from "./storageSafety.js";
import { prepareWorkspace, rootHeaders, validateWorkspaceRoot, verifyRoot, sealRoot } from "./workspaceObjectSchema.js";
import { WORKSPACE_LIMITS, checkStorageEstimate, requireBudget } from "./storageBudget.js";
import { sourceBytes, compareSourceIdentity } from "./workspaceProvenance.js";
import { prepareMemoryMutation, verifyMemoryEnvelope } from "./assistantMemorySchema.js";
import { verifiedWorkspaceMemory } from "./assistantMemoryStore.js";
import { stableStringify } from "../graph/graphFingerprint.js";
import { CONNECTION_ID, CONNECTION_POLICY, validateConnectionRecord, validateConnectionProfile } from "./modelConnectionSchema.js";
import { RESUME_PREFERENCE_ID, DEFAULT_RESUME_PREFERENCES, validateResumePreferences, resumePreferences, namedProject } from "./resumePreferenceSchema.js";

const STORES = ["projects", "threads", "meta", "migrations", "quarantine", "workspaceRoots", "workspaceObjects", "assistantMemories", "modelConnections"];
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
        try { request = indexedDB.open(databaseName, PROJECT_DATABASE_VERSION); } catch (error) { reject(fault(error)); return; }
        request.onupgradeneeded = () => { for (const name of STORES) if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, { keyPath: ["projects", "threads", "workspaceRoots", "assistantMemories"].includes(name) ? "projectId" : "id" }); };
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
    return transaction(["projects", "threads", "migrations", ...(deleting ? ["workspaceRoots", "workspaceObjects", "assistantMemories"] : [])], "readwrite", (tx, done, abort) => {
      const projects = tx.objectStore("projects"), request = projects.get(projectId);
      request.onsuccess = () => {
        try {
          if (!request.result) throw new StorageFault("CONFLICT", "Project no longer exists; stale writes cannot create it.", true);
          let next = nextProject(request.result, expectedRevision, lineage ? { migrationLineage: [...request.result.migrationLineage, lineage] } : {});
          if (deleting) next = validateProject({ ...next, deleted: true, tombstone: { revision: next.revision, deletedAt: next.updatedAt } });
          projects.put(next);
          if (deleting) { tx.objectStore("threads").delete(projectId); removeDurable(tx, projectId); }
          else if (safe) tx.objectStore("threads").put({ projectId, record: safe });
          if (lineage) tx.objectStore("migrations").put({ id: "legacy-thread", schemaVersion: 1, projectId, ...lineage });
          done(Object.freeze({ ok: true, saved: true, status: "committed", projectId, revision: next.revision, manifest: next }));
        } catch (error) { abort(error); }
      };
    });
  }
  function removeDurable(tx, projectId) {
    tx.objectStore("assistantMemories").delete(projectId);
    tx.objectStore("workspaceRoots").delete(projectId);
    const objects = tx.objectStore("workspaceObjects"), keys = objects.getAllKeys();
    keys.onsuccess = () => { for (const id of keys.result) if (typeof id === "string" && id.startsWith(projectId + "/")) objects.delete(id); };
  }
  async function workspaceBundle(projectId, checkpointId = null) {
    checkId(projectId);
    return transaction(["projects", "workspaceRoots", "workspaceObjects"], "readonly", (tx, done, abort) => {
      const project = tx.objectStore("projects").get(projectId);
      project.onsuccess = () => {
        try {
          if (!project.result) throw new StorageFault("CONFLICT", "Project is missing.", true);
          const manifest = validateProject(project.result);
          if (manifest.deleted) throw new StorageFault("DELETED", "Deleted project cannot restore workspace data.", true);
          const request = tx.objectStore("workspaceRoots").get(projectId);
          request.onsuccess = () => {
            try {
              if (!request.result) {
                const keys = tx.objectStore("workspaceObjects").getAllKeys();
                keys.onsuccess = () => { if (keys.result.some(id => typeof id === "string" && id.startsWith(projectId + "/"))) abort(new StorageFault("INCOMPLETE", "Workspace manifest is missing but orphaned objects remain. Recovery is read-only.", true)); else done({ manifest, root: null, objects: [], orphanIds: [] }); };
                return;
              }
              const root = validateWorkspaceRoot(request.result, projectId), selected = checkpointId ? root.history.find(entry => entry.graph.objectId === checkpointId) : root;
              if (!selected) throw new StorageFault("INCOMPLETE", "Graph checkpoint is missing.", true);
              const headers = [...selected.sources, ...(selected.graph ? [selected.graph] : []), selected.derived], objects = [];
              const allKeys = tx.objectStore("workspaceObjects").getAllKeys();
              allKeys.onsuccess = () => {
                const referenced = new Set(rootHeaders(root).map(h => h.id));
                const orphanIds = allKeys.result.filter(id => typeof id === "string" && id.startsWith(projectId + "/") && !referenced.has(id));
                const knownKeys = new Set(allKeys.result), missingHistoryIds = root.history.flatMap(entry => [entry.graph, entry.derived, ...entry.sources]).filter(h => !knownKeys.has(h.id)).map(h => h.id);
                let remaining = headers.length;
                for (const h of headers) {
                  const req = tx.objectStore("workspaceObjects").get(h.id);
                  req.onsuccess = () => { objects.push(req.result); if (!--remaining) done({ manifest, root, objects, orphanIds, checkpointId, missingHistoryIds }); };
                }
              };
            } catch (error) { abort(error); }
          };
        } catch (error) { abort(error); }
      };
    });
  }
  async function publishDurable(projectId, expectedRevision, prepared, previousSha) {
    return transaction(["projects", "threads", "workspaceRoots", "workspaceObjects"], "readwrite", (tx, done, abort) => {
      const projects = tx.objectStore("projects"), req = projects.get(projectId);
      req.onsuccess = () => {
        try {
          if (!req.result) throw new StorageFault("CONFLICT", "Project is missing; publication cannot create it.", true);
          const next = nextProject(req.result, expectedRevision), roots = tx.objectStore("workspaceRoots"), all = roots.getAll();
          all.onsuccess = () => {
            try {
              const current = all.result.find(root => root.projectId === projectId);
              if ((current?.sha256 ?? null) !== previousSha || prepared.root.publicationRevision !== next.revision) throw new StorageFault("CONFLICT", "Workspace changed while data was prepared.", true);
              const total = all.result.filter(root => root.projectId !== projectId).reduce((sum, root) => sum + validateWorkspaceRoot(root, root.projectId).totalBytes, prepared.root.totalBytes);
              requireBudget(total, WORKSPACE_LIMITS.applicationBytes, "Application durable bytes");
              const objects = tx.objectStore("workspaceObjects"), keys = objects.getAllKeys();
              keys.onsuccess = () => {
                try {
                const retained = new Set(rootHeaders(prepared.root).map(h => h.id));
                for (const id of keys.result) if (typeof id === "string" && id.startsWith(projectId + "/") && !retained.has(id)) objects.delete(id);
                for (const object of prepared.records) objects.put(object);
                roots.put(prepared.root); projects.put(next);
                const thread = tx.objectStore("threads").get(projectId);
                thread.onsuccess = () => {
                  if (!thread.result) {
                    if (req.result.revision > 1) { abort(new StorageFault("CORRUPT", "Published thread is missing; workspace write is read-only.", true)); return; }
                    tx.objectStore("threads").put({ projectId, record: normalizeThreadRecord({ schemaVersion: 1, messages: [], workspace: {} }) });
                  }
                  done({ ok: true, saved: true, status: "committed", projectId, revision: next.revision, manifest: next, workspace: prepared.root });
                };
                } catch (error) { abort(error); }
              };
            } catch (error) { abort(error); }
          };
        } catch (error) { abort(error); }
      };
    });
  }
  const api = Object.freeze({
    async readResumePreferences() { const value = await read("meta", RESUME_PREFERENCE_ID); return value ? validateResumePreferences(value) : { revision: 0, ...DEFAULT_RESUME_PREFERENCES }; },
    async saveResumePreferences(expected, values) {
      const safe = resumePreferences(expected + 1, values);
      return transaction(["meta"], "readwrite", (tx, done, abort) => {
        const meta = tx.objectStore("meta"), req = meta.get(RESUME_PREFERENCE_ID);
        req.onsuccess = () => { try { const current = req.result ? validateResumePreferences(req.result).revision : 0; if (expected !== current) throw new StorageFault("CONFLICT", "Startup preferences changed in another tab. Reload before saving.", true); meta.put(safe); done(safe); } catch (error) { abort(error); } };
      });
    },
    async createFreshProject(expected, values, name = "Untitled workspace") {
      const project = initialProject(), safe = resumePreferences(expected + 1, { ...namedProject(values, project.projectId, name), selectedProjectId: project.projectId });
      return transaction(["projects", "meta"], "readwrite", (tx, done, abort) => {
        const meta = tx.objectStore("meta"), req = meta.get(RESUME_PREFERENCE_ID);
        req.onsuccess = () => { try { const current = req.result ? validateResumePreferences(req.result).revision : 0; if (expected !== current) throw new StorageFault("CONFLICT", "Startup preferences changed; no fresh project was created. Reload first.", true); const projects = tx.objectStore("projects"), keys = projects.getAllKeys(); keys.onsuccess = () => { if (keys.result.length >= PROJECT_LIMITS.projects) { abort(new StorageFault("LIMIT", "Project retention limit reached.", true)); return; } projects.add(project); meta.put(safe); done({ project, preferences: safe }); }; } catch (error) { abort(error); } };
      });
    },
    async readProject(projectId) { checkId(projectId); const p = await read("projects", projectId); if (!p) throw new StorageFault("CONFLICT", "This saved project is missing.", true); return validateProject(p); },
    async listProjects() {
      return transaction(["projects"], "readonly", (tx, done, abort) => { const req = tx.objectStore("projects").getAll(); req.onsuccess = () => {
        if (req.result.length > PROJECT_LIMITS.projects) { abort(new StorageFault("LIMIT", "Saved project inventory exceeds its limit.", true)); return; }
        done(req.result.map(raw => { try { return { manifest: validateProject(raw) }; } catch { return { unavailable: true }; } }));
      }; });
    },
    async deleteWorkspace(projectId, expectedRevision) {
      checkId(projectId);
      return transaction(["projects", "threads", "workspaceRoots", "workspaceObjects"], "readwrite", (tx, done, abort) => {
        const projects = tx.objectStore("projects"), req = projects.get(projectId);
        req.onsuccess = () => { try {
          if (!req.result) throw new StorageFault("CONFLICT", "Project is missing.", true);
          const next = nextProject(req.result, expectedRevision); projects.put(next); tx.objectStore("workspaceRoots").delete(projectId);
          const objects = tx.objectStore("workspaceObjects"), keys = objects.getAllKeys(); keys.onsuccess = () => { for (const id of keys.result) if (typeof id === "string" && id.startsWith(projectId + "/")) objects.delete(id); };
          const threads = tx.objectStore("threads"), thread = threads.get(projectId); thread.onsuccess = () => { try {
            const record = thread.result ? normalizeThreadRecord(thread.result.record) : normalizeThreadRecord({ schemaVersion: 1, messages: [], workspace: {} });
            threads.put({ projectId, record: normalizeThreadRecord({ ...record, workspace: {} }) });
            done({ ok: true, saved: true, status: "committed", projectId, revision: next.revision, manifest: next });
          } catch (error) { abort(error); } };
        } catch (error) { abort(error); } };
      });
    },
    async readConnectionProfile() {
      const value = await read("modelConnections", CONNECTION_ID);
      return value ? validateConnectionRecord(value) : { revision: 0, deleted: false, profile: null };
    },
    async saveConnectionProfile(expectedRevision, profile) {
      const safe = profile === null ? null : validateConnectionProfile(profile);
      return transaction(["modelConnections"], "readwrite", (tx, done, abort) => {
        const store = tx.objectStore("modelConnections"), req = store.get(CONNECTION_ID);
        req.onsuccess = () => {
          try {
            const current = req.result ? validateConnectionRecord(req.result) : { revision: 0 };
            if (!Number.isSafeInteger(expectedRevision) || expectedRevision !== current.revision) throw new StorageFault("CONFLICT", "Connection preferences changed in another tab; reload before writing.", true);
            const next = validateConnectionRecord({ id: CONNECTION_ID, schemaVersion: 1, revision: current.revision + 1, deleted: safe === null, profile: safe });
            store.put(next); done({ ok: true, saved: true, status: "committed", ...next });
          } catch (error) { abort(error); }
        };
      });
    },
    async acquireConnectionLease(owner, now = Date.now()) {
      checkId(owner);
      if (!Number.isSafeInteger(now) || now < 0) throw new StorageFault("CORRUPT", "Invalid reconnect lease clock.", true);
      return transaction(["modelConnections"], "readwrite", (tx, done, abort) => {
        const store = tx.objectStore("modelConnections"), req = store.get("reconnect-lease");
        req.onsuccess = () => {
          const lease = req.result;
          if (lease && (Object.keys(lease).sort().join() !== "expiresAt,id,owner" || !isProjectId(lease.owner) || !Number.isSafeInteger(lease.expiresAt) || lease.expiresAt > now + CONNECTION_POLICY.leaseMs)) { abort(new StorageFault("CORRUPT", "Reconnect lease is malformed or the clock moved backwards.", true)); return; }
          if (lease && lease.owner !== owner && lease.expiresAt > now) { done(false); return; }
          store.put({ id: "reconnect-lease", owner, expiresAt: now + CONNECTION_POLICY.leaseMs }); done(true);
        };
      });
    },
    async releaseConnectionLease(owner) {
      return transaction(["modelConnections"], "readwrite", (tx, done) => { const store = tx.objectStore("modelConnections"), req = store.get("reconnect-lease"); req.onsuccess = () => { if (req.result?.owner === owner) store.delete("reconnect-lease"); done(true); }; });
    },
    async readMemory(projectId) {
      checkId(projectId);
      const bundle = await transaction(["projects", "assistantMemories"], "readonly", (tx, done, abort) => {
        const p = tx.objectStore("projects").get(projectId);
        p.onsuccess = () => {
          try {
            if (!p.result) throw new StorageFault("CONFLICT", "Project is missing.", true);
            const manifest = validateProject(p.result);
            if (manifest.deleted) throw new StorageFault("DELETED", "Deleted project memory cannot be restored.", true);
            const m = tx.objectStore("assistantMemories").get(projectId);
            m.onsuccess = () => done({ manifest, envelope: m.result ?? null });
          } catch (error) { abort(error); }
        };
      });
      const envelope = await verifyMemoryEnvelope(bundle.envelope, projectId);
      if (envelope && envelope.revision > bundle.manifest.revision) throw new StorageFault("CORRUPT", "Memory revision exceeds project revision.", true);
      return { ...bundle, envelope };
    },
    async saveMemory(projectId, expectedRevision, command, isCurrent = () => true) {
      command = boundedCopy(command, { bytes: 12000, depth: 3, nodes: 25, string: 2000 });
      const previous = await api.readMemory(projectId);
      if (previous.manifest.revision !== expectedRevision) throw new StorageFault("CONFLICT", "Memory writer is stale; reload before writing.", true);
      const workspaceFact = command?.provenance === "WORKSPACE_DERIVED" ? await verifiedWorkspaceMemory(api, projectId) : null;
      if (command?.provenance === "WORKSPACE_DERIVED" && !workspaceFact) throw new StorageFault("INCOMPLETE", "Verified workspace is required for derived memory.", true);
      const derived = command?.provenance === "WORKSPACE_DERIVED" ? { ...command, content: workspaceFact.content, memoryType: "TECHNICAL_FACT", topic: "workspace-snapshot" } : command?.provenance === "SYSTEM_DERIVED" ? { ...command, content: "Project memory uses bounded local-only storage and never authorizes execution.", memoryType: "TECHNICAL_FACT", topic: "memory-policy" } : command;
      const prepared = await prepareMemoryMutation(projectId, expectedRevision + 1, previous.envelope, derived, workspaceFact?.binding ?? null);
      await checkStorageEstimate(new TextEncoder().encode(stableStringify(prepared)).byteLength);
      if (!isCurrent()) throw new StorageFault("ABANDONED", "Memory owner changed before publication.", true);
      return transaction(["projects", "threads", "assistantMemories"], "readwrite", (tx, done, abort) => {
        const projects = tx.objectStore("projects"), p = projects.get(projectId);
        p.onsuccess = () => {
          try {
            if (!isCurrent()) throw new StorageFault("ABANDONED", "Memory owner changed before publication.", true);
            if (!p.result) throw new StorageFault("CONFLICT", "Project is missing.", true);
            const next = nextProject(p.result, expectedRevision), memories = tx.objectStore("assistantMemories"), m = memories.get(projectId);
            m.onsuccess = () => {
              try {
                if (stableStringify(m.result ?? null) !== stableStringify(previous.envelope)) throw new StorageFault("CONFLICT", "Memory changed while preparing the write.", true);
                const thread = tx.objectStore("threads").get(projectId);
                thread.onsuccess = () => {
                  try {
                    if (!thread.result && p.result.revision > 1) throw new StorageFault("CORRUPT", "Published project thread is missing.", true);
                    if (!thread.result) tx.objectStore("threads").put({ projectId, record: normalizeThreadRecord({ schemaVersion: 1, messages: [], workspace: {} }) });
                    memories.put(prepared); projects.put(next);
                    done({ ok: true, saved: true, status: "committed", projectId, revision: next.revision, manifest: next, envelope: prepared });
                  } catch (error) { abort(error); }
                };
              } catch (error) { abort(error); }
            };
          } catch (error) { abort(error); }
        };
      });
    },
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
    readWorkspace: workspaceBundle,
    async saveWorkspace(projectId, expectedRevision, input) {
      const previous = await workspaceBundle(projectId);
      if (previous.manifest.revision !== expectedRevision) throw new StorageFault("CONFLICT", "Project revision changed before workspace preparation.", true);
      const prepared = await prepareWorkspace(projectId, expectedRevision + 1, input, previous.root);
      await checkStorageEstimate(prepared.writeBytes);
      return publishDurable(projectId, expectedRevision, prepared, previous.root?.sha256 ?? null);
    },
    async reattachSource(projectId, expectedRevision, objectId, input) {
      const previous = await workspaceBundle(projectId), root = await verifyRoot(previous.root, projectId);
      if (previous.manifest.revision !== expectedRevision) throw new StorageFault("CONFLICT", "Project changed before reattachment.", true);
      const header = rootHeaders(root).find(h => h.objectId === objectId && h.objectType === "source");
      if (!header) throw new StorageFault("UNSUPPORTED_SOURCE", "Source is not owned/referenced by this project.", true);
      const data = await sourceBytes(input, WORKSPACE_LIMITS.sourceBytes);
      const match = await compareSourceIdentity(header, data, WORKSPACE_LIMITS.sourceBytes);
      if (match.status !== "EXACT_MATCH") return { ...match, ok: false, saved: false };
      const repaired = { ...header, lifecycle: "COMPLETE", updatedAt: new Date().toISOString() };
      const replace = h => h.id === header.id ? repaired : h;
      const body = { ...root, publicationRevision: expectedRevision + 1, updatedAt: repaired.updatedAt, sources: root.sources.map(replace), history: root.history.map(entry => ({ ...entry, sources: entry.sources.map(replace) })) };
      body.totalBytes += header.lifecycle === "EXTERNAL" ? header.byteLength : 0;
      await checkStorageEstimate(data.byteLength);
      return publishDurable(projectId, expectedRevision, { root: await sealRoot(body), records: [{ ...repaired, data }] }, root.sha256);
    },
    async discardWorkspaceOrphans(projectId, expectedRevision) {
      const bundle = await workspaceBundle(projectId);
      if (!bundle.root) throw new StorageFault("INCOMPLETE", "No authoritative workspace manifest; recovery must be explicit.", true);
      const root = await verifyRoot(bundle.root, projectId);
      return publishDurable(projectId, expectedRevision, { root: await sealRoot({ ...root, publicationRevision: expectedRevision + 1, updatedAt: new Date().toISOString() }), records: [] }, root.sha256);
    },
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
      return transaction(["projects", "threads", "quarantine", "workspaceRoots", "workspaceObjects", "assistantMemories", "modelConnections", "meta"], "readwrite", (tx, done, abort) => {
        const projects = tx.objectStore("projects"), req = projects.getAll();
        req.onsuccess = () => {
          try {
            for (const raw of req.result) {
              const current = validateProject(raw);
              if (!current.deleted) { const next = nextProject(current, current.revision); projects.put(validateProject({ ...next, deleted: true, migrationLineage: [], tombstone: { revision: next.revision, deletedAt: next.updatedAt } })); }
            }
            tx.objectStore("threads").clear(); tx.objectStore("quarantine").clear(); tx.objectStore("workspaceRoots").clear(); tx.objectStore("workspaceObjects").clear(); tx.objectStore("assistantMemories").clear();
            const connections = tx.objectStore("modelConnections"), connection = connections.get(CONNECTION_ID);
            connection.onsuccess = () => { try { const revision = connection.result ? validateConnectionRecord(connection.result).revision : 0; connections.put(validateConnectionRecord({ id: CONNECTION_ID, schemaVersion: 1, revision: revision + 1, deleted: true, profile: null })); connections.delete("reconnect-lease"); const meta = tx.objectStore("meta"), prefs = meta.get(RESUME_PREFERENCE_ID); prefs.onsuccess = () => { try { if (prefs.result) { const current = validateResumePreferences(prefs.result); meta.put(resumePreferences(current.revision + 1, { ...current, autoResume: false, selectedProjectId: null, labels: [] })); } done({ ok: true, saved: true, status: "committed", scope: "project-data and connection intent; identity tombstones retained" }); } catch (error) { abort(error); } }; } catch (error) { abort(error); } };
          } catch (error) { abort(error); }
        };
      });
    },
  });
  return api;
}
