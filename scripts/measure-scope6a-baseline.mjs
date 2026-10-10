import { performance } from "node:perf_hooks";
import { readFile, writeFile } from "node:fs/promises";
import { cpus, totalmem, platform, release } from "node:os";
import { execFileSync } from "node:child_process";
import { createBenchmarkFixture, requireQualifiedBenchmarkFixture, digest } from "./benchmarks/scope6a-fixtures.mjs";
import { createGraphState, commitGraphState, graphIdentityFromState } from "../src/graph/graphState.js";
import { createMutationPlan } from "../src/graph/graphMutationValidator.js";
import { createPendingHypergraphUpdateController } from "../src/graph/pendingHypergraphUpdate.js";
import { createDynamicUpdateControls } from "../src/graph/dynamicUpdateControls.js";
import { dynamicUpdatePreview } from "../src/visualization/dynamicUpdatePreview.js";
import { motifGraphValue } from "../src/candy/motifPreflight.js";
import { prepareBrowserMotifRequest, submitMotifWorkflow } from "../src/candy/motifWorkflow.js";
import { createCandyClient } from "../src/candy/client.js";
import { startCandyRuntime } from "../candy-runtime/src/server.js";
import { createMotifResultRegistry } from "../src/candy/motifResultRegistry.js";
import { appendLiveMessage } from "../src/agent/liveMessageHistory.js";
import { createDownloadLifecycle } from "../src/utils/downloadLifecycle.js";
import { boundedCandyJobObservation } from "../src/candy/resultObservation.js";
import { motifApplicationBinding } from "../src/candy/motifPreflight.js";

const output=process.argv.find(arg=>arg.startsWith("--output="))?.slice(9);
if(!output)throw new Error("An explicit descriptive --output= path is required.");
const timed=async(name,fn,samples)=>{const start=performance.now();const value=await fn();samples.push({boundary:name,ms:performance.now()-start,status:"SUCCESS"});return value;};
const git=(...args)=>execFileSync("git",args,{encoding:"utf8",windowsHide:true});
const measurements=[];
for(const family of ["S1","S2"]) {
  const fixture=createBenchmarkFixture(family),samples=[];requireQualifiedBenchmarkFixture(fixture);
  let graph=await timed("B1 JSON parse + production committed graph creation",()=>createGraphState(JSON.parse(JSON.stringify(fixture.graph)).hyperedges,{graphType:"DynamicHypergraph"}),samples);
  let commits=0;const history=[];
  const pending=createPendingHypergraphUpdateController({getGraphState:()=>graph,getHistory:()=>history,commit:(edges,options)=>{history.push({beforeHyperedges:graph.hyperedges,beforeGraphType:graph.graphType});graph=commitGraphState(graph,edges,options);commits++;return graph;}});
  const controls=createDynamicUpdateControls({pendingController:pending,getGraphState:()=>graph,getCandy:()=>({state:{authorized:false,analysisStatus:"NONE"},actions:{}})});
  const id=graph.hyperedges[0].id;
  const plan=()=>createMutationPlan({graphIdentity:graphIdentityFromState(graph),operations:[{type:"ADD_INCIDENCE",hyperedgeId:id,vertexId:"fixture-new-vertex"}],summary:"Public seeded benchmark fixture"});
  await timed("B2 Stage through production pending controller",()=>pending.stage(plan()),samples);
  await timed("B2 Edit/restage fresh revision",()=>pending.stage(plan()),samples);
  await timed("B2 derived preview (no paint)",()=>dynamicUpdatePreview(graph,pending.getCurrent()),samples);
  const current=pending.getCurrent(),select={updateId:current.updateId,revision:current.revision};
  const serialized=await timed("B3 production graph projection + JSON serialization",()=>JSON.stringify(motifGraphValue(graph)),samples);
  const sha=await timed("B3 SHA256 exact serialized bytes",()=>digest(serialized),samples);
  const envelope=await timed("B3 base64 + actual upload envelope serialization",()=>JSON.stringify({schemaVersion:"candy.artifact-upload/1",mediaType:"application/vnd.candy.graph+json",contentEncoding:"base64",content:Buffer.from(serialized).toString("base64")}),samples);
  const packed=prepareBrowserMotifRequest(motifGraphValue(graph),current.motifUpdate,{mode:"INCREMENTAL",backend:"CUDA_INCREMENTAL",deviceId:0,timeoutMs:5000,updateContextId:current.updateId});
  // Private, fixture-only approval is consumed immediately and never serialized.
  await timed("B2 separate explicit fixture Apply confirmation to commit",()=>controls.confirmApply(controls.requestApply(select).confirmation),samples);
  if(commits!==1 || pending.getCurrent()!==null)throw Error("Apply invariant failed");
  measurements.push({fixture:fixture.manifest,samples,artifactJsonBytes:Buffer.byteLength(serialized),artifactSha256:sha,
    uploadEnvelopeBytes:Buffer.byteLength(envelope),packedIncrementalBytes:packed.packedBytes,commits,historyEntries:history.length,nativeJobs:0});
  pending.dispose();
}

