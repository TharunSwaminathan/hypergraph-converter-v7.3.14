import assert from 'node:assert/strict';
import { readdir,mkdtemp,readFile,symlink,unlink,writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ArtifactStore } from '../candy-runtime/src/artifacts/artifactStore.js';
import { fixture,payload,terminal } from './fixtures/candy-scope6c-runtime.mjs';

const f=await fixture();
try {
 let first,last;
 for(let i=0;i<300;i++){
   const sent=await f.manager.submit(await payload(f.store));first??=sent.jobId;last=sent.jobId;
   assert.equal((await terminal(f.manager,sent.jobId)).status,'completed');
   assert.ok(f.manager.jobs.size<=3);assert.ok(f.store.metadataById.size<=7);
 }
 assert.throws(()=>f.manager.get(first),e=>e.httpStatus===404);assert.throws(()=>f.manager.result(first),e=>e.httpStatus===404);
 assert.equal(f.manager.result(last).jobId,last);
 for(const job of f.manager.jobs.values()){assert.ok(await f.store.read(job.resultRef));assert.ok(await f.store.read(job.payload.graphArtifactId));}
 assert.deepEqual(await readdir(join(f.root,'workspaces')),[]);
 // Existing SSSP retries keep the exact old request/job binding while retained.
 const same=await payload(f.store),a=await f.manager.submit(same);await terminal(f.manager,a.jobId);
 const b=await f.manager.submit(same);await terminal(f.manager,b.jobId);assert.equal(a.jobId,b.jobId);
 f.state.mode='hold';const active=await f.manager.submit(await payload(f.store));
 while(!f.state.gate)await new Promise(r=>setTimeout(r,2));
 const queued=[];for(let i=0;i<3;i++)queued.push(await f.manager.submit(await payload(f.store)));
 await assert.rejects(f.manager.submit(await payload(f.store)),e=>e.code==='RESOURCE_LIMIT');
 assert.equal(f.manager.get(active.jobId).status,'running');
 f.manager.cancel(queued[0].jobId);f.manager.cancel(active.jobId);f.state.mode='success';
 for(const job of [active,...queued])await terminal(f.manager,job.jobId).catch(e=>{if(e.httpStatus!==404)throw e;});
 assert.equal(f.state.peak,1);assert.equal((await terminal(f.manager,(await f.manager.submit(await payload(f.store))).jobId)).status,'completed');
 for(const mode of ['throw','crash']){f.state.mode=mode;const j=await f.manager.submit(await payload(f.store));assert.equal((await terminal(f.manager,j.jobId)).status,'failed');assert.equal(f.manager.jobs.get(j.jobId).fullResult,null);}
 f.state.mode='success';assert.equal((await terminal(f.manager,(await f.manager.submit(await payload(f.store))).jobId)).status,'completed');
 assert.deepEqual(await readdir(join(f.root,'workspaces')),[]);
}finally{await f.dispose();}

const root=await mkdtemp(join(tmpdir(),'candy-scope6c-artifacts-'));
const store=await new ArtifactStore({root,maxBytes:64,maxArtifacts:2,maxTotalBytes:8}).initialize();
try {
 const a=await store.put(Buffer.from('aa'),'text/plain');store.pin([a.id],'active');
 const b=await store.put(Buffer.from('bb'),'text/plain');const c=await store.put(Buffer.from('cc'),'text/plain');
 assert.throws(()=>store.metadata(b.id),e=>e.httpStatus===404);assert.equal((await store.read(a.id)).toString(),'aa');
 store.pin([c.id],'other');await assert.rejects(store.put(Buffer.from('dd'),'text/plain'),e=>e.code==='RESOURCE_LIMIT');
 await store.release('other',[c.id]);assert.throws(()=>store.metadata(c.id));assert.ok(await store.put(Buffer.from('dd'),'text/plain'));
 await assert.rejects(store.put(Buffer.from('aa'),'application/json'),e=>e.code==='INVALID_GRAPH_SCHEMA');
 await writeFile(store.pathForId(a.id),'ab');await assert.rejects(store.read(a.id),e=>e.code==='RESULT_VALIDATION_FAILURE');
 await writeFile(store.pathForId(a.id),'aa');await store.release('active');
 const external=join(tmpdir(),`candy-scope6c-external-${crypto.randomUUID()}.txt`);await writeFile(external,'must survive');
 await unlink(store.pathForId(a.id));
 try{await symlink(external,store.pathForId(a.id));await assert.rejects(store.read(a.id));await assert.rejects(store.evict(a.id));assert.equal(await readFile(external,'utf8'),'must survive');await unlink(store.pathForId(a.id));await writeFile(store.pathForId(a.id),'aa');}
 catch(e){if(e.code!=='EPERM')throw e;await writeFile(store.pathForId(a.id),'aa');}
 finally{await unlink(external);}
}finally{await store.dispose();}
console.log('Scope6C 300-job retention, active pinning, FIFO, overload, failures, cancellation, artifact LRU/integrity and cleanup passed (injected CPU runner).');
