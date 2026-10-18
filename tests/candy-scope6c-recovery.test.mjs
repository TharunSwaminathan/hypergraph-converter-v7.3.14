import assert from 'node:assert/strict';
import { mkdtemp,readdir,writeFile,readFile,unlink,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import http from 'node:http';
import { ArtifactStore } from '../candy-runtime/src/artifacts/artifactStore.js';
import { startCandyRuntime } from '../candy-runtime/src/server.js';
import { createCandyClient } from '../src/candy/client.js';
import { fixture,payload,terminal } from './fixtures/candy-scope6c-runtime.mjs';
const root=await mkdtemp(join(tmpdir(),'candy-scope6c-restart-'));
let runtime=await startCandyRuntime({port:0,backendAvailable:false,artifactRoot:root,limits:{maxHttpOperations:1}});
try {
 const firstClient=createCandyClient({baseUrl:`http://127.0.0.1:${runtime.port}`,token:runtime.pairingToken});
 const first=(await firstClient.session()).runtimeSessionId,oldToken=runtime.pairingToken;
 const artifact=await runtime.artifactStore.put(Buffer.from('old session input'),'text/plain');
 const workspace=await runtime.artifactStore.ownedRoot.createWorkspace();await writeFile(join(workspace,'request.txt'),'orphan fixture');
 await assert.rejects(startCandyRuntime({port:0,backendAvailable:false,artifactRoot:root}),/live owner/);
 const slow=http.request({host:'127.0.0.1',port:runtime.port,path:'/v1/artifacts',method:'POST',headers:{Authorization:`Bearer ${oldToken}`,'Content-Length':100,'Content-Type':'application/json'}});slow.on('error',()=>{});slow.write('{');
 await new Promise(r=>setTimeout(r,30));
 const busy=await fetch(`http://127.0.0.1:${runtime.port}/v1/session`,{headers:{Authorization:`Bearer ${oldToken}`}});assert.equal(busy.status,413);
 slow.destroy();await new Promise(r=>setTimeout(r,30));assert.equal((await firstClient.session()).runtimeSessionId,first);
 const malformed=await fetch(`http://127.0.0.1:${runtime.port}/v1/jobs`,{method:'POST',headers:{Authorization:`Bearer ${oldToken}`,'Content-Type':'application/json'},body:'{'});assert.equal(malformed.status,400);
 await runtime.close();
 runtime=await startCandyRuntime({port:0,backendAvailable:false,artifactRoot:root});
 assert.ok(runtime.artifactStore.ownedRoot.recoveredFiles>=2);assert.equal(runtime.artifactStore.metadataById.size,0);assert.deepEqual(await readdir(join(root,'workspaces')),[]);
 const client=createCandyClient({baseUrl:`http://127.0.0.1:${runtime.port}`,token:runtime.pairingToken});
 assert.notEqual((await client.session()).runtimeSessionId,first);
 await assert.rejects(createCandyClient({baseUrl:client.baseUrl,token:oldToken}).session(),e=>e.classification==='UNAUTHORIZED');
 await assert.rejects(client.getJob(crypto.randomUUID()),e=>e.details.httpStatus===404);
 await assert.rejects(client.getArtifactMetadata(artifact.id),e=>e.details.httpStatus===404);
}finally{await runtime.close();}
await writeFile(join(root,'unknown.txt'),'must remain');
await assert.rejects(new ArtifactStore({root,maxBytes:4096}).initialize(),/Unrecognized/);
assert.equal(await readFile(join(root,'unknown.txt'),'utf8'),'must remain');await unlink(join(root,'unknown.txt'));
const recovered=await new ArtifactStore({root,maxBytes:4096}).initialize();await recovered.dispose();

const f=await fixture({queueWaitMs:30,jobDeadlineMs:3000});
try {
 const put=f.store.put.bind(f.store);let failing=true;
 f.store.put=(bytes,media,options)=>{if(failing && media==='application/vnd.candy.result+json')throw Error('controlled write failure');return put(bytes,media,options);};
 const j=await f.manager.submit(await payload(f.store));assert.equal((await terminal(f.manager,j.jobId)).status,'failed');assert.equal(f.store.metadataById.size,1,'failed-job mapping removed, input reusable');
 failing=false;assert.equal((await terminal(f.manager,(await f.manager.submit(await payload(f.store))).jobId)).status,'completed');
 f.state.mode='hold';const active=await f.manager.submit(await payload(f.store));while(!f.state.gate)await new Promise(r=>setTimeout(r,2));
 const queued=await f.manager.submit(await payload(f.store));const calls=f.state.calls;
 await new Promise(r=>setTimeout(r,50));f.manager.cancel(active.jobId);f.state.mode='success';
 await terminal(f.manager,active.jobId);const expired=await terminal(f.manager,queued.jobId);assert.equal(expired.status,'failed');assert.equal(expired.error.classification,'PROCESS_TIMEOUT');assert.equal(f.state.calls,calls,'expired queued job never launched');
 assert.equal((await terminal(f.manager,(await f.manager.submit(await payload(f.store))).jobId)).status,'completed');
 f.state.mode='hold';await f.manager.submit(await payload(f.store));await f.manager.submit(await payload(f.store));
 await f.manager.close();assert.ok([...f.manager.jobs.values()].every(job=>job.finished));assert.deepEqual(await readdir(join(f.root,'workspaces')),[]);
}finally{await f.dispose();}
// Empty unmarked directory can be owned; a nonempty unmarked directory cannot.
const unowned=await mkdtemp(join(tmpdir(),'candy-scope6c-unowned-'));await writeFile(join(unowned,'a'),'keep');
await assert.rejects(new ArtifactStore({root:unowned,maxBytes:10}).initialize());assert.equal(await readFile(join(unowned,'a'),'utf8'),'keep');await rm(unowned,{recursive:true});
console.log('Scope6C HTTP admission/abort, fresh session, missing old handles, owned orphan reconciliation, write failure, queue deadline and shutdown drain passed.');
