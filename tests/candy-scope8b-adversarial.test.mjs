import assert from 'node:assert/strict';
import {setup,seed} from './fixtures/candy-scope8a-portability.mjs';
import {cpuRecord,historyGraph} from './fixtures/candy-scope8b-history.mjs';
import {createGraphState} from '../src/graph/graphState.js';
import {createProjectStore} from '../src/persistence/projectStore.js';
import {createProjectSession} from '../src/persistence/projectSession.js';
import {createAnalysisHistoryCoordinator} from '../src/persistence/analysisHistoryCoordinator.js';
import {PROJECT_DATABASE} from '../src/persistence/projectSchema.js';
import {historyDigest,sealHistoryRecord,sealHistoryEnvelope,validateHistoryRecord,verifyHistoryEnvelope,cpuHistoryPayload,HISTORY_LIMITS,historyBytes} from '../src/persistence/analysisHistorySchema.js';
import {exportPortableWorkspace,stagePortableWorkspace,PORTABLE_MAGIC} from '../src/persistence/workspacePortability.js';
import {stableStringify} from '../src/graph/graphFingerprint.js';
const checks=[];async function test(name,fn){await fn();checks.push(name);}
const append=async(s,id,r)=>s.mutateAnalysisHistory(id,(await s.readProject(id)).revision,{kind:'append',record:r});
const raw=s=>s.db.databases.get(PROJECT_DATABASE).stores;
const reseal=async r=>sealHistoryRecord({...r,resultSha256:await historyDigest(r.payload)});
await test('rehashed malformed nested CPU output, backend, graph identity and provenance substitution fail closed',async()=>{
 const s=setup(),id=await seed(s.store);let count=0;
 for(const [algorithm,mutate] of [
 ['degree_distribution',r=>r.payload.data.entries[0].degree='zero'],['degree_distribution',r=>r.payload.data.histogram[0].execute='callback'],
 ['k_core',r=>r.payload.data.peelOrder[0].coreness=-1],['k_core',r=>r.payload.data.usage.execute='callback'],
 ['shortest_path',r=>r.payload.data.previous.mapEntries[0][1]={apply:true}],['connected_components',r=>r.payload.data.vertexToComponent.mapEntries[0][1]=-1],
 ['bfs',r=>r.execution.backend='CLOUD'],['bfs',r=>r.input.contentSha256='not-a-digest'],['bfs',r=>r.provenance.origin='TRUSTED'],['bfs',r=>r.projectId=crypto.randomUUID()],
 ['bfs',r=>r.endpoint='https://example.com'],['bfs',r=>r.payload.data.visitOrder={callback:'run'}],['bfs',r=>r.input.preview='false']]){
  const r=structuredClone(await cpuRecord(id,{algorithm}));mutate(r);await assert.rejects(()=>reseal(r).then(x=>validateHistoryRecord(x,id)));count++;
 }
 assert.equal(count,13);assert.equal((await s.store.readAnalysisHistory(id)).envelope,null);
});
await test('credential-like output is rejected, HTML stays plain data, accessors/functions are never executed or serialized',async()=>{
 const s=setup(),id=await seed(s.store);
 for(const secret of ['password=x','access_token:short','runtime-token=abc','ghp_abcdefghijklmnop','-----BEGIN RSA PRIVATE KEY-----']){
  const r=structuredClone(await cpuRecord(id));r.payload.data.visitOrder[0]=secret;await assert.rejects(()=>reseal(r).then(x=>validateHistoryRecord(x,id)),e=>e.code==='SENSITIVE');
 }
 let invoked=0;const result={algorithm:'bfs'};Object.defineProperty(result,'visitOrder',{enumerable:true,get(){invoked++;return[];}});assert.throws(()=>cpuHistoryPayload('bfs',result));assert.equal(invoked,0);
 const array=[];Object.defineProperty(array,0,{enumerable:true,get(){invoked++;return 'A';}});assert.throws(()=>cpuHistoryPayload('bfs',{algorithm:'bfs',visitOrder:array}));assert.equal(invoked,0);
 const r=await cpuRecord(id);await assert.rejects(()=>validateHistoryRecord({...r,callback:()=>{}},id));const html=structuredClone(r);html.payload.data.visitOrder[0]='<img src=x onerror=alert(1)>';assert(await validateHistoryRecord(await reseal(html),id));
});
await test('future/deep/oversized/cyclic collections and corrupt local completion cannot publish',async()=>{
 const s=setup(),id=await seed(s.store),r=await cpuRecord(id);await assert.rejects(()=>append(s.store,id,{...r,sha256:'0'.repeat(64)}));
 const deep=structuredClone(r);let p=deep;for(let n=0;n<30;n++)p=p.extra={};await assert.rejects(()=>validateHistoryRecord(deep,id));
 await assert.rejects(()=>validateHistoryRecord({...r,label:'a'.repeat(HISTORY_LIMITS.recordBytes+1)},id),e=>e.code==='LIMIT');
 const cycle=structuredClone(r);cycle.cycle=cycle;await assert.rejects(()=>validateHistoryRecord(cycle,id));
 await assert.rejects(()=>verifyHistoryEnvelope({schemaVersion:99},id),e=>e.code==='INCOMPATIBLE');assert.equal((await s.store.readAnalysisHistory(id)).envelope,null);
});
await test('ledger exhaustion preserves replay guards and does not evict workspace or memory',async()=>{
 const s=setup(),id=await seed(s.store),p=await s.store.readProject(id),seen=Array.from({length:512},()=>({id:crypto.randomUUID(),digest:'a'.repeat(64)})),h=await sealHistoryEnvelope(id,p.revision,[],seen);raw(s).get('analysisHistories').values.set(id,h);
 const next=await cpuRecord(id),before=stableStringify([...raw(s)].map(([k,v])=>[k,[...v.values]]));await assert.rejects(()=>append(s.store,id,next),e=>e.code==='LIMIT');
 assert.equal(stableStringify([...raw(s)].map(([k,v])=>[k,[...v.values]])),before);
});
await test('byte retention is deterministic; global history budget rejects atomically while preserving other projects',async()=>{
 const s=setup(),id=await seed(s.store),graph=createGraphState([{id:'large',vertices:['A','v'.repeat(49000)]}]);let first;
 for(let n=0;n<15;n++){const r=await cpuRecord(id,{graph,completedAt:`2026-11-01T00:00:${String(n+1).padStart(2,'0')}.000Z`});first??=r;await append(s.store,id,r);}
 const h=(await s.store.readAnalysisHistory(id)).envelope;assert(h.records.length<15&&h.records.length>0);assert(historyBytes(h)<=HISTORY_LIMITS.projectBytes);assert(!h.records.some(x=>x.recordId===first.recordId));assert((await append(s.store,id,first)).duplicate);
 // Seed validated, bounded foreign histories through the test database to reach the global budget without hundreds of writes.
 for(let n=0;n<4;n++){const p=await s.store.createProject();const records=[];for(let k=0;k<h.records.length;k++){const r=structuredClone(h.records[k]);r.projectId=p.projectId;records.push(await sealHistoryRecord(r));}const envelope=await sealHistoryEnvelope(p.projectId,p.revision,records,records.map(r=>({id:r.recordId,digest:r.completionSha256})));await verifyHistoryEnvelope(envelope,p.projectId);raw(s).get('analysisHistories').values.set(p.projectId,envelope);}
 const before=stableStringify([...raw(s)].map(([k,v])=>[k,[...v.values]])),p=await s.store.createProject();const baseline=stableStringify([...raw(s)].map(([k,v])=>[k,[...v.values]]));void before;
 const cpu=await cpuRecord(p.projectId);await assert.rejects(()=>append(s.store,p.projectId,cpu),e=>e.code==='LIMIT');assert.equal(stableStringify([...raw(s)].map(([k,v])=>[k,[...v.values]])),baseline);
});
await test('v3 corruption is rejected even with recomputed outer manifest; import abort rolls back every category and unrelated project',async()=>{
 const source=setup(),id=await seed(source.store);await append(source.store,id,await cpuRecord(id));const file=await exportPortableWorkspace(source.store,id),outer=JSON.parse(new TextDecoder().decode(file.bytes).slice(PORTABLE_MAGIC.length));
 for(const mutate of [r=>r.payload.data.reached=999,r=>r.execution.backend='CUDA_STATIC',r=>r.provenance.origin='TRUSTED',r=>r.pendingAction={apply:true},r=>r.projectId=crypto.randomUUID()]){
  const x=structuredClone(outer);mutate(x.manifest.analysisHistory.records[0]);x.manifest.analysisHistory.records[0]=await reseal(x.manifest.analysisHistory.records[0]);x.manifestSha256=await historyDigest(x.manifest);await assert.rejects(()=>stagePortableWorkspace(new TextEncoder().encode(PORTABLE_MAGIC+stableStringify(x))));
 }
 const dest=setup(),a=await seed(dest.store,'h0: X, Y');await append(dest.store,a,await cpuRecord(a));const b=await dest.store.createProject();await append(dest.store,b.projectId,await cpuRecord(b.projectId));const stage=await stagePortableWorkspace(file.bytes),before=stableStringify([...raw(dest)].map(([k,v])=>[k,[...v.values]]));dest.db.control.quotaNext=true;await assert.rejects(()=>dest.store.importWorkspace(stage));assert.equal(stableStringify([...raw(dest)].map(([k,v])=>[k,[...v.values]])),before);
});
await test('late owner loss never publishes and committed receipt survives failed post-commit discovery',async()=>{
 const s=setup(),id=await seed(s.store),r=await cpuRecord(id),revision=(await s.store.readProject(id)).revision;await assert.rejects(()=>s.store.mutateAnalysisHistory(id,revision,{kind:'append',record:r},()=>false),e=>e.code==='ABANDONED');assert.equal((await s.store.readAnalysisHistory(id)).envelope,null);
 const session=createProjectSession(s.store,await s.store.readProject(id));let fail=false;const wrapped={...session,readAnalysisHistory:async(...args)=>{if(fail)throw new Error('Injected post-commit discovery loss');return session.readAnalysisHistory(...args);},mutateAnalysisHistory:async(...args)=>{const receipt=await session.mutateAnalysisHistory(...args);fail=true;return receipt;}};
 const coordinator=createAnalysisHistoryCoordinator(wrapped);await coordinator.initialize();const graph=historyGraph(),receipt=await coordinator.complete({operationId:r.recordId,createdAt:r.createdAt,completedAt:r.completedAt,context:{projectId:id,graph,hyperedges:graph.hyperedges},algorithm:'bfs',parameters:r.parameters,result:{...r.payload.data,distances:new Map(r.payload.data.distances.mapEntries)}});assert(receipt.saved);assert(coordinator.getSnapshot().message.includes('History persisted'));assert.equal((await s.store.readAnalysisHistory(id)).envelope.records.length,1);coordinator.dispose();
});
await test('workspace-only clear preserves historical evidence; project and application deletion remain scoped and tombstoned',async()=>{
 const s=setup(),id=await seed(s.store);await append(s.store,id,await cpuRecord(id));const b=await s.store.createProject();await append(s.store,b.projectId,await cpuRecord(b.projectId));const mem=(await s.store.readMemory(id)).envelope.sha256;
 await s.store.deleteWorkspace(id,(await s.store.readProject(id)).revision);assert.equal((await s.store.readAnalysisHistory(id)).envelope.records.length,1);assert.equal((await s.store.readMemory(id)).envelope.sha256,mem);await s.store.deleteProject(id,(await s.store.readProject(id)).revision);assert.equal((await s.store.readAnalysisHistory(b.projectId)).envelope.records.length,1);await s.store.clearApplicationData();await assert.rejects(()=>s.store.readAnalysisHistory(b.projectId),e=>e.code==='DELETED');assert.equal(raw(s).get('analysisHistories').values.size,0);
});
await test('v4 upgrade adds history without rewriting old data; future collection remains read-only',async()=>{
 const s=setup(),id=await seed(s.store);await s.store.close();const info=s.db.databases.get(PROJECT_DATABASE);info.version=4;info.stores.delete('analysisHistories');const old=[...info.stores].map(([k,v])=>[k,stableStringify([...v.values])]);const reopened=createProjectStore(s.db);assert.equal((await reopened.readAnalysisHistory(id)).envelope,null);for(const[k,v]of old)assert.equal(stableStringify([...info.stores.get(k).values]),v);const p=await reopened.readProject(id);info.stores.get('analysisHistories').values.set(id,{schemaVersion:99,projectId:id});await assert.rejects(()=>reopened.readAnalysisHistory(id),e=>e.code==='INCOMPATIBLE');assert.equal((await reopened.readProject(id)).revision,p.revision);
});
console.log(JSON.stringify({scope:'8B adversarial',status:'PASS',groups:checks.length,checks,evidence:'transactional IndexedDB double, actual Web Crypto; native separately'}));

