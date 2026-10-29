// Serialized transactional IDB double with rollback and delayed completion.
// It verifies application logic; real-browser evidence is separate.
export function projectIndexedDB() {
  const records = new Map(), databases = new Map(), handles = new Set();
  databases.set('hypergraph-chat-threads', { version: 1, stores: new Map([['threads', { keyPath: 'id', values: records }]]), queue: [], running: false });
  const control = { denyOpen: false, blockedOpen: false, abortNext: false, quotaNext: false, holdCommit: false, pendingCommits: [], requestsSucceeded: 0 };
  const error = name => new DOMException(name, name);
  function connection(info, name) {
    let closed = false;
    const db = {
      objectStoreNames: { contains: key => info.stores.has(key) },
      createObjectStore(key, { keyPath }) { info.stores.set(key, { keyPath, values: new Map() }); },
      close() { closed = true; handles.delete(db); },
      transaction(names, mode = 'readonly') {
        if (closed) throw error('InvalidStateError');
        const selected = Array.isArray(names) ? names : [names];
        let running = false, ended = false, state, tasks = [];
        const tx = {
          error: null,
          abort() { if (ended) return; ended = true; queueMicrotask(() => { tx.onabort?.(); release(); }); },
          objectStore(key) {
            if (!selected.includes(key) || !info.stores.has(key)) throw error('NotFoundError');
            const request = (fn, write = false) => {
              const req = {};
              tasks.push(() => {
                if (ended) return;
                try {
                  if (control.abortNext) { control.abortNext = false; throw error('AbortError'); }
                  if (write && control.quotaNext) { control.quotaNext = false; throw error('QuotaExceededError'); }
                  req.result = fn(state.get(key)); control.requestsSucceeded++; req.onsuccess?.();
                } catch (value) { req.error = value; tx.error = value; tx.onerror?.(); tx.abort(); }
              });
              if (running) queueMicrotask(pump);
              return req;
            };
            return {
              get: id => request(store => structuredClone(store.values.get(id))),
              getAll: () => request(store => [...store.values.values()].map(value => structuredClone(value))),
              getAllKeys: () => request(store => [...store.values.keys()].sort()),
              put: value => request(store => { store.values.set(value[store.keyPath], structuredClone(value)); return value[store.keyPath]; }, true),
              add: value => request(store => { const id = value[store.keyPath]; if (store.values.has(id)) throw error('ConstraintError'); store.values.set(id, structuredClone(value)); return id; }, true),
              delete: id => request(store => store.values.delete(id), true),
              clear: () => request(store => store.values.clear(), true),
            };
          },
        };
        function release() { info.running = false; next(info); }
        function commit() {
          if (ended) return;
          ended = true;
          if (mode === 'readwrite') for (const key of selected) {
            const destination = info.stores.get(key).values; destination.clear();
            for (const [id, value] of state.get(key).values) destination.set(id, value);
          }
          tx.oncomplete?.(); release();
        }
        let scheduled = false;
        function pump() {
          if (ended || !running || scheduled) return;
          scheduled = true;
          queueMicrotask(() => {
            scheduled = false;
            if (ended) return;
            if (tasks.length) { tasks.shift()(); pump(); }
            else if (control.holdCommit && mode === 'readwrite') { running = false; control.pendingCommits.push(commit); }
            else commit();
          });
        }
        info.queue.push(() => {
          running = true;
          state = new Map(selected.map(key => [key, { keyPath: info.stores.get(key).keyPath, values: new Map([...info.stores.get(key).values].map(([id, value]) => [id, structuredClone(value)])) }]));
          pump();
        });
        queueMicrotask(() => next(info));
        return tx;
      },
      databaseName: name,
    };
    handles.add(db); return db;
  }
  function next(info) { if (!info.running && info.queue.length) { info.running = true; info.queue.shift()(); } }
  return {
    records, databases, control,
    releaseCommits() { control.holdCommit = false; for (const commit of control.pendingCommits.splice(0)) commit(); },
    versionchange(name) { for (const db of [...handles]) if (db.databaseName === name) db.onversionchange?.(); },
    open(name, version = 1) {
      const req = {};
      queueMicrotask(() => {
        if (control.denyOpen) { req.error = error('SecurityError'); req.onerror?.(); return; }
        if (control.blockedOpen) { req.onblocked?.(); return; }
        let info = databases.get(name);
        if (info && info.version > version) { req.error = error('VersionError'); req.onerror?.(); return; }
        const upgrade = !info || info.version < version;
        if (!info) { info = { version, stores: new Map(), queue: [], running: false }; databases.set(name, info); }
        info.version = version; req.result = connection(info, name);
        if (upgrade) req.onupgradeneeded?.();
        req.onsuccess?.();
      });
      return req;
    },
  };
}

export function mapStorage(entries = []) {
  const values = new Map(entries);
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}
export const turn = () => new Promise(resolve => setTimeout(resolve, 0));
