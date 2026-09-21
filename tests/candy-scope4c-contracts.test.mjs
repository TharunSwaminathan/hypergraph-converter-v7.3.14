import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { MOTIF_ALGORITHM, MOTIF_TAXONOMY, MOTIF_RUNTIME_REQUEST, validateRuntimeMotifRequest } from "../src/candy/contracts/runtimeMotif.js";
import { motifSelectorErrors, submitMotifWorkflow, validateBrowserMotifResult } from "../src/candy/motifWorkflow.js";
import { motifQueryPolicy } from "../src/agent/motifQueryPolicy.js";
import { runBoundedOrchestrator } from "../src/agent/orchestratorLoop.js";
import { candyRequestConfirmationBinding } from "../src/candy/requestPolicy.js";
import { ALL_30_MOTIF_WITNESSES } from "./fixtures/candy-scope4-motifs.mjs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ArtifactStore } from "../candy-runtime/src/artifacts/artifactStore.js";
import { JobManager } from "../candy-runtime/src/jobs/jobManager.js";
import { createRuntimeConfig } from "../candy-runtime/src/config.js";

const graph=ALL_30_MOTIF_WITNESSES[0].graph;
const request={schemaVersion:MOTIF_RUNTIME_REQUEST,requestId:"01234567-1234-4234-8234-0123456789ab",algorithm:MOTIF_ALGORITHM,taxonomyVersion:MOTIF_TAXONOMY,mode:"STATIC",backend:"CUDA_STATIC",graphRef:{graphId:graph.graphId,graphVersion:graph.graphVersion},deviceId:0,timeoutMs:5000};
const snapshot={graphId:graph.graphId,graphVersion:graph.graphVersion,graphType:"Hypergraph"};
const selector={mode:"STATIC",backend:"CUDA_STATIC",deviceId:0,timeoutMs:5000};
const capability={backend:"CUDA_STATIC",modes:["STATIC"],devices:[{id:0}]};
const observation={graph:{available:true,graphType:"Hypergraph"},candy:{featureEnabled:true,authorized:true,capabilities:[capability]},availableCapabilities:["SUBMIT_CANDY_MOTIF_JOB"],stateVersionToken:"fixed"};
const query="Count the 3-edge motifs on the current hypergraph using CUDA.";
const proposal=args=>({outcome:"PROPOSE_ACTION",action:"SUBMIT_CANDY_MOTIF_JOB",arguments:args,requiresUserInput:false,userMessage:null,finish:false});

