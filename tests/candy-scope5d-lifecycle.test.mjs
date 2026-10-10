import assert from "node:assert/strict";
import { controlsHarness } from "./fixtures/candy-scope5d-controls.mjs";
import { commitGraphState } from "../src/graph/graphState.js";
import { dynamicUpdatePreview } from "../src/visualization/dynamicUpdatePreview.js";
import { compileGraphMutationGrammar } from "../src/agent/deterministicNlu/domains/graphMutationGrammar.js";
import { graphIdentityFromState } from "../src/graph/graphState.js";
import { readFile } from "node:fs/promises";

const { h, controls, selector } = await controlsHarness();
const graph = h.graph;
controls.discard(selector());
assert.equal(h.graph, graph); assert.equal(h.counts.commits, 0);
assert.equal(h.counts.submissions, 0); assert.equal(controls.observe(), null);
await controls.stageBatch("DELETE h1\nUPDATE h2: a, c\nADD_HYPEREDGE h4: b, z");
const first = h.pending.getCurrent(), oldSelector = selector();
assert.equal(h.graph, graph);
const preview = dynamicUpdatePreview(graph, first);
assert.deepEqual([...preview.semantics.values()].sort(), ["deleted", "inserted", "replaced", "unchanged"]);
assert.equal(preview.hyperedges.find(edge => edge.id === "h1"), graph.hyperedges[0]);
const apply = controls.requestApply(selector());
const analysis = controls.requestAnalysis(selector());
assert.equal(h.counts.submissions, 0, "neither request creates a job or commit");
await assert.rejects(controls.confirmApply(analysis.confirmation), /owned/);
assert.equal((await controls.confirmAnalysis(analysis.argumentsValue, apply.confirmation)).ok, false);
assert.equal((await controls.confirmAnalysis(analysis.argumentsValue, analysis.confirmation)).ok, true);
await controls.openAnalysisResult(h.job.jobId);
assert.equal(controls.observe().resultCurrent, true);
assert.equal(h.counts.commits, 0, "analysis never Apply");
await controls.stageBatch("DELETE h2");
const edited = h.pending.getCurrent();
assert.ok(edited.revision > first.revision); assert.notEqual(edited.updateId, first.updateId); assert.notEqual(edited.updateDigest, first.updateDigest);
assert.equal(controls.observe().resultCurrent, false, "edit stales presentation synchronously");
assert.throws(() => controls.requestApply(oldSelector), /superseded/);
await assert.rejects(controls.confirmApply(apply.confirmation), /owned/);
for (const bad of [{}, { ...selector(), revision: -1 }, { ...selector(), updateId: "forged" }, { ...selector(), nativePath: "x" }]) assert.throws(() => controls.requestApply(bad));
const fresh = controls.requestApply(selector());
await assert.rejects(controls.confirmApply({ ...fresh.confirmation }), /owned/);
const commitsBefore = h.counts.commits, jobsBefore = h.counts.submissions;
const attempts = await Promise.allSettled([controls.confirmApply(fresh.confirmation), controls.confirmApply(fresh.confirmation)]);
assert.equal(attempts.filter(item => item.status === "fulfilled").length, 1);
assert.equal(h.counts.commits, commitsBefore + 1); assert.equal(h.counts.submissions, jobsBefore, "Apply does not analyze");
assert.equal(h.graph.graphVersion, graph.graphVersion + 1); assert.equal(h.pending.getCurrent(), null);
assert.equal(h.analysis.currentResult(), null); assert.equal(controls.observe(), null);

await controls.stageBatch("UPDATE_WEIGHT h1: 2");
assert.equal(controls.observe().motifImpact, "NONE"); assert.throws(() => controls.requestAnalysis(selector()));
await controls.confirmApply(controls.requestApply(selector()).confirmation);
await controls.stageBatch("DELETE h1");
const staleApproval = controls.requestApply(selector()).confirmation;
h.graph = commitGraphState(h.graph, h.graph.hyperedges, { graphType: "Hypergraph" });
h.pending.onGraphTransition(h.graph, "GRAPH_TYPE_CHANGED");
assert.equal(controls.observe().staleReason, "GRAPH_TYPE_CHANGED");
assert.equal(dynamicUpdatePreview(h.graph, h.pending.getCurrent()), null);
await assert.rejects(controls.confirmApply(staleApproval));
assert.throws(() => controls.requestApply(selector()), /stale/);
controls.discard(selector());
await assert.rejects(controls.stageBatch("DELETE h3"), /DynamicHypergraph/);

// Discard while a confirmed analysis is uploading: late work never becomes current.
const race = await controlsHarness();
let release;
const gate = new Promise(resolve => { release = resolve; });
const upload = race.h.client.uploadArtifact;
race.h.client.uploadArtifact = async args => { await gate; return upload(args); };
const approval = race.controls.requestAnalysis(race.selector());
const job = race.controls.confirmAnalysis(approval.argumentsValue, approval.confirmation);
await new Promise(resolve => setTimeout(resolve, 10));
race.controls.discard(race.selector()); release();
assert.equal((await job).ok, false); assert.equal(race.h.counts.commits, 0); assert.equal(race.h.counts.submissions, 0);
assert.equal(race.h.analysis.currentResult(), null);

// Cancellation followed by a new analysis cannot revive an older Apply approval.
const cancelled = await controlsHarness();
await cancelled.h.run();
const oldApply = cancelled.controls.requestApply(cancelled.selector()).confirmation;
await cancelled.h.analysis.cancelJob(cancelled.h.job.jobId);
await cancelled.h.run();
assert.equal(cancelled.controls.isApplyCurrent(oldApply), false);
await assert.rejects(cancelled.controls.confirmApply(oldApply), /changed|cancelled/);
assert.equal(cancelled.h.counts.commits, 0);
const reanalysisApply = cancelled.controls.requestApply(cancelled.selector()).confirmation;
cancelled.controls.requestAnalysis(cancelled.selector());
await assert.rejects(cancelled.controls.confirmApply(reanalysisApply), /owned/);
// A fresh independent Apply remains permitted, without another job.
const finalJobs = cancelled.h.counts.submissions;
await cancelled.controls.confirmApply(cancelled.controls.requestApply(cancelled.selector()).confirmation);
assert.equal(cancelled.h.counts.commits, 1); assert.equal(cancelled.h.counts.submissions, finalJobs);

// The actual compound planner emits both operations; only a sole Undo is exempt.
const mixed = compileGraphMutationGrammar("undo last mutation and add hyperedge h9 with vertices x", {
  hyperedges: graph.hyperedges, graphIdentity: graphIdentityFromState(graph),
  graphHistory: [{ beforeHyperedges: graph.hyperedges, beforeGraphType: "DynamicHypergraph" }],
});
assert.equal(mixed.ok, true);
assert.deepEqual(mixed.plan.operations.map(operation => operation.type), ["UNDO_LAST_MUTATION", "ADD_HYPEREDGE"]);
for (const path of ["../src/App.jsx", "../src/components/AgentChatPanel.jsx"]) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  assert.match(source, /operations\?\.length === 1 && [\w.]+\.operations\[0\]\.type === "UNDO_LAST_MUTATION"/);
}
console.log("Scope 5D stage/edit/discard, previews, exact selectors, token crossing, result currency, independent Apply and reentry passed.");
