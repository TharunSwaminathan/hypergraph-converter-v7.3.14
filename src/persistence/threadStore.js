import { normalizeThreadRecord, THREAD_SCHEMA_VERSION } from "./threadStateSchema.js";

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
    async listThreads() { return (await operation("readonly", s => s.getAll())).map(normalizeThreadRecord).map(({ id, updatedAt }) => ({ id, updatedAt })); },
    async saveThreadState(value) {
      const safe = normalizeThreadRecord({ ...value, schemaVersion: THREAD_SCHEMA_VERSION, updatedAt: new Date().toISOString() });
      await operation("readwrite", s => s.put(safe)); return safe;
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
          } catch { tx.abort(); }
        };
        tx.oncomplete = () => resolve(safe);
        tx.onerror = () => reject(tx.error ?? new Error("Thread append failed."));
        tx.onabort = () => reject(tx.error ?? new Error("Thread append aborted."));
      });
    },
    deleteThread: (id = "main") => operation("readwrite", s => s.delete(id)),
  };
  store.loadThreadState = store.loadThread;
  return store;
}
