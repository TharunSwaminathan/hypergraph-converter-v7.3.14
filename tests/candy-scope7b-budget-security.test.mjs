import assert from 'node:assert/strict';
import { createProjectStore } from '../src/persistence/projectStore.js';
import { newProjectId,PROJECT_DATABASE } from '../src/persistence/projectSchema.js';
import { WORKSPACE_LIMITS as L } from '../src/persistence/storageBudget.js';
import { prepareWorkspace,sealRoot } from '../src/persistence/workspaceObjectSchema.js';
import { sha256 } from '../src/persistence/workspaceProvenance.js';
import { restoreWorkspace } from '../src/persistence/workspaceRestore.js';
import { createWorkspaceSourceRegistry } from '../src/persistence/workspaceCapture.js';
import { createGraphState } from '../src/graph/graphState.js';
import { projectIndexedDB } from './fixtures/candy-scope7a-storage.mjs';
const bytes=value=>new TextEncoder().encode(value).buffer;
const data=()=>({sources:[{key:'s',name:'data.txt',bytes:bytes('AB')}],graph:createGraphState([{id:'h0',vertices:['A','B'],weight:1,time:null,attributes:{command:'plain graph data; not execution'}}]),graphSourceKeys:['s'],metadata:{}});
const db=projectIndexedDB(),store=createProjectStore(db),p=await store.defaultProject();
const values=name=>db.databases.get(PROJECT_DATABASE).stores.get(name).values;
const template=(await prepareWorkspace(p.projectId,2,data())).root;
// Application-limit test uses declared-size root metadata fixtures, not 128 MiB
// of real browser storage and not a claim about effective browser quota.
for(let n=0;n<4;n++){
 const other=await store.createProject();await store.saveThread(other.projectId,1,{schemaVersion:1,messages:[],workspace:{}});
 const root=structuredClone(template);root.projectId=other.projectId;
 root.sources=Array.from({length:3},(_,i)=>({...structuredClone(template.sources[0]),objectId:i?newProjectId():template.sources[0].objectId,byteLength:L.sourceBytes-65536,provenance:{...template.sources[0].provenance,sourceKey:'s'+i}}));
 for(const header of [...root.sources,root.graph,root.derived]){header.projectId=other.projectId;header.id=other.projectId+'/'+header.objectId;}
 root.graph.byteLength=7*1024*1024;root.graph.provenance.sources=[{objectId:root.sources[0].objectId,sha256:root.sources[0].sha256}];
 values('workspaceRoots').set(other.projectId,await sealRoot(root));
}
const large=data();large.sources[0].bytes=new ArrayBuffer(L.sourceBytes);
await assert.rejects(store.saveWorkspace(p.projectId,1,large),{code:'LIMIT'});assert.equal((await store.load(p.projectId)).manifest.revision,1);assert.equal(values('workspaceObjects').size,0);
values('workspaceRoots').clear();await store.saveWorkspace(p.projectId,1,data());
const originalRoot=structuredClone(values('workspaceRoots').get(p.projectId)),originalObjects=structuredClone([...values('workspaceObjects')]);
async function restoreOriginal(){values('workspaceRoots').set(p.projectId,structuredClone(originalRoot));values('workspaceObjects').clear();for(const [id,value]of originalObjects)values('workspaceObjects').set(id,structuredClone(value));}
async function rewrite(type,text){
 await restoreOriginal();const root=structuredClone(originalRoot),header=root[type],record=values('workspaceObjects').get(header.id),payload=bytes(text);
 header.byteLength=payload.byteLength;header.sha256=await sha256(payload);values('workspaceObjects').set(header.id,{...header,data:payload});values('workspaceRoots').set(p.projectId,await sealRoot(root));
}
await rewrite('derived',JSON.stringify({schemaVersion:99,workspace:{},mapping:{}}));await assert.rejects(restoreWorkspace(store,p.projectId),{code:'INCOMPATIBLE'});
const graphJson=JSON.parse(new TextDecoder().decode(originalObjects.find(([,value])=>value.objectType==='graph')[1].data));
await rewrite('graph',JSON.stringify({...graphJson,pendingAction:{approved:true},runtimeToken:'synthetic'}));await assert.rejects(restoreWorkspace(store,p.projectId),{code:'CORRUPT_GRAPH'});
await rewrite('graph','{"__proto__":{"polluted":true}}');await assert.rejects(restoreWorkspace(store,p.projectId),{code:'CORRUPT'});assert.equal({}.polluted,undefined);
await restoreOriginal();const invalid=data();invalid.graph={...invalid.graph,graphType:'OrdinaryGraph'};await assert.rejects(store.saveWorkspace(p.projectId,2,invalid),{code:'CORRUPT_GRAPH'});
const oldUUID=Object.getOwnPropertyDescriptor(globalThis.crypto,'randomUUID');Object.defineProperty(globalThis.crypto,'randomUUID',{configurable:true,value:()=>p.projectId});
try{await assert.rejects(store.saveWorkspace(p.projectId,2,data()),{code:'CORRUPT'});}finally{if(oldUUID)Object.defineProperty(globalThis.crypto,'randomUUID',oldUUID);else delete globalThis.crypto.randomUUID;}
assert.equal(values('workspaceRoots').get(p.projectId).sha256,originalRoot.sha256);
const oldCrypto=Object.getOwnPropertyDescriptor(globalThis,'crypto');Object.defineProperty(globalThis,'crypto',{configurable:true,value:undefined});
try{const registry=createWorkspaceSourceRegistry();assert.match(registry.get('editor','text','input.txt').key,/volatile/);await assert.rejects(store.saveWorkspace(p.projectId,2,data()),{code:'UNAVAILABLE'});}
finally{Object.defineProperty(globalThis,'crypto',oldCrypto);}
let current=p.projectId;const pending=restoreWorkspace(store,p.projectId,()=>current===p.projectId);current=newProjectId();await assert.rejects(pending,{code:'ABANDONED'});
const live=await restoreWorkspace(store,p.projectId);assert.equal(live.graph.hyperedges[0].attributes.command,'plain graph data; not execution');assert.equal(Object.hasOwn(live.graph,'runtimeToken'),false);
console.log(JSON.stringify({scope:'7B',status:'PASS',checks:9,evidence:'transactional doubles + Web Crypto; declared-size global-budget fixtures; not real disk quota',cases:['application cap before object publication','future derived schema','authority/type injection','prototype keys','no implicit projection','object UUID collision','crypto unavailable keeps deterministic inputs usable','late callback after project switch','graph attribute strings remain data']}));
