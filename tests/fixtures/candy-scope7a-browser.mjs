// Deliberate test entry point. Run only in the runner's fresh browser profile.
import { createProjectStore } from '../../src/persistence/projectStore.js';
import { PROJECT_DATABASE, PROJECT_DATABASE_VERSION } from '../../src/persistence/projectSchema.js';
import { createStorageCoordinator } from '../../src/persistence/storageCoordinator.js';
import { initializeProjectThread } from '../../src/persistence/storageMigration.js';
import { loadLocalModelConfigReceipt, MODEL_SETTINGS_PROJECT_KEY } from '../../src/agent/localModelSettings.js';

const query = new URLSearchParams(location.search), phase = query.get('phase'), token = query.get('token');
const check = (value, message) => { if (!value) throw new Error(message); };
const pause = () => new Promise(resolve => setTimeout(resolve, 20));
const record = text => ({ schemaVersion: 1, messages: [{ role: 'user', text }], workspace: {} });
const results = [];
async function rejects(promise, code) { try { await promise; } catch (error) { check(error.code === code, `Expected ${code}, got ${error.code}`); return; } throw new Error(`Missing rejection ${code}`); }

if (phase === 'peer') {
  const store = createProjectStore();
  // A separate actual top-level window, connection and JavaScript realm.
  window.scope7aPeer = { store, ready: true, save: (projectId, revision, text) => store.saveThread(projectId, revision, record(text)) };
} else {
  const stores = [];
  try {
    check(location.origin === 'http://127.0.0.1:5173', 'canonical test origin');
    if (phase === 'first') {
      check(!(await indexedDB.databases()).some(db => db.name === PROJECT_DATABASE), 'fresh isolated profile, not user data');
      const store = createProjectStore(); stores.push(store);
      const { manifest } = await initializeProjectThread(store);
      const originalTransaction = IDBDatabase.prototype.transaction, events = [];
      IDBDatabase.prototype.transaction = function (...args) {
        const transaction = originalTransaction.apply(this, args);
        transaction.addEventListener('complete', () => events.push('complete'));
        return transaction;
      };
      const originalPut = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (...args) {
        const request = originalPut.apply(this, args);
        request.addEventListener('success', () => events.push('request-success'));
        return request;
      };
      let receipt;
      try {
        receipt = await store.saveThread(manifest.projectId, manifest.revision, record('real-browser-committed'));
        events.push('receipt');
        check(events.indexOf('request-success') < events.lastIndexOf('complete') && events.lastIndexOf('complete') < events.indexOf('receipt'), 'receipt only after native transaction complete');
      } finally { IDBDatabase.prototype.transaction = originalTransaction; IDBObjectStore.prototype.put = originalPut; }
      results.push({ case: 'transaction-receipt', evidence: 'real native IndexedDB events', events });
      const peer = window.open(`${location.pathname}?phase=peer&token=${encodeURIComponent(token)}`, 'scope7a-owned-peer');
      check(peer, 'owned second tab opened');
      try {
        const deadline = performance.now() + 15000;
        while (!peer.scope7aPeer?.ready && performance.now() < deadline) await pause();
        check(peer.scope7aPeer?.ready, 'second top-level tab ready');
        const remote = peer.scope7aPeer.store;
        await rejects(peer.scope7aPeer.save(manifest.projectId, manifest.revision, 'stale tab'), 'CONFLICT');
        check((await store.load(manifest.projectId)).record.messages[0].text === 'real-browser-committed', 'stale tab did not overwrite');
        results.push({ case: 'two-top-level-tabs-CAS', code: 'CONFLICT' });
        await remote.deleteProject(manifest.projectId, receipt.revision);
        await rejects(store.saveThread(manifest.projectId, receipt.revision, record('resurrect')), 'DELETED');
        results.push({ case: 'two-tabs-delete-late-writer', code: 'DELETED' });
        await remote.close();
      } finally { peer.close(); }
      const durable = await store.createProject();
      await store.saveThread(durable.projectId, durable.revision, record('persisted across browser process restart'));
      localStorage.setItem('scope7a-test-project', durable.projectId);
      const versioned = createProjectStore(indexedDB, 'scope7a-versionchange'); stores.push(versioned);
      const current = await versioned.defaultProject(); let changed = false;
      versioned.subscribe(error => { changed = error.code === 'VERSION_CHANGED'; });
      await new Promise((resolve, reject) => {
        const request = indexedDB.open('scope7a-versionchange', PROJECT_DATABASE_VERSION + 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => { request.result.close(); resolve(); };
      });
      check(changed, 'production store closes and revokes writer on versionchange');
      await rejects(versioned.saveThread(current.projectId, current.revision, record('old version')), 'VERSION_CHANGED');
      results.push({ case: 'native-IDB-versionchange', revoked: true });
      await rejects(createProjectStore(null).defaultProject(), 'UNAVAILABLE');
      results.push({ case: 'unavailable-in-browser', evidence: 'injected unavailable API; not browser policy denial' });
      const coordinator = createStorageCoordinator({ store, projectId: durable.projectId, revision: 2 });
      coordinator.enqueue(record('coordinator committed in native IDB')); const saved = await coordinator.flush();
      check(saved.state === 'committed' && saved.committedRevision === 3 && !saved.unsaved, 'coordinator commit receipt');
      coordinator.dispose(); results.push({ case: 'native-coordinator-flush', revision: 3 });
      const put = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (...args) {
        const request = put.apply(this, args), transaction = this.transaction;
        if (this.name === 'projects' && args[0]?.projectId === durable.projectId) request.addEventListener('success', () => transaction.abort(), { once: true });
        return request;
      };
      try { await rejects(store.saveThread(durable.projectId, 3, record('aborted publication')), 'ABORTED'); }
      finally { IDBObjectStore.prototype.put = put; }
      const unchanged = await store.load(durable.projectId);
      check(unchanged.manifest.revision === 3 && unchanged.record.messages[0].text === 'coordinator committed in native IDB', 'native abort rolls back manifest and data');
      results.push({ case: 'native-IDB-abort-atomic-publication', revisionPreserved: 3 });
    } else if (phase === 'reload') {
      const store = createProjectStore(); stores.push(store);
      const projectId = localStorage.getItem('scope7a-test-project'); check(projectId, 'same-origin fixture pointer persisted');
      const loaded = await store.load(projectId);
      check(loaded.manifest.revision === 3 && loaded.record.messages[0].text === 'coordinator committed in native IDB', 'same origin retained exact committed record');
      check(loaded.record.pendingAction === null && loaded.record.workspace.graph.available === false && loaded.record.messages[0].actions.length === 0, 'retained history remains inert');
      const settings = loadLocalModelConfigReceipt(); check(!Object.hasOwn(settings.value, 'connected'), 'settings do not restore Connected');
      results.push({ case: 'same-origin-page-reload', revision: loaded.manifest.revision, graphAvailable: false, approvalRestored: false, settingsKey: MODEL_SETTINGS_PROJECT_KEY });
      await new Promise((resolve, reject) => { const request = indexedDB.deleteDatabase(PROJECT_DATABASE); request.onerror = () => reject(request.error); request.onsuccess = resolve; });
      await rejects(store.saveThread(projectId, 3, record('stale after site data cleared')), 'VERSION_CHANGED');
      const fresh = createProjectStore(); stores.push(fresh);
      await rejects(fresh.load(projectId), 'CONFLICT');
      results.push({ case: 'native-project-database-cleared-while-mounted', oldOwnerRevoked: true, oldProjectAbsent: true });
    } else if (phase === 'private') {
      const store = createProjectStore(); stores.push(store);
      try {
        const project = await store.defaultProject(); await store.saveThread(project.projectId, 1, record('private ephemeral fixture'));
        localStorage.setItem('scope7a-private-fixture', 'ephemeral');
        results.push({ case: 'private-mode-permits-session-storage', committedAPIOnly: true, retentionGuaranteed: false });
      } catch (error) { check(['UNAVAILABLE', 'QUOTA'].includes(error.code), 'private denial is explicit'); results.push({ case: 'private-mode-denied-storage', code: error.code, saved: false }); }
    } else if (phase === 'private-reopen') {
      check(!(await indexedDB.databases()).some(db => db.name === PROJECT_DATABASE), 'new private session has no old project database');
      check(localStorage.getItem('scope7a-private-fixture') === null, 'private history not promised across sessions');
      results.push({ case: 'private-mode-new-session', previousProjectUnavailable: true });
    } else throw new Error('Unknown test phase');
    for (const store of stores) await store.close();
    const report = { ok: true, phase, origin: location.origin, userAgent: navigator.userAgent, cases: results, limitations: ['isolated headless profile', 'no physical reboot or power-loss claim', 'no native/backend execution', 'unavailable API is an injected fault'] };
    document.getElementById('result').textContent = JSON.stringify(report, null, 2);
    await fetch(`/__scope7a_report?token=${encodeURIComponent(token)}`, { method: 'POST', body: JSON.stringify(report) });
    if (phase === 'first' && query.get('autoReload') === '1') location.replace(`${location.pathname}?phase=reload&token=${encodeURIComponent(token)}`);
  } catch (error) {
    document.getElementById('result').textContent = String(error.stack);
    await fetch(`/__scope7a_report?token=${encodeURIComponent(token)}`, { method: 'POST', body: JSON.stringify({ ok: false, phase, cases: results, error: String(error.stack) }) });
  }
}
