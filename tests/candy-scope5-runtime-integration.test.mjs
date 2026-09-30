import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { harness, selector, edge } from "./fixtures/candy-scope5-runtime.mjs";
import { motifPreflight, motifGraphBudget, motifGraphValue } from "../src/candy/motifPreflight.js";
import { prepareBrowserMotifRequest, motifSelectorErrors } from "../src/candy/motifWorkflow.js";
import { packCudaMotifRequest } from "../candy-runtime/test/hypergraph-motif-cuda-contract.mjs";
import { packCudaIncrementalRequest } from "../candy-runtime/test/hypergraph-motif-cuda-incremental-contract.mjs";
import { ALL_30_MOTIF_WITNESSES } from "./fixtures/candy-scope4-motifs.mjs";
import { motifQueryPolicy } from "../src/agent/motifQueryPolicy.js";
import { createConfirmationSnapshot } from "../src/agent/confirmationState.js";
import { APPLY_PENDING_HYPERGRAPH_UPDATE_ACTION } from "../src/graph/pendingHypergraphUpdate.js";
import { Window } from "happy-dom";
import { createServer } from "vite";
import { frontendCandyCapabilities } from "../src/candy/capabilityDiscovery.js";

const h=await harness(), graph=h.graph, pending=h.pending.getCurrent(), args=selector(pending);
assert.equal(h.counts.submissions,0,"staging/validation must not auto-analyze");
const observation={graph:{available:true,graphType:graph.graphType},candy:{...h.runtime,pendingUpdateContext:{updateId:pending.updateId}}};
assert.equal(motifQueryPolicy("Count the motifs on the current hypergraph using CUDA.",observation).mode,"STATIC");
assert.equal(motifQueryPolicy("How do the motif counts change if I apply this update?",observation).mode,"INCREMENTAL");

const pre=(g=graph,p=pending,a=args,r=h.runtime)=>motifPreflight({graph:g,pendingUpdate:p,argumentsValue:a,runtime:r});
assert.equal(pre().ok,true);
for(const type of ["OrdinaryGraph","DynamicOrdinaryGraph","ProjectedOrdinaryGraph","Hypergraph"]) assert.equal(pre({...graph,graphType:type}).classification,"INVALID_GRAPH_TYPE");
assert.equal(pre(graph,null).reason,"NO_VALIDATED_PENDING_UPDATE");
assert.equal(pre(graph,{...pending,status:"DRAFT"}).reason,"NO_VALIDATED_PENDING_UPDATE");
assert.equal(pre(graph,{...pending,status:"STALE"}).reason,"PENDING_UPDATE_STALE");
assert.equal(pre(graph,{...pending,motifImpact:"NONE"}).reason,"NO_MOTIF_RELEVANT_CHANGE");
assert.equal(pre(graph,pending,args,{...h.runtime,capabilities:[]}).reason,"BACKEND_UNAVAILABLE");
assert.equal(pre(graph,pending,{...args,deviceId:1}).reason,"DEVICE_UNAVAILABLE");
assert.equal(pre(graph,pending,args,{...h.runtime,authorized:false}).reason,"RUNTIME_UNAVAILABLE");
for(const timeoutMs of [0,60001,1.5]) assert.equal(pre(graph,pending,{...args,timeoutMs}).ok,false);
for(const timeoutMs of [1,60000]) assert.equal(pre(graph,pending,{...args,timeoutMs}).ok,true);
assert.equal(motifGraphBudget({hyperedges:Array.from({length:256},(_,i)=>edge(String(i),[]))}).ok,true,"raw edge-count boundary; empty edges remain rejected by canonical validation");
assert.match(motifGraphBudget({hyperedges:Array.from({length:256},(_,i)=>edge(String(i),["v"]))}).message,/membership-work/);
assert.equal(motifGraphBudget({hyperedges:Array.from({length:257},(_,i)=>edge(String(i),["v"]))}).reason,"GRAPH_LIMIT_EXCEEDED");
assert.equal(motifGraphBudget({hyperedges:[edge("many",Array(100000).fill("v"))]}).ok,true);
assert.equal(motifGraphBudget({hyperedges:[edge("many",Array(100001).fill("v"))]}).ok,false);
assert.equal(pre(graph,{...pending,motifUpdate:{...pending.motifUpdate,deletions:Array(257).fill("h1")}}).reason,"UPDATE_LIMIT_EXCEEDED");
assert.equal(pre(graph,{...pending,motifUpdate:{...pending.motifUpdate,insertions:[{id:"x",vertices:Array(100001).fill("v")}]}}).reason,"UPDATE_LIMIT_EXCEEDED");
for(const field of ["graphArtifactId","updateArtifactId","requestDigest","nativeRequest","newGraph","candidateTuples","token","path"]) assert.ok(motifSelectorErrors({...args,[field]:"forged"}).length);

