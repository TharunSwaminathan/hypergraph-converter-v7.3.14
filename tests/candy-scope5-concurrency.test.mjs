import assert from "node:assert/strict";
import { controlsHarness } from "./fixtures/candy-scope5d-controls.mjs";
import { harness, selector } from "./fixtures/candy-scope5-runtime.mjs";
import { deferred } from "./fixtures/candy-scope5e-storage.mjs";
import { commitGraphState } from "../src/graph/graphState.js";
import { createMotifResultRegistry } from "../src/candy/motifResultRegistry.js";
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

// C01/C04: UI and Assistant request/confirm against the very same owner.
const shared = await controlsHarness();
const first = shared.controls.requestAnalysis(shared.selector()), second = shared.controls.requestAnalysis(shared.selector());
const submitted = await Promise.all([shared.controls.confirmAnalysis(first.argumentsValue, first.confirmation), shared.controls.confirmAnalysis(second.argumentsValue, second.confirmation)]);
assert.equal(submitted.filter(value => value.ok).length, 1); assert.equal(shared.h.counts.submissions, 1);
const duplicate = await controlsHarness(), approved = duplicate.controls.requestAnalysis(duplicate.selector());
const duplicates = await Promise.all([duplicate.controls.confirmAnalysis(approved.argumentsValue, approved.confirmation), duplicate.controls.confirmAnalysis(approved.argumentsValue, approved.confirmation)]);
assert.equal(duplicates.filter(value => value.ok).length, 1); assert.equal(duplicate.h.counts.submissions, 1);
// C02/C03: the consume-before-await Apply boundary commits once.
const apply = await controlsHarness(), token = apply.controls.requestApply(apply.selector()).confirmation;
const applies = await Promise.allSettled([apply.controls.confirmApply(token), apply.controls.confirmApply(token)]);
assert.equal(applies.filter(value => value.status === "fulfilled").length, 1); assert.equal(apply.h.counts.commits, 1);

// C05/C06/C07/C08/C11: gated result download versus each authority loss.
for (const transition of ["edit", "discard", "graph", "reconnect", "unmount"]) {
  const h = await harness(); await h.run();
  const gate = deferred(), entered = deferred(), result = h.result, jobId = h.job.jobId;
  h.client.getResult = async () => { entered.resolve(); return gate.promise; };
  const opening = h.analysis.openResult(jobId); await entered.promise;
  if (transition === "edit") await h.stage([{ type: "REMOVE_HYPEREDGE", hyperedgeId: "h1" }]);
  if (transition === "discard") h.pending.discard();
  if (transition === "graph") { h.graph = commitGraphState(h.graph, h.graph.hyperedges, { replacement: true }); h.pending.onGraphTransition(h.graph); }
  if (transition === "reconnect") h.runtime = { ...h.runtime, runtimeSessionId: "new-session" };
  if (transition === "unmount") h.analysis.dispose();
  h.analysis.synchronize(); gate.resolve(result);
  assert.equal((await opening).ok, false, transition); assert.equal(h.analysis.currentResult(), null); assert.equal(h.counts.commits, 0);
}
// C09: cancellation is locally effective even when the old cancel response stalls.
const again = await harness(); await again.run();
const download = deferred(), entered = deferred(), cancel = deferred(), oldResult = again.result, oldJob = again.job.jobId;
again.client.getResult = async () => { entered.resolve(); return download.promise; };
const oldOpening = again.analysis.openResult(oldJob); await entered.promise;
again.client.cancelJob = () => cancel.promise;
const oldCancellation = again.analysis.cancelJob(oldJob);
assert.equal(again.analysis.currentResult(), null); assert.equal(again.analysis.getSnapshot().status, "CANCELLED");
await again.run(); const newJob = again.job.jobId;
again.client.getResult = async () => again.result;
assert.equal((await again.analysis.openResult(newJob)).ok, true);
download.resolve(oldResult); cancel.reject(new Error("remote cancel failed"));
assert.equal((await oldOpening).ok, false); assert.equal((await oldCancellation).ok, false);
assert.equal(again.analysis.getSnapshot().status, "RESULT_READY"); assert.equal(again.analysis.currentResult().jobId, newJob);

// Two concurrent result reads: superseded download cannot clear the newer result.
const reads = await harness(); await reads.run(); const readGate = deferred(), readEntered = deferred(); let count = 0;
reads.client.getResult = async () => { if (++count === 1) { readEntered.resolve(); return readGate.promise; } return reads.result; };
const olderRead = reads.analysis.openResult(reads.job.jobId); await readEntered.promise;
assert.equal((await reads.analysis.openResult(reads.job.jobId)).ok, true);
readGate.resolve(reads.result); assert.equal((await olderRead).ok, false); assert.ok(reads.analysis.currentResult());
// The registry's own clear revokes in-flight validation without a caller guard.
const registry = createMotifResultRegistry();
const evidence = reads.analysis.currentResult();
// Reuse exact qualified binding captured from a genuine workflow, not invented fields.
const { submitMotifWorkflow } = await import("../src/candy/motifWorkflow.js");
const { motifGraphValue, motifApplicationBinding } = await import("../src/candy/motifPreflight.js");
const accepted = await submitMotifWorkflow({ client: reads.client, graphValue: motifGraphValue(reads.graph), pendingUpdate: reads.pending.getCurrent().motifUpdate,
  argumentsValue: selector(reads.pending.getCurrent()), runtimeSessionId: reads.runtime.runtimeSessionId,
  applicationBinding: motifApplicationBinding(reads.graph, reads.pending.getCurrent()), isCurrent: () => true });
const accepting = registry.accept(reads.result, accepted.binding); registry.clear();
await assert.rejects(accepting, /stale|abandoned/); assert.equal(registry.getCurrent({ applicationBinding: evidence.applicationBinding, runtimeSessionId: evidence.runtimeSessionId }), null);

// C12: identical visible contents in a new revision remain a different authority.
const identical = await harness(); await identical.run(); await identical.analysis.openResult(identical.job.jobId);
const old = identical.pending.getCurrent(), oldApproval = identical.analysis.stage(selector(old)).confirmation;
await identical.stage(old.plan.operations);
assert.notEqual(identical.pending.getCurrent().updateId, old.updateId);
assert.equal(identical.pending.getCurrent().proposedGraphFingerprint, old.proposedGraphFingerprint);
assert.equal((await identical.analysis.submit(selector(old), oldApproval)).ok, false); assert.equal(identical.analysis.currentResult(), null);
// Pending unmount during Apply digest cannot commit, even if the owner activates again.
const disposal = await controlsHarness(), applyingToken = disposal.controls.requestApply(disposal.selector()).confirmation;
const committing = disposal.controls.confirmApply(applyingToken);
disposal.h.pending.dispose(); disposal.h.pending.activate();
await assert.rejects(committing); assert.equal(disposal.h.pending.getCurrent(), null); assert.equal(disposal.h.counts.commits, 0);
await tick();
console.log("Scope 5E C01–C09/C11/C12: concurrent UI/Assistant analysis and Apply, late downloads, failed cancel/reanalysis, same-content revisions and unmount passed.");
