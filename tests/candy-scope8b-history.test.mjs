import assert from "node:assert/strict";
import { setup, seed } from "./fixtures/candy-scope8a-portability.mjs";
import { cpuRecord } from "./fixtures/candy-scope8b-history.mjs";
import { createProjectStore } from "../src/persistence/projectStore.js";
import { createProjectSession } from "../src/persistence/projectSession.js";
import { HISTORY_LIMITS, CPU_HISTORY_ALGORITHMS, historyDigest, sealHistoryRecord, validateHistoryRecord } from "../src/persistence/analysisHistorySchema.js";
import { exportPortableWorkspace, stagePortableWorkspace, PORTABLE_MAGIC } from "../src/persistence/workspacePortability.js";
import { stableStringify } from "../src/graph/graphFingerprint.js";
import { createGraphState } from "../src/graph/graphState.js";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const checks = [], test = async (name, fn) => { await fn(); checks.push(name); }, pause = () => new Promise(resolve => setTimeout(resolve, 2));
async function append(store, id, record) { const p = await store.readProject(id); return store.mutateAnalysisHistory(id, p.revision, { kind: "append", record }); }
await test("six CPU outcomes normalize Maps without invoking lazy traces and survive fresh store restoration", async () => {
  const s = setup(), id = await seed(s.store);
  for (const algorithm of Object.keys(CPU_HISTORY_ALGORITHMS)) { const r = await cpuRecord(id, { algorithm }); await append(s.store, id, r); }
  const restarted = createProjectStore(s.db), data = await restarted.readAnalysisHistory(id); assert.equal(data.envelope.records.length, 6); assert(data.envelope.records.every(r => r.projectId === id && r.status === "completed")); assert(!stableStringify(data).includes('"steps"')); assert(data.envelope.records.find(r => r.algorithm === "bfs").payload.data.distances.mapEntries.length > 0);
});
await test("duplicate completion is idempotent; changed replay is rejected; intentional rerun has a fresh identity", async () => {
  const s = setup(), id = await seed(s.store), r = await cpuRecord(id); await append(s.store, id, r); const before = await s.store.readProject(id), duplicate = await append(s.store, id, r); assert(duplicate.duplicate && !duplicate.saved); assert.equal((await s.store.readProject(id)).revision, before.revision);
  const changed = await cpuRecord(id, { operationId: r.recordId, algorithm: "dfs" }); await assert.rejects(() => append(s.store, id, changed), e => e.code === "CONFLICT"); await append(s.store, id, await cpuRecord(id)); assert.equal((await s.store.readAnalysisHistory(id)).envelope.records.length, 2);
});
await test("A/B isolation and stale cross-tab append reject rather than overwrite; reload permits append", async () => {
  const s = setup(), id = await seed(s.store), b = await s.store.createProject(), p = await s.store.readProject(id), a = createProjectSession(s.store, p), stale = createProjectSession(s.store, p), record = await cpuRecord(id);
  await a.mutateAnalysisHistory(id, p.revision, { kind: "append", record }); const staleRecord = await cpuRecord(id); await assert.rejects(() => stale.mutateAnalysisHistory(id, p.revision, { kind: "append", record: staleRecord }), e => e.code === "CONFLICT");
  const reloaded = createProjectSession(s.store, await s.store.readProject(id)); await reloaded.mutateAnalysisHistory(id, (await s.store.readProject(id)).revision, { kind: "append", record: await cpuRecord(id) }); assert.equal((await s.store.readAnalysisHistory(id)).envelope.records.length, 2); assert.equal((await s.store.readAnalysisHistory(b.projectId)).envelope, null);
});
await test("reviewed delete/clear rejects stale foreign and same-owner changes and changed commands", async () => {
  const s = setup(), id = await seed(s.store); await append(s.store, id, await cpuRecord(id)); let p = await s.store.readProject(id); const owner = createProjectSession(s.store, p), command = { kind: "clear" }, token = await owner.captureDestructive(id, "history", command);
  await append(s.store, id, await cpuRecord(id)); await assert.rejects(() => owner.clearReviewed(token, "history", command), e => e.code === "CONFLICT"); assert.equal((await s.store.readAnalysisHistory(id)).envelope.records.length, 2);
  p = await s.store.readProject(id); const fresh = createProjectSession(s.store, p), changed = await fresh.captureDestructive(id, "history", command); await assert.rejects(() => fresh.clearReviewed(changed, "history", { kind: "delete" }), e => e.code === "ABANDONED");
  const same = await fresh.captureDestructive(id, "history", command); await fresh.mutateAnalysisHistory(id, p.revision, { kind: "append", record: await cpuRecord(id) }); await assert.rejects(() => fresh.clearReviewed(same, "history", command), e => e.code === "CONFLICT");
});
await test("clear and eviction retain completion replay protection; deletion remains project scoped", async () => {
  const s = setup(), id = await seed(s.store), first = await cpuRecord(id, { completedAt: "2026-11-01T00:00:00.100Z" }); await append(s.store, id, first);
  for (let n = 0; n < HISTORY_LIMITS.records; n++) await append(s.store, id, await cpuRecord(id)); let h = await s.store.readAnalysisHistory(id); assert.equal(h.envelope.records.length, HISTORY_LIMITS.records); assert(!h.envelope.records.some(x => x.recordId === first.recordId)); assert((await append(s.store, id, first)).duplicate);
  const p = await s.store.readProject(id); await s.store.mutateAnalysisHistory(id, p.revision, { kind: "clear" }); assert((await append(s.store, id, first)).duplicate); h = await s.store.readAnalysisHistory(id); assert.equal(h.envelope.records.length, 0); assert(h.envelope.seen.length > 0);
  const b = await s.store.createProject(); await append(s.store, b.projectId, await cpuRecord(b.projectId)); await s.store.deleteProject(id, (await s.store.readProject(id)).revision); assert.equal((await s.store.readAnalysisHistory(b.projectId)).envelope.records.length, 1); await assert.rejects(() => s.store.readAnalysisHistory(id), e => e.code === "DELETED");
});
await test("abort/quota preserve old state and request success cannot precede transaction completion", async () => {
  const s = setup(), id = await seed(s.store), r = await cpuRecord(id), before = await s.store.readProject(id); s.db.control.quotaNext = true; await assert.rejects(() => append(s.store, id, r)); assert.equal((await s.store.readProject(id)).revision, before.revision); assert.equal((await s.store.readAnalysisHistory(id)).envelope, null);
  s.db.control.abortNext = true; await assert.rejects(() => append(s.store, id, r)); s.db.control.holdCommit = true; let acknowledged = false; const pending = append(s.store, id, r).then(x => { acknowledged = true; return x; });
  for (let n = 0; n < 100 && !s.db.control.pendingCommits.length; n++) await pause(); assert(!acknowledged); s.db.control.holdCommit = false; s.db.control.pendingCommits.splice(0).forEach(fn => fn()); const receipt = await pending; assert(receipt.saved && receipt.status === "committed");
});
await test("corrupted digests, foreign owner, future schema and unsafe output fail closed", async () => {
  const s = setup(), id = await seed(s.store), r = await cpuRecord(id); await assert.rejects(() => validateHistoryRecord({ ...r, resultSha256: "0".repeat(64) }, id)); await assert.rejects(() => validateHistoryRecord({ ...r, schemaVersion: 99 }, id), e => e.code === "INCOMPATIBLE"); const foreign = await s.store.createProject(); await assert.rejects(() => append(s.store, foreign.projectId, r));
  const proto = JSON.parse(JSON.stringify(r).replace('"payload":{', '"payload":{"__proto__":{},')); await assert.rejects(() => validateHistoryRecord(proto, id)); const bad = structuredClone(r); bad.payload.data.pendingAction = { apply: true }; bad.resultSha256 = await historyDigest(bad.payload); await assert.rejects(() => sealHistoryRecord(bad).then(x => validateHistoryRecord(x, id)));
});
await test("history v3 exports/imports atomically and changes owner/provenance without reconnect or authority", async () => {
  const s = setup(), id = await seed(s.store), r = await cpuRecord(id); await append(s.store, id, r); const file = await exportPortableWorkspace(s.store, id), decoded = JSON.parse(new TextDecoder().decode(file.bytes).slice(PORTABLE_MAGIC.length)); assert.equal(decoded.manifest.schemaVersion, 3); assert(!Object.hasOwn(decoded.manifest.analysisHistory, "seen")); assert.deepEqual(file.bytes, (await exportPortableWorkspace(s.store, id)).bytes);
  const dest = setup(), stage = await stagePortableWorkspace(file.bytes), receipt = await dest.store.importWorkspace(stage), h = (await dest.store.readAnalysisHistory(receipt.projectId)).envelope; assert.equal(h.records.length, 1); const imported = h.records[0]; assert.equal(imported.projectId, receipt.projectId); assert.equal(imported.provenance.origin, "IMPORTED"); assert.equal(imported.provenance.sourceRecordId, r.recordId); assert.notEqual(imported.recordId, r.recordId); assert.equal(imported.input.contentSha256, r.input.contentSha256); assert.equal((await dest.store.readConnectionProfile()).profile.autoReconnectEnabled, false);
  const corrupt = structuredClone(decoded); corrupt.manifest.analysisHistory.records[0].payload.data.reached = 999; corrupt.manifestSha256 = await historyDigest(corrupt.manifest); await assert.rejects(() => stagePortableWorkspace(new TextEncoder().encode(PORTABLE_MAGIC + stableStringify(corrupt))));
});
await test("history-free v2 compatibility remains the Scope8A contract", async () => {
  const s = setup(), id = await seed(s.store), file = await exportPortableWorkspace(s.store, id), decoded = JSON.parse(new TextDecoder().decode(file.bytes).slice(PORTABLE_MAGIC.length)); assert.equal(decoded.manifest.schemaVersion, 2); assert(!Object.hasOwn(decoded.manifest, "analysisHistory")); const dest = setup(), receipt = await dest.store.importWorkspace(await stagePortableWorkspace(file.bytes)); assert.equal((await dest.store.readAnalysisHistory(receipt.projectId)).envelope.records.length, 0);
});
await test("genuine pre-Scope8B native Scope8A archive still imports with empty history and safe memory/model policy", async () => {
  const old = JSON.parse(await readFile(new URL('./fixtures/candy-scope8b-pre8b-workspace.json', import.meta.url), 'utf8')), bytes = Buffer.from(old.base64, 'base64'); assert.equal(createHash('sha256').update(bytes).digest('hex'), old.sha256); assert.equal(old.sourceProductSha, 'f1e040e90764eac925d04c78d734a884dc4cd6cc'); const destination = setup(), receipt = await destination.store.importWorkspace(await stagePortableWorkspace(bytes)); assert.equal((await destination.store.readAnalysisHistory(receipt.projectId)).envelope.records.length, 0); assert.equal((await destination.store.readConnectionProfile()).profile.autoReconnectEnabled, false); assert((await destination.store.readMemory(receipt.projectId)).envelope.records.every(x => x.provenance === 'IMPORTED'));
});
await test("bounded 2000-vertex CPU outcomes remain portable without materializing animation traces", async () => {
  const s = setup(), id = await seed(s.store), graph = createGraphState([{ id: "large", vertices: ["A", ...Array.from({ length: 1999 }, (_, n) => "v" + n)] }]); await append(s.store, id, await cpuRecord(id, { graph, preview: true })); const file = await exportPortableWorkspace(s.store, id), destination = setup(); const receipt = await destination.store.importWorkspace(await stagePortableWorkspace(file.bytes)); assert.equal((await destination.store.readAnalysisHistory(receipt.projectId)).envelope.records[0].payload.data.reached, 2000);
});
console.log(JSON.stringify({ scope: "8B history", groups: checks.length, status: "PASS", evidence: "transactional IndexedDB double and actual Web Crypto; native qualification separate", checks }));
