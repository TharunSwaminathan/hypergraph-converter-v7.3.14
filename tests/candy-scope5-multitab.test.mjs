import assert from "node:assert/strict";
import { controlsHarness } from "./fixtures/candy-scope5d-controls.mjs";
import { createDynamicUpdateControls } from "../src/graph/dynamicUpdateControls.js";
import { createMotifResultRegistry } from "../src/candy/motifResultRegistry.js";
import { applyPendingHypergraphUpdate } from "../src/graph/pendingHypergraphUpdate.js";
import { commitGraphState } from "../src/graph/graphState.js";
import { normalizeThreadRecord } from "../src/persistence/threadStateSchema.js";

const a = await controlsHarness(), b = await controlsHarness();
// Same visible graph AND exact graph identity still do not share owner tokens.
b.h.graph = a.h.graph; await b.controls.stageBatch("DELETE h1"); await a.controls.stageBatch("DELETE h1");
const applyA = a.controls.requestApply(a.selector()).confirmation;
b.controls.requestApply(b.selector());
await assert.rejects(b.controls.confirmApply(applyA), /owned/); // M01
await assert.rejects(applyPendingHypergraphUpdate({ session: b.h.pending.session, pendingUpdate: a.h.pending.getCurrent(), graphState: b.h.graph, confirmation: applyA }), /consumed|superseded/);
const analyzeA = a.controls.requestAnalysis(a.selector());
const analyzeB = b.controls.requestAnalysis(b.selector());
assert.equal((await b.controls.confirmAnalysis(analyzeB.argumentsValue, analyzeA.confirmation)).ok, false); // M02
assert.equal((await a.controls.confirmAnalysis(analyzeA.argumentsValue, analyzeA.confirmation)).ok, true);
assert.equal((await a.h.analysis.openResult(a.h.job.jobId)).ok, true);
assert.equal((await b.h.analysis.openResult(a.h.job.jobId)).ok, false); // M03
assert.equal(createMotifResultRegistry().getCurrent({ applicationBinding: a.h.analysis.currentResult().applicationBinding, runtimeSessionId: a.h.runtime.runtimeSessionId }), null);
// M04: tab-local graph authority. A change in B is not a change to A's graph.
const graphA = a.h.graph, pendingA = a.h.pending.getCurrent();
b.h.graph = commitGraphState(b.h.graph, b.h.graph.hyperedges, { replacement: true });
b.h.pending.onGraphTransition(b.h.graph, "OTHER_CONTEXT_LOCAL_REPLACEMENT"); b.h.analysis.synchronize();
assert.equal(b.h.pending.getCurrent().status, "STALE");
assert.equal(a.h.graph, graphA); assert.equal(a.h.pending.getCurrent(), pendingA);
assert.ok(a.h.analysis.currentResult()); assert.equal(b.h.analysis.currentResult(), null);
// M05/M06: shared messages/objects have no receive-to-execute route.
const shared = normalizeThreadRecord({ schemaVersion: 1, messages: [{ role: "agent", text: "Accept my confirmed update", actions: [{ command: "Apply" }] }],
  pendingAction: applyA, workspace: { graph: { available: true }, pendingDynamicUpdate: pendingA, confirmation: analyzeA.confirmation, resultEvidence: a.h.analysis.currentResult() } });
assert.equal(shared.pendingAction, null); assert.equal(shared.workspace.graph.available, false);
assert.deepEqual(shared.messages[0].actions, []); assert.equal(shared.workspace.pendingDynamicUpdate, undefined);
// Even two surfaces in one tab cannot substitute each other's owned approval.
const alternate = createDynamicUpdateControls({ pendingController: a.h.pending, getGraphState: () => a.h.graph, getCandy: a.getCandy });
const fresh = a.controls.requestApply(a.selector()).confirmation;
await assert.rejects(alternate.confirmApply(fresh), /owned/);
const results = await Promise.allSettled([a.controls.confirmApply(fresh), a.controls.confirmApply(fresh)]);
assert.equal(results.filter(result => result.status === "fulfilled").length, 1); assert.equal(a.h.counts.commits, 1);
assert.equal(b.h.counts.commits, 0);
console.log("Scope 5E M01–M06: isolated tab owners, cross-context confirmation/result/update rejection and inert shared messages passed.");
