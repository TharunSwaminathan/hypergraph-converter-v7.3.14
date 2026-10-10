import assert from "node:assert/strict";
import { harness, sealResult } from "./fixtures/candy-scope5-runtime.mjs";
import { signedMotifValue } from "../src/candy/resultObservation.js";
import { motifApplicationBinding, motifAuthorityKey } from "../src/candy/motifPreflight.js";

assert.deepEqual([3,-3,0].map(signedMotifValue),["+3","-3","0"]);
const baseline=await harness();assert.equal((await baseline.run()).ok,true);assert.equal((await baseline.analysis.openResult(baseline.job.jobId)).ok,true);
const evidence=baseline.analysis.currentResult();
assert.equal(evidence.result.native.deltaCounts.length,30);assert.equal(evidence.interpretation,"delta_only");
assert.equal(Object.hasOwn(evidence.result.native,"counts"),false);assert.equal(Object.hasOwn(evidence,"afterCounts"),false);
assert.ok(evidence.result.native.deltaCounts.includes(1));assert.ok(evidence.result.native.deltaCounts.includes(-1));assert.ok(evidence.result.native.deltaCounts.includes(0));
for(const field of ["runtimeSessionId","jobId","requestId","algorithm","taxonomyVersion","backend","mode","graphArtifactId","requestDigest"]) {
  const h=await harness();await h.run();h.result=sealResult({...h.result,[field]:"substituted"});assert.equal((await h.analysis.openResult(h.job.jobId)).ok,false,field);
}
for(const change of [r=>{r.inputGraphRef.graphId="other";},r=>{r.inputGraphRef.graphVersion++;},r=>{r.updateRef.updateId="other";},r=>{r.updateRef.artifactId="sha256:"+"b".repeat(64);},r=>{r.updateRef.nextGraphVersion++;},r=>{r.native.outputGraphRef.graphVersion++;},r=>{r.native.outputGraphRef.graphId="other";},r=>{r.native.inputGraphRef.graphVersion++;},r=>{r.native.cuda.deviceIndex=1;},r=>{r.native.cuda.compiledArchitecture="sm_80";},r=>{r.native.requestDigest="bad";},r=>{r.native.requestDigest=r.requestDigest="bad";},r=>{r.native.taxonomyVersion="bad";},r=>{r.native.deltaCounts.pop();},r=>{r.native.deltaTotalConnectedTriples++;},r=>{r.interpretation="absolute_counts";}]) {
  const h=await harness();await h.run();const result=structuredClone(h.result);change(result);h.result=sealResult(result);
  assert.equal((await h.analysis.openResult(h.job.jobId)).ok,false);assert.equal(h.analysis.currentResult(),null);assert.equal(h.counts.commits,0);
}
const artifact=await harness();await artifact.run();artifact.result={...artifact.result,resultArtifactRef:{id:"sha256:"+"a".repeat(64)}};assert.equal((await artifact.analysis.openResult(artifact.job.jobId)).ok,false);
for(const field of ["graphId","graphVersion","graphFingerprint","graphType"]) {
  const h=await harness();await h.run();await h.analysis.openResult(h.job.jobId);h.graph={...h.graph,[field]:field==="graphVersion"?99:"other"};assert.equal(h.analysis.currentResult(),null,field);assert.equal((await h.analysis.openResult(h.job.jobId)).ok,false);
}
for(const field of ["revision","updateDigest","proposedGraphFingerprint","nextGraphVersion","status","motifImpact"]) {
  const binding=motifApplicationBinding(baseline.graph,baseline.pending.getCurrent());const changed={...binding,[field=== "status"?"pendingStatus":field]:"other"};
  assert.notEqual(motifAuthorityKey(binding),motifAuthorityKey(changed),field);
}
const replaced=await harness();await replaced.run();await replaced.analysis.openResult(replaced.job.jobId);
await replaced.stage([{type:"ADD_INCIDENCE",hyperedgeId:"h1",vertexId:"d"}]);assert.equal(replaced.analysis.currentResult(),null);
const restart=await harness();await restart.run();await restart.analysis.openResult(restart.job.jobId);restart.runtime={...restart.runtime,runtimeSessionId:"replacement"};assert.equal(restart.analysis.currentResult(),null);
assert.ok(Object.isFrozen(evidence));assert.ok(Object.isFrozen(evidence.result.native.deltaCounts));
assert.equal(evidence.applyAuthority,false);assert.equal(baseline.counts.commits,0);
console.log("Scope 5C exact registry, signed delta-only semantics and all result/app authority substitutions passed.");
