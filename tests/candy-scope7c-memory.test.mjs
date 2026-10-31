import assert from 'node:assert/strict';
import {createProjectStore}from '../src/persistence/projectStore.js';
import {createProjectSession}from '../src/persistence/projectSession.js';
import {createMemoryCoordinator,parseMemoryCommand}from '../src/persistence/assistantMemoryCoordinator.js';
import {retrieveMemories}from '../src/persistence/assistantMemoryRetrieval.js';
import {PROJECT_DATABASE}from '../src/persistence/projectSchema.js';
import {createGraphState}from '../src/graph/graphState.js';
import {projectIndexedDB,turn}from './fixtures/candy-scope7a-storage.mjs';
const cases=[];async function test(name,run){await run();cases.push(name);}
const command=(content='Keep CUDA fail closed',topic='cuda')=>({kind:'remember',memoryType:'USER_CONSTRAINT',topic,content,provenance:'USER_EXPLICIT'});
const setup=async()=>{const db=projectIndexedDB(),store=createProjectStore(db),p=await store.defaultProject();return{db,store,p,rows:()=>db.databases.get(PROJECT_DATABASE).stores.get('assistantMemories').values};};
await test('explicit remember, durable restart context and no transcript extraction',async()=>{
 const {store,p}=await setup();const receipt=await store.saveMemory(p.projectId,1,command());assert.equal(receipt.status,'committed');
 await store.saveThread(p.projectId,2,{schemaVersion:1,messages:[{role:'user',text:'casual chat is not memory'}],workspace:{}});
 await store.close();const loaded=await store.readMemory(p.projectId);assert.equal(loaded.envelope.records.length,1);
 const c=createMemoryCoordinator(store,p.projectId);await c.initialize();assert.equal((await c.context()).items[0].content,'Keep CUDA fail closed');c.dispose();
 assert.equal(parseMemoryCommand('Remember that this project uses dataset X.').content,'this project uses dataset X.');assert.equal(parseMemoryCommand('apply the update'),null);
});
await test('request success cannot acknowledge before transaction completion',async()=>{
 const {db,store,p,rows}=await setup();db.control.holdCommit=true;let settled=false;const pending=store.saveMemory(p.projectId,1,command()).then(r=>{settled=true;return r;});
 for(let n=0;n<100&&!db.control.pendingCommits.length;n++)await turn();assert.equal(db.control.pendingCommits.length,1);assert.equal(settled,false);assert.equal(rows().has(p.projectId),false);
 db.control.holdCommit=false;db.control.pendingCommits.shift()();
 assert.equal((await pending).saved,true);
});
await test('project isolation A to B to A and shared local chat/workspace writer lineage',async()=>{
 const {store,p}=await setup(),session=createProjectSession(store);await session.load(p.projectId);const b=await session.createProject();
 await session.saveMemory(p.projectId,1,command('A fact'));await session.saveThread(p.projectId,1,{schemaVersion:1,messages:[],workspace:{}});await session.saveMemory(p.projectId,1,command('A second','second'));
 const aView=retrieveMemories((await store.readMemory(p.projectId)).envelope),bView=retrieveMemories((await store.readMemory(b.projectId)).envelope);
 assert.equal(aView.items.length,2);assert.equal(bView.items.length,0);assert.equal((await store.readMemory(p.projectId)).envelope.records[0].projectId,p.projectId);
});
await test('duplicates, supersession, explicit conflict groups and forgetting erase content',async()=>{
 const {store,p}=await setup();let r=await store.saveMemory(p.projectId,1,command('Target 100k','target'));const first=r.envelope.records[0].memoryId;
 await assert.rejects(store.saveMemory(p.projectId,r.revision,command('Target 100k','target')),{code:'DUPLICATE'});
 r=await store.saveMemory(p.projectId,r.revision,{kind:'supersede',memoryId:first,content:'Target 1M'});assert.equal(r.envelope.records[0].status,'SUPERSEDED');assert.equal(retrieveMemories(r.envelope).items[0].content,'Target 1M');
 r=await store.saveMemory(p.projectId,r.revision,command('Target 10','target'));assert.equal(retrieveMemories(r.envelope).items.length,0);assert.equal(retrieveMemories(r.envelope).conflicts,2);
 r=await store.saveMemory(p.projectId,r.revision,{kind:'forgetType',memoryType:'USER_CONSTRAINT'});assert.equal(r.envelope.records.every(x=>x.content===''&&x.status==='FORGOTTEN'),true);
 r=await store.saveMemory(p.projectId,r.revision,{kind:'clear'});assert.equal(r.envelope.records.length,0);
});
await test('concurrent creation/supersession, stale forget and no memory resurrection',async()=>{
 const {db,store,p}=await setup(),peer=createProjectStore(db);
 const writes=await Promise.allSettled([store.saveMemory(p.projectId,1,command('A')),peer.saveMemory(p.projectId,1,command('B'))]);assert.equal(writes.filter(x=>x.status==='fulfilled').length,1);assert.equal(writes.find(x=>x.status==='rejected').reason.code,'CONFLICT');
 let row=await store.readMemory(p.projectId),id=row.envelope.records[0].memoryId;
 const supers=await Promise.allSettled([store.saveMemory(p.projectId,2,{kind:'supersede',memoryId:id,content:'C'}),peer.saveMemory(p.projectId,2,{kind:'supersede',memoryId:id,content:'D'})]);assert.equal(supers.filter(x=>x.status==='fulfilled').length,1);
 row=await store.readMemory(p.projectId);id=row.envelope.records.at(-1).memoryId;await store.saveMemory(p.projectId,3,{kind:'forget',memoryId:id});
 await assert.rejects(peer.saveMemory(p.projectId,3,command('resurrection')),{code:'CONFLICT'});assert.equal(retrieveMemories((await store.readMemory(p.projectId)).envelope).items.length,0);
});
await test('quota and abort rollback; project delete/clear preserve unrelated project',async()=>{
 const {db,store,p,rows}=await setup(),b=await store.createProject();await store.saveMemory(p.projectId,1,command());await store.saveMemory(b.projectId,1,command('B'));
 const old=structuredClone(rows().get(p.projectId));for(const [flag,code]of [['quotaNext','QUOTA'],['abortNext','ABORTED']]){db.control[flag]=true;await assert.rejects(store.saveMemory(p.projectId,2,command('new','new')),{code});assert.deepEqual(rows().get(p.projectId),old);}
 await store.deleteProject(p.projectId,2);assert.equal(rows().has(p.projectId),false);assert.equal((await store.readMemory(b.projectId)).envelope.records.length,1);await assert.rejects(store.saveMemory(p.projectId,3,command()),{code:'DELETED'});
 await store.clearApplicationData();assert.equal(rows().size,0);
});
await test('late callback and project switch abandon publication without leaking receipt',async()=>{
 const {store,p}=await setup(),c=createMemoryCoordinator(store,p.projectId);await c.initialize();c.dispose();await assert.rejects(c.mutate(command()),{code:'ABANDONED'});
 let active=true;const pending=store.saveMemory(p.projectId,1,command(),()=>active);active=false;await assert.rejects(pending,{code:'ABANDONED'});assert.equal((await store.readMemory(p.projectId)).envelope,null);
});
await test('derived provenance is computed from real verified workspace, never supplied claims',async()=>{
 const {store,p}=await setup();await assert.rejects(store.saveMemory(p.projectId,1,{kind:'remember',provenance:'WORKSPACE_DERIVED'}),{code:'INCOMPLETE'});
 const input={sources:[{key:'s',name:'source.txt',bytes:new TextEncoder().encode('A B')}],graph:createGraphState([{id:'h',vertices:['A','B'],weight:1,time:null,attributes:{}}]),metadata:{}};
 await store.saveWorkspace(p.projectId,1,input);const receipt=await store.saveMemory(p.projectId,2,{kind:'remember',provenance:'WORKSPACE_DERIVED',content:'invented graph has 100 nodes'});assert.match(receipt.envelope.records[0].content,/1 hyperedges/);assert.doesNotMatch(receipt.envelope.records[0].content,/invented/);
 const c=createMemoryCoordinator(store,p.projectId);await c.initialize();assert.equal((await c.context()).items.length,1);
 await store.saveWorkspace(p.projectId,3,{...input,graph:createGraphState([{id:'h',vertices:['C','D'],weight:1,time:null,attributes:{}}])});assert.equal((await c.context()).items.length,0);assert.equal((await c.context()).stale,1);
});
await test('project deletion wins against memory preparation paused during SHA256',async()=>{
 const {store,p}=await setup(),subtle=crypto.subtle,original=subtle.digest;let release,entered;
 const hit=new Promise(r=>entered=r),gate=new Promise(r=>release=r);let first=true;
 subtle.digest=async function(...args){if(first){first=false;entered();await gate;}return original.apply(this,args);};
 try{const pending=store.saveMemory(p.projectId,1,command());await hit;await store.deleteProject(p.projectId,1);release();await assert.rejects(pending,{code:'DELETED'});}finally{subtle.digest=original;release();}
 await assert.rejects(store.readMemory(p.projectId),{code:'DELETED'});
});
await test('chat-only revision during hashed recall does not invalidate unchanged memory',async()=>{
 const {store,p}=await setup();await store.saveMemory(p.projectId,1,command());let first=true;
 const racing={...store,async readMemory(id){const bundle=await store.readMemory(id);if(first){first=false;await store.saveThread(id,bundle.manifest.revision,{schemaVersion:1,messages:[],workspace:{}});}return bundle;}};
 const c=createMemoryCoordinator(racing,p.projectId);await c.initialize();assert.equal((await c.context()).items.length,1);await c.mutate(command('next','next'));c.dispose();
});
console.log(JSON.stringify({scope:'7C',cases:cases.length,status:'PASS',evidence:'transactional IDB doubles + actual Web Crypto; browser evidence separate',names:cases}));
