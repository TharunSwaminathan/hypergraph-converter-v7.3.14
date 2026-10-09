// Uses production application owners and the actual authenticated Runtime.
// This is Node/controller evidence, never visible-browser evidence.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { startCandyRuntime } from '../src/server.js';
import { inspectMotifQualificationEnvironment, verifyQualifiedMotifBackend } from '../src/capabilities/motifQualification.js';
import { createRuntimeConfig } from '../src/config.js';
import { createCandyClient } from '../../src/candy/client.js';
import { intersectCandyCapabilities } from '../../src/candy/capabilityDiscovery.js';
import { createGraphState, commitGraphState, graphIdentityFromState } from '../../src/graph/graphState.js';
import { createMutationPlan } from '../../src/graph/graphMutationValidator.js';
import { createPendingHypergraphUpdateController } from '../../src/graph/pendingHypergraphUpdate.js';
import { createDynamicUpdateControls } from '../../src/graph/dynamicUpdateControls.js';
import { createMotifAnalysisController } from '../../src/candy/motifAnalysisController.js';
import { createMotifResultRegistry } from '../../src/candy/motifResultRegistry.js';
import { motifPreflight } from '../../src/candy/motifPreflight.js';

const report = {schemaVersion:'candy.scope5f-live-runtime/1', evidenceKind:'REAL_AUTHENTICATED_RUNTIME_CUDA_WITH_PRODUCTION_APPLICATION_CONTROLLERS', visibleBrowser:false, cases:[], negatives:[], lifecycle:[], failures:[]};
const edge = (id, vertices) => ({id, vertices, weight:1, time:null, attributes:{}});
const edges = () => [edge('h1',['a','b']),edge('h2',['b','c']),edge('h3',['b','d'])];
let runtime, client, declaration;
const ledger = [];
async function start() {
  runtime = await startCandyRuntime({port:0});
  const real = createCandyClient({baseUrl:`http://127.0.0.1:${runtime.port}`,token:runtime.pairingToken,
    fetchImpl:(url,options)=>fetch(url,{...options,headers:{...options.headers,Origin:'http://localhost:5173'}})});
  client = {...real, async submitJob(payload) { const job=await real.submitJob(payload); ledger.push({payload:structuredClone(payload),job:structuredClone(job)}); return job; }};
  declaration = await client.capabilities();
  const intersection = intersectCandyCapabilities(declaration,{authorized:true,graphType:'DynamicHypergraph'});
  assert.ok(intersection.capabilities.some(c=>c.backend==='CUDA_INCREMENTAL'));
  return {featureEnabled:true,authorized:true,runtimeSessionId:declaration.runtimeSessionId,capabilities:intersection.capabilities};
}
function owner({type='Hypergraph', disconnected=false, hyperedges=edges()}={}) {
  let graph=createGraphState(hyperedges,{graphType:type});
  let contextRuntime=disconnected?{featureEnabled:true,authorized:false,runtimeSessionId:null,capabilities:[]}:currentRuntime;
  let commits=0; const history=[];
  const pending=createPendingHypergraphUpdateController({getGraphState:()=>graph,commit:(value,options)=>{
    const before=graph; graph=commitGraphState(graph,value,options); commits++; history.push({before:graphIdentityFromState(before),after:graphIdentityFromState(graph)}); return graph;
  }});
  const analysis=createMotifAnalysisController({getContext:()=>({graph,pendingUpdate:pending.getCurrent(),runtime:contextRuntime}),getClient:()=>client});
  const getCandy=()=>({state:{...contextRuntime,analysisStatus:analysis.getSnapshot().status,selectedJob:analysis.getSnapshot().job,
    resultEvidence:analysis.currentResult(),selectedMotifResult:analysis.currentResult()?.result??null,
    incrementalAvailability:motifPreflight({graph,pendingUpdate:pending.getCurrent(),runtime:contextRuntime,argumentsValue:args('INCREMENTAL')})},
    actions:{stageMotifAnalysis:analysis.stage,submitFromAssistant:analysis.submit,getJobStatus:analysis.getJobStatus,openResult:analysis.openResult,cancelJob:analysis.cancelJob,cancelMotifConfirmation:analysis.cancelConfirmation}});
  const controls=createDynamicUpdateControls({pendingController:pending,getGraphState:()=>graph,getCandy});
  function args(mode='INCREMENTAL',timeoutMs=5000) {return {mode,backend:mode==='STATIC'?'CUDA_STATIC':'CUDA_INCREMENTAL',deviceId:0,timeoutMs,...(mode==='INCREMENTAL'?{updateContextId:pending.getCurrent()?.updateId}:{})};}
  return {pending,analysis,controls,args,get graph(){return graph;},get runtime(){return contextRuntime;},set runtime(value){contextRuntime=value;},get commits(){return commits;},history,
    dynamic(){graph=commitGraphState(graph,graph.hyperedges,{graphType:'DynamicHypergraph'});analysis.synchronize();},
    select:()=>({updateId:pending.getCurrent().updateId,revision:pending.getCurrent().revision}),
    async stage(operations){return controls.stagePlan(createMutationPlan({graphIdentity:graphIdentityFromState(graph),operations,summary:'Scope5F qualification'}));},
    dispose(){analysis.dispose();pending.dispose();}};
}
async function terminal(h,jobId) {
  const deadline=Date.now()+45000;
  while(Date.now()<deadline) {const value=await h.analysis.getJobStatus(jobId); assert.ok(value.ok,JSON.stringify(value)); if(['completed','failed','cancelled'].includes(value.job.status))return value.job; await new Promise(r=>setTimeout(r,40));}
  throw new Error('Live Runtime terminal wait exceeded bound');
}
async function run(h,mode='INCREMENTAL',timeoutMs=5000) {
  const before=JSON.stringify(h.graph), jobs=ledger.length;
  const args=h.args(mode,timeoutMs), approval=h.analysis.stage(args); assert.ok(approval.ok,JSON.stringify(approval));assert.equal(ledger.length,jobs);
  const submitted=await h.analysis.submit(args,approval.confirmation);assert.ok(submitted.ok,JSON.stringify(submitted));
  const job=await terminal(h,submitted.job.jobId);assert.equal(job.status,'completed',JSON.stringify(job));
  const opened=await h.analysis.openResult(job.jobId);assert.ok(opened.ok,JSON.stringify(opened));
  const evidence=h.analysis.currentResult(); assert.ok(evidence);assert.equal(JSON.stringify(h.graph),before);assert.equal(evidence.result.native.cuda.kernelLaunchSucceeded,true);assert.equal(evidence.result.native.cuda.synchronizationSucceeded,true);
  return {evidence,job,approval,selector:args};
}
function bindingOf(e) { return {runtimeSessionId:e.runtimeSessionId,jobId:e.jobId,requestId:e.requestId,algorithm:e.algorithm,taxonomyVersion:e.taxonomyVersion,backend:e.backend,mode:e.mode,deviceId:e.deviceId,
  graphRef:e.result.inputGraphRef,graphArtifactId:e.graphArtifactId,updateRef:e.result.updateRef,nativeRequestDigest:e.nativeRequestDigest,applicationBinding:e.applicationBinding}; }
