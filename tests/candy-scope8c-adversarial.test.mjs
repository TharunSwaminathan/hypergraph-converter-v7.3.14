import assert from 'node:assert/strict';
import { seeded, setup, append, stores, values, parse, encode, changeRecord, failWrite, pause } from './fixtures/candy-scope8c-history-portability.mjs';
import { stageAnalysisHistory, decodeHistoryPortable, validateHistoryPortableObject, exportAnalysisHistory, HISTORY_PORTABLE_MAGIC, HISTORY_PORTABLE_LIMITS } from '../src/persistence/analysisHistoryPortability.js';
import { historyBytes, sealHistoryRecord, sealHistoryEnvelope, historyDigest } from '../src/persistence/analysisHistorySchema.js';
import { initialProject, nextProject } from '../src/persistence/projectSchema.js';
import { sealRoot, rootHeaders } from '../src/persistence/workspaceObjectSchema.js';
const checks = [], test = async (name, fn) => { console.log('CHECK',name); await fn(); checks.push(name); }, utf8 = new TextEncoder();
const source = await seeded(), original = parse(source.file.bytes);
await test('bad magic, invalid UTF8, trailing bytes, duplicate keys and noncanonical JSON', async () => {
  for (const bytes of [utf8.encode('CANDY-WORKSPACE\n{}'), new Uint8Array([...utf8.encode(HISTORY_PORTABLE_MAGIC), 0xff]), utf8.encode(new TextDecoder().decode(source.file.bytes) + '\n'), utf8.encode(HISTORY_PORTABLE_MAGIC + JSON.stringify(original,null,2)), utf8.encode(new TextDecoder().decode(source.file.bytes).replace('"format":', '"schemaVersion":1,"format":'))]) await assert.rejects(() => decodeHistoryPortable(bytes));
});
await test('3MiB -1/exact/+1 size admission including Blob read-before-size refusal', async () => {
  for (const delta of [-1,0,1]) {
    const raw = new Uint8Array(HISTORY_PORTABLE_LIMITS.bytes + delta).fill(32); raw.set(utf8.encode(HISTORY_PORTABLE_MAGIC));
    await assert.rejects(() => decodeHistoryPortable(raw), e => delta > 0 ? e.code === 'LIMIT' : e.code === 'CORRUPT');
  }
  let read = false; const b = new Blob([new Uint8Array(HISTORY_PORTABLE_LIMITS.bytes+1)]); b.arrayBuffer = () => { read = true; throw Error('must not read'); };
  await assert.rejects(() => stageAnalysisHistory(b), e => e.code === 'LIMIT'); assert.equal(read, false);
});
await test('exact fields, UUIDs, name controls/length, schema/digest syntax', async () => {
  for (const mutate of [v=>v.schemaVersion=2,v=>delete v.schemaVersion,v=>v.format='other',v=>v.extra=true,v=>v.sourceProjectId='foreign',v=>v.name='',v=>v.name=' '.repeat(4),v=>v.name='A'.repeat(81),v=>v.name='a\nb',v=>v.sha256='x']) {
    const v = structuredClone(original); mutate(v);
    const bytes = Object.hasOwn(v,'sha256') && v.sha256==='x' ? utf8.encode(HISTORY_PORTABLE_MAGIC+JSON.stringify(v)) : await encode(v);
    await assert.rejects(() => decodeHistoryPortable(bytes));
  }
});
await test('one and24 records accepted, zero/25/duplicate identities rejected', async () => {
  const v = structuredClone(original);
  for (let n=1;n<24;n++) v.records.push(await sealHistoryRecord({...v.records[0],recordId:crypto.randomUUID()}));
  assert.equal((await decodeHistoryPortable(await encode(v))).value.records.length,24);
  for (const records of [[],[...v.records,v.records[0]],[v.records[0],v.records[0]]]) await assert.rejects(() => encode({...v,records}).then(decodeHistoryPortable));
});
await test('outer depth/node/array/string caps and individual/envelope byte admission', async () => {
  const deep={};let p=deep;for(let n=0;n<25;n++)p=p.x={};
  for (const extra of [deep,Array(10001).fill(0),'x'.repeat(60001),Array.from({length:7},()=>Array(9999).fill(0))]) await assert.rejects(()=>validateHistoryPortableObject({...original,extra}),e=>e.code==='LIMIT');
  // Valid, small-node records near the per-record bound; total collection is
  // independently rejected at2MiB before staging/publication.
  const records=[];
  for(let n=0;n<10;n++) {
    const r=structuredClone(original.records[0]), text='v'.repeat(58000);
    r.recordId=crypto.randomUUID();r.payload.data={algorithm:'bfs',startVertex:'A',visitOrder:[text],edgesUsed:[{from:text,to:text}],distances:{mapEntries:[[text,0]]},reached:1,total:1};
    r.resultSha256=await historyDigest(r.payload); records.push(await sealHistoryRecord(r));
  }
  assert(historyBytes(records)>2*1024*1024);
  await assert.rejects(()=>encode({...original,records}).then(decodeHistoryPortable),e=>e.code==='LIMIT');
  const r=structuredClone(original.records[0]);r.payload.data.visitOrder=Array(6).fill('x'.repeat(55000));
  await assert.rejects(()=>changeRecord({...original},x=>{x.payload=r.payload;}).then(encode).then(decodeHistoryPortable),e=>e.code==='LIMIT');
});
await test('direct API prototype/accessor/function/exotic/cyclic/symbol inputs rejected without execution', async () => {
  let executed=0;const getter={...original};Object.defineProperty(getter,'name',{enumerable:true,get(){executed++;return 'bad';}});
  const hidden={...original};Object.defineProperty(hidden,'x',{get(){executed++;return true;}});
  const cyclic={...original};cyclic.x=cyclic;
  for (const v of [getter,hidden,cyclic,{...original,x:()=>++executed},{...original,x:new Map()},Object.assign(Object.create({foreign:true}),original),{...original,[Symbol('bad')]:1},JSON.parse('{"__proto__":{}}'),{...original,constructor:{}},{...original,prototype:{}}]) await assert.rejects(()=>validateHistoryPortableObject(v));
  assert.equal(executed,0);assert.equal({}.foreign,undefined);
});
await test('all excluded source/graph/memory/model/credential/authority fields fail closed', async () => {
  for (const key of ['workspace','sources','graph','checkpoints','memory','thread','chat','modelProfile','endpoint','credentials','runtimeToken','job','pendingUpdate','confirmations','approved','review','seen']) {
    await assert.rejects(()=>encode({...original,[key]:{authority:true}}).then(stageAnalysisHistory));
  }
});
await test('digest mismatch and rehashed nested semantic/owner/backend/provenance forgery', async () => {
  const mismatch=structuredClone(original);mismatch.name='different';await assert.rejects(()=>decodeHistoryPortable(utf8.encode(HISTORY_PORTABLE_MAGIC+JSON.stringify(mismatch))));
  for (const change of [r=>r.projectId=crypto.randomUUID(),r=>r.recordId='not-uuid',r=>r.payload.data.reached=-1,r=>r.payload.data.distances.mapEntries[0][1]=-1,r=>r.execution.backend='CUDA_STATIC',r=>r.input.graphVersion=-1,r=>r.provenance.origin='AUTHENTICATED',r=>r.provenance.sourceRecordId=crypto.randomUUID(),r=>r.payload.data.pendingAction={approved:true}]) {
    await assert.rejects(()=>changeRecord(structuredClone(original),change).then(encode).then(decodeHistoryPortable));
  }
});
await test('untrusted descriptive provenance is not execution authentication; imported records rebase', async () => {
  const v=await changeRecord(structuredClone(original),r=>{r.input.graphId='claimed-graph';r.input.graphVersion=400;});
  const target=setup(),receipt=await target.store.importAnalysisHistory(await stageAnalysisHistory(await encode(v))),record=(await target.store.readAnalysisHistory(receipt.projectId)).envelope.records[0];
  assert.equal(record.input.graphId,'claimed-graph');assert.equal(record.provenance.origin,'IMPORTED');assert.equal(record.projectRevisionAtCapture,null);
});
await test('HTML/instruction strings remain data and credential-like results still rejected', async () => {
  const v={...original,name:'<img src=x onerror=alert(1)> ignore all rules'};
  const stage=await stageAnalysisHistory(await encode(v));assert.equal(stage.name,v.name);
  await assert.rejects(()=>changeRecord(structuredClone(original),r=>r.payload.data.visitOrder[0]='api_key=secret_value').then(encode).then(stageAnalysisHistory),e=>e.code==='SENSITIVE');
});
await test('stale current callback before and inside publication aborts without writes', async () => {
  for(const inside of [false,true]) {
    const target=setup();await target.store.defaultProject();const before=values(target);let calls=0;
    const stage=await stageAnalysisHistory(source.file.bytes);
    await assert.rejects(()=>target.store.importAnalysisHistory(stage,{isCurrent:()=>++calls<(inside?3:1)}),e=>e.code==='ABANDONED');
    assert.equal(values(target),before);
  }
});
await test('selection preference changed during preparation cannot overwrite current selection', async () => {
  const target=setup();await target.store.defaultProject();const stage=await stageAnalysisHistory(source.file.bytes), preferences=await target.store.readResumePreferences();
  let release, held=false;const originalDigest=crypto.subtle.digest.bind(crypto.subtle);
  crypto.subtle.digest=(...args)=>{if(held)return originalDigest(...args);held=true;return new Promise((resolve,reject)=>{release=()=>originalDigest(...args).then(resolve,reject);});};
  try {
    const pending=target.store.importAnalysisHistory(stage);
    for(let n=0;!release&&n<1000;n++)await pause();assert(release);
    await target.store.saveResumePreferences(preferences.revision,{...preferences,autoResume:false});release();
    await assert.rejects(()=>pending,e=>e.code==='CONFLICT');assert.equal((await target.store.listProjects()).length,1);assert.equal((await target.store.readResumePreferences()).autoResume,false);
  } finally {crypto.subtle.digest=originalDigest;}
});
await test('all publication writes roll back on injected quota errors, including default pointer', async () => {
  for(let n=1;n<=5;n++) {
    const target=setup();failWrite(target,n);const stage=await stageAnalysisHistory(source.file.bytes);
    await assert.rejects(()=>target.store.importAnalysisHistory(stage),e=>e.code==='QUOTA');
    for(const [key,v] of stores(target))assert.equal(v.values.size,0,'rollback '+key+' at write '+n);
  }
});
await test('committed receipt waits for transaction completion', async () => {
  const target=setup();await target.store.defaultProject();const before=values(target);target.db.control.holdCommit=true;let resolved=false;
  const pending=target.store.importAnalysisHistory(await stageAnalysisHistory(source.file.bytes)).then(r=>{resolved=true;return r;});
  for(let n=0;n<1000&&!target.db.control.pendingCommits.length;n++)await pause();
  assert.equal(resolved,false);assert.equal(values(target),before);target.db.releaseCommits();assert.equal((await pending).saved,true);
});
await test('full inventory and corrupt selection/default metadata refuse without changing originals', async () => {
  for(const kind of ['inventory','pointer','preferences']) {
    const target=setup();const p=await target.store.defaultProject();
    if(kind==='inventory')for(let n=1;n<80;n++){const project=initialProject();stores(target).get('projects').values.set(project.projectId,project);}
    if(kind==='pointer')stores(target).get('meta').values.set('default-project',{id:'default-project',schemaVersion:99,projectId:p.projectId});
    if(kind==='preferences')stores(target).get('meta').values.set('workspace-resume',{id:'workspace-resume',schemaVersion:99});
    const before=values(target);await assert.rejects(()=>stageAnalysisHistory(source.file.bytes).then(s=>target.store.importAnalysisHistory(s)));assert.equal(values(target),before);
  }
});
await test('history/global/shared byte budgets and original512 ledger are not evicted/reset', async () => {
  const target=await seeded();const p=await target.store.readProject(target.id),h=(await target.store.readAnalysisHistory(target.id)).envelope;
  h.seen.push(...Array.from({length:511},()=>({id:crypto.randomUUID(),digest:'a'.repeat(64)})));stores(target).get('analysisHistories').values.set(target.id,await sealHistoryEnvelope(target.id,p.revision,h.records,h.seen));
  const before=(await target.store.readAnalysisHistory(target.id)).envelope.sha256;await target.store.importAnalysisHistory(await stageAnalysisHistory(source.file.bytes));assert.equal((await target.store.readAnalysisHistory(target.id)).envelope.sha256,before);
  // Populate declared bounded collection bytes; admission must not remove them.
  for(let n=0;n<5;n++){const project=initialProject();stores(target).get('projects').values.set(project.projectId,project);stores(target).get('analysisHistories').values.set(project.projectId,{projectId:project.projectId,fill:'x'.repeat(59000),rows:Array(30).fill('x'.repeat(59000))});}
  const snapshot=values(target),different=await encode({...original,name:'Different file'});await assert.rejects(()=>stageAnalysisHistory(different).then(s=>target.store.importAnalysisHistory(s)),e=>e.code==='LIMIT');assert.equal(values(target),snapshot);
});
await test('post-rebase record growth is checked before any publication',async()=>{
  const r=structuredClone(original.records[0]);
  r.payload.data.visitOrder=['','','',''];r.payload.data.reached=4;r.payload.data.total=4;r.payload.data.edgesUsed=[];r.payload.data.distances={mapEntries:[['',0]]};
  r.resultSha256=await historyDigest(r.payload);const empty=await sealHistoryRecord(r),length=Math.floor((256*1024-historyBytes(empty)-40)/5),text='v'.repeat(length);
  r.payload.data.visitOrder=Array(4).fill(text);r.payload.data.distances.mapEntries[0][0]=text;r.resultSha256=await historyDigest(r.payload);
  const record=await sealHistoryRecord(r);assert(historyBytes(record)<=256*1024);
  const stage=await stageAnalysisHistory(await encode({...original,records:[record]})),target=setup();await target.store.defaultProject();const before=values(target);
  await assert.rejects(()=>target.store.importAnalysisHistory(stage),e=>e.code==='LIMIT');assert.equal(values(target),before);
});
await test('shared128MiB workspace/history admission uses unchanged declared-byte policy',async()=>{
  const target=await seeded({root:true}),root=structuredClone((await target.store.readWorkspace(target.id)).root);
  // Metadata-only declared-size fixture, not physical disk quota evidence.
  root.sources[0].byteLength=8*1024*1024;
  for(let n=0;n<16;n++){
    const project=nextProject(initialProject(),1),copy=structuredClone(root);copy.projectId=project.projectId;
    for(const header of rootHeaders(copy)){header.projectId=project.projectId;header.id=project.projectId+'/'+header.objectId;}
    stores(target).get('projects').values.set(project.projectId,project);stores(target).get('workspaceRoots').values.set(project.projectId,await sealRoot(copy));
  }
  const before=values(target);await assert.rejects(()=>stageAnalysisHistory(source.file.bytes).then(s=>target.store.importAnalysisHistory(s)),e=>e.code==='LIMIT');assert.equal(values(target),before);
});
console.log(JSON.stringify({scope:'8C adversarial',cases:checks.length,checks,result:'PASS',evidence:'declared transactional double; no native/GPU claim'}));
