import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { createServer } from "vite";
import { harness, selector, sealResult } from "./fixtures/candy-scope5-runtime.mjs";
import { frontendCandyCapabilities } from "../src/candy/capabilityDiscovery.js";
const window=new Window({url:"http://localhost:5173/"});
Object.assign(globalThis,{window,document:window.document,HTMLElement:window.HTMLElement,Event:window.Event,IS_REACT_ACT_ENVIRONMENT:true});
Object.defineProperty(globalThis,"navigator",{value:window.navigator,configurable:true});
const before=globalThis.fetch,h=await harness();let session="fixture-session-1",hold=null,lastSignal=null;
globalThis.fetch=async(url,options)=>{
  const path=new URL(url).pathname;let body;
  if(hold===path){lastSignal=options.signal;await new Promise(()=>{});}
  if(path==="/v1/health")body={schemaVersion:"candy.runtime-api/1",serviceVersion:"fixture"};
  else if(path==="/v1/capabilities")body={schemaVersion:"candy.capabilities/1",runtimeSessionId:session,capabilities:frontendCandyCapabilities().filter(c=>["CUDA_STATIC","CUDA_INCREMENTAL"].includes(c.backend)).map(c=>({...c,executionEnvironment:"WSL2_CUDA",nativeBuildFingerprint:"sha256:"+"a".repeat(64),qualification:{schemaVersion:"candy.motif-qualified-build/1",status:"exact_local_operator_record"},devices:[{id:0,name:"Fixture only",computeCapability:"12.0",qualifiedArchitecture:"sm_120",memoryMiB:1024}]}))};
  else if(path==="/v1/artifacts"){const data=JSON.parse(options.body);body=await h.client.uploadArtifact({bytes:JSON.parse(Buffer.from(data.content,"base64").toString()),mediaType:data.mediaType});}
  else if(path.startsWith("/v1/artifacts/"))body=await h.client.getArtifactMetadata(decodeURIComponent(path.split('/')[3]));
  else if(path==="/v1/session")body={schemaVersion:"candy.runtime-session/1",runtimeSessionId:session};
  else if(path==="/v1/jobs"){body=await h.client.submitJob(JSON.parse(options.body));h.result=sealResult({...h.result,runtimeSessionId:session});}
  else if(path.endsWith("/cancel"))body=await h.client.cancelJob();
  else if(path.endsWith("/result"))body=h.result;
  else body=h.job;
  return {ok:true,status:200,json:async()=>body};
};
const vite=await createServer({server:{middlewareMode:true},appType:"custom",logLevel:"error",define:{"import.meta.env.VITE_CANDY_RUNTIME_ENABLED":"'true'"}});
try {
  const React=await import("react"),{act}=React,{createRoot}=await import("react-dom/client");
  const {useCandyRuntime}=await vite.ssrLoadModule("/src/candy/useCandyRuntime.js");let hook;
  function Host(){hook=useCandyRuntime({graphState:h.graph,getGraphState:()=>h.graph,pendingController:h.pending,graphType:h.graph.graphType});return null;}
  const root=createRoot(document.body.appendChild(document.createElement("div")));
  await act(async()=>root.render(React.createElement(Host)));
  await act(async()=>{hook.actions.pair("fixture-token");assert.equal((await hook.actions.discover()).ok,true);});
  const args=selector(h.pending.getCurrent());let oldToken,running;
  await act(async()=>{oldToken=hook.actions.stageMotifAnalysis(args).confirmation;hold="/v1/artifacts";running=hook.actions.submitFromAssistant(args,oldToken);});
  for(let i=0;!lastSignal && i<100;i++)await new Promise(resolve=>setTimeout(resolve,10));
  assert.ok(lastSignal,"upload reached held transport");
  await act(async()=>hook.actions.pair(""));assert.equal(lastSignal.aborted,true);assert.equal((await running).ok,false);
  assert.equal(hook.state.authorized,false);assert.equal(hook.state.selectedMotifResult,null);assert.equal(h.counts.submissions,0);
  hold=null;session="fixture-session-2";
  await act(async()=>{hook.actions.pair("fixture-fresh-token");assert.equal((await hook.actions.discover()).ok,true);});
  await act(async()=>assert.equal((await hook.actions.submitFromAssistant(args,oldToken)).ok,false));
  await act(async()=>{const fresh=hook.actions.stageMotifAnalysis(args).confirmation;assert.equal((await hook.actions.submitFromAssistant(args,fresh)).ok,true);});
  assert.equal(h.counts.submissions,1);assert.equal(h.counts.commits,0);
  for(const suffix of ["","/result"]) {
    const path=`/v1/jobs/${h.job.jobId}${suffix}`;
    hold=path;lastSignal=null;let read;
    await act(async()=>{read=hook.actions.openResult(h.job.jobId);});
    for(let i=0;!lastSignal && i<100;i++)await new Promise(resolve=>setTimeout(resolve,10));
    assert.ok(lastSignal,"read reached held transport");
    await act(async()=>hook.actions.pair("fixture-fresh-token"));assert.equal(lastSignal.aborted,true);
    assert.equal((await read).ok,false);assert.equal(hook.state.selectedMotifResult,null);
    hold=null;
    await act(async()=>{await hook.actions.discover();const token=hook.actions.stageMotifAnalysis(args).confirmation;assert.equal((await hook.actions.submitFromAssistant(args,token)).ok,true);});
  }
  hold="/v1/health";lastSignal=null;let discovery;
  await act(async()=>{discovery=hook.actions.discover();});assert.ok(lastSignal);
  await act(async()=>root.unmount());assert.equal(lastSignal.aborted,true);assert.equal((await discovery).ok,false);
  assert.equal(h.counts.commits,0);assert.equal(h.pending.getCurrent().status,"VALIDATED");
} finally {await vite.close();globalThis.fetch=before;window.close();}
console.log("Scope 6A mounted hook upload/disconnect, fresh discovery/authorization retry, aborted status/result and unmount cleanup passed (fixture Runtime only).");