function reseal(value) { const {resultArtifactRef,...content}=value; return {...content,resultArtifactRef:{...resultArtifactRef,id:`sha256:${createHash('sha256').update(JSON.stringify(content)).digest('hex')}`}}; }
async function remoteTerminal(jobId) {
  const deadline=Date.now()+45000;
  while(Date.now()<deadline) {const job=await client.getJob(jobId);if(['completed','failed','cancelled'].includes(job.status))return job;await new Promise(r=>setTimeout(r,40));}
  throw new Error('Remote cancellation terminal wait exceeded bound');
}
let currentRuntime;
try {
  report.environment=await inspectMotifQualificationEnvironment();
  const config=createRuntimeConfig();
  report.binaries=Object.fromEntries(await Promise.all(['CUDA_STATIC','CUDA_INCREMENTAL'].map(async b=>[b,await verifyQualifiedMotifBackend(config,b)])));
  assert.ok(report.binaries.CUDA_STATIC.available);assert.ok(report.binaries.CUDA_INCREMENTAL.available);
  currentRuntime=await start(); report.discovery={runtimeSessionId:declaration.runtimeSessionId,serviceVersion:declaration.serviceVersion,capabilities:declaration.capabilities,host:runtime.host,port:runtime.port};
  for(const [id,headers,expected] of [['missing-bearer',{Origin:'http://localhost:5173'},401],['wrong-bearer',{Origin:'http://localhost:5173',Authorization:'Bearer deliberately-invalid'},401],['wrong-origin',{Origin:'https://untrusted.example',Authorization:`Bearer ${runtime.pairingToken}`},403]]) {
    const res=await fetch(`http://127.0.0.1:${runtime.port}/v1/capabilities`,{headers});assert.equal(res.status,expected);report.negatives.push({id,httpStatus:res.status,realHttp:true});
  }
  const matrix=[
    ['insertion',[{type:'ADD_HYPEREDGE',hyperedgeId:'h4',vertices:['b','e']}]],
    ['deletion',[{type:'REMOVE_HYPEREDGE',hyperedgeId:'h1'}]],
    ['same-id-replacement',[{type:'REMOVE_HYPEREDGE',hyperedgeId:'h2'},{type:'ADD_HYPEREDGE',hyperedgeId:'h2',vertices:['a','c']}]],
    ['old-new-id-replacement',[{type:'REMOVE_HYPEREDGE',hyperedgeId:'h2'},{type:'ADD_HYPEREDGE',hyperedgeId:'h22',vertices:['a','c']}]],
    ['multiple-changed-hyperedges',[{type:'REMOVE_HYPEREDGE',hyperedgeId:'h1'},{type:'REMOVE_HYPEREDGE',hyperedgeId:'h2'},{type:'ADD_HYPEREDGE',hyperedgeId:'h4',vertices:['b','e']},{type:'ADD_HYPEREDGE',hyperedgeId:'h5',vertices:['d','e']}]],
    ['zero-delta-disconnected-insertion',[{type:'ADD_HYPEREDGE',hyperedgeId:'isolated',vertices:['x','y']}]],
    ['novel-inserted-vertex',[{type:'ADD_INCIDENCE',hyperedgeId:'h1',vertexId:'novel'}]],
  ];
  let negativeSource;
  for(const [id,operations] of matrix) {
    const h=owner();
    const staticHyper=await run(h,'STATIC');assert.equal(staticHyper.evidence.backend,'CUDA_STATIC');
    h.dynamic(); const before=JSON.stringify(h.graph); const base=graphIdentityFromState(h.graph);
    await h.stage(operations); const p=h.pending.getCurrent();assert.equal(JSON.stringify(h.graph),before);assert.equal(p.status,'VALIDATED');
    const old=await run(h,'STATIC');assert.equal(old.evidence.mode,'STATIC');assert.equal(h.pending.getCurrent(),p);
    const jobs=ledger.length; const staged=h.controls.requestAnalysis(h.select());assert.ok(staged.ok,JSON.stringify(staged));assert.equal(ledger.length,jobs);
    assert.equal(staged.confirmation.actionType,'run_candy_expensive_compute');
    const submitted=await h.controls.confirmAnalysis(staged.argumentsValue,staged.confirmation);assert.ok(submitted.ok,JSON.stringify(submitted));
    const status=await terminal(h,submitted.job.jobId);assert.equal(status.status,'completed',JSON.stringify(status));assert.ok((await h.controls.openAnalysisResult(status.jobId)).ok);
    const e=h.analysis.currentResult();assert.ok(e);assert.equal(e.result.native.deltaCounts.length,30);assert.equal(e.result.native.deltaCounts.reduce((a,b)=>a+b,0),e.result.native.deltaTotalConnectedTriples);
    assert.equal(JSON.stringify(h.graph),before);assert.equal(h.pending.getCurrent().status,'VALIDATED');assert.equal(h.commits,0);
    assert.ok(h.controls.observe().resultCurrent);
    const applyJobs=ledger.length, approval=h.controls.requestApply(h.select());assert.equal(approval.confirmation.actionType,'apply_pending_hypergraph_update');
    const applied=await h.controls.confirmApply(approval.confirmation);assert.ok(applied.ok);assert.equal(h.commits,1);assert.equal(h.history.length,1);assert.equal(h.graph.graphVersion,base.graphVersion+1);assert.equal(h.graph.graphFingerprint,p.proposedGraphFingerprint);assert.equal(ledger.length,applyJobs);assert.equal(h.pending.getCurrent(),null);assert.equal(h.analysis.currentResult(),null);
    await assert.rejects(h.controls.confirmApply(approval.confirmation));
    const proposed=owner({type:'DynamicHypergraph',hyperedges:h.graph.hyperedges});const newer=await run(proposed,'STATIC');
    assert.deepEqual(old.evidence.result.native.counts.map((n,i)=>n+e.result.native.deltaCounts[i]),newer.evidence.result.native.counts);
    if(id==='zero-delta-disconnected-insertion')assert.ok(e.result.native.deltaCounts.every(n=>n===0));
    report.cases.push({id,baseGraph:base,pendingAuthority:{updateId:p.updateId,revision:p.revision,updateDigest:p.updateDigest,baseGraphFingerprint:p.baseGraphFingerprint,proposedGraphFingerprint:p.proposedGraphFingerprint,nextGraphVersion:p.nextGraphVersion,motifImpact:p.motifImpact},evidence:e,lifecycle:status.lifecycle,committedGraphUnchangedBeforeApply:true,pendingValidatedAfterAnalysis:true,parity:{old:old.evidence.result.native.counts,delta:e.result.native.deltaCounts,new:newer.evidence.result.native.counts,all30Equal:true},apply:{commits:h.commits,historyTransitions:h.history.length,version:h.graph.graphVersion,fingerprint:h.graph.graphFingerprint,newRuntimeJobs:ledger.length-applyJobs-1,replayRejected:true,resultNoLongerCurrent:true}});
    negativeSource??={e,p};h.dispose();proposed.dispose();console.log(`PASS ${id}`);
  }
  const {e}=negativeSource, bound=bindingOf(e);
  const mutations=[['runtimeSessionId',r=>r.runtimeSessionId='other'],['jobId',r=>r.jobId='other'],['requestId',r=>r.requestId='other'],['graphId',r=>r.inputGraphRef.graphId='other'],['graphVersion',r=>r.inputGraphRef.graphVersion++],['updateId',r=>r.updateRef.updateId='other'],['nextGraphVersion',r=>r.updateRef.nextGraphVersion++],['graphArtifactId',r=>r.graphArtifactId='sha256:'+'a'.repeat(64)],['updateArtifactId',r=>r.updateRef.artifactId='sha256:'+'a'.repeat(64)],['nativeRequestDigest',r=>r.native.requestDigest=r.requestDigest='a'.repeat(64)],['backend',r=>r.backend='CUDA_STATIC'],['mode',r=>r.mode='STATIC'],['device',r=>r.native.cuda.deviceIndex=1],['taxonomy',r=>r.taxonomyVersion='other']];
  for(const [id,mutate] of mutations) {const registry=createMotifResultRegistry(),r=structuredClone(e.result);mutate(r);await assert.rejects(registry.accept(reseal(r),bound));assert.equal(registry.getCurrent({applicationBinding:e.applicationBinding,runtimeSessionId:e.runtimeSessionId}),null);report.negatives.push({id,rejected:true,source:'mutated-and-resealed-genuine-live-CUDA-result',current:false});}
  for(const id of ['resultArtifactId','result digest']){const registry=createMotifResultRegistry(),r=structuredClone(e.result);if(id==='resultArtifactId')r.resultArtifactRef.id='sha256:'+'a'.repeat(64);else r.native.deltaCounts[0]++;await assert.rejects(registry.accept(r,bound));report.negatives.push({id,rejected:true,current:false,source:'genuine-live-result-with-artifact-integrity-substitution'});}
  for(const id of ['graphFingerprint','graphType','revision','updateDigest','proposedGraphFingerprint']) {const registry=createMotifResultRegistry();await registry.accept(e.result,bound);const b={...e.applicationBinding,[id]:id==='revision'?999:'other'};assert.equal(registry.getCurrent({applicationBinding:b,runtimeSessionId:e.runtimeSessionId}),null);report.negatives.push({id,rejected:true,current:false,source:'exact-current-authority-rebind-of-genuine-live-result'});}

  const offline=owner({type:'DynamicHypergraph',disconnected:true});const offlineJobs=ledger.length;await offline.stage(matrix[0][1]);const offlineGraph=JSON.stringify(offline.graph);const unavailable=offline.analysis.stage(offline.args());assert.equal(unavailable.ok,false);assert.equal(unavailable.classification,'BACKEND_UNAVAILABLE');assert.equal(offline.analysis.availability(offline.args()).reason,'RUNTIME_UNAVAILABLE');assert.equal(JSON.stringify(offline.graph),offlineGraph);const offlineApply=offline.controls.requestApply(offline.select());await offline.controls.confirmApply(offlineApply.confirmation);assert.equal(offline.commits,1);assert.equal(ledger.length,offlineJobs);report.lifecycle.push({id:'runtime-unavailable-and-apply-without-analysis',reason:'RUNTIME_UNAVAILABLE',classification:unavailable.classification,staged:true,commits:1,newJobs:0,browser:false});offline.dispose();

  const metadata=owner({type:'DynamicHypergraph'}),metadataJobs=ledger.length;await metadata.stage([{type:'SET_HYPEREDGE_WEIGHT',hyperedgeId:'h1',weight:2}]);assert.equal(metadata.pending.getCurrent().motifImpact,'NONE');assert.equal(metadata.analysis.stage(metadata.args()).classification,'INVALID_UPDATE_BATCH');assert.equal(metadata.analysis.availability(metadata.args()).reason,'NO_MOTIF_RELEVANT_CHANGE');const mp=metadata.controls.requestApply(metadata.select());await metadata.controls.confirmApply(mp.confirmation);assert.equal(ledger.length,metadataJobs);assert.equal(metadata.commits,1);report.lifecycle.push({id:'metadata-only',motifImpact:'NONE',newJobs:0,commits:1});metadata.dispose();
  const noop=owner({type:'DynamicHypergraph'}),nv=noop.graph.graphVersion;const nr=await noop.stage([{type:'SET_HYPEREDGE_WEIGHT',hyperedgeId:'h1',weight:1}]);assert.ok(nr.noOp);assert.equal(noop.pending.getCurrent(),null);assert.equal(noop.graph.graphVersion,nv);assert.equal(noop.analysis.stage(noop.args()).ok,false);assert.throws(()=>noop.controls.requestApply({updateId:'none',revision:1}));report.lifecycle.push({id:'full-no-op',pending:null,versionUnchanged:true,analysis:false,apply:false});noop.dispose();

  const cancelled=owner({type:'DynamicHypergraph'});await cancelled.stage(matrix[0][1]);const ca=cancelled.analysis.stage(cancelled.args()),cj=await cancelled.analysis.submit(cancelled.args(),ca.confirmation);assert.ok(cj.ok);const cg=JSON.stringify(cancelled.graph),cp=cancelled.pending.getCurrent();const cancellation=cancelled.controls.cancelAnalysis(cj.job.jobId);assert.equal(cancelled.analysis.getSnapshot().status,'CANCELLED');assert.equal(cancelled.analysis.currentResult(),null);const cancelResponse=await cancellation;assert.ok(cancelResponse.ok);const remote=await remoteTerminal(cj.job.jobId);assert.equal(remote.status,'cancelled');await assert.rejects(client.getResult(cj.job.jobId));assert.equal((await cancelled.analysis.openResult(cj.job.jobId)).ok,false);assert.equal((await cancelled.analysis.submit(cancelled.args(),ca.confirmation)).ok,false);assert.equal(JSON.stringify(cancelled.graph),cg);assert.equal(cancelled.pending.getCurrent(),cp);report.lifecycle.push({id:'real-incremental-cancellation',jobId:cj.job.jobId,remoteStatus:remote.status,lifecycle:remote.lifecycle,synchronousLocalRevocation:true,pendingValidated:true,graphUnchanged:true,oldApprovalRejected:true});cancelled.dispose();

  const late=owner({type:'DynamicHypergraph'});await late.stage(matrix[0][1]);const largs=late.args(),la=late.analysis.stage(largs),lj=await late.analysis.submit(largs,la.confirmation);await terminal(late,lj.job.jobId);const originalClient=client;let release,downloaded;
  const gate=new Promise(r=>release=r),arrived=new Promise(r=>downloaded=r);
  client={...originalClient,async getResult(id){const value=await originalClient.getResult(id);downloaded();await gate;return value;}};
  // The binding captures the submission client, so create a fresh job with gated client.
  late.analysis.invalidate();const la2=late.analysis.stage(largs),lj2=await late.analysis.submit(largs,la2.confirmation);await terminal(late,lj2.job.jobId);const read=late.analysis.openResult(lj2.job.jobId);await arrived;const lc=late.analysis.cancelJob(lj2.job.jobId);assert.equal(late.analysis.currentResult(),null);release();assert.equal((await read).ok,false);await lc;assert.equal(late.analysis.currentResult(),null);report.lifecycle.push({id:'late-genuine-CUDA-result-after-cancel',jobId:lj2.job.jobId,nativeCompletedBeforeGatedDownload:true,lateResultRejected:true,graphUnchanged:true});client=originalClient;late.dispose();

  const timeout=owner({type:'DynamicHypergraph'});await timeout.stage(matrix[0][1]);const ta=timeout.analysis.stage(timeout.args('INCREMENTAL',1));assert.ok(ta.ok);const tj=await timeout.analysis.submit(timeout.args('INCREMENTAL',1),ta.confirmation);assert.ok(tj.ok);await terminal(timeout,tj.job.jobId);const ts=await client.getJob(tj.job.jobId);assert.equal(ts.status,'failed');assert.equal(ts.error.classification,'PROCESS_TIMEOUT');assert.equal(timeout.analysis.currentResult(),null);await assert.rejects(client.getResult(tj.job.jobId));assert.equal((await timeout.analysis.submit(timeout.args('INCREMENTAL',1),ta.confirmation)).ok,false);assert.equal(timeout.commits,0);report.lifecycle.push({id:'real-incremental-timeout',jobId:tj.job.jobId,classification:ts.error.classification,lifecycle:ts.lifecycle,resultAccepted:false,commits:0,freshRetryRequired:true});timeout.dispose();

  const reconnect=owner({type:'DynamicHypergraph'});await reconnect.stage(matrix[0][1]);await run(reconnect);const oldSession=currentRuntime.runtimeSessionId,oldEvidence=reconnect.analysis.currentResult(),oldPending=reconnect.pending.getCurrent();const oldApproval=reconnect.analysis.stage(reconnect.args());
  await runtime.close();currentRuntime=await start();assert.notEqual(currentRuntime.runtimeSessionId,oldSession);reconnect.runtime=currentRuntime;reconnect.analysis.synchronize();assert.equal(reconnect.analysis.currentResult(),null);assert.equal((await reconnect.analysis.submit(reconnect.args(),oldApproval.confirmation)).ok,false);assert.equal(reconnect.pending.getCurrent(),oldPending);await run(reconnect);report.lifecycle.push({id:'real-runtime-restart',oldSession,newSession:currentRuntime.runtimeSessionId,oldJobId:oldEvidence.jobId,oldResultNotCurrent:true,oldApprovalRejected:true,pendingValidated:true,freshDiscoveryAndConfirmation:true,graphCommits:0});reconnect.dispose();
  report.jobs=ledger.map(({job,payload})=>({jobId:job.jobId,requestId:payload.request.requestId,backend:payload.request.backend,mode:payload.request.mode,graphRef:payload.request.graphRef,graphArtifactId:payload.graphArtifactId,updateArtifactId:payload.updateBatchArtifactId??null,timeoutMs:payload.request.timeoutMs}));
  report.status='PASS';
} catch(error) { report.status='FAIL';report.failures.push({message:error.message,stack:error.stack});process.exitCode=1;console.error(error.stack); }
finally {if(runtime)await runtime.close();report.finishedAt=new Date().toISOString();await writeFile(new URL('../../artifacts/candy-scope5f-live-runtime-qualification.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(`Scope5F controller/real CUDA: ${report.status}, ${report.cases.length} matrix cases`);}
