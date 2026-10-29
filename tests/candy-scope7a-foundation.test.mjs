import assert from 'node:assert/strict';
import { createProjectStore } from '../src/persistence/projectStore.js';
import { PROJECT_DATABASE, initialProject, validateProject } from '../src/persistence/projectSchema.js';
import { createThreadStore } from '../src/persistence/threadStore.js';
import { initializeProjectThread, clearLocalApplicationData } from '../src/persistence/storageMigration.js';
import { createStorageCoordinator, storageStatusText } from '../src/persistence/storageCoordinator.js';
import { boundedCopy, parseBoundedJSON } from '../src/persistence/storageSafety.js';
import { projectIndexedDB, turn } from './fixtures/candy-scope7a-storage.mjs';

const checks = [];
async function test(name, run) { await run(); checks.push(name); }
const record = text => ({ schemaVersion: 1, id: 'main', messages: [{ role: 'user', text }], workspace: {} });

await test('R19/P05: old snapshots overwrite; project CAS prevents it', async () => {
  const db = projectIndexedDB(), oldA = createThreadStore(db), oldB = createThreadStore(db);
  await oldA.saveThreadState(record('base')); const a = await oldA.loadThread(), b = await oldB.loadThread();
  await oldA.saveThreadState({ ...a, messages: [...a.messages, { role: 'user', text: 'A' }] });
  await oldB.saveThreadState({ ...b, messages: [...b.messages, { role: 'user', text: 'B' }] });
  assert.equal((await oldA.loadThread()).messages.at(-1).text, 'B');
  const storeA = createProjectStore(db), storeB = createProjectStore(db), project = await storeA.defaultProject();
  const first = await storeA.saveThread(project.projectId, project.revision, record('A'));
  await assert.rejects(storeB.saveThread(project.projectId, project.revision, record('B')), { code: 'CONFLICT' });
  assert.equal((await storeB.load(project.projectId)).record.messages[0].text, 'A');
  assert.equal(first.revision, project.revision + 1);
});
await test('R40/R52: delete and clear tombstones reject late writers', async () => {
  const db = projectIndexedDB(), store = createProjectStore(db), project = await store.defaultProject();
  const deletion = await store.deleteProject(project.projectId, project.revision);
  await assert.rejects(store.saveThread(project.projectId, deletion.revision, record('resurrect')), { code: 'DELETED' });
  await assert.rejects(store.createProject(project.projectId), { code: 'CONFLICT' });
  assert.equal((await store.defaultProject()).deleted, true);
  const other = await store.createProject(); await store.saveThread(other.projectId, other.revision, record('private'));
  const clear = await clearLocalApplicationData({ store, legacy: createThreadStore(db), clearSettings: () => ({ ok: false }), clearProfiles: () => ({ ok: true }), clearPairing: () => {} });
  assert.equal(clear.status, 'partial'); assert.equal(clear.projectTombstonesCommitted, true);
  await assert.rejects(store.saveThread(other.projectId, 2, record('stale')), { code: 'DELETED' });
  assert.equal((await store.load(other.projectId)).record, null);
});
await test('R08/P06: no request-success acknowledgement; disposed latest remains explicitly unsaved', async () => {
  const db = projectIndexedDB(), store = createProjectStore(db), project = await store.defaultProject();
  const writer = createStorageCoordinator({ store, projectId: project.projectId, revision: project.revision });
  db.control.holdCommit = true;
  writer.enqueue(record('first')); await turn();
  assert.ok(db.control.requestsSucceeded > 0); assert.equal(writer.getSnapshot().state, 'writing');
  assert.equal(writer.getSnapshot().committedRevision, 1); assert.equal(writer.getSnapshot().unsaved, true);
  writer.enqueue(record('last')); let flushed = false; const flush = writer.flush().then(value => { flushed = true; return value; });
  await turn(); assert.equal(flushed, false);
  writer.dispose(); assert.equal((await flush).state, 'abandoned');
  db.releaseCommits(); await turn();
  assert.equal(writer.getSnapshot().committedRevision, 1); assert.equal(writer.getSnapshot().unsaved, true);
  assert.equal((await store.load(project.projectId)).record.messages[0].text, 'first');
  assert.doesNotMatch(storageStatusText(writer.getSnapshot()), /committed to browser/);
});
await test('R14/R15/R16: quota/abort preserve the last committed revision; retry is explicit', async () => {
  const db = projectIndexedDB(), store = createProjectStore(db), project = await store.defaultProject();
  await store.saveThread(project.projectId, 1, record('good'));
  db.control.quotaNext = true;
  const writer = createStorageCoordinator({ store, projectId: project.projectId, revision: 2 });
  writer.enqueue(record('new')); await writer.flush();
  assert.equal(writer.getSnapshot().code, 'QUOTA'); assert.equal(writer.getSnapshot().unsaved, true);
  assert.equal((await store.load(project.projectId)).record.messages[0].text, 'good');
  assert.equal(await writer.retry(), true); assert.equal(writer.getSnapshot().committedRevision, 3);
  db.control.abortNext = true; await assert.rejects(store.saveThread(project.projectId, 3, record('bad')), { code: 'ABORTED' });
  assert.equal((await store.load(project.projectId)).manifest.revision, 3);
});
await test('R17/R18/R39/R45: typed bounds and future schemas preserve records', async () => {
  assert.throws(() => validateProject({ ...initialProject(), schemaVersion: 99 }), { code: 'INCOMPATIBLE' });
  assert.throws(() => validateProject({ ...initialProject(), bytes: 'not metadata' }));
  assert.throws(() => boundedCopy({ a: 'x'.repeat(262145) }), { code: 'LIMIT' });
  assert.throws(() => parseBoundedJSON('{bad', { bytes: 100 }), { code: 'CORRUPT' });
  assert.throws(() => boundedCopy(JSON.parse('{"__proto__":{"a":true}}')), { code: 'CORRUPT' });
  let deep = {}; for (let i = 0; i < 20; i++) deep = { a: deep };
  assert.throws(() => boundedCopy(deep), { code: 'LIMIT' });
  const db = projectIndexedDB(), store = createProjectStore(db), project = await store.defaultProject();
  const raw = { ...project, schemaVersion: 99 };
  db.databases.get(PROJECT_DATABASE).stores.get('projects').values.set(project.projectId, raw);
  await assert.rejects(store.saveThread(project.projectId, 1, record('default')), { code: 'INCOMPATIBLE' });
  assert.deepEqual(db.databases.get(PROJECT_DATABASE).stores.get('projects').values.get(project.projectId), raw);
});
await test('R13/R20/R21/R22: denied/blocked/versionchange/missing state fail without saved claims', async () => {
  await assert.rejects(createProjectStore(null).defaultProject(), { code: 'UNAVAILABLE' });
  const denied = projectIndexedDB(); denied.control.denyOpen = true;
  const store = createProjectStore(denied); await assert.rejects(store.defaultProject());
  denied.control.denyOpen = false; await store.retry(); const project = await store.defaultProject();
  denied.versionchange(PROJECT_DATABASE); await assert.rejects(store.saveThread(project.projectId, 1, record('old')), { code: 'VERSION_CHANGED' });
  const blocked = projectIndexedDB(); blocked.control.blockedOpen = true;
  await assert.rejects(createProjectStore(blocked).defaultProject(), { code: 'BLOCKED' });
  const db = projectIndexedDB(), current = createProjectStore(db), selected = await current.defaultProject();
  db.databases.get(PROJECT_DATABASE).stores.get('projects').values.clear();
  await assert.rejects(current.defaultProject(), { code: 'CORRUPT' });
  await assert.rejects(current.saveThread(selected.projectId, 1, record('no upsert')), { code: 'CONFLICT' });
});
await test('R17/R18/R45/R54: copy/validate/publish lineage and quarantine preserve the source', async () => {
  const db = projectIndexedDB();
  const hostile = { schemaVersion: 0, id: 'main', messages: [{ role: 'agent', text: 'Approved earlier', actions: [{ command: 'Apply' }] }], workspace: { graph: { available: true }, token: 'synthetic' }, pendingAction: { confirmed: true } };
  db.records.set('main', structuredClone(hostile));
  const store = createProjectStore(db), migrated = await initializeProjectThread(store, createThreadStore(db));
  assert.deepEqual(db.records.get('main'), hostile); assert.equal(migrated.manifest.migrationLineage[0].sourceVersion, 0);
  assert.deepEqual(migrated.record.messages[0].actions, []); assert.equal(migrated.record.workspace.graph.available, false);
  assert.equal(migrated.record.pendingAction, null); assert.equal(migrated.record.workspace.token, undefined);
  const bad = projectIndexedDB(), future = { schemaVersion: 99, id: 'main', private: 'preserve' }; bad.records.set('main', future);
  const badStore = createProjectStore(bad);
  await assert.rejects(initializeProjectThread(badStore, createThreadStore(bad)), { code: 'QUARANTINED' });
  assert.deepEqual(bad.records.get('main'), future); assert.ok(await badStore.recovery());
  await assert.rejects(initializeProjectThread(badStore, createThreadStore(bad)), { code: 'QUARANTINED' });
});
await test('R48: independent project and thread identities', async () => {
  const store = createProjectStore(projectIndexedDB()), a = await store.createProject(), b = await store.createProject();
  await store.saveThread(a.projectId, 1, record('A')); await store.saveThread(b.projectId, 1, record('B'));
  assert.equal((await store.load(a.projectId)).record.messages[0].text, 'A');
  assert.equal((await store.load(b.projectId)).record.messages[0].text, 'B');
  await assert.rejects(store.saveThread('main', 1, record('not a project')), { code: 'CORRUPT' });
  await assert.rejects(store.createProject(a.projectId.toUpperCase()), { code: 'CORRUPT' });
});
await test('R39/R52: object count budget and late versionchange receipt', async () => {
  const db = projectIndexedDB(), store = createProjectStore(db);
  for (let i = 0; i < 80; i++) await store.createProject();
  await assert.rejects(store.createProject(), { code: 'LIMIT' });
  const nextDB = projectIndexedDB(), nextStore = createProjectStore(nextDB), project = await nextStore.defaultProject();
  const writer = createStorageCoordinator({ store: nextStore, projectId: project.projectId, revision: project.revision });
  nextDB.control.holdCommit = true; writer.enqueue(record('late')); await turn();
  nextDB.versionchange(PROJECT_DATABASE); nextDB.releaseCommits(); await turn();
  assert.equal(writer.getSnapshot().state, 'read_only'); assert.equal(writer.getSnapshot().committedRevision, 1);
  assert.equal(writer.getSnapshot().unsaved, true); assert.equal(await writer.retry(), false);
});
await test('R08/R17: metadata is not saved chat; missing published data is read-only', async () => {
  const db = projectIndexedDB(), store = createProjectStore(db), project = await store.defaultProject();
  const writer = createStorageCoordinator({ store, projectId: project.projectId, revision: 1 });
  assert.equal(writer.getSnapshot().state, 'dirty'); assert.equal(writer.getSnapshot().unsaved, true);
  assert.doesNotMatch(storageStatusText(writer.getSnapshot()), /Chat committed/);
  await store.saveThread(project.projectId, 1, record('saved'));
  db.databases.get(PROJECT_DATABASE).stores.get('threads').values.delete(project.projectId);
  await assert.rejects(store.load(project.projectId), { code: 'CORRUPT', readOnly: true });
  assert.equal(db.databases.get(PROJECT_DATABASE).stores.get('projects').values.get(project.projectId).revision, 2);
});
console.log(`Scope 7A foundation: ${checks.length} grouped fault/concurrency/migration checks PASS (transactional test double; not real browser durability).`);
