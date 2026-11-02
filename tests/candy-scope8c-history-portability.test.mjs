import assert from 'node:assert/strict';
import { seeded, setup, workspace, append, parse, values, stores, pause } from './fixtures/candy-scope8c-history-portability.mjs';
import { exportAnalysisHistory, decodeHistoryPortable, stageAnalysisHistory, discardAnalysisHistoryStage } from '../src/persistence/analysisHistoryPortability.js';
import { createWorkspaceResumeCoordinator, inspectResumeProject } from '../src/persistence/workspaceResumeCoordinator.js';
import { createProjectStore } from '../src/persistence/projectStore.js';
import { createProjectSession } from '../src/persistence/projectSession.js';
import { CPU_HISTORY_ALGORITHMS, sealHistoryEnvelope } from '../src/persistence/analysisHistorySchema.js';
import { exportPortableWorkspace, stagePortableWorkspace } from '../src/persistence/workspacePortability.js';
import { initialConnectionProfile } from '../src/persistence/modelConnectionSchema.js';
const checks = [], test = async (name, fn) => { await fn(); checks.push(name); };
await test('canonical deterministic six-family history-only export; no writes or private ledger', async () => {
  const s = await seeded({ algorithms: Object.keys(CPU_HISTORY_ALGORITHMS) }), before = values(s), a = await exportAnalysisHistory(s.store, s.id), b = await exportAnalysisHistory(s.store, s.id);
  assert.deepEqual(a.bytes, b.bytes); assert.equal(a.sha256, b.sha256); assert.equal(values(s), before);
  const { value, fileSha256 } = await decodeHistoryPortable(a.bytes);
  assert.equal(fileSha256, a.sha256); assert.equal(value.records.length, 6); assert.deepEqual(Object.keys(value).sort(), ['format','name','records','schemaVersion','sha256','sourceProjectId']);
  assert.equal(stores(s).get('workspaceRoots').values.size, 0); assert.equal((await inspectResumeProject(s.store, s.id)).saved, true);
  await assert.rejects(() => exportPortableWorkspace(s.store, s.id), e => e.code === 'INCOMPLETE');
});
await test('partial/corrupt/absent workspace does not impede independently valid history export', async () => {
  const s = await seeded({ root: true }); const expected = s.file.sha256;
  stores(s).get('workspaceRoots').values.set(s.id, { projectId: s.id, schemaVersion: 999 });
  assert.equal((await exportAnalysisHistory(s.store, s.id)).sha256, expected);
  stores(s).get('workspaceRoots').values.delete(s.id);
  assert.equal((await exportAnalysisHistory(s.store, s.id)).sha256, expected);
});
await test('missing/zero/corrupt/future/tombstoned history refuses without repair', async () => {
  const s = setup(), p = await s.store.defaultProject();
  await assert.rejects(() => exportAnalysisHistory(s.store, p.projectId), e => e.code === 'INCOMPLETE');
  stores(s).get('analysisHistories').values.set(p.projectId, await sealHistoryEnvelope(p.projectId, 1));
  await assert.rejects(() => exportAnalysisHistory(s.store, p.projectId), e => e.code === 'INCOMPLETE');
  await append(s.store, p.projectId); const v = stores(s).get('analysisHistories').values.get(p.projectId);
  v.sha256 = '0'.repeat(64); const before = values(s);
  await assert.rejects(() => exportAnalysisHistory(s.store, p.projectId)); assert.equal(values(s), before);
  v.schemaVersion = 99; await assert.rejects(() => exportAnalysisHistory(s.store, p.projectId), e => e.code === 'INCOMPATIBLE');
  const current = await s.store.readProject(p.projectId); await s.store.deleteProject(p.projectId, current.revision);
  await assert.rejects(() => exportAnalysisHistory(s.store, p.projectId), e => e.code === 'DELETED');
});
await test('new-project-only atomic import rebases IDs/unverified revisions and creates no source/graph/memory/model', async () => {
  const s = await seeded({ root: true }), sourceHash = (await s.store.readAnalysisHistory(s.id)).envelope.sha256, before = values(s), stage = await stageAnalysisHistory(s.file.bytes);
  assert.equal(values(s), before); assert(Object.isFrozen(stage)); assert(Object.isFrozen(stage.backends));
  const receipt = await s.store.importAnalysisHistory(stage), h = (await s.store.readAnalysisHistory(receipt.projectId)).envelope;
  assert.equal(receipt.status, 'committed'); assert.notEqual(receipt.projectId, s.id);
  const record = h.records[0], original = parse(s.file.bytes).records[0];
  assert.notEqual(record.recordId, original.recordId); assert.equal(record.projectId, receipt.projectId); assert.equal(record.provenance.origin, 'IMPORTED'); assert.equal(record.projectRevisionAtCapture, null); assert.equal(record.input.workspacePublicationRevision, null);
  assert.equal(record.resultSha256, original.resultSha256); assert.equal(record.input.contentSha256, original.input.contentSha256); assert.equal(h.seen.length, 1);
  for (const name of ['workspaceRoots','assistantMemories']) assert(!stores(s).get(name).values.has(receipt.projectId));
  assert(![...stores(s).get('workspaceObjects').values.keys()].some(k => k.startsWith(receipt.projectId + '/')));
  assert.equal((await s.store.load(receipt.projectId)).record.messages.length, 0);
  assert.equal((await s.store.readResumePreferences()).selectedProjectId, receipt.projectId);
  assert.equal((await s.store.readAnalysisHistory(s.id)).envelope.sha256, sourceHash);
  await assert.rejects(() => s.store.importAnalysisHistory(stage), e => e.code === 'ABANDONED');
  const round = await exportAnalysisHistory(s.store, receipt.projectId); assert.notEqual(round.sha256, s.file.sha256);
});
await test('fresh destination, duplicate/concurrent import and retained tombstone replay', async () => {
  const source = await seeded(), target = setup(), otherStore = createProjectStore(target.db);
  const stages = await Promise.all([stageAnalysisHistory(source.file.bytes), stageAnalysisHistory(source.file.bytes)]);
  const results = await Promise.allSettled([target.store.importAnalysisHistory(stages[0]), otherStore.importAnalysisHistory(stages[1])]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1); assert.equal(results.find(r => r.status === 'rejected').reason.code, 'DUPLICATE');
  const id = results.find(r => r.status === 'fulfilled').value.projectId, p = await target.store.readProject(id);
  await target.store.deleteProject(id, p.revision);
  const replay = await stageAnalysisHistory(source.file.bytes);
  await assert.rejects(() => target.store.importAnalysisHistory(replay), e => e.code === 'DUPLICATE');
});
await test('forged/discarded stage cannot publish, and Cancel is write-free', async () => {
  const s = await seeded(), stage = await stageAnalysisHistory(s.file.bytes), before = values(s);
  discardAnalysisHistoryStage(stage);
  for (const v of [stage, {}, { ...stage }]) await assert.rejects(() => s.store.importAnalysisHistory(v), e => e.code === 'ABANDONED');
  assert.equal(values(s), before);
});
await test('Resume available, manual Resume, startup auto ON/OFF and Start Fresh preserve imported history', async () => {
  const s = await seeded(), receipt = await s.store.importAnalysisHistory(await stageAnalysisHistory(s.file.bytes));
  const c = createWorkspaceResumeCoordinator({ store: s.store });
  await c.reviewImported(receipt.projectId); assert.equal(c.getSnapshot().active, null); assert.equal(c.getSnapshot().state, 'RESTORE_AVAILABLE'); assert.equal(c.getSnapshot().available.historyCount, 1);
  await c.resume(); assert.equal(c.getSnapshot().active.projectId, receipt.projectId); await c.setAutoResume(false); c.dispose();
  const off = createWorkspaceResumeCoordinator({ store: s.store }); await off.initialize(); assert.equal(off.getSnapshot().active, null); await off.setAutoResume(true); off.dispose();
  const on = createWorkspaceResumeCoordinator({ store: s.store }); await on.initialize(); assert.equal(on.getSnapshot().active.projectId, receipt.projectId); await on.fresh(); assert.notEqual(on.getSnapshot().active.projectId, receipt.projectId); assert.equal((await s.store.readAnalysisHistory(receipt.projectId)).envelope.records.length, 1); on.dispose();
});
await test('history summary refresh never adopts writer revision and obsolete async owner is dropped', async () => {
  const s = await seeded(), c = createWorkspaceResumeCoordinator({ store: s.store }); await c.initialize();
  const active = c.getSnapshot().active; await append(s.store, s.id); await c.historyChanged(active.key); assert.equal(c.getSnapshot().historySummary.historyCount, 2);
  const foreignRevision = (await s.store.readProject(s.id)).revision;
  await assert.rejects(() => active.session.saveWorkspace(s.id, foreignRevision, workspace()), e => e.code === 'CONFLICT');
  let release, delay = false; const read = s.store.readAnalysisHistory.bind(s.store), wrapped = { ...s.store, readAnalysisHistory: id => { if (!delay) return read(id); delay = false; return new Promise(resolve => { release = () => read(id).then(resolve); }); } };
  const x = createWorkspaceResumeCoordinator({ store: wrapped }); await x.initialize();
  const other = await s.store.createProject(); delay = true; const pending = x.historyChanged(x.getSnapshot().active.key);
  for (let n = 0; !release && n < 100; n++) await pause();
  await x.choose(other.projectId); release(); await pending;
  assert.equal(x.getSnapshot().historySummary.projectId, other.projectId); assert.equal(x.getSnapshot().historySummary.historyCount, 0);
  x.dispose(); c.dispose();
});
await test('workspace-only deletion retains portable history; stale history deletes and saves remain rejected', async () => {
  const s = await seeded({ root: true }), p = await s.store.readProject(s.id), session = createProjectSession(s.store, p), review = await session.captureDestructive(s.id, 'history', { kind: 'clear' });
  await append(s.store, s.id); await assert.rejects(() => session.clearReviewed(review, 'history', { kind: 'clear' }), e => e.code === 'CONFLICT');
  const latest = await s.store.readProject(s.id); await s.store.deleteWorkspace(s.id, latest.revision); assert.equal((await decodeHistoryPortable((await exportAnalysisHistory(s.store, s.id)).bytes)).value.records.length, 2);
  await assert.rejects(() => s.store.saveWorkspace(s.id, p.revision, workspace()), e => e.code === 'CONFLICT');
});
await test('durable model OFF/tombstone and source memory remain unchanged; full workspace legacy codec still isolated', async () => {
  const s = await seeded({ root: true }); await s.store.saveConnectionProfile(0, { ...initialConnectionProfile('qwen3:8b'), autoReconnectEnabled: false });
  const model = JSON.stringify(await s.store.readConnectionProfile()), full = await exportPortableWorkspace(s.store, s.id);
  const t = setup(), receipt = await t.store.importWorkspace(await stagePortableWorkspace(full.bytes)); assert.equal((await t.store.readAnalysisHistory(receipt.projectId)).envelope.records.length, 1);
  await assert.rejects(() => stagePortableWorkspace(s.file.bytes)); await assert.rejects(() => stageAnalysisHistory(full.bytes));
  await s.store.importAnalysisHistory(await stageAnalysisHistory(s.file.bytes)); assert.equal(JSON.stringify(await s.store.readConnectionProfile()), model);
  const current=await s.store.readConnectionProfile();await s.store.saveConnectionProfile(current.revision,null);const tombstone=JSON.stringify(await s.store.readConnectionProfile());
  const file=await exportAnalysisHistory(s.store,s.id),v=parse(file.bytes);v.name='Tombstone remains';
  const {encode}=await import('./fixtures/candy-scope8c-history-portability.mjs');await s.store.importAnalysisHistory(await stageAnalysisHistory(await encode(v)));assert.equal(JSON.stringify(await s.store.readConnectionProfile()),tombstone);
});
console.log(JSON.stringify({ scope: '8C history portability', cases: checks.length, checks, result: 'PASS', evidence: 'source tests / declared transactional double; native separate' }));