// Browser digest projection exactly matches the unchanged qualified packers.
for(const witness of ALL_30_MOTIF_WITNESSES) {
  const stat=selector(null,"STATIC");
  assert.equal(prepareBrowserMotifRequest(witness.graph,null,stat).digestContent,packCudaMotifRequest(witness.graph).text);
}
const packed=packCudaIncrementalRequest(motifGraphValue(graph),pending.motifUpdate);
const browser=prepareBrowserMotifRequest(motifGraphValue(graph),pending.motifUpdate,args);
assert.equal(browser.digestContent,packed.text.split("\n").slice(2).join("\n"));
assert.equal(browser.packedBytes,Buffer.byteLength(packed.text));
for(const operations of [[{type:"REMOVE_HYPEREDGE",hyperedgeId:"h1"}],[{type:"ADD_HYPEREDGE",hyperedgeId:"new",vertices:["novel","a"]}],
  [{type:"REMOVE_HYPEREDGE",hyperedgeId:"h1"},{type:"ADD_HYPEREDGE",hyperedgeId:"h1",vertices:["novel","d"]}]]) {
  const parity=await harness({operations}),p=parity.pending.getCurrent(),g=motifGraphValue(parity.graph);
  assert.equal(prepareBrowserMotifRequest(g,p.motifUpdate,selector(p)).digestContent,packCudaIncrementalRequest(g,p.motifUpdate).text.split("\n").slice(2).join("\n"));
}

const approval=h.analysis.stage(args);
assert.equal(approval.ok,true);assert.equal(h.analysis.getSnapshot().status,"CONFIRMATION_REQUIRED");
assert.equal((await h.analysis.submit(args,{actionType:APPLY_PENDING_HYPERGRAPH_UPDATE_ACTION})).ok,false);
assert.equal((await h.analysis.submit(args,{...approval.confirmation})).ok,false,"copied/unowned approvals are inert");
assert.equal((await h.analysis.submit(args,approval.confirmation)).ok,true);
assert.equal((await h.analysis.submit(args,approval.confirmation)).ok,false,"approval consumed once");
assert.equal((await h.analysis.openResult(h.job.jobId)).ok,true);
assert.equal(h.analysis.getSnapshot().status,"RESULT_READY");
assert.equal(h.graph,graph);assert.equal(h.pending.getCurrent(),pending);assert.equal(h.counts.commits,0);
assert.equal(h.analysis.currentResult().applyAuthority,false);
await assert.rejects(h.pending.apply(approval.confirmation),/Apply confirmation/);
const apply=createConfirmationSnapshot(APPLY_PENDING_HYPERGRAPH_UPDATE_ACTION,{graphId:graph.graphId,graphVersion:graph.graphVersion,graphFingerprint:graph.graphFingerprint,graphType:graph.graphType,pendingDynamicUpdate:pending},{pendingUpdate:pending,mutationPlan:pending.plan});
await h.pending.apply(apply);
assert.equal(h.counts.commits,1);assert.equal(h.counts.submissions,1);assert.equal(h.analysis.currentResult(),null);

