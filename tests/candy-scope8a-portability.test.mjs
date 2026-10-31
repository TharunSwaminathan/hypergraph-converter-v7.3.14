import assert from 'node:assert/strict';
import{setup,seed,workspace}from'./fixtures/candy-scope8a-portability.mjs';
import{exportPortableWorkspace,stagePortableWorkspace,PORTABLE_MAGIC,PORTABLE_LIMITS}from'../src/persistence/workspacePortability.js';
import{restoreWorkspace}from'../src/persistence/workspaceRestore.js';
import{createMemoryCoordinator}from'../src/persistence/assistantMemoryCoordinator.js';
import{createProjectSession}from'../src/persistence/projectSession.js';
import{sha256}from'../src/persistence/workspaceProvenance.js';
import{stableStringify}from'../src/graph/graphFingerprint.js';
import{createProjectStore}from'../src/persistence/projectStore.js';
const checks=[];async function test(name,fn){await fn();checks.push(name);}
const enc=new TextEncoder(),decode=bytes=>JSON.parse(new TextDecoder().decode(bytes).slice(PORTABLE_MAGIC.length));
async function encode(v,rehash=true){if(rehash)v.manifestSha256=await sha256(enc.encode(stableStringify(v.manifest)));return enc.encode(PORTABLE_MAGIC+stableStringify(v));}
async function exported(){const s=setup(),id=await seed(s.store);return{...s,id,file:await exportPortableWorkspace(s.store,id)};}
await test('deterministic complete export and separate-install source graph provenance memory safe-model preservation',async()=>{
 const source=await exported(),again=await exportPortableWorkspace(source.store,source.id);assert.deepEqual(again.bytes,source.file.bytes);
 const target=setup(),before=(await source.store.readWorkspace(source.id)),handle=await stagePortableWorkspace(source.file.bytes);assert(Object.isFrozen(handle));assert.equal(Object.hasOwn(handle,'root'),false);
 const receipt=await target.store.importWorkspace(handle),after=await restoreWorkspace(target.store,receipt.projectId);assert.equal(receipt.status,'committed');assert.notEqual(receipt.projectId,source.id);assert.equal(receipt.sourceProjectId,source.id);assert.equal(receipt.revision,2);assert.equal(after.graph.graphFingerprint,(await restoreWorkspace(source.store,source.id)).graph.graphFingerprint);
 assert.equal((await target.store.defaultProject()).projectId,receipt.projectId,'fresh-install import atomically establishes valid normal Resume selection');
 for(const h of before.root.sources){const actual=after.sources.find(x=>x.objectId===h.objectId);assert.equal(actual.sha256,h.sha256);assert.deepEqual(actual.bytes,before.objects.find(x=>x.id===h.id).data);assert.deepEqual(actual.provenance,h.provenance);}
 const memory=createMemoryCoordinator(target.store,receipt.projectId);await memory.initialize();const context=await memory.context();assert.equal(context.authority,'untrusted_context_only');assert.equal(context.items[0].content,'Project Alpha forbids implicit projection.');assert.equal(context.items[0].provenance,'IMPORTED');assert.equal(context.items[0].projectId,receipt.projectId);memory.dispose();
 const profile=(await target.store.readConnectionProfile()).profile;assert.equal(profile.selectedModel,'qwen3:8b');assert.equal(profile.autoReconnectEnabled,false);assert.equal(profile.lastKnownModelAvailability,'UNKNOWN');assert.equal(profile.lastSuccessfulConnectionAt,null);assert.equal((await target.store.load(receipt.projectId)).record.pendingAction,null);assert.deepEqual((await target.store.load(receipt.projectId)).record.messages,[]);
 await target.store.close();const restarted=createProjectStore(target.db);assert.equal((await restoreWorkspace(restarted,receipt.projectId)).root.sha256,receipt.workspace.sha256);
 await assert.rejects(()=>restarted.importWorkspace(handle),e=>e.code==='DUPLICATE');assert.equal((await restarted.listProjects()).length,1);
});
await test('explicit owner replacement preserves B, rejects stale owner and invalidates pre-import queued saves',async()=>{
 const source=await exported(),target=setup(),a=await seed(target.store,'h0: OLD, A'),b=await target.store.createProject();await target.store.saveWorkspace(b.projectId,b.revision,workspace('h0: B, ONLY'));const b0=(await target.store.readWorkspace(b.projectId)).root.sha256;
 const stage=await stagePortableWorkspace(source.file.bytes),p=await target.store.readProject(a),session=createProjectSession(target.store,{projectId:a,revision:p.revision}),review=await session.captureDestructive(a,'workspace');
 const receipt=await session.importReviewed(review,stage);assert.equal(receipt.revision,p.revision+1);assert.equal((await target.store.readWorkspace(b.projectId)).root.sha256,b0);await assert.rejects(()=>session.saveWorkspace(a,p.revision,workspace('h0: OLD, QUEUED')),e=>e.code==='CONFLICT');await assert.rejects(()=>session.importReviewed(review,stage),e=>e.code==='ABANDONED');assert.equal((await target.store.readConnectionProfile()).profile.autoReconnectEnabled,true,'existing global model intent retained');
 const peer=setup(),id=await seed(peer.store),old=await peer.store.readProject(id),stale=createProjectSession(peer.store,{projectId:id,revision:old.revision}),token=await stale.captureDestructive(id,'workspace');await peer.store.saveWorkspace(id,old.revision,workspace('h0: FOREIGN, NEW'));const root=(await peer.store.readWorkspace(id)).root.sha256;await assert.rejects(()=>stale.importReviewed(token,stage),e=>e.code==='CONFLICT');assert.equal((await peer.store.readWorkspace(id)).root.sha256,root);
});
await test('abort/quota before publication preserve all destination state; receipt waits for native-style transaction completion',async()=>{
 const source=await exported(),target=setup(),stage=await stagePortableWorkspace(source.file.bytes),id=await seed(target.store),p=await target.store.readProject(id),before=(await target.store.readWorkspace(id)).root.sha256;
 target.db.control.quotaNext=true;await assert.rejects(()=>target.store.importWorkspace(stage,{targetId:id,expectedRevision:p.revision}),e=>e.code==='QUOTA');assert.equal((await target.store.readWorkspace(id)).root.sha256,before);
 const fresh=setup();fresh.db.control.holdCommit=true;let acknowledged=false;const publishing=fresh.store.importWorkspace(stage).then(x=>{acknowledged=true;return x;});for(let n=0;n<200&&!fresh.db.control.pendingCommits.length;n++)await new Promise(r=>setTimeout(r,1));assert(fresh.db.control.pendingCommits.length);assert.equal(acknowledged,false);fresh.db.releaseCommits();const result=await publishing;assert.equal(acknowledged,true);assert.equal(result.saved,true);
 const noOwner=setup();await assert.rejects(()=>noOwner.store.importWorkspace(stage,{isCurrent:()=>false}),e=>e.code==='ABANDONED');assert.equal((await noOwner.store.listProjects()).length,0);
});
await test('corrupt/missing/extra/wrong-digest payload and substituted manifest all fail closed',async()=>{
 const {file}=await exported();
 const cases=[v=>{v.manifest.project.name='Substitution';},v=>{v.payloads[0].data='AAAA';},v=>{v.payloads.pop();},v=>{v.payloads.push({...v.payloads[0],path:'objects/00000000-0000-4000-8000-000000000000.bin'});},v=>{v.manifest.workspace.root.sources[0].sha256='0'.repeat(64);}];
 for(let i=0;i<cases.length;i++){const v=decode(file.bytes);cases[i](v);await assert.rejects(()=>encode(v,false).then(stagePortableWorkspace));}
 for(const memory of [false,0,[],{schemaVersion:99}]){const v=decode(file.bytes);v.manifest.memory=memory;await assert.rejects(()=>encode(v).then(stagePortableWorkspace));}
});
await test('future schema rejects; explicit supported v1 migration supplies no model intent',async()=>{
 const {file}=await exported(),future=decode(file.bytes);future.manifest.schemaVersion=99;await assert.rejects(()=>encode(future).then(stagePortableWorkspace),e=>e.code==='INCOMPATIBLE');
 const old=decode(file.bytes);old.manifest.schemaVersion=1;delete old.manifest.modelPreferences;const stage=await stagePortableWorkspace(await encode(old));assert.equal(stage.migratedFrom,1);assert.equal(stage.model,null);const target=setup(),receipt=await target.store.importWorkspace(stage);assert.equal(receipt.migratedFrom,1);assert.equal((await target.store.readConnectionProfile()).profile,null);
});
await test('canonical paths, duplicate payload names, duplicate JSON keys, compression and oversize are rejected',async()=>{
 const {file}=await exported();for(const path of ['../evil','objects/../x.bin','C:/evil','objects\\evil.bin','/evil','objects/a%2fb.bin','objects/CON.bin']){const v=decode(file.bytes);v.payloads[0].path=path;await assert.rejects(()=>encode(v).then(stagePortableWorkspace));}
 const dupe=decode(file.bytes);dupe.payloads[1]={...dupe.payloads[0]};await assert.rejects(()=>encode(dupe).then(stagePortableWorkspace));
 const raw=new TextDecoder().decode(file.bytes).replace('"format":"candy.workspace"','"format":"ignored","format":"candy.workspace"');await assert.rejects(()=>stagePortableWorkspace(enc.encode(raw)));
 for(const magic of [[0x50,0x4b,3,4],[0x1f,0x8b,8]])await assert.rejects(()=>stagePortableWorkspace(Uint8Array.from(magic)),e=>e.code==='INCOMPATIBLE');
 await assert.rejects(()=>stagePortableWorkspace(new Blob([new Uint8Array(PORTABLE_LIMITS.containerBytes+1)])),e=>e.code==='LIMIT');
});
await test('authority/credential/unsafe endpoint/prototype smuggling and sensitive source export fail closed',async()=>{
 const {file}=await exported();for(const field of ['pendingAction','confirmation','credentials','runtimeToken','processState']){const v=decode(file.bytes);v.manifest[field]={approve:true};await assert.rejects(()=>encode(v).then(stagePortableWorkspace));}
 for(const endpoint of ['https://cloud.example','http://user:pass@localhost:11434','http://localhost:11434/?token=secret','http://127.0.0.2:11434']){const v=decode(file.bytes);v.manifest.modelPreferences.endpoint=endpoint;await assert.rejects(()=>encode(v).then(stagePortableWorkspace));}
 const credential=decode(file.bytes);credential.manifest.modelPreferences.password='hidden';await assert.rejects(()=>encode(credential).then(stagePortableWorkspace));
 const pollution=decode(file.bytes);pollution.manifest.project=JSON.parse('{"__proto__":{"polluted":true},"schemaVersion":1}');await assert.rejects(()=>encode(pollution).then(stagePortableWorkspace));assert.equal({}.polluted,undefined);
 for(const text of ['password=super-secret-value','password'+' '.repeat(40000)+'=synthetic-test-value']){const s=setup(),p=await s.store.defaultProject();await s.store.saveWorkspace(p.projectId,1,workspace(text));await assert.rejects(()=>exportPortableWorkspace(s.store,p.projectId),e=>e.code==='SENSITIVE');}
});
await test('multiple checkpoints use their own source identities and preserve original binary source bytes',async()=>{
 const source=setup(),p=await source.store.defaultProject(),first=workspace('first'),binary=Uint8Array.from([0,255,13,10,65]);first.sources.find(s=>s.kind==='editor').bytes=binary;
 await source.store.saveWorkspace(p.projectId,1,first);await source.store.saveWorkspace(p.projectId,2,workspace('second'));const file=await exportPortableWorkspace(source.store,p.projectId),target=setup(),receipt=await target.store.importWorkspace(await stagePortableWorkspace(file.bytes)),bundle=await target.store.readWorkspace(receipt.projectId);assert.equal(bundle.root.history.length,1);const old=await restoreWorkspace(target.store,receipt.projectId,()=>true,bundle.root.history[0].graph.objectId);assert.deepEqual(new Uint8Array(old.sources.find(s=>s.provenance.kind==='editor').bytes),binary);
});
await test('all fourteen qualified application input modes round-trip, including AI Prompt without execution',async()=>{
 for(const fmt of ['simple','cornell','incidence','csv','edgelist','json','v2h','h2h','csr_json','csr_csv','adjlist','freeform','ai_prompt','custom']){const s=setup(),p=await s.store.defaultProject();await s.store.saveWorkspace(p.projectId,1,workspace('A B',fmt,true));const file=await exportPortableWorkspace(s.store,p.projectId),t=setup(),receipt=await t.store.importWorkspace(await stagePortableWorkspace(file.bytes)),restored=await restoreWorkspace(t.store,receipt.projectId);assert.equal(restored.metadata.fmt,fmt);assert.equal(restored.metadata.manual[0].slot,'text:'+fmt);assert.equal((await t.store.load(receipt.projectId)).record.pendingAction,null);}
});
await test('full eight-MiB source with long whitespace round-trips without base64 overflow or secret-scan backtracking',async()=>{
 const s=setup(),p=await s.store.defaultProject(),input=workspace(),bytes=new Uint8Array(8*1024*1024);bytes.fill(32);bytes.set(new TextEncoder().encode('password'));input.sources.find(x=>x.kind==='editor').bytes=bytes;await s.store.saveWorkspace(p.projectId,1,input);const file=await exportPortableWorkspace(s.store,p.projectId),target=setup(),receipt=await target.store.importWorkspace(await stagePortableWorkspace(file.bytes)),restored=await restoreWorkspace(target.store,receipt.projectId);assert.deepEqual(new Uint8Array(restored.sources.find(x=>x.provenance.kind==='editor').bytes),bytes);
});
console.log(JSON.stringify({scope:'8A',groups:checks.length,status:'PASS',evidence:'transactional IndexedDB double and real Web Crypto; native browser qualification separate',checks}));
