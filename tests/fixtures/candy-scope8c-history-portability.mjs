import { setup, workspace } from './candy-scope8a-portability.mjs';
import { cpuRecord } from './candy-scope8b-history.mjs';
import { exportAnalysisHistory, HISTORY_PORTABLE_MAGIC } from '../../src/persistence/analysisHistoryPortability.js';
import { historyDigest, sealHistoryRecord } from '../../src/persistence/analysisHistorySchema.js';
import { stableStringify } from '../../src/graph/graphFingerprint.js';
export { setup, workspace, cpuRecord };
export const pause = (ms = 1) => new Promise(resolve => setTimeout(resolve, ms));
export async function append(store, id, options = {}) {
  const project = await store.readProject(id);
  return store.mutateAnalysisHistory(id, project.revision, { kind: 'append', record: await cpuRecord(id, options) });
}
export async function seeded({ algorithms = ['bfs'], root = false } = {}) {
  const s = setup(), project = await s.store.defaultProject();
  s.id = project.projectId;
  if (root) await s.store.saveWorkspace(s.id, project.revision, workspace());
  for (const algorithm of algorithms) await append(s.store, s.id, { algorithm });
  s.file = await exportAnalysisHistory(s.store, s.id);
  return s;
}
export function stores(s) { return s.db.databases.get('hypergraph-studio-projects').stores; }
export function values(s) { return JSON.stringify([...stores(s)].map(([name, store]) => [name, [...store.values]])); }
export function parse(bytes) { return JSON.parse(new TextDecoder().decode(bytes).slice(HISTORY_PORTABLE_MAGIC.length)); }
export async function encode(value) {
  const { sha256: ignored, ...body } = value; void ignored;
  return new TextEncoder().encode(HISTORY_PORTABLE_MAGIC + stableStringify({ ...body, sha256: await historyDigest(body) }));
}
export async function changeRecord(value, change) {
  value = structuredClone(value);
  const record = structuredClone(value.records[0]); change(record);
  record.resultSha256 = await historyDigest(record.payload);
  value.records[0] = await sealHistoryRecord(record);
  return value;
}
// Per-write failure wrapper around the declared transactional double. Native
// IDB failures are independently exercised by the browser fixture.
export function failWrite(s, number) {
  const open = s.db.open.bind(s.db); let writes = 0;
  s.db.open = (...args) => {
    const request = open(...args);
    let success;
    Object.defineProperty(request, 'onsuccess', { set(fn) { success = fn; }, get() { return () => {
      const db = request.result, transaction = db.transaction.bind(db);
      db.transaction = (...args) => {
        const tx = transaction(...args), objectStore = tx.objectStore.bind(tx);
        tx.objectStore = name => {
          const target = objectStore(name);
          return { ...target, put(value) { if (++writes === number) throw new DOMException('Injected write failure', 'QuotaExceededError'); return target.put(value); } };
        };
        return tx;
      };
      success?.();
    }; } });
    return request;
  };
}
