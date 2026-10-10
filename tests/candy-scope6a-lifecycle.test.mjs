import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createCandyClient } from "../src/candy/client.js";
import { createMotifAnalysisController } from "../src/candy/motifAnalysisController.js";
import { harness, selector } from "./fixtures/candy-scope5-runtime.mjs";
import { appendLiveMessage, MAX_LIVE_MESSAGES } from "../src/agent/liveMessageHistory.js";
import { createDownloadLifecycle } from "../src/utils/downloadLifecycle.js";

const response = body => ({ok:true,status:200,json:async()=>body});
const held = () => { let release; const promise=new Promise(resolve=>{release=resolve;}); return {promise,release}; };
for (const method of ["health","capabilities","uploadArtifact","submitJob","getJob","getResult","cancelJob"]) {
  const gate=held(), lifetime=new AbortController(); let dispatched;
  const client=createCandyClient({token:"fixture-only",signal:lifetime.signal,fetchImpl:async(_,options)=>{dispatched=options.signal;await gate.promise;return response({});}});
  const payload=method==="uploadArtifact"?{bytes:"fixture",mediaType:"text/plain"}:method==="submitJob"?{}:"id";
  const running=client[method](...(["health","capabilities"].includes(method)?[]:[payload]));
  lifetime.abort();
  await assert.rejects(running,error=>error.classification==="REQUEST_ABORTED");
  assert.equal(dispatched.aborted,true);gate.release();
}
for (const phase of ["fetch","json"]) {
  const gate=held(); let signal;
  const client=createCandyClient({token:"fixture-only",fetchImpl:async(_,options)=>{signal=options.signal;if(phase==="fetch")await gate.promise;return {ok:true,json:()=>gate.promise};}});
  await assert.rejects(client.capabilities({timeoutMs:5}),error=>error.classification==="REQUEST_TIMEOUT");
  assert.equal(signal.aborted,true);gate.release({});
}
let dispatches=0;
const already=new AbortController();already.abort();
const client=createCandyClient({token:"fixture-only",fetchImpl:async()=>{dispatches++;return response({fresh:true});}});
await assert.rejects(client.capabilities({signal:already.signal}),error=>error.classification==="REQUEST_ABORTED");
assert.equal(dispatches,0);assert.equal((await client.capabilities()).fresh,true);
for (const timeoutMs of [0,120001,1.5,NaN]) await assert.rejects(client.health({timeoutMs}),RangeError);

// Actual controller lifetime reaches the actual HTTP client. No native work.
for (const transition of ["disconnect","reconnect","dispose"]) {
  const h=await harness(), before=h.graph, pending=h.pending.getCurrent();let signal;
  const analysis=createMotifAnalysisController({getContext:()=>({graph:h.graph,pendingUpdate:pending,runtime:h.runtime}),
    getClient:({signal:lifetime}={})=>createCandyClient({token:"fixture-only",signal:lifetime,fetchImpl:async(_,options)=>{signal=options.signal;return new Promise(()=>{});}})});
  const args=selector(pending),token=analysis.stage(args).confirmation,running=analysis.submit(args,token);
  while(!signal)await new Promise(resolve=>setTimeout(resolve,0));
  if(transition==="dispose")analysis.dispose();
  else {h.runtime={...h.runtime,authorized:false,runtimeSessionId:null};analysis.invalidate();}
  assert.equal(signal.aborted,true);assert.equal((await running).ok,false);
  assert.equal((await analysis.submit(args,token)).ok,false);assert.equal(analysis.currentResult(),null);
  assert.equal(h.graph,before);assert.equal(h.pending.getCurrent(),pending);
  h.runtime={...h.runtime,authorized:true,runtimeSessionId:"fresh-session"};analysis.activate();
  assert.equal(analysis.stage(args).ok,true,"fresh session and confirmation can stage a retry");analysis.dispose();
}
// Genuine contract-valid fixture result, deliberately ignoring abort: currentness
// still rejects it. Fixture execution is never described as real CUDA.
for (const method of ["getJob","getResult"]) {
  const h=await harness();await h.run();const original=h.client[method],gate=held();
  h.client[method]=async(...args)=>{await gate.promise;return original(...args);};
  const opening=method==="getJob"?h.analysis.getJobStatus(h.job.jobId):h.analysis.openResult(h.job.jobId);
  await new Promise(resolve=>setTimeout(resolve,0));
  const cancel=h.analysis.cancelJob(h.job.jobId);
  assert.equal(h.analysis.currentResult(),null);assert.equal(h.analysis.getSnapshot().status,"CANCELLED");
  gate.release();await cancel;assert.equal((await opening).ok,false);assert.equal(h.counts.commits,0);
}

let messages=[];const owner=Object.freeze({id:"current-selector",applyAuthority:false});
for(let i=0;i<10000;i++) {messages=appendLiveMessage(messages,{id:i,actions:i===9999?[owner]:[]});assert.ok(messages.length<=MAX_LIVE_MESSAGES);}
assert.equal(messages.length,500);assert.equal(messages[0].id,9500);assert.equal(messages.at(-1).actions[0],owner);
const panel=await readFile(new URL("../src/components/AgentChatPanel.jsx",import.meta.url),"utf8");
assert.doesNotMatch(panel,/setMessages\([^\n]*=>\s*\[\.\.\./);assert.equal((panel.match(/setMessages\([^\n]*=> appendLiveMessage/g)||[]).length,5);

const urls=new Map(),timers=new Map();let sequence=0,clicks=0;
const exports=createDownloadLifecycle({urlApi:{createObjectURL:blob=>{const url=`blob:fixture-${sequence++}`;urls.set(url,blob);return url;},revokeObjectURL:url=>urls.delete(url)},
  document:{body:{appendChild(){}},createElement:()=>({click(){clicks++;},remove(){}})},schedule:fn=>{const id=sequence++;timers.set(id,fn);return id;},unschedule:id=>timers.delete(id)});
const bytes="v1\tα\r\nv2\tβ\n";
for(let i=0;i<1000;i++) {exports.download("fixture.txt",bytes);assert.equal(await [...urls.values()].at(-1).text(),bytes);}
assert.equal(clicks,1000);assert.equal(exports.retainedCount(),1000);
for(const fn of [...timers.values()])fn();assert.equal(urls.size,0);assert.equal(timers.size,0);
exports.download("teardown.txt",bytes);exports.dispose();assert.equal(exports.retainedCount(),0);assert.equal(urls.size,0);
// StrictMode teardown/re-setup does not permanently disable downloads.
exports.download("remount.txt",bytes);exports.dispose();assert.equal(urls.size,0);
console.log("Scope 6A bounded transport, authority races, 10000 appends, exact export bytes and URL cleanup passed.");
