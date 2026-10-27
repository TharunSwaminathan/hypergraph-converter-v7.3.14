import assert from 'node:assert/strict';
import { writeFile,readFile,readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { startCandyRuntime } from '../../candy-runtime/src/server.js';
import { createCandyClient } from '../../src/candy/client.js';
import { createGraphState,commitGraphState,graphIdentityFromState } from '../../src/graph/graphState.js';
import { createMutationPlan } from '../../src/graph/graphMutationValidator.js';
import { createPendingHypergraphUpdateController,APPLY_PENDING_HYPERGRAPH_UPDATE_ACTION } from '../../src/graph/pendingHypergraphUpdate.js';
import { createConfirmationSnapshot } from '../../src/agent/confirmationState.js';
import { createMotifAnalysisController } from '../../src/candy/motifAnalysisController.js';
import { motifGraphValue } from '../../src/candy/motifPreflight.js';
import { countHypergraphThreeEdgeMotifs } from '../../src/candy/hypergraphMotifs/referenceOracle.js';
import { ALL_30_MOTIF_WITNESSES } from '../../tests/fixtures/candy-scope4-motifs.mjs';

const output=name=>new URL(`../candy-scope6e-v5-${name}.json`,import.meta.url);
const save=(name,obj)=>writeFile(output(name),JSON.stringify(obj,null,2)+'\n',{flag:'wx'});
const hashes={CUDA_STATIC:'sha256:fd0e2af192a322a00f719c8289218a0e08f96a4861553d31613d1fab6c346688',CUDA_INCREMENTAL:'sha256:58772e07cc04a5135a4cd21d8f6ba33701801b79d06925cde99284db075d12ff'};
const edge=(id,vertices)=>({id,vertices,weight:1,time:null,attributes:{}});
const report={baseline:'d2a2bdb86ebf785ed2d7b43a9cca3a80ee7eb0d2',startedAt:new Date().toISOString(),
 injectedDiscovery:false,injectedRunner:false,nativeRebuild:false,nativeRequalification:false,oracleRole:'Expected-output comparison only; every submitted job executes the genuine production native backend.',cases:[],cleanShutdown:false};
let runtime,client,runtimeContext;
async function runCase({id,mode='STATIC',witnessIndex=0,operationKind='REPLACEMENT'}) {
 let graph=mode==='STATIC'?createGraphState(ALL_30_MOTIF_WITNESSES[witnessIndex].graph.hyperedges.map(e=>edge(e.id,e.vertices)),{graphType:'Hypergraph'}):createGraphState([edge('h1',['a','b']),edge('h2',['b','c']),edge('h3',['b','d'])],{graphType:'DynamicHypergraph'});
 let commits=0;
 const pending=createPendingHypergraphUpdateController({getGraphState:()=>graph,commit:(edges,options)=>{commits++;graph=commitGraphState(graph,edges,options);return graph;}});
 const analysis=createMotifAnalysisController({getContext:()=>({graph,pendingUpdate:pending.getCurrent(),runtime:runtimeContext}),getClient:options=>createCandyClient({baseUrl:client.baseUrl,token:runtime.pairingToken,...options})});
 try {
  let operations=[];
  if(mode==='INCREMENTAL') {
   operations=operationKind==='INSERT'?[{type:'ADD_HYPEREDGE',hyperedgeId:'h4',vertices:['a','c']}]:operationKind==='DELETE'?[{type:'REMOVE_HYPEREDGE',hyperedgeId:'h2'}]:[{type:'REMOVE_HYPEREDGE',hyperedgeId:'h1'},{type:'ADD_HYPEREDGE',hyperedgeId:'h1',vertices:['a','c']}];
   const staged=await pending.stage(createMutationPlan({graphIdentity:graphIdentityFromState(graph),operations,summary:'V5 bounded genuine '+operationKind}));assert.ok(staged.ok);
   assert.equal(pending.getCurrent().status,'VALIDATED');
  }
  const original=graph,graphText=JSON.stringify(graph),selected=pending.getCurrent();
  const oldCounts=countHypergraphThreeEdgeMotifs(motifGraphValue(graph));
  const proposed=selected?createGraphState(selected.preview.hyperedges,{graphType:'DynamicHypergraph'}):null;
  const expected=selected?countHypergraphThreeEdgeMotifs(motifGraphValue(proposed)).counts.map((v,i)=>v-oldCounts.counts[i]):oldCounts.counts;
  const args={mode,backend:mode==='STATIC'?'CUDA_STATIC':'CUDA_INCREMENTAL',deviceId:0,timeoutMs:10000,...(selected?{updateContextId:selected.updateId}:{})};
  const staged=analysis.stage(args);assert.ok(staged.ok,JSON.stringify(staged));
  const sent=await analysis.submit(args,staged.confirmation);assert.ok(sent.ok,JSON.stringify(sent));
  const deadline=Date.now()+35000;let observed;
  do {
   observed=await analysis.getJobStatus(sent.job.jobId);assert.ok(observed.ok,JSON.stringify(observed));
   if(['completed','failed','cancelled'].includes(observed.job.status))break;
   await new Promise(r=>setTimeout(r,25));
  } while(Date.now()<deadline);
  assert.equal(observed.job.status,'completed',JSON.stringify(observed));
  const opened=await analysis.openResult(sent.job.jobId);assert.ok(opened.ok,JSON.stringify(opened));
  const evidence=analysis.currentResult();assert.ok(evidence);const result=evidence.result;
  assert.equal(result.backend,args.backend);assert.equal(result.mode,mode);assert.equal(result.execution.nativeBuildFingerprint,hashes[args.backend]);
  assert.equal(result.execution.exitCode,0);assert.equal(result.validation.status,'passed');assert.equal(result.native.cuda.kernelLaunchSucceeded,true);assert.equal(result.native.cuda.synchronizationSucceeded,true);
  const counts=mode==='STATIC'?result.native.counts:result.native.deltaCounts;
  assert.equal(counts.length,30);assert.deepEqual(counts,expected);assert.equal(graph,original);assert.equal(JSON.stringify(graph),graphText);assert.equal(commits,0);
  const row={id,mode,backend:args.backend,operationKind:mode==='INCREMENTAL'?operationKind:null,witnessIndex:mode==='STATIC'?witnessIndex:null,
   operations,pendingUpdate:selected?.motifUpdate??null,jobId:sent.job.jobId,expectedCounts:expected,result,graphUnchangedByAnalyze:true,
   noCpuFallbackOrBackendSubstituteOrProjection:true,analysisApplyAuthority:evidence.applyAuthority};
  assert.equal(evidence.applyAuthority,false);
  if(selected) {
   assert.equal(result.interpretation,'delta_only');assert.equal(result.resultType,'HypergraphMotifDelta');
   assert.ok(counts.every(Number.isSafeInteger));
   await assert.rejects(pending.apply(staged.confirmation),/Apply confirmation/);assert.equal(commits,0);
   const apply=createConfirmationSnapshot(APPLY_PENDING_HYPERGRAPH_UPDATE_ACTION,{graphId:graph.graphId,graphVersion:graph.graphVersion,graphFingerprint:graph.graphFingerprint,graphType:graph.graphType,pendingDynamicUpdate:selected},{pendingUpdate:selected,mutationPlan:selected.plan});
   const applied=await pending.apply(apply);assert.ok(applied.ok);assert.equal(commits,1);assert.equal(graph.graphVersion,original.graphVersion+1);assert.notEqual(graph.graphFingerprint,original.graphFingerprint);
   analysis.synchronize();assert.equal(analysis.currentResult(),null);
   row.applySeparateAndExplicit=true;row.graphChangesOnlyAfterExplicitApply=true;row.resultAuthorityRevokedAfterApply=true;
  }
  row.status='PASS';return row;
 } finally {analysis.dispose();pending.dispose();}
}
try {
 runtime=await startCandyRuntime({port:0});client=createCandyClient({baseUrl:`http://127.0.0.1:${runtime.port}`,token:runtime.pairingToken});
 const session=await client.session(),caps=await client.capabilities();
 for(const backend of Object.keys(hashes))assert.equal(caps.capabilities.find(c=>c.backend===backend)?.nativeBuildFingerprint,hashes[backend]);
 runtimeContext={featureEnabled:true,authorized:true,runtimeSessionId:session.runtimeSessionId,capabilities:caps.capabilities};
 report.liveRuntimeContextSource='Fresh authenticated session and capabilities from unchanged production Runtime; no discovery or runner overrides.';
 if(process.argv[2]==='static') {
  const open=ALL_30_MOTIF_WITNESSES.findIndex(w=>w.shape==='OPEN_WEDGE');
  const closed=ALL_30_MOTIF_WITNESSES.findIndex(w=>w.shape==='CLOSED_TRIANGLE');
  assert.ok(open>=0 && closed>=0);
  for(const [id,witnessIndex] of [['open-wedge',open],['closed-triangle',closed],['second-closed-triangle',closed+1]])report.cases.push(await runCase({id,witnessIndex}));
 } else if(process.argv[2]==='incremental') {
  for(const operationKind of ['INSERT','DELETE','REPLACEMENT'])report.cases.push(await runCase({id:operationKind,mode:'INCREMENTAL',operationKind}));
 } else if(process.argv[2]==='soak') {
  report.memory=[];report.retention=[];report.defaultLimits=true;
  // Exercise the unchanged default artifact-count bound using small, disposable,
  // authenticated text artifacts; native fixtures stay within the qualified envelope.
  for(let i=0;i<520;i++)await client.uploadArtifact({bytes:`V5 retention sentinel ${i}`,mediaType:'text/plain'});
  assert.equal(runtime.artifactStore.metadataById.size,512);report.artifactWarmupUploads=520;
  for(let i=0;i<40;i++) {
   const mode=i%2?'INCREMENTAL':'STATIC';const row=await runCase({id:'soak-'+i,mode,witnessIndex:i%30,operationKind:['INSERT','DELETE','REPLACEMENT'][i%3]});report.cases.push(row);
   report.retention.push({iteration:i+1,jobs:runtime.jobs.jobs.size,artifacts:runtime.artifactStore.metadataById.size,artifactBytes:runtime.artifactStore.totalBytes(),workspaces:(await readdir(join(runtime.artifactStore.root,'workspaces'))).length});
   report.memory.push({iteration:i+1,...process.memoryUsage()});
   assert.ok(runtime.jobs.jobs.size<=32);assert.ok(runtime.artifactStore.metadataById.size<=512);
   if(i%10===9)console.log(JSON.stringify({soakCompleted:i+1,retention:report.retention.at(-1)}));
  }
  report.staticCount=report.cases.filter(c=>c.mode==='STATIC').length;report.incrementalCount=report.cases.filter(c=>c.mode==='INCREMENTAL').length;
  report.attemptedNativeJobs=40;report.successfulNativeJobs=report.cases.length;report.failures=[];
 }
 report.status='PASS';
} catch(error){report.status='NON-PASS';report.error={name:error.name,message:error.message,stack:error.stack};process.exitCode=1;}
finally {
 if(runtime)try{await runtime.close();report.cleanShutdown=true;}catch(error){report.status='NON-PASS';report.shutdownError=error.message;process.exitCode=1;}
 report.finishedAt=new Date().toISOString();
 await save(process.argv[2]==='soak'?'soak-native':`native-${process.argv[2]}`,report);
 console.log(JSON.stringify({status:report.status,cases:report.cases.length,error:report.error,cleanShutdown:report.cleanShutdown}));
}