test("motif Runtime schema rejects type, mode/backend, taxonomy, stale graph, unknown authority and unsafe bounds",()=>{
  assert.equal(validateRuntimeMotifRequest(request,snapshot).backend,"CUDA_STATIC");
  for(const type of ["OrdinaryGraph","DynamicOrdinaryGraph","ProjectedOrdinaryGraph"]) assert.throws(()=>validateRuntimeMotifRequest(request,{...snapshot,graphType:type}),error=>error.code==="INVALID_GRAPH_TYPE");
  for(const change of [{backend:"CUDA_INCREMENTAL"},{taxonomyVersion:"invented"},{deviceId:"0"},{deviceId:-1},{timeoutMs:0},{timeoutMs:60001},{timeoutMs:1.5},{executable:"/tmp/evil"},{newGraph:{}},{candidateTuples:[]},{graphRef:{...request.graphRef,graphVersion:999}}]) assert.throws(()=>validateRuntimeMotifRequest({...request,...change},snapshot));
  assert.throws(()=>validateRuntimeMotifRequest({...request,mode:"INCREMENTAL",backend:"CUDA_INCREMENTAL"},snapshot),error=>error.code==="INVALID_GRAPH_TYPE");
});
test("model selectors cannot supply graph, update contents, paths, token, environment or launch configuration",()=>{
  assert.deepEqual(motifSelectorErrors(selector),[]);
  for(const key of ["graph","graphRef","newGraph","memberships","affected","candidateTuples","packedRequest","requestPath","executable","env","distro","token","baseUrl","threads","launchGeometry"]) assert.ok(motifSelectorErrors({...selector,[key]:"invented"}).length);
  assert.ok(motifSelectorErrors({...selector,backend:"CUDA_INCREMENTAL"}).length);
  assert.ok(motifSelectorErrors({...selector,updateContextId:"unexpected"}).length);
});
test("browser workflow stops on stale context before creating a job and rejects missing authoritative updates",async()=>{
  let uploads=0,jobs=0,current=true;
  const client={uploadArtifact:async()=>{uploads++;current=false;return{id:`sha256:${"a".repeat(64)}`,mediaType:"application/vnd.candy.graph+json"};},submitJob:async()=>{jobs++;}};
  await assert.rejects(submitMotifWorkflow({client,graphValue:graph,argumentsValue:selector,isCurrent:()=>current}),error=>error.code==="STALE_GRAPH_VERSION");
  assert.equal(uploads,1);assert.equal(jobs,0);
  await assert.rejects(submitMotifWorkflow({client,graphValue:graph,argumentsValue:{mode:"INCREMENTAL",backend:"CUDA_INCREMENTAL",deviceId:0,timeoutMs:5000,updateContextId:"absent"}}),error=>error.code==="INVALID_GRAPH_TYPE");
  await assert.rejects(submitMotifWorkflow({client,graphValue:{...graph,graphType:"DynamicHypergraph"},argumentsValue:{mode:"INCREMENTAL",backend:"CUDA_INCREMENTAL",deviceId:0,timeoutMs:5000,updateContextId:"absent"}}),error=>error.code==="INVALID_UPDATE_BATCH");
});
test("browser result rejects content substitution, Runtime/session and cross-graph replay",async()=>{
  const binding={runtimeSessionId:"session",requestId:request.requestId,graphRef:request.graphRef,graphArtifactId:`sha256:${"a".repeat(64)}`,updateRef:null,backend:"CUDA_STATIC",mode:"STATIC",deviceId:0};
  const result={schemaVersion:"candy.runtime-motif-result/1",...binding,inputGraphRef:binding.graphRef,algorithm:MOTIF_ALGORITHM,taxonomyVersion:MOTIF_TAXONOMY,validation:{status:"passed"},execution:{exitCode:0},interpretation:"absolute_counts",native:{algorithm:MOTIF_ALGORITHM,taxonomyVersion:MOTIF_TAXONOMY,backend:"CUDA_STATIC",mode:"STATIC",counts:Array(30).fill(0),totalConnectedTriples:0,cuda:{deviceIndex:0,kernelLaunchSucceeded:true,synchronizationSucceeded:true}}};
  delete result.graphRef;delete result.deviceId;
  result.resultArtifactRef={id:`sha256:${createHash("sha256").update(JSON.stringify(result)).digest("hex")}`};
  await validateBrowserMotifResult(result,binding);
  for(const change of [{runtimeSessionId:"another"},{graphArtifactId:`sha256:${"b".repeat(64)}`},{backend:"CPU_REFERENCE_ORACLE"},{taxonomyVersion:"another"},{interpretation:"absolute_reconstruction"},{requestId:"another"}]) await assert.rejects(validateBrowserMotifResult({...result,...change},binding));
  const substituted=structuredClone(result);substituted.native.counts[0]=1;substituted.native.totalConnectedTriples=1;
  await assert.rejects(validateBrowserMotifResult(substituted,binding),error=>error.code==="RESULT_VALIDATION_FAILURE");
});
test("typed motif preflight rejects known invalid graph and unavailable backend with zero model/native calls",async()=>{
  for(const [queryValue,type,caps,classification] of [[query,"OrdinaryGraph",[capability],"INVALID_GRAPH_TYPE"],["Run incremental motif analysis.","Hypergraph",[capability],"INVALID_GRAPH_TYPE"],[query,"Hypergraph",[],"BACKEND_UNAVAILABLE"],["Project this and then count motifs.","Hypergraph",[capability],"INVALID_GRAPH_TYPE"]]) {
    let model=0,executions=0;
    const result=await runBoundedOrchestrator({userQuery:queryValue,getObservation:async()=>({...observation,graph:{available:true,graphType:type},candy:{...observation.candy,capabilities:caps}}),callModel:async()=>{model++;},executeAction:async()=>{executions++;}});
    assert.equal(result.classification,classification);assert.equal(model,0);assert.equal(executions,0);
  }
});
test("CUDA motif proposal stages exact confirmation without running a job",async()=>{
  let executed=0,staged=0;
  const result=await runBoundedOrchestrator({userQuery:query,getObservation:async()=>observation,callModel:async()=>({ok:true,step:proposal(selector)}),executeAction:async()=>{executed++;},stageConfirmation:async step=>{staged++;assert.deepEqual(step.arguments,selector);return{ok:true};}});
  assert.equal(result.stopReason,"confirmation");assert.equal(staged,1);assert.equal(executed,0);assert.equal(result.metrics.modelCalls,1);
});
test("invented motif arguments reobserve within eight steps; no deterministic mutation fallback is called",async()=>{
  let calls=0,observations=0,staged=0,fallback=0;
  const result=await runBoundedOrchestrator({userQuery:query,getObservation:async()=>{observations++;return observation;},callModel:async()=>{calls++;return{ok:true,step:proposal({...selector,newGraph:{}})};},stageConfirmation:async()=>{staged++;},fallback:async()=>{fallback++;}});
  assert.equal(calls,8);assert.ok(observations>=9);assert.equal(staged,0);assert.equal(fallback,0);assert.equal(result.outcome,"max_steps_reached");
});
test("incremental hypothetical analysis is allowed only with DynamicHypergraph and a real pending selector",async()=>{
  const obs={...observation,graph:{available:true,graphType:"DynamicHypergraph"},candy:{...observation.candy,pendingUpdateContext:{updateId:"pending"},capabilities:[{backend:"CUDA_INCREMENTAL",modes:["INCREMENTAL"],devices:[{id:0}]}]}};
  const text="How do the motif counts change if I apply this update?";
  assert.equal(motifQueryPolicy(text,obs).backend,"CUDA_INCREMENTAL");
  let executed=0;
  const result=await runBoundedOrchestrator({userQuery:text,getObservation:async()=>obs,callModel:async()=>({ok:true,step:proposal({mode:"INCREMENTAL",backend:"CUDA_INCREMENTAL",deviceId:0,timeoutMs:5000,updateContextId:"pending"})}),stageConfirmation:async()=>({ok:true}),executeAction:async()=>{executed++;}});
  assert.equal(result.stopReason,"confirmation");assert.equal(executed,0);
});
test("confirmation binds Runtime session and exact pending-context digest",()=>{
  const graphRef={id:graph.graphId,version:graph.graphVersion,runtimeSessionId:"first",motifContextVersion:"first-digest"};
  const binding=candyRequestConfirmationBinding({argumentsValue:selector,graph:graphRef});
  for(const change of [{runtimeSessionId:"second"},{motifContextVersion:"second-digest"},{version:999}]) assert.notEqual(binding.requestHash,candyRequestConfirmationBinding({argumentsValue:selector,graph:{...graphRef,...change}}).requestHash);
});
test("motif model failures and fabricated success never invoke a workspace fallback",async()=>{
  for (const modelResult of [{ok:false,error:"offline"},{ok:true,step:{outcome:"FINAL_RESPONSE",action:null,arguments:null,requiresUserInput:false,userMessage:"Successfully applied the update and counted motifs.",finish:true}}]) {
    let mutations=0;
    const result=await runBoundedOrchestrator({userQuery:query,getObservation:async()=>observation,callModel:async()=>modelResult,fallback:async()=>{mutations++;return{ok:true};}});
    assert.equal(result.ok,false);assert.equal(mutations,0);assert.equal(result.metrics.fallbackCount,0);
  }
});
test("missing authoritative graph fails motif preflight before calling the model",()=>{
  assert.equal(motifQueryPolicy(query,{...observation,graph:{available:false}}).classification,"INVALID_GRAPH_TYPE");
});
test("fixed legacy OpenMP transport accepts its missing backend field and rejects conflicting backend claims",async()=>{
  const root=await mkdtemp(join(tmpdir(),"scope4c-legacy-openmp-"));
  const store=await new ArtifactStore({root,maxBytes:4096}).initialize();
  try {
    const value={graphType:"OrdinaryGraph",directed:true,vertices:["A"],edges:[]};
    const artifact=await store.put(Buffer.from(JSON.stringify(value)),"application/vnd.candy.graph+json");
    const snapshot={schemaVersion:"candy.graph-snapshot/1",graphId:"legacy",graphVersion:1,graphType:"OrdinaryGraph",directed:true,weightModel:{kind:"nonnegative_integer",objectives:["cost"]},vertexCount:1,edgeCount:0,canonicalArtifactRef:artifact,provenance:{}};
    for(const backend of [undefined,"LOCAL_OPENMP","LOCAL_CUDA",null,"CPU_REFERENCE_ORACLE"]){
      const native={schemaVersion:"candy.native-sssp-result/1",ok:true,algorithm:"SSSP",mode:"STATIC",graphId:"legacy",graphVersion:1,source:0,vertexCount:1,reachableCount:1,unreachableCount:0,affectedVertices:0,validation:{status:"not_requested"},metrics:{},distances:[0],parents:[-1],...(backend===undefined?{}:{backend})};
      const manager=new JobManager({artifactStore:store,config:createRuntimeConfig({backendAvailable:true,nativeRunner:{run:async()=>({stdout:JSON.stringify(native),exitCode:0})}})});
      const request={schemaVersion:"candy.algorithm-request/1",requestId:crypto.randomUUID(),capability:"RUN_SSSP",algorithm:"SSSP",algorithmVersion:"scope1-openmp-sssp/1",mode:"STATIC",backend:"LOCAL_OPENMP",graphRef:{graphId:"legacy",graphVersion:1},parameters:{sourceVertexId:"A",objective:"cost"},resourceHints:{threads:1,timeoutMs:1000}};
      const job=await manager.submit({schemaVersion:"candy.job-submit/1",request,graphSnapshot:snapshot,graphArtifactId:artifact.id});
      for(let i=0;i<100&&!['completed','failed'].includes(manager.get(job.jobId).status);i++)await new Promise(resolve=>setTimeout(resolve,5));
      const status=manager.get(job.jobId);assert.equal(status.status,[undefined,"LOCAL_OPENMP"].includes(backend)?"completed":"failed");if(status.status==="failed")assert.equal(status.error.classification,"RESULT_VALIDATION_FAILURE");await manager.close();
    }
  } finally {await rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
});
