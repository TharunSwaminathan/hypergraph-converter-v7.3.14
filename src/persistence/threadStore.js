import { normalizeThreadRecord, THREAD_SCHEMA_VERSION, THREAD_LIMITS } from "./threadStateSchema.js";

// Deterministic quota in the same write transaction; preserve the main chat
// and the record being saved. No graph/job/update authority is stored here.
function trimThreads(objectStore, currentId) {
  const keys = objectStore.getAllKeys();
  keys.onsuccess = () => {
    let excess = keys.result.length - THREAD_LIMITS.threads;
    for (const id of keys.result) {
      if (excess <= 0) break;
      if (id !== "main" && id !== currentId) { objectStore.delete(id); excess--; }
    }
  };
}

export function createThreadStore(indexedDB = globalThis.indexedDB, databaseName = "hypergraph-chat-threads") {
  let opening;
  async function database() {
    if (!indexedDB) throw new Error("Browser storage unavailable; this session is not saved.");
    if (!opening) opening = new Promise((resolve, reject) => {
      let blocked = false;
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => request.result.createObjectStore("threads", { keyPath: "id" });
      request.onerror = () => { opening = null; reject(request.error); };
      request.onblocked = () => { blocked = true; opening = null; reject(new Error("Close other dashboard tabs to enable thread storage.")); };
      request.onsuccess = () => {
        const db = request.result;
        if (blocked) { db.close(); return; }
        db.onversionchange = () => { db.close(); opening = null; };
        resolve(db);
      };
    });
    return opening;
  }
  async function operation(mode, perform) {
    const db = await database();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("threads", mode);
      const request = perform(transaction.objectStore("threads"));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error ?? request.error);
      transaction.onabort = () => reject(transaction.error ?? new Error("Thread save aborted."));
    });
  }
  const store = {
    async createThread(id = globalThis.crypto?.randomUUID?.() ?? `thread-${Date.now()}`) {
      const value = { id, schemaVersion: THREAD_SCHEMA_VERSION, messages: [], summary: "", workspace: {} };
      await store.saveThreadState(value); return id;
    },
    async loadThread(id = "main") {
      const value = await operation("readonly", s => s.get(id));
      return value ? normalizeThreadRecord(value) : null;
    },
    async loadThreadWithSource(id = "main") {
      const value = await operation("readonly", s => s.get(id));
      return value ? { record: normalizeThreadRecord(value), sourceSchemaVersion: value.schemaVersion } : null;
    },
    async listThreads() { return (await operation("readonly", s => s.getAll())).map(normalizeThreadRecord).map(({ id, updatedAt }) => ({ id, updatedAt })); },
    async saveThreadState(value) {
      const safe = normalizeThreadRecord({ ...value, schemaVersion: value.schemaVersion ?? THREAD_SCHEMA_VERSION, updatedAt: new Date().toISOString() });
      await operation("readwrite", s => { const request = s.put(safe); trimThreads(s, safe.id); return request; }); return safe;
    },
    async saveMessage(id, message) {
      const db = await database();
      return new Promise((resolve, reject) => {
        const tx = db.transaction("threads", "readwrite");
        const objectStore = tx.objectStore("threads");
        const get = objectStore.get(id);
        let safe;
        get.onsuccess = () => {
          try {
            const current = get.result ? normalizeThreadRecord(get.result) : { id, schemaVersion: THREAD_SCHEMA_VERSION, messages: [] };
            safe = normalizeThreadRecord({ ...current, messages: [...current.messages, message], updatedAt: new Date().toISOString() });
            objectStore.put(safe);
            trimThreads(objectStore, safe.id);
          } catch { tx.abort(); }
        };
        tx.oncomplete = () => resolve(safe);
        tx.onerror = () => reject(tx.error ?? new Error("Thread append failed."));
        tx.onabort = () => reject(tx.error ?? new Error("Thread append aborted."));
      });
    },
    deleteThread: (id = "main") => operation("readwrite", s => s.delete(id)),
    clearThreads: () => operation("readwrite", s => s.clear()),
    async close() { const db = await opening?.catch(() => null); db?.close(); opening = null; },
  };
  store.loadThreadState = store.loadThread;
  return store;
}
