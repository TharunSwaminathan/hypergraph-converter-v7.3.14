import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { createServer } from 'vite';
import { harness,selector,sealResult,artifactId } from './fixtures/candy-scope5-runtime.mjs';
import { frontendCandyCapabilities } from '../src/candy/capabilityDiscovery.js';
import { createArtifactPresenceCache } from '../src/candy/artifactPresence.js';
const cache=createArtifactPresenceCache({maxEntries:2,maxBytes:100}),text='{"input":1}',id=artifactId(text);
let uploads=0,present=false,wrong=false;
const dataClient={baseUrl:'http://127.0.0.1:8791',async uploadArtifact(value){assert.equal(value.bytes,text);uploads++;present=true;return {id,mediaType:'application/json',byteLength:text.length};},async getArtifactMetadata(){if(!present)throw Object.assign(Error('expired'),{details:{httpStatus:404}});return {id,mediaType:wrong?'text/plain':'application/json',byteLength:text.length};}};
const input={text,id,mediaType:'application/json',runtimeSessionId:'s1'};
await cache.upload(dataClient,input,()=>{});await cache.upload(dataClient,input,()=>{});assert.equal(uploads,1);
present=false;await cache.upload(dataClient,input,()=>{});assert.equal(uploads,2);
await cache.upload(dataClient,{...input,runtimeSessionId:'s2'},()=>{});assert.equal(uploads,3);
wrong=true;await assert.rejects(cache.upload(dataClient,{...input,runtimeSessionId:'s2'},()=>{}),e=>e.code==='RESULT_VALIDATION_FAILURE');
cache.clear();assert.equal(cache.stats().entries,0);

const window=new Window({url:'http://localhost:5173/'});
Object.assign(globalThis,{window,document:window.document,HTMLElement:window.HTMLElement,Event:window.Event,IS_REACT_ACT_ENVIRONMENT:true});
Object.defineProperty(globalThis,'navigator',{value:window.navigator,configurable:true});
const before=globalThis.fetch,h=await harness();let session='scope6c-session-1',token='fresh-one',offline=false,sessionReads=0;
globalThis.fetch=async(url,options)=>{
 if(offline)throw Error('Runtime stopped');
 const path=new URL(url).pathname;let body;
 if(path!=='/v1/health' && options.headers.Authorization!==`Bearer ${token}`)return {ok:false,status:401,json:async()=>({schemaVersion:'candy.algorithm-error/1',message:'Fresh pairing required'})};
 if(path==='/v1/health')body={schemaVersion:'candy.runtime-api/1',serviceVersion:'fixture'};
 else if(path==='/v1/session'){sessionReads++;body={schemaVersion:'candy.runtime-session/1',runtimeSessionId:session};}
 else if(path==='/v1/capabilities')body={schemaVersion:'candy.capabilities/1',runtimeSessionId:session,capabilities:frontendCandyCapabilities().filter(c=>['CUDA_STATIC','CUDA_INCREMENTAL'].includes(c.backend)).map(c=>({...c,executionEnvironment:'WSL2_CUDA',nativeBuildFingerprint:'sha256:'+'a'.repeat(64),qualification:{schemaVersion:'candy.motif-qualified-build/1',status:'exact_local_operator_record'},devices:[{id:0,name:'Fixture only',computeCapability:'12.0',qualifiedArchitecture:'sm_120',memoryMiB:1024}]}))};
 else if(path==='/v1/artifacts'){const data=JSON.parse(options.body);body=await h.client.uploadArtifact({bytes:Buffer.from(data.content,'base64').toString(),mediaType:data.mediaType});}
 else if(path.startsWith('/v1/artifacts/'))body=await h.client.getArtifactMetadata(decodeURIComponent(path.split('/')[3]));
 else if(path==='/v1/jobs'){body=await h.client.submitJob(JSON.parse(options.body));h.result=sealResult({...h.result,runtimeSessionId:session});}
 else if(path.endsWith('/cancel'))body=await h.client.cancelJob();
 else if(path.endsWith('/result'))body=h.result;
 else body=h.job;
 return {ok:true,status:200,json:async()=>body};
};
const vite=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'error',define:{'import.meta.env.VITE_CANDY_RUNTIME_ENABLED':"'true'"}});
try {
 const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
 const {useCandyRuntime}=await vite.ssrLoadModule('/src/candy/useCandyRuntime.js');let hook;
 function Host(){hook=useCandyRuntime({graphState:h.graph,getGraphState:()=>h.graph,pendingController:h.pending,graphType:h.graph.graphType});return null;}
 const root=createRoot(document.body.appendChild(document.createElement('div')));
 await act(async()=>root.render(React.createElement(Host)));
 assert.equal(hook.state.authorized,false);
 await act(async()=>{hook.actions.pair(token);assert.ok((await hook.actions.discover()).ok);});
 const pending=h.pending.getCurrent(),args=selector(pending);let approval;
 async function run(){await act(async()=>{approval=hook.actions.stageMotifAnalysis(args).confirmation;assert.ok((await hook.actions.submitFromAssistant(args,approval)).ok);assert.ok((await hook.actions.openResult(h.job.jobId)).ok);});assert.equal(hook.state.analysisStatus,'RESULT_READY');}
 await run();const oldApproval=approval,oldResult=hook.state.selectedMotifResult;
 offline=true;
 await act(async()=>{await new Promise(r=>setTimeout(r,2250));});
 assert.equal(hook.state.authorized,false);assert.equal(hook.state.status,'unavailable');assert.deepEqual(hook.state.capabilities,[]);assert.equal(hook.state.selectedMotifResult,null);assert.equal(h.pending.getCurrent(),pending);
 offline=false;session='scope6c-session-2';token='fresh-two';
 await act(async()=>assert.equal((await hook.actions.discover()).classification,'UNAUTHORIZED'));
 await act(async()=>{hook.actions.pair(token);assert.ok((await hook.actions.discover()).ok);});
 await act(async()=>assert.equal((await hook.actions.submitFromAssistant(args,oldApproval)).ok,false));
 await run();assert.notEqual(hook.state.selectedMotifResult.runtimeSessionId,oldResult.runtimeSessionId);assert.equal(h.counts.commits,0);
 // A new service identity with an intentionally reused test credential also revokes readiness.
 session='scope6c-session-3';await act(async()=>{await new Promise(r=>setTimeout(r,2250));});
 assert.equal(hook.state.authorized,false);assert.equal(hook.state.selectedMotifResult,null);assert.ok(sessionReads>=1);
 await act(async()=>root.unmount());
}finally{await vite.close();globalThis.fetch=before;window.close();}
console.log('Scope6C exact-byte/session-scoped artifact reuse, eviction miss, idle loss, stale pairing/result/approval rejection and explicit mounted reconnect passed (fixture Runtime).');
