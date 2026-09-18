import assert from "node:assert/strict";
import test from "node:test";
import { packCudaIncrementalRequest, candidateCount, signIncrementalPayload, validateCudaIncrementalResult, CUDA_INCREMENTAL_RESULT_SCHEMA } from "../candy-runtime/test/hypergraph-motif-cuda-incremental-contract.mjs";
import { CANDY_SCHEMA_VERSIONS } from "../src/candy/contracts/schemaVersions.js";
import { ANCHOR_OVER_SUBTRACTION_COUNTEREXAMPLE, ANCHOR_COUNTEREXAMPLE_DELETE } from "./fixtures/candy-scope4-motifs.mjs";
import { computeExactHypergraphMotifDelta } from "../src/candy/hypergraphMotifs/referenceOracle.js";

test("candidate cardinality agrees with independent duplicate-producing affected-edge enumeration", () => {
  for (let n=0;n<=12;n++) for (let a=0;a<=n;a++) {
    const triples=new Set();
    for (let edge=0;edge<a;edge++) for (let i=0;i<n;i++) for (let j=i+1;j<n;j++) if (edge!==i && edge!==j) triples.add([edge,i,j].sort((x,y)=>x-y).join(","));
    assert.equal(candidateCount(n,a),triples.size);
  }
});
test("adapter-derived snapshots preserve typed identity, isolates, replacements and canonical digest", () => {
  const old={ schemaVersion:CANDY_SCHEMA_VERSIONS.HYPERGRAPH_INCIDENCE,graphId:'typed "\\\n🍬\ud800',graphVersion:9,graphType:"DynamicHypergraph",vertices:[0,"0","isolate"],hyperedges:[{id:0,vertices:[0]},{id:"0",vertices:["0"]},{id:"C",vertices:[0,"0"]}] };
  const update={schemaVersion:CANDY_SCHEMA_VERSIONS.HYPERGRAPH_MOTIF_UPDATE,updateId:"replace",baseGraphRef:{graphId:old.graphId,graphVersion:9},nextGraphVersion:10,ordering:"DELETE_THEN_INSERT",collisionPolicy:"REJECT_EXCEPT_EXACT_DELETE_REINSERT",deletions:[0],insertions:[{id:0,vertices:["0",-99]}]};
  const packed=packCudaIncrementalRequest(old,update);
  assert.ok(Object.isFrozen(packed.oldStatic) && Object.isFrozen(packed.newStatic));
  assert.equal(packed.oldAffected.length,1);assert.equal(packed.newAffected.length,1);
  assert.equal(packed.newGraph.vertexCount,4);assert.equal(packed.newGraph.graphVersion,10);
  assert.notEqual(packed.newGraph.hyperedgeMapping.toNative(0),packed.newGraph.hyperedgeMapping.toNative("0"));
  assert.equal(packed.newGraph.isolatedVertexNativeIndices.length,1);
  const reordered=structuredClone(old);reordered.vertices.reverse();reordered.hyperedges.reverse();reordered.hyperedges.forEach(e=>e.vertices.reverse());
  const secondUpdate=structuredClone(update);secondUpdate.insertions[0].vertices.reverse();
  assert.equal(packCudaIncrementalRequest(reordered,secondUpdate).text,packed.text);
  const body=packed.text.split("\n").slice(2).join("\n");assert.equal(signIncrementalPayload(body).digest,packed.digest);
  assert.throws(()=>packCudaIncrementalRequest({...old,priorCounts:Array(30).fill(0)},update));
  assert.throws(()=>packCudaIncrementalRequest(old,{...update,baseGraphRef:{graphId:old.graphId,graphVersion:8}}));
  assert.throws(()=>packCudaIncrementalRequest(old,{...update,deletions:[]}));
});
test("signed result contract rejects replay, stale prior state, wrong bindings and reconstruction corruption", () => {
  const packed=packCudaIncrementalRequest(ANCHOR_OVER_SUBTRACTION_COUNTEREXAMPLE,ANCHOR_COUNTEREXAMPLE_DELETE);
  const cpu=computeExactHypergraphMotifDelta(ANCHOR_OVER_SUBTRACTION_COUNTEREXAMPLE,ANCHOR_COUNTEREXAMPLE_DELETE);
  // Test-only fixture: deletion affects six old connected triples and no new candidates.
  const negative=cpu.deltaCounts.map(delta=>-delta);
  const valid={ok:true,schemaVersion:CUDA_INCREMENTAL_RESULT_SCHEMA,algorithm:"HYPERGRAPH_3EDGE_MOTIF_COUNT",taxonomyVersion:"candy.hypergraph-3edge-motif-taxonomy/1",backend:"CUDA_INCREMENTAL",mode:"INCREMENTAL",inputGraphRef:{graphId:packed.oldGraph.graphId,graphVersion:1},outputGraphRef:{graphId:packed.newGraph.graphId,graphVersion:2},updateId:packed.update.updateId,requestDigest:packed.digest,oldAffectedEdgeCount:1,newAffectedEdgeCount:0,oldCandidateCount:6,newCandidateCount:0,oldAffectedCounts:negative,newAffectedCounts:Array(30).fill(0),deltaCounts:cpu.deltaCounts,deltaTotalConnectedTriples:-3,cuda:{deviceIndex:0,deviceName:"test-only",computeMajor:12,computeMinor:0,compiledArchitecture:"sm_120",compilerVersion:"13.4.59",runtimeVersion:13040,driverVersion:13040,kernelLaunchSucceeded:true,synchronizationSucceeded:true,kernelMilliseconds:0}};
  validateCudaIncrementalResult(valid,packed);
  valid.deltaCounts.forEach((delta,i)=>assert.equal(cpu.oldCounts[i]+delta,cpu.newCounts[i]));
  for (const change of [v=>{v.requestDigest="0".repeat(64);},v=>{v.inputGraphRef.graphVersion=0;},v=>{v.deltaCounts[0]++;},v=>{v.deltaTotalConnectedTriples++;},v=>{v.priorCounts=cpu.oldCounts;},v=>{v.cuda.deviceIndex=99;},v=>{v.backend="CPU_REFERENCE_ORACLE";}]) {
    const corrupt=structuredClone(valid);change(corrupt);assert.throws(()=>validateCudaIncrementalResult(corrupt,packed));
  }
  assert.throws(()=>validateCudaIncrementalResult(valid,{...packed}));
});
