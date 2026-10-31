// Explicit synthetic qualification entry point; never run in a user profile.
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from '../../src/App.jsx';
import { createProjectStore } from '../../src/persistence/projectStore.js';
import { restoreWorkspace } from '../../src/persistence/workspaceRestore.js';
import { createGraphState } from '../../src/graph/graphState.js';
import { PROJECT_DATABASE, PROJECT_DATABASE_VERSION } from '../../src/persistence/projectSchema.js';

const q=new URLSearchParams(location.search),phase=q.get('phase')??'first',token=q.get('token'),cases=[],stores=[];
const check=(v,m)=>{if(!v)throw Error(m);};
const pause=()=>new Promise(done=>setTimeout(done,20));
async function wait(fn,label){const end=performance.now()+20000;while(performance.now()<end){const value=await fn();if(value)return value;await pause();}throw Error('Timed out: '+label+'; DOM: '+document.body.textContent.slice(0,1600));}
async function rejects(promise,code){try{await promise;}catch(error){check(error.code===code,`Expected ${code}, got ${error.code}: ${error.message}`);return;}throw Error('Missing rejection '+code);}
const data=(label='base')=>({sources:[{key:'source',name:'native.txt',bytes:new TextEncoder().encode(label)}],graph:createGraphState([{id:'h0',vertices:['A',label],time:null,weight:1,attributes:{}}]),graphSourceKeys:['source'],metadata:{label}});
let mounted=null;
const mount=()=>{mounted=createRoot(document.getElementById('root'));mounted.render(React.createElement(App));};
const unmount=async()=>{mounted?.unmount();mounted=null;await pause();};
const status=()=>document.querySelector('[data-workspace-storage]');
const settled=async()=>wait(()=>status()&&['clean','committed','read_only','error'].includes(status().dataset.workspaceStorage)&&status(),'App storage state');
async function report(ok,extra={}){
 const value={ok,phase,origin:location.origin,userAgent:navigator.userAgent,cases,...extra};document.getElementById('result').textContent=JSON.stringify(value);
 await fetch(`/__scope7b_report?token=${encodeURIComponent(token)}`,{method:'POST',body:JSON.stringify(value)});
}
function selectFile(element,text,name='scope7b.txt'){
 const transfer=new DataTransfer();transfer.items.add(new File([text],name,{type:'text/plain',lastModified:123}));element.files=transfer.files;element.dispatchEvent(new Event('change',{bubbles:true}));
}
if(phase==='peer'){
 const store=createProjectStore();stores.push(store);mount();
 window.scope7bPeer={store,ready:false,publish:(id,revision,label)=>store.saveWorkspace(id,revision,data(label)),restored:null};
 await settled();const p=await store.defaultProject();window.scope7bPeer.restored=await restoreWorkspace(store,p.projectId);window.scope7bPeer.ready=true;
}else{
 try{
  check(location.origin==='http://127.0.0.1:5173','canonical origin');
  const store=createProjectStore();stores.push(store);
  if(phase==='unavailable'){
   const descriptor=Object.getOwnPropertyDescriptor(globalThis,'indexedDB');Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:undefined});
   try{mount();await settled();check(status().dataset.workspaceStorage==='error'&&/unavailable/i.test(status().textContent),'actual App reports injected unavailable storage');cases.push({case:'actual-App-injected-unavailable-storage',injected:true,graphAvailable:false});await unmount();await report(true);}
   finally{Object.defineProperty(globalThis,'indexedDB',descriptor);}
  }else if(phase==='first'){
   check(!(await indexedDB.databases()).some(db=>db.name===PROJECT_DATABASE),'fresh isolated database');mount();await settled();check(status().dataset.workspaceStorage!=='error','App storage starts usable');
   const text='h0: A, B\nh1: B, C';
   const upload=document.querySelector('input[type=file]');check(upload,'actual upload input');selectFile(upload,text);
   const p=await store.defaultProject();
   await wait(async()=>{const b=await store.readWorkspace(p.projectId);return b.root?.sources.some(s=>s.provenance.name==='scope7b.txt')&&status()?.dataset.workspaceStorage==='committed';},'actual source bytes committed');
   const parse=[...document.querySelectorAll('.hg-input-card button')].find(button=>/convert/i.test(button.textContent));check(parse,'actual Convert button');parse.click();
   const loaded=await wait(async()=>{const b=await store.readWorkspace(p.projectId);if(!b.root)return false;const s=await restoreWorkspace(store,p.projectId);return s.graph?.hyperedges?.length===2&&status()?.dataset.workspaceStorage==='committed'&&s;},'actual parsed graph saved');
   check(loaded.sources.some(s=>s.provenance.name==='scope7b.txt'&&new TextDecoder().decode(s.bytes)===text),'original File bytes validated');
   cases.push({case:'actual-App-upload-parse-save',sourceSha256:loaded.sources.find(s=>s.provenance.name==='scope7b.txt').sha256,graphId:loaded.graph.graphId,graphVersion:loaded.graph.graphVersion,graphSha256:loaded.root.graph.sha256});
   await unmount();
   const peer=window.open(`${location.pathname}?phase=peer&token=${encodeURIComponent(token)}`,'scope7b-owned-peer');check(peer,'owned second tab');
   await wait(()=>peer.scope7bPeer?.ready,'second tab restored App');
   check(peer.scope7bPeer.restored.root.graph.sha256===loaded.root.graph.sha256,'second actual App has same committed graph');
   cases.push({case:'new-tab-same-origin-App-restore',graphSha256:loaded.root.graph.sha256});
   try{
    const native=await store.createProject();await store.saveWorkspace(native.projectId,1,data());
    const events=[],oldTransaction=IDBDatabase.prototype.transaction,oldPut=IDBObjectStore.prototype.put;
    IDBDatabase.prototype.transaction=function(...args){const tx=oldTransaction.apply(this,args);tx.addEventListener('complete',()=>events.push('complete'));return tx;};
    IDBObjectStore.prototype.put=function(...args){const req=oldPut.apply(this,args);req.addEventListener('success',()=>events.push('request-success'));return req;};
    try{await store.saveWorkspace(native.projectId,2,data('new'));events.push('receipt');}finally{IDBDatabase.prototype.transaction=oldTransaction;IDBObjectStore.prototype.put=oldPut;}
    check(events.indexOf('request-success')<events.lastIndexOf('complete')&&events.lastIndexOf('complete')<events.indexOf('receipt'),'receipt after native transaction complete');cases.push({case:'native-publication-receipt',events});
    await rejects(peer.scope7bPeer.publish(native.projectId,2,'stale graph'),'CONFLICT');cases.push({case:'two-tab-stale-graph-publication',code:'CONFLICT'});
    await rejects(peer.scope7bPeer.publish(native.projectId,2,'stale source'),'CONFLICT');cases.push({case:'two-tab-stale-source-publication',code:'CONFLICT'});
    const baseline=(await store.readWorkspace(native.projectId)).root.sha256;
    for(const mode of ['quota','abort']){
     const put=IDBObjectStore.prototype.put;
     IDBObjectStore.prototype.put=function(...args){
      if(this.name==='workspaceObjects'&&args[0]?.projectId===native.projectId&&mode==='quota')throw new DOMException('Injected native write quota failure','QuotaExceededError');
      const req=put.apply(this,args);if(this.name==='workspaceRoots'&&args[0]?.projectId===native.projectId&&mode==='abort')req.addEventListener('success',()=>this.transaction.abort(),{once:true});return req;
     };
     try{await rejects(store.saveWorkspace(native.projectId,3,data(mode)),mode==='quota'?'QUOTA':'ABORTED');}finally{IDBObjectStore.prototype.put=put;}
     check((await store.readWorkspace(native.projectId)).root.sha256===baseline,'failed write retains previous root');check((await restoreWorkspace(store,native.projectId)).available,'previous bytes intact');
     cases.push({case:mode==='quota'?'native-IDB-injected-quota':'native-IDB-explicit-abort',injected:true,previousPublicationPreserved:true});
    }
    let revision=3;for(let n=0;n<7;n++)revision=(await store.saveWorkspace(native.projectId,revision,data('checkpoint-'+n))).revision;
    const bounded=await peer.scope7bPeer.store.readWorkspace(native.projectId);check(bounded.root.history.length===5,'history bound under another open connection');cases.push({case:'bounded-history-second-tab-open',checkpoints:5});
    const estimate=Object.getOwnPropertyDescriptor(navigator.storage,'estimate');let release,entered;
    const started=new Promise(done=>entered=done),gate=new Promise(done=>release=done);
    Object.defineProperty(navigator.storage,'estimate',{configurable:true,value:async()=>{entered();await gate;return {quota:1e10,usage:0};}});
    const late=store.saveWorkspace(native.projectId,revision,data('late after delete'));await started;
    await peer.scope7bPeer.store.deleteProject(native.projectId,revision);release();
    try{await rejects(late,'DELETED');}finally{if(estimate)Object.defineProperty(navigator.storage,'estimate',estimate);else delete navigator.storage.estimate;}
    await rejects(peer.scope7bPeer.publish(native.projectId,revision,'resurrect'),'DELETED');cases.push({case:'deletion-during-graph-preparation-and-late-writer',code:'DELETED'});
    await rejects(createProjectStore(null).defaultProject(),'UNAVAILABLE');cases.push({case:'injected-unavailable-API',injected:true,scope:'not actual browser policy denial'});
    const versioned=createProjectStore(indexedDB,'scope7b-versionchange');stores.push(versioned);const vp=await versioned.defaultProject();let revoked=false;versioned.subscribe(e=>revoked=e.code==='VERSION_CHANGED');
    await new Promise((done,fail)=>{const req=indexedDB.open('scope7b-versionchange',PROJECT_DATABASE_VERSION+1);req.onsuccess=()=>{req.result.close();done();};req.onerror=()=>fail(req.error);});
    check(revoked,'native versionchange revoked');await rejects(versioned.saveWorkspace(vp.projectId,1,data()),'VERSION_CHANGED');cases.push({case:'native-versionchange-revokes-workspace-writer'});
    const measurements=[];
    for(const size of [0,131072,1048576]){
     const measured=await store.createProject(),sample=data('measurement'),edgeCount=size===1048576?5000:100;
     sample.sources[0].bytes=new Uint8Array(size);sample.graph=createGraphState(Array.from({length:edgeCount},(_,i)=>({id:'m'+i,vertices:['v'+i,'v'+(i+1),'v'+(i+2)],time:null,weight:1,attributes:{}})));
     const start=performance.now(),saved=await store.saveWorkspace(measured.projectId,1,sample),written=performance.now();await restoreWorkspace(store,measured.projectId);const restored=performance.now();
     measurements.push({sourceBytes:size,hyperedges:edgeCount,logicalDurableBytes:saved.workspace.totalBytes,writeIncludingSerializationHashMs:written-start,restoreValidationMs:restored-written});
    }
    cases.push({case:'measured-native-storage-paths',measurements,scope:'only these bounded sizes; no general large-scale or GPU claim'});
   }finally{await peer.scope7bPeer.store.close();peer.close();}
   const pending=await store.createProject();await store.saveWorkspace(pending.projectId,1,data('before reload'));
   await report(true,{defaultProjectId:p.projectId,expectedGraphSha256:loaded.root.graph.sha256,pendingProjectId:pending.projectId});
   const next=new URL(location.href);next.searchParams.set('phase','reload');next.searchParams.set('defaultProjectId',p.projectId);next.searchParams.set('expectedGraphSha256',loaded.root.graph.sha256);next.searchParams.set('pendingProjectId',pending.projectId);
   const put=IDBObjectStore.prototype.put;let navigating=false;
   IDBObjectStore.prototype.put=function(...args){const req=put.apply(this,args);if(this.name==='workspaceRoots'&&args[0]?.projectId===pending.projectId)req.addEventListener('success',()=>{if(!navigating){navigating=true;location.replace(next);}}, {once:true});return req;};
   void store.saveWorkspace(pending.projectId,2,data('during reload')).catch(()=>{});
  }else{
   mount();await settled();check(status().dataset.workspaceStorage==='committed','actual App restored only validated bytes');
   const p=await store.defaultProject(),loaded=await restoreWorkspace(store,p.projectId);
   check(p.projectId===q.get('defaultProjectId')&&loaded.root.graph.sha256===q.get('expectedGraphSha256'),'exact persisted default graph identity');
   check(document.querySelector('.hg-input-card textarea')?.value==='h0: A, B\nh1: B, C','actual editor/source restoration');
   cases.push({case:phase==='reopen'?'browser-process-close-reopen-App-restore':'same-origin-App-refresh',graphSha256:loaded.root.graph.sha256,executionAuthorityRestored:false});
   if(phase==='reload'){
    const pending=await restoreWorkspace(store,q.get('pendingProjectId'));
    check([2,3].includes(pending.manifest.revision),'atomic outcome after navigation during write');
    const value=new TextDecoder().decode(pending.sources[0].bytes);check(value==='before reload'||value==='during reload','complete old or complete new source');
    cases.push({case:'reload-during-native-publication',observedRevision:pending.manifest.revision,outcome:value,partialStatePublished:false});
   }else if(phase==='reopen'){
    await unmount();const source=loaded.root.sources.find(s=>s.provenance.name==='scope7b.txt'&&s.provenance.kind==='upload');check(source,'raw upload fixture');
    async function corrupt(id){return new Promise((done,fail)=>{const req=indexedDB.open(PROJECT_DATABASE,PROJECT_DATABASE_VERSION);req.onerror=()=>fail(req.error);req.onsuccess=()=>{const db=req.result,tx=db.transaction('workspaceObjects','readwrite'),os=tx.objectStore('workspaceObjects'),get=os.get(id);get.onsuccess=()=>{const record=get.result,bytes=record.data.slice(0);new Uint8Array(bytes)[0]^=1;os.put({...record,data:bytes});};tx.oncomplete=()=>{db.close();done();};tx.onabort=()=>fail(tx.error);};});}
    await corrupt(source.id);mount();await wait(()=>document.querySelector(`[data-workspace-source-id="${source.objectId}"] input`),'explicit exact-source recovery control');
    check(status().dataset.workspaceStorage==='read_only','corruption fails closed before graph is published');
    const recovery=document.querySelector(`[data-workspace-source-id="${source.objectId}"] input`),revision=(await store.load(p.projectId)).manifest.revision;
    selectFile(recovery,'h0: X, Y\nh1: Y, Z');await wait(()=>/not attached/.test(status()?.textContent??''),'changed source rejected');check((await store.load(p.projectId)).manifest.revision===revision,'changed source does not publish');
    selectFile(recovery,'h0: A, B\nh1: B, C');await wait(()=>/Exact source bytes reattached/.test(status()?.textContent??''),'exact-source UI repair');
    check((await restoreWorkspace(store,p.projectId)).graph.graphId===loaded.graph.graphId,'reattachment restores exact graph without transformation');cases.push({case:'actual-App-corrupt-source-exact-reattachment',changedSourceRejected:true,automaticTransformation:false});
    const customPill=[...document.querySelectorAll('.hg-formats button')].find(b=>/custom/i.test(b.textContent));check(customPill,'Custom Parser route');customPill.click();
    const review=await wait(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Use reviewed draft'),'fresh parser review control');
    const run=[...document.querySelectorAll('button')].find(b=>/Run Parser/.test(b.textContent));check(run?.disabled,'restored parser cannot run before fresh review');
    const apply=[...document.querySelectorAll('.hg-input-card button')].find(b=>/Apply/.test(b.textContent));check(apply?.disabled,'no restored parser result/Apply authority');review.click();
    await wait(()=>status()?.dataset.workspaceStorage==='committed'&&![...document.querySelectorAll('button')].some(b=>b.textContent==='Use reviewed draft'),'reviewed draft remains non-executing');
    cases.push({case:'actual-App-restored-parser-review-Run-Apply-separation',automaticRun:false,restoredApply:false});
    await unmount();const current=await restoreWorkspace(store,p.projectId);await corrupt(current.root.graph.id);mount();await settled();check(status().dataset.workspaceStorage==='read_only','corrupt graph remains unavailable');await rejects(restoreWorkspace(store,p.projectId),'CORRUPT_GRAPH');cases.push({case:'actual-App-corrupt-graph-fails-closed'});
   }
   await unmount();for(const s of stores)await s.close();await report(true,{defaultProjectId:p.projectId,expectedGraphSha256:loaded.root.graph.sha256,pendingProjectId:q.get('pendingProjectId')});
  }
 }catch(error){await unmount();await report(false,{error:String(error.stack)});}
}
