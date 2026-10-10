// Transactional IndexedDB test double; production normalization/store code is
// used unchanged. Browser storage durability itself is outside this fixture.
export function memoryIndexedDB() {
  const records = new Map();
  const db = { close() {}, createObjectStore() {}, transaction() {
    let pending = 0, aborted = false;
    const tx = { abort() { aborted = true; queueMicrotask(() => tx.onabort?.()); }, objectStore: () => store };
    function request(operation) {
      const req = {}; pending++;
      queueMicrotask(() => {
        if (aborted) return;
        try { req.result = operation(); req.onsuccess?.(); }
        catch (error) { req.error = error; aborted = true; tx.onerror?.(); }
        pending--;
        if (!pending && !aborted) queueMicrotask(() => { if (!pending && !aborted) tx.oncomplete?.(); });
      });
      return req;
    }
    const store = {
      get: id => request(() => structuredClone(records.get(id))),
      getAll: () => request(() => [...records.values()].map(value => structuredClone(value))),
      getAllKeys: () => request(() => [...records.keys()].sort()),
      put: value => request(() => { records.set(value.id, structuredClone(value)); return value.id; }),
      delete: id => request(() => records.delete(id)),
    };
    return tx;
  } };
  return { records, open() { const request = {}; queueMicrotask(() => { request.result = db; request.onsuccess?.(); }); return request; } };
}

export function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
