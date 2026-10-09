import assert from 'node:assert/strict';
import { collisionA, collisionB, dynamicCollisionA, dynamicCollisionB } from './fixtures/candy-scope5f-collision.mjs';
import { harness } from './fixtures/candy-scope5-runtime.mjs';
import { createGraphState, commitGraphState, graphIdentityFromState } from '../src/graph/graphState.js';
import { graphFingerprint } from '../src/graph/graphFingerprint.js';
import { createMutationPlan } from '../src/graph/graphMutationValidator.js';
import { previewGraphMutation } from '../src/graph/graphMutationPreview.js';
import { buildAuthoritativeOrchestratorObservation, observationStillCurrent } from '../src/agent/orchestratorObservation.js';

const observe=h=>buildAuthoritativeOrchestratorObservation({state:{...graphIdentityFromState(h.graph),hasGraph:true,
  pendingDynamicUpdate:h.pending.getCurrent()?{...h.pending.getCurrent(),resultCurrent:Boolean(h.analysis.currentResult())}:null,
  candy:{...h.runtime,analysisStatus:h.analysis.getSnapshot().status,selectedJob:h.analysis.getSnapshot().job}}});

assert.notDeepEqual(collisionA,collisionB);
assert.equal(graphFingerprint(collisionA),'gfp-27452219-287');
assert.equal(graphFingerprint(collisionA),graphFingerprint(collisionB));
const h=await harness();h.pending.discard();h.graph=createGraphState(structuredClone(collisionA));
assert.ok((await h.run('STATIC')).ok);assert.ok((await h.analysis.openResult(h.job.jobId)).ok);
const result=h.analysis.currentResult(),before=h.graph,oldObservation=observe(h);
assert.equal(result.result.native.totalConnectedTriples,1);
const noop=commitGraphState(before,structuredClone(collisionA));assert.equal(noop.graphId,before.graphId);assert.equal(noop.graphVersion,before.graphVersion);
h.graph=commitGraphState(before,structuredClone(collisionB),{replacement:true});
assert.notEqual(h.graph.graphId,before.graphId);assert.equal(h.graph.graphVersion,before.graphVersion+1);assert.equal(h.graph.graphFingerprint,before.graphFingerprint);
assert.equal(h.analysis.currentResult(),null);assert.equal((await h.analysis.openResult(h.job.jobId)).ok,false);
assert.equal(h.analysis.getSnapshot().resultEvidence,null);assert.equal(h.analysis.getSnapshot().status,'STALE');assert.equal(h.pending.getCurrent(),null);
assert.equal(observationStillCurrent(oldObservation,observe(h)),false);
assert.equal(observe(h).graph.id,h.graph.graphId);assert.equal(observe(h).pendingDynamicUpdate,null);
const args={mode:'STATIC',backend:'CUDA_STATIC',deviceId:0,timeoutMs:5000};
const token=h.analysis.stage(args);assert.ok(token.ok);const version=h.graph.graphVersion;
h.graph=commitGraphState(h.graph,structuredClone(collisionA),{replacement:true});
assert.equal((await h.analysis.submit(args,token.confirmation)).ok,false);assert.equal(h.graph.graphVersion,version+1);
for(const authority of [{...before,graphId:'different'},{...before,graphVersion:before.graphVersion+1}]) {
  h.graph=authority;assert.equal(h.analysis.currentResult(),null);
}
const mutation=commitGraphState(before,structuredClone(collisionB));assert.equal(mutation.graphId,before.graphId);assert.equal(mutation.graphVersion,before.graphVersion+1);
const plan=createMutationPlan({graphIdentity:graphIdentityFromState(before),operations:[{type:'SET_HYPEREDGE_TIME',hyperedgeId:'h0',time:'00002427'},{type:'REMOVE_HYPEREDGE',hyperedgeId:'h2'},{type:'ADD_HYPEREDGE',hyperedgeId:'h2',vertices:['D','E']}]});
const preview=previewGraphMutation(before.hyperedges,plan,graphIdentityFromState(before));assert.ok(preview.ok);assert.equal(preview.beforeFingerprint,preview.afterFingerprint);assert.ok(preview.graphChanged,'colliding material mutation is not a full no-op');
const identicalReplacement=commitGraphState(before,structuredClone(collisionA),{replacement:true});assert.notEqual(identicalReplacement.graphId,before.graphId);assert.equal(identicalReplacement.graphVersion,before.graphVersion+1);
const d=await harness();d.pending.discard();d.graph=createGraphState(dynamicCollisionA,{graphType:'DynamicHypergraph'});
assert.equal(d.graph.graphFingerprint,'gfp-7912e519-294');
assert.equal(graphFingerprint(dynamicCollisionB,{graphType:'DynamicHypergraph'}),d.graph.graphFingerprint);
await d.stage([{type:'REMOVE_HYPEREDGE',hyperedgeId:'h0'}]);
const dynamicRun=await d.run();assert.ok(dynamicRun.ok,JSON.stringify(dynamicRun));assert.ok((await d.analysis.openResult(d.job.jobId)).ok);
assert.ok(d.analysis.currentResult());const dynamicObservation=observe(d),dynamicBefore=d.graph;
const incrementalArgs={mode:'INCREMENTAL',backend:'CUDA_INCREMENTAL',deviceId:0,timeoutMs:5000,updateContextId:d.pending.getCurrent().updateId};
const dynamicApproval=d.analysis.stage(incrementalArgs);assert.ok(dynamicApproval.ok);
d.graph=commitGraphState(d.graph,dynamicCollisionB,{graphType:'DynamicHypergraph',replacement:true});
assert.notEqual(d.graph.graphId,dynamicBefore.graphId);assert.equal(d.graph.graphVersion,dynamicBefore.graphVersion+1);assert.equal(d.graph.graphFingerprint,dynamicBefore.graphFingerprint);
assert.equal(d.analysis.currentResult(),null);assert.equal((await d.analysis.openResult(d.job.jobId)).ok,false);
assert.equal((await d.analysis.submit(incrementalArgs,dynamicApproval.confirmation)).ok,false);
assert.equal(observationStillCurrent(dynamicObservation,observe(d)),false);assert.equal(observe(d).pendingDynamicUpdate.resultCurrent,false);
assert.equal(d.pending.onGraphTransition(d.graph).status,'STALE');
h.analysis.dispose();h.pending.dispose();d.analysis.dispose();d.pending.dispose();
console.log('Scope5F real currentness collision regression, exact no-op and replacement lineage passed (fixture Runtime; separate live CUDA evidence).');