let messages=[],peak=0;
for(let i=0;i<10000;i++){messages=appendLiveMessage(messages,{id:i,text:"Public fixture status"});peak=Math.max(peak,messages.length);}
const active=new Set(),timers=new Map();let next=0;
const downloads=createDownloadLifecycle({urlApi:{createObjectURL:()=>{const id=`blob:fixture-${next++}`;active.add(id);return id;},revokeObjectURL:id=>active.delete(id)},document:{body:{appendChild(){}},createElement:()=>({click(){},remove(){}})},schedule:fn=>{const id=next++;timers.set(id,fn);return id;},unschedule:id=>timers.delete(id)});
for(let i=0;i<1000;i++)downloads.download("public-fixture.txt","Public fixture export");
const peakUrls=active.size;for(const callback of [...timers.values()])callback();downloads.dispose();

// Existing real Runtime semantics, one S1 STATIC request only if honestly
// discovered as qualified. Never inject availability/native mocks here.
const runtimeSamples=[],native=[];let runtimeStatus="UNAVAILABLE";
const runtime=await startCandyRuntime({port:0});
try {
  const client=createCandyClient({baseUrl:`http://127.0.0.1:${runtime.port}`,token:runtime.pairingToken});
  await timed("B4 real HTTP health roundtrip",()=>client.health(),runtimeSamples);
  const declaration=await timed("B4 real authenticated discovery roundtrip",()=>client.capabilities(),runtimeSamples);
  const fixture=createBenchmarkFixture("S1"),graph=requireQualifiedBenchmarkFixture(fixture);
  await timed("B3 real small artifact upload roundtrip",()=>client.uploadArtifact({bytes:graph,mediaType:"application/vnd.candy.graph+json"}),runtimeSamples);
  const available=declaration.capabilities?.find(cap=>cap.backend==="CUDA_STATIC");
  if(available) {
    const endToEndStarted=performance.now();
    const applicationGraph={...createGraphState(graph.hyperedges,{graphType:graph.graphType}),graphId:graph.graphId};
    const accepted=await timed("B5 real S1 STATIC submit through browser workflow",()=>submitMotifWorkflow({client,graphValue:graph,argumentsValue:{mode:"STATIC",backend:"CUDA_STATIC",deviceId:0,timeoutMs:5000},runtimeSessionId:declaration.runtimeSessionId,applicationBinding:motifApplicationBinding(applicationGraph,null),isCurrent:()=>true}),runtimeSamples);
    const start=performance.now();let job;
    do {job=await client.getJob(accepted.job.jobId);if(!["completed","failed","cancelled"].includes(job.status))await new Promise(resolve=>setTimeout(resolve,25));} while(!["completed","failed","cancelled"].includes(job.status) && performance.now()-start<15000);
    if(job.status!=="completed")throw Error(`Real small native request ${job.status}`);
    const result=await timed("B5 real result download",()=>client.getResult(job.jobId),runtimeSamples);
    const registry=createMotifResultRegistry();await registry.accept(result,accepted.binding,()=>true);
    const observation=boundedCandyJobObservation(result);
    if(result.native?.counts?.length!==30 || result.native.counts.some(value=>value!==0)
      || result.native.totalConnectedTriples!==0)throw Error("S1 motif truth mismatch");
    native.push({mode:"STATIC",status:"REAL_NATIVE_SUCCESS",endToEndMs:performance.now()-endToEndStarted,
      kernelMilliseconds:result.native.cuda.kernelMilliseconds,
      truthCountsSha256:digest(JSON.stringify(result.native.counts)),
      observation,resultSha256:digest(JSON.stringify(result)),expectedConnectedTriples:0});
    runtimeStatus="REAL_NATIVE_SUCCESS";registry.clear();
  }
} finally {await runtime.close();}
const result={schemaVersion:"candy.scope6a-baseline/1",capturedAt:new Date().toISOString(),runKind:"BOUNDED_SMOKE",warmups:0,replicates:1,sessions:1,
  authority:false,descriptiveOnly:true,repoSha:git("rev-parse","HEAD").trim(),dirty:Boolean(git("status","--porcelain").trim()),trackedDiffSha256:digest(git("diff","--binary","HEAD")),
  lockfileSha256:digest(await readFile("package-lock.json")),software:{node:process.version,platform:platform(),osRelease:release(),npm:"11.6.2 (qualification host)"},
  hardware:{cpu:cpus()[0]?.model,logicalCores:cpus().length,ramBytes:totalmem(),gpu:"Only real discovered qualified execution; no sampled thermals/load/VRAM peaks",storage:"Not sampled",powerState:"Not sampled"},
  measurements,runtime:{status:runtimeStatus,samples:runtimeSamples,native,incremental:"Timing hook is submitMotifWorkflow with Q guard; paired incremental distribution not run",unobservableStages:["queue decomposition","H2D","D2H","allocation","CUDA context"]},
  retention:{messageAppends:10000,peakMessages:peak,retainedMessages:messages.length,urlDownloads:1000,peakUrls,retainedUrls:active.size,retainedTimers:timers.size,kind:"Injected counter smoke; real browser checked separately"},
  assistantSupport:{observation:"boundedCandyJobObservation production projection",modelInvocations:0,uiPaint:"Separate real browser evidence; Node spans exclude paint"},
  limitations:["Single descriptive smoke; no speed/crossover/capacity claims","Full five warmups/30 warm repetitions,20 cold starts,three sessions deferred","Only S1/S2/S3/B1 generator subset implemented; remaining fixture families documented future measurement","No executable authority, sessions or approvals serialized"]};
await writeFile(output,JSON.stringify(result,null,2)+"\n");console.log(JSON.stringify({status:"BASELINE_SMOKE_COMPLETE",runtime:runtimeStatus,output}));
