import assert from 'node:assert/strict';
import { mkdtemp,writeFile,readFile } from 'node:fs/promises';
import { join,basename } from 'node:path';
import { tmpdir } from 'node:os';
import { OwnedRoot } from '../candy-runtime/src/artifacts/ownedRoot.js';
import { fixture,payload,terminal } from './fixtures/candy-scope6c-runtime.mjs';

const root=await mkdtemp(join(tmpdir(),'candy-scope6c-exclusive-'));
const initial=await new OwnedRoot(root).initialize();await initial.release();
// A stale PID may have been reused after reboot. It is never ownership authority.
await writeFile(join(root,'.candy-owner'),`${process.pid}\n`);
const owners=[new OwnedRoot(root),new OwnedRoot(root)];
const outcomes=await Promise.allSettled(owners.map(owner=>owner.initialize()));
assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);
const winner=owners[outcomes.findIndex(r=>r.status==='fulfilled')];
assert.equal(await readFile(join(root,'.candy-owner'),'utf8'),`${process.pid}\n`);
// The kernel lease must remain held through marker deletion and final rmdir.
const remove=winner.removeFile.bind(winner);let release,arrived;
const gate=new Promise(r=>release=r),atMarker=new Promise(r=>arrived=r);
winner.removeFile=async path=>{if(basename(path)==='.candy-store'){arrived();await gate;}return remove(path);};
const disposing=winner.dispose();await atMarker;
await assert.rejects(new OwnedRoot(root).initialize(),/live owner|lease port/);
release();await disposing;

const f=await fixture({maxJobs:64,maxTerminalJobs:32});
try {
 f.store.maxTotalBytes=2000;
 const first=await payload(f.store),graphText=(await f.store.read(first.graphArtifactId)).toString();
 const input=await f.store.put(Buffer.from(graphText+' '.repeat(950)),'application/vnd.candy.graph+json');
 first.graphArtifactId=input.id;first.graphSnapshot.canonicalArtifactRef=input;
 const job=await f.manager.submit(first);assert.equal((await terminal(f.manager,job.jobId)).status,'completed');
 const next=await f.store.put(Buffer.from(graphText+'\n'+' '.repeat(950)),'application/vnd.candy.graph+json');
 assert.throws(()=>f.manager.get(job.jobId),e=>e.httpStatus===404);
 assert.throws(()=>f.manager.result(job.jobId),e=>e.httpStatus===404);
 assert.ok(await f.store.read(next.id));assert.ok(f.store.totalBytes()<=2000);
 const second=structuredClone(first);second.request.requestId=crypto.randomUUID();second.graphArtifactId=next.id;second.graphSnapshot.canonicalArtifactRef=next;
 assert.equal((await terminal(f.manager,(await f.manager.submit(second)).jobId)).status,'completed');
 assert.ok(f.store.terminalOwners.size<=f.manager.jobs.size);
}finally{await f.dispose();}

const d=await fixture({jobDeadlineMs:40,queueWaitMs:1000});
try {
 const cleanup=d.store.ownedRoot.removeWorkspace.bind(d.store.ownedRoot);
 d.store.ownedRoot.removeWorkspace=async path=>{await new Promise(r=>setTimeout(r,100));return cleanup(path);};
 const job=await d.manager.submit(await payload(d.store)),status=await terminal(d.manager,job.jobId);
 assert.equal(status.status,'failed');assert.equal(status.error.classification,'PROCESS_TIMEOUT');
 assert.throws(()=>d.manager.result(job.jobId));assert.equal(d.manager.jobs.get(job.jobId).fullResult,null);
 d.store.ownedRoot.removeWorkspace=cleanup;
 assert.equal((await terminal(d.manager,(await d.manager.submit(await payload(d.store))).jobId)).status,'completed');
}finally{await d.dispose();}
// An unrelated retained-artifact cleanup fault must not permit a current job
// to publish an expired result after its own workspace cleanup succeeds.
const e=await fixture({jobDeadlineMs:40,queueWaitMs:1000});
try {
 const cleanup=e.store.ownedRoot.removeWorkspace.bind(e.store.ownedRoot);
 e.store.ownedRoot.removeWorkspace=async path=>{
   e.manager.cleanupError=Error('Unrelated retained-artifact cleanup fault');
   await new Promise(r=>setTimeout(r,100));return cleanup(path);
 };
 const job=await e.manager.submit(await payload(e.store));
 const status=await terminal(e.manager,job.jobId);
 assert.equal(status.status,'failed');assert.equal(status.error.classification,'PROCESS_TIMEOUT');
 assert.throws(()=>e.manager.result(job.jobId));assert.equal(e.manager.jobs.get(job.jobId).fullResult,null);
 assert.ok(e.manager.cleanupError);
 // Only the injected fault is removed here; admission remains blocked in production.
 e.manager.cleanupError=null;e.store.ownedRoot.removeWorkspace=cleanup;
}finally{await e.dispose();}
console.log('Scope6C corrective concurrent root lease, PID reuse, disposal lease, terminal pressure eviction and cleanup deadline regressions passed.');
