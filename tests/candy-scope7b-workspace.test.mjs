import assert from 'node:assert/strict';
import { createProjectStore } from '../src/persistence/projectStore.js';
import { createProjectSession } from '../src/persistence/projectSession.js';
import { PROJECT_DATABASE } from '../src/persistence/projectSchema.js';
import { restoreWorkspace } from '../src/persistence/workspaceRestore.js';
import { createGraphState } from '../src/graph/graphState.js';
import { sha256, compareSourceIdentity } from '../src/persistence/workspaceProvenance.js';
import { WORKSPACE_LIMITS as L, checkStorageEstimate } from '../src/persistence/storageBudget.js';
import { sealRoot, prepareWorkspace } from '../src/persistence/workspaceObjectSchema.js';
import { projectIndexedDB, turn } from './fixtures/candy-scope7a-storage.mjs';

const bytes = value => new TextEncoder().encode(value).buffer;
const graph = (value='B') => createGraphState([{id:'h0',vertices:['A',value],weight:1,time:null,attributes:{label:'safe'}}]);
const input = (value='A B') => ({sources:[{key:'source',name:'data.txt',bytes:bytes(value)}],graph:graph(),graphSourceKeys:['source'],metadata:{detectedFormat:'simple'},mapping:{role:'hyperedges'},parser:'simple/v1',transform:'explicit-parse'});
const checks=[];
async function test(name, run){await run();checks.push(name);}
function setup(){const db=projectIndexedDB(),store=createProjectStore(db);return {db,store,values:key=>db.databases.get(PROJECT_DATABASE).stores.get(key).values};}
await test('SHA-256 known vector and exact/changed/missing/unsupported identity',async()=>{
 assert.equal(await sha256(bytes('abc')),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
 const expected={sha256:await sha256(bytes('AB')),byteLength:2};
 assert.equal((await compareSourceIdentity(expected,bytes('AB'),L.sourceBytes)).status,'EXACT_MATCH');
 assert.equal((await compareSourceIdentity(expected,bytes('CD'),L.sourceBytes)).status,'CHANGED_SOURCE');
 assert.equal((await compareSourceIdentity(expected,null,L.sourceBytes)).status,'MISSING_SOURCE');
 assert.equal((await compareSourceIdentity({},bytes('AB'),L.sourceBytes)).status,'UNSUPPORTED_SOURCE');
});
await test('real bytes, canonical graph identity/mappings and inert metadata round-trip',async()=>{
 const {store}=setup(),p=await store.defaultProject(),data=input();
 const saved=await store.saveWorkspace(p.projectId,1,data);
 assert.equal(saved.saved,true);assert.equal(saved.revision,2);
 const loaded=await restoreWorkspace(store,p.projectId);
 assert.deepEqual(loaded.sources[0].bytes,bytes('A B'));assert.equal(loaded.sources[0].requiresReupload,false);
 assert.equal(loaded.graph.graphId,data.graph.graphId);assert.equal(loaded.graph.graphVersion,data.graph.graphVersion);assert.equal(loaded.graph.graphFingerprint,data.graph.graphFingerprint);
 assert.deepEqual(loaded.graph.hyperedges,data.graph.hyperedges);assert.deepEqual(loaded.mapping,{role:'hyperedges'});assert.deepEqual(loaded.metadata,{detectedFormat:'simple'});
 assert.equal(Object.hasOwn(loaded.graph,'pendingAction'),false);
 assert.equal((await store.load(p.projectId)).record.pendingAction,null);
});
await test('two concurrent large-object writers: one committed winner, no stale source/graph overwrite',async()=>{
 const {db,store}=setup(),peer=createProjectStore(db),p=await store.defaultProject();
 const a=input('a'.repeat(1024*1024)),b=input('b'.repeat(1024*1024));b.graph=graph('C');
 const results=await Promise.allSettled([store.saveWorkspace(p.projectId,1,a),peer.saveWorkspace(p.projectId,1,b)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.code,'CONFLICT');
 assert.equal((await restoreWorkspace(store,p.projectId)).manifest.revision,2);
});
await test('abort and quota preserve previous current snapshot, all bytes and history atomically',async()=>{
 const {db,store,values}=setup(),p=await store.defaultProject();await store.saveWorkspace(p.projectId,1,input());
 const before=structuredClone([...values('workspaceObjects')]),root=structuredClone(values('workspaceRoots').get(p.projectId));
 for(const [control,code] of [['quotaNext','QUOTA'],['abortNext','ABORTED']]){
  db.control[control]=true;await assert.rejects(store.saveWorkspace(p.projectId,2,input('new')),{code});
  assert.deepEqual([...values('workspaceObjects')],before);assert.deepEqual(values('workspaceRoots').get(p.projectId),root);assert.equal((await store.load(p.projectId)).manifest.revision,2);
 }
});
await test('commit acknowledgement waits for transaction completion, not request success',async()=>{
 const {db,store}=setup(),p=await store.defaultProject();db.control.holdCommit=true;let acknowledged=false;
 const pending=store.saveWorkspace(p.projectId,1,input()).then(value=>{acknowledged=true;return value;});
 for(let n=0;!db.control.pendingCommits.length&&n<100;n++)await turn();
 assert.equal(db.control.pendingCommits.length,1);assert.equal(acknowledged,false);assert.equal(db.control.requestsSucceeded>0,true);
 db.control.holdCommit=false;db.control.pendingCommits.shift()();assert.equal((await pending).saved,true);
});
await test('bounded checkpoints, verified historical reads, partial history stays non-authoritative',async()=>{
 const {store,values}=setup(),p=await store.defaultProject();let revision=1;
 for(let n=0;n<8;n++){const data=input('version '+n);data.graph=graph('B'+n);revision=(await store.saveWorkspace(p.projectId,revision,data)).revision;}
 const current=await restoreWorkspace(store,p.projectId);assert.equal(current.root.history.length,L.checkpoints);
 assert.equal(current.graph.hyperedges[0].vertices[1],'B7');assert.equal(current.root.totalBytes<L.projectBytes,true);
 const previous=current.root.history.at(-1).graph;
 const historical=await restoreWorkspace(store,p.projectId,()=>true,previous.objectId);assert.equal(historical.historical,true);assert.equal(historical.graph.hyperedges[0].vertices[1],'B6');
 values('workspaceObjects').delete(previous.id);
 const stillCurrent=await restoreWorkspace(store,p.projectId);assert.equal(stillCurrent.available,true);assert.equal(stillCurrent.missingHistoryIds.includes(previous.id),true);
 await assert.rejects(restoreWorkspace(store,p.projectId,()=>true,previous.objectId),{code:'INCOMPLETE'});
});
await test('source corruption/missing identity, exact reattachment and changed-source rejection',async()=>{
 const {store,values}=setup(),p=await store.defaultProject();await store.saveWorkspace(p.projectId,1,input('AB'));
 let root=values('workspaceRoots').get(p.projectId),source=root.sources[0];
 values('workspaceObjects').get(source.id).data=bytes('CD');
 await assert.rejects(restoreWorkspace(store,p.projectId),{code:'CORRUPT_SOURCE'});
 assert.equal((await store.reattachSource(p.projectId,2,source.objectId,bytes('CD'))).status,'CHANGED_SOURCE');
 assert.equal((await store.load(p.projectId)).manifest.revision,2);
 values('workspaceObjects').delete(source.id);await assert.rejects(restoreWorkspace(store,p.projectId),{code:'MISSING_SOURCE'});
 await store.reattachSource(p.projectId,2,source.objectId,bytes('AB'));assert.equal((await restoreWorkspace(store,p.projectId)).available,true);
 root=values('workspaceRoots').get(p.projectId);values('workspaceObjects').get(root.graph.id).data=bytes('not graph');
 await assert.rejects(restoreWorkspace(store,p.projectId),{code:'CORRUPT_GRAPH'});
});
await test('external source remains unavailable until exact bytes are attached, without transforms',async()=>{
 const {store}=setup(),p=await store.defaultProject(),data=input('AB');data.sources[0]={key:'source',name:'external.txt',external:{sha256:await sha256(bytes('AB')),byteLength:2}};
 await store.saveWorkspace(p.projectId,1,data);await assert.rejects(restoreWorkspace(store,p.projectId),{code:'MISSING_SOURCE'});
 const root=(await store.readWorkspace(p.projectId)).root;
 await store.reattachSource(p.projectId,2,root.sources[0].objectId,bytes('AB'));
 const result=await restoreWorkspace(store,p.projectId);assert.equal(result.graph.graphId,data.graph.graphId);assert.deepEqual(result.sources[0].bytes,bytes('AB'));
});
await test('future schema, digest confusion, cross-project provenance and orphan takeover fail closed',async()=>{
 const {store,values}=setup(),p=await store.defaultProject();await store.saveWorkspace(p.projectId,1,input());
 const original=structuredClone(values('workspaceRoots').get(p.projectId));
 values('workspaceRoots').set(p.projectId,{...original,schemaVersion:99});await assert.rejects(restoreWorkspace(store,p.projectId),{code:'INCOMPATIBLE'});
 await assert.rejects(store.saveWorkspace(p.projectId,2,input('overwrite')),{code:'INCOMPATIBLE'});assert.equal(values('workspaceRoots').get(p.projectId).schemaVersion,99);
 values('workspaceRoots').set(p.projectId,{...original,updatedAt:'2020-01-01T00:00:00Z'});await assert.rejects(restoreWorkspace(store,p.projectId),{code:'CORRUPT'});
 const other=await store.createProject();const cross=structuredClone(original);cross.sources[0].projectId=other.projectId;
 values('workspaceRoots').set(p.projectId,cross);await assert.rejects(restoreWorkspace(store,p.projectId),{code:'CORRUPT'});
 values('workspaceRoots').set(p.projectId,original);values('workspaceRoots').delete(p.projectId);await assert.rejects(restoreWorkspace(store,p.projectId),{code:'INCOMPLETE'});
 await assert.rejects(store.saveWorkspace(p.projectId,2,input()),{code:'INCOMPLETE'});
 values('workspaceRoots').set(p.projectId,original);const orphan=structuredClone([...values('workspaceObjects').values()][0]);orphan.id=p.projectId+'/orphan';values('workspaceObjects').set(orphan.id,orphan);
 assert.equal((await restoreWorkspace(store,p.projectId)).orphanStatus,'ORPHANED');await store.discardWorkspaceOrphans(p.projectId,2);assert.equal(values('workspaceObjects').has(orphan.id),false);
});
await test('deletion and clear remove owned durable records, preserve unrelated project and tombstones',async()=>{
 const {store,values}=setup(),p=await store.defaultProject(),other=await store.createProject();
 await store.saveWorkspace(p.projectId,1,input());await store.saveWorkspace(other.projectId,1,input('other'));
 await store.deleteProject(p.projectId,2);await assert.rejects(store.saveWorkspace(p.projectId,2,input()),{code:'DELETED'});
 assert.equal([...values('workspaceObjects').keys()].some(id=>id.startsWith(p.projectId+'/')),false);assert.equal((await restoreWorkspace(store,other.projectId)).available,true);
 await store.clearApplicationData();assert.equal(values('workspaceObjects').size,0);assert.equal(values('workspaceRoots').size,0);
 await assert.rejects(store.saveThread(other.projectId,2,{schemaVersion:1}),{code:'DELETED'});
});
await test('late owner, unavailable API and versionchange cannot publish available restored graph',async()=>{
 const {db,store}=setup(),p=await store.defaultProject();await store.saveWorkspace(p.projectId,1,input());
 await assert.rejects(restoreWorkspace(store,p.projectId,()=>false),{code:'ABANDONED'});
 await assert.rejects(createProjectStore(null).saveWorkspace(p.projectId,2,input()),{code:'UNAVAILABLE'});
 db.versionchange(PROJECT_DATABASE);await assert.rejects(store.saveWorkspace(p.projectId,2,input()),{code:'VERSION_CHANGED'});
});
await test('one-tab serialized chat/workspace lineage never rebases another tab',async()=>{
 const {db,store:base}=setup(),store=createProjectSession(base),p=await store.defaultProject();
 const values=await Promise.all([store.saveThread(p.projectId,1,{schemaVersion:1,messages:[{role:'user',text:'local'}],workspace:{}}),store.saveWorkspace(p.projectId,1,input())]);
 assert.equal(values[1].revision,3);assert.equal((await store.load(p.projectId)).record.messages[0].text,'local');
 const peer=createProjectStore(db);await peer.saveWorkspace(p.projectId,3,input('remote'));
 await assert.rejects(store.saveThread(p.projectId,2,{schemaVersion:1,messages:[],workspace:{}}),{code:'CONFLICT'});
 await store.readWorkspace(p.projectId);await assert.rejects(store.saveWorkspace(p.projectId,4,input()),{code:'CONFLICT'});
});
await test('source/count/structure/project budgets and browser estimate are enforced before publication',async()=>{
 const {store}=setup(),p=await store.defaultProject(),oversize=input();oversize.sources[0].bytes=new ArrayBuffer(L.sourceBytes+1);
 await assert.rejects(store.saveWorkspace(p.projectId,1,oversize),{code:'LIMIT'});
 const many=input();many.sources=Array.from({length:L.sources+1},(_,n)=>({key:''+n,name:'x',bytes:bytes('x')}));await assert.rejects(store.saveWorkspace(p.projectId,1,many),{code:'LIMIT'});
 const huge=input();huge.sources=Array.from({length:4},(_,n)=>({key:''+n,name:'x',bytes:new ArrayBuffer(L.sourceBytes)}));huge.graphSourceKeys=[];
 await assert.rejects(prepareWorkspace(p.projectId,2,huge),{code:'LIMIT'});assert.equal((await store.load(p.projectId)).manifest.revision,1);
 await assert.rejects(checkStorageEstimate(100,{estimate:async()=>({usage:95,quota:100})}),{code:'QUOTA'});
 assert.equal((await checkStorageEstimate(100,{estimate:async()=>{throw Error('denied');}})).estimateFailed,true);
});
await test('invalid source relation and incomplete lifecycle cannot become authoritative',async()=>{
 const {store}=setup(),p=await store.defaultProject(),bad=input();bad.graphSourceKeys=['missing'];
 await assert.rejects(store.saveWorkspace(p.projectId,1,bad),{code:'MISSING_SOURCE'});
 const saved=await store.saveWorkspace(p.projectId,1,input()),root=structuredClone(saved.workspace);root.lifecycle='INCOMPLETE';
 await assert.rejects(sealRoot(root),{code:'INCOMPLETE'});
});
console.log(JSON.stringify({scope:'7B',checks:checks.length,status:'PASS',evidence:'transactional IDB double + real Web Crypto; not native browser durability',cases:checks}));