for(const type of ["Hypergraph","DynamicHypergraph"]) {
  const stat=await harness();stat.graph={...stat.graph,graphType:type};
  assert.equal((await stat.run("STATIC")).ok,true);assert.equal(stat.payload.request.mode,"STATIC");
  assert.equal(stat.payload.updateBatchArtifactId,undefined);assert.equal(stat.counts.uploads,1);
}
const metadata=await harness({operations:[{type:"SET_HYPEREDGE_WEIGHT",hyperedgeId:"h1",weight:7}]});
assert.equal(metadata.pending.getCurrent().motifImpact,"NONE");assert.equal(metadata.analysis.stage(selector(metadata.pending.getCurrent())).ok,false);assert.equal(metadata.counts.uploads,0);
const app=await readFile(new URL("../src/App.jsx",import.meta.url),"utf8");
assert.match(app,/pendingController: pendingHypergraphUpdateControllerRef.current/);
assert.match(app,/stageCandyMotifAnalysis: candyRuntime.actions.stageMotifAnalysis/);
assert.doesNotMatch(await readFile(new URL("../src/candy/useCandyRuntime.js",import.meta.url),"utf8"),/JSON.stringify\(\{graphId,graphVersion,graphType,graphValue,pendingUpdate\}/);

// Actual React hook, authenticated injected HTTP boundary, and minimal views.
const window=new Window({url:"http://localhost:5173/"});
Object.assign(globalThis,{window,document:window.document,HTMLElement:window.HTMLElement,Event:window.Event,sessionStorage:window.sessionStorage,IS_REACT_ACT_ENVIRONMENT:true});
Object.defineProperty(globalThis,"navigator",{value:window.navigator,configurable:true});
const fetchBefore=globalThis.fetch,hookHarness=await harness();let runtimeSession="hook-session",healthGate=null;
const declaration=()=>({schemaVersion:"candy.capabilities/1",runtimeSessionId:runtimeSession,capabilities:frontendCandyCapabilities().filter(c=>c.backend.startsWith("CUDA_")).map(c=>({...c,executionEnvironment:"WSL2_CUDA",nativeBuildFingerprint:"sha256:"+"a".repeat(64),qualification:{schemaVersion:"candy.motif-qualified-build/1",status:"exact_local_operator_record"},devices:[{id:0,name:"Test device",computeCapability:"12.0",qualifiedArchitecture:"sm_120",memoryMiB:1024}]}))});
globalThis.fetch=async(url,options)=>{
  const path=new URL(url).pathname;
  if(path!=="/v1/health") assert.equal(options.headers.Authorization,"Bearer test-only-pairing");
  let body;
  if(path==="/v1/health") {if(healthGate)await healthGate;body={schemaVersion:"candy.runtime-api/1",serviceVersion:"test"};}
  else if(path==="/v1/capabilities") body=declaration();
  else if(path==="/v1/artifacts") {const data=JSON.parse(options.body);body=await hookHarness.client.uploadArtifact({bytes:JSON.parse(Buffer.from(data.content,"base64").toString()),mediaType:data.mediaType});}
  else if(path==="/v1/jobs") {body=await hookHarness.client.submitJob(JSON.parse(options.body));hookHarness.result={...hookHarness.result,runtimeSessionId:runtimeSession};hookHarness.result=(await import("./fixtures/candy-scope5-runtime.mjs")).sealResult(hookHarness.result);}
  else if(path.endsWith("/result")) body=hookHarness.result;
  else if(path.endsWith("/cancel")) body=await hookHarness.client.cancelJob();
  else body=hookHarness.job;
  return {ok:true,status:200,json:async()=>body};
};
const vite=await createServer({server:{middlewareMode:true},appType:"custom",logLevel:"error",define:{"import.meta.env.VITE_CANDY_RUNTIME_ENABLED":"'true'"}});
try {
  const React=await import("react"),{act}=React,{createRoot}=await import("react-dom/client");
  const {useCandyRuntime}=await vite.ssrLoadModule("/src/candy/useCandyRuntime.js");
  const {default:Statistics}=await vite.ssrLoadModule("/src/components/CandyMotifStatistics.jsx");
  let hook;
  function Host() {
    React.useSyncExternalStore(hookHarness.pending.subscribe,hookHarness.pending.getCurrent,hookHarness.pending.getCurrent);
    hook=useCandyRuntime({graphState:hookHarness.graph,getGraphState:()=>hookHarness.graph,pendingController:hookHarness.pending,
      graphType:hookHarness.graph.graphType,graphId:hookHarness.graph.graphId,graphVersion:hookHarness.graph.graphVersion,graphFingerprint:hookHarness.graph.graphFingerprint});
    return React.createElement(Statistics,{candy:hook.state});
  }
  const root=createRoot(document.body.appendChild(document.createElement("div")));
  await act(async()=>root.render(React.createElement(Host)));
  assert.equal(hookHarness.counts.submissions,0);
  await act(async()=>{hook.actions.pair("test-only-pairing");assert.equal((await hook.actions.discover()).ok,true);});
  assert.equal(hook.state.incrementalAvailability.ready,true);assert.equal(hookHarness.counts.submissions,0);
  const s=selector(hookHarness.pending.getCurrent());let token;
  await act(async()=>{token=hook.actions.stageMotifAnalysis(s).confirmation;});
  await act(async()=>assert.equal((await hook.actions.submitFromAssistant(s,token)).ok,true));
  await act(async()=>assert.equal((await hook.actions.openResult(hookHarness.job.jobId)).ok,true));
  assert.equal(hook.state.analysisStatus,"RESULT_READY");assert.match(document.body.textContent,/delta only/);assert.match(document.body.textContent,/\+1/);assert.match(document.body.textContent,/-1/);
  assert.equal(hookHarness.counts.commits,0);assert.equal(hookHarness.pending.getCurrent().status,"VALIDATED");
  const before=hookHarness.pending.getCurrent();runtimeSession="new-hook-session";
  await act(async()=>assert.equal((await hook.actions.discover()).ok,true));
  assert.equal(hook.state.selectedMotifResult,null);assert.equal(hookHarness.pending.getCurrent(),before);
  assert.doesNotMatch(JSON.stringify(hook.state),/test-only-pairing/);
  let release;healthGate=new Promise(resolve=>{release=resolve;});let discovery;
  await act(async()=>{discovery=hook.actions.discover();});await act(async()=>root.unmount());release();assert.equal((await discovery).ok,false);
} finally {await vite.close();globalThis.fetch=fetchBefore;window.close();}
console.log("Scope 5C explicit routing, preflight, frozen transport parity, distinct confirmation and no-apply integration passed.");
