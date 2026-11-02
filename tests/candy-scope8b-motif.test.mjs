import assert from "node:assert/strict";
import { harness, selector } from "./fixtures/candy-scope5-runtime.mjs";
import { setup, seed } from "./fixtures/candy-scope8a-portability.mjs";
import { createGraphState } from "../src/graph/graphState.js";
import { createMotifAnalysisController } from "../src/candy/motifAnalysisController.js";
import { createAnalysisHistoryCoordinator } from "../src/persistence/analysisHistoryCoordinator.js";
import { createProjectSession } from "../src/persistence/projectSession.js";
import { historyDigest, sealHistoryRecord, validateHistoryRecord } from "../src/persistence/analysisHistorySchema.js";
const cases = [], pause = () => new Promise(resolve => setTimeout(resolve, 2));
async function wait(fn) { for (let n = 0; n < 1500; n++) { if (await fn()) return; await pause(); } throw Error("Simulated motif/history timeout"); }
for (const mode of ["STATIC", "INCREMENTAL"]) {
  const s = setup(), id = await seed(s.store), h = await harness(); if (mode === "STATIC") { h.graph = createGraphState(h.graph.hyperedges, { graphType: "Hypergraph" }); h.pending.onGraphTransition(h.graph, "TYPE_CHANGED"); }
  const owner = createProjectSession(s.store, await s.store.readProject(id)), history = createAnalysisHistoryCoordinator(owner); await history.initialize();
  const controller = createMotifAnalysisController({ getContext: () => ({ graph: h.graph, pendingUpdate: h.pending.getCurrent(), runtime: h.runtime, historyContext: { projectId: id, workspacePublicationRevision: 2 }, onHistoryCompleted: history.complete }), getClient: () => h.client });
  const args = selector(h.pending.getCurrent(), mode), approval = controller.stage(args); assert(approval.ok); const submitted = await controller.submit(args, approval.confirmation); assert(submitted.ok); await wait(() => history.getSnapshot().records.length === 1); const record = history.getSnapshot().records[0]; assert.equal(record.execution.backend, args.backend); assert.equal(record.parameters.mode, mode); assert.equal(record.provenance.origin, "LOCAL"); assert.equal(h.counts.commits, 0); assert.equal(h.counts.submissions, 1); assert(!JSON.stringify(record).includes('runtimeSessionId')); assert(!JSON.stringify(record).includes('jobId'));
  await controller.openResult(submitted.job.jobId); await pause(); assert.equal((await s.store.readAnalysisHistory(id)).envelope.records.length, 1, "repeated completion/result opening is idempotent");
  for (const mutate of [r => { r.payload.data.taxonomyVersion = "unknown/99"; }, r => { r.payload.data.counts[0] = "1"; }, r => { r.parameters.mode = "UNREVIEWED"; }, r => { r.provenance.nativeRequestDigest = null; }]) {
    const forged = structuredClone(record); mutate(forged); forged.resultSha256 = await historyDigest(forged.payload);
    await assert.rejects(() => sealHistoryRecord(forged).then(r => validateHistoryRecord(r, id)), "rehashed unsupported native evidence remains rejected");
  }
  const oldCount = h.counts.submissions; const reopened = createAnalysisHistoryCoordinator(owner); await reopened.initialize(); assert.equal(h.counts.submissions, oldCount, "history restoration never executes a new job");
  controller.dispose(); history.dispose(); reopened.dispose(); cases.push(mode + " simulated validated completion archived once with digest/parameters/backend; no restored authority");
}
{
  const h = await harness(), events = [], unavailable = createMotifAnalysisController({ getContext: () => ({ graph: h.graph, pendingUpdate: h.pending.getCurrent(), runtime: { ...h.runtime, authorized: false, capabilities: [] }, onHistoryCompleted: e => events.push(e) }), getClient: () => h.client }); const result = unavailable.stage(selector(h.pending.getCurrent())); assert(!result.ok); assert.equal(events.length, 0); assert.equal(h.counts.submissions, 0); unavailable.dispose(); cases.push("unavailable Runtime fails preflight with no completion/history/native job");
}
console.log(JSON.stringify({ scope: "8B motif observer", status: "PASS", cases, evidence: "Validated Runtime transport/result doubles with explicit test device; NOT live CUDA qualification or actual capability evidence" }));
