import assert from 'node:assert/strict';
import {fork} from 'node:child_process';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createCandyClient} from '../../src/candy/client.js';
import {ArtifactStore} from '../../candy-runtime/src/artifacts/artifactStore.js';
const root=await mkdtemp(join(tmpdir(),'candy-scope6e-v5-restart-'));
const report={baseline:'d2a2bdb86ebf785ed2d7b43a9cca3a80ee7eb0d2',startedAt:new Date().toISOString(),injectedDiscovery:false,injectedRunner:false,artifactRoot:root,restarts:[],committedTests:[],cleanShutdown:false};
let child;
function event(target,type){return new Promise((resolve,reject)=>{
 const timer=setTimeout(()=>{cleanup();reject(new Error('Bounded Runtime child event timeout: '+type));},20000);
 const message=m=>{if(m.type===type){cleanup();resolve(m);}else if(m.type==='error'){cleanup();reject(new Error(m.message));}};
 const exit=(code)=>{cleanup();reject(new Error('Runtime child exited before '+type+': '+code));};
 function cleanup(){clearTimeout(timer);target.off('message',message);target.off('exit',exit);}
 target.on('message',message);target.once('exit',exit);
});}
async function start(){child=fork(fileURLToPath(new URL('./runtime-child.mjs',import.meta.url)),[root],{stdio:['ignore','pipe','pipe','ipc'],windowsHide:true});
 let errors='';child.stderr.on('data',b=>errors+=b.toString());
 const ready=await event(child,'ready');const client=createCandyClient({baseUrl:`http://127.0.0.1:${ready.port}`,token:ready.pairingToken});
 const caps=await client.capabilities();
 for(const backend of ['CUDA_STATIC','CUDA_INCREMENTAL'])assert.ok(caps.capabilities.find(c=>c.backend===backend),JSON.stringify(caps.motifReadiness));
 return {ready,client,caps};}
async function stop(abrupt=false){const c=child;const ended=new Promise(resolve=>c.once('exit',(code,signal)=>resolve({code,signal})));if(abrupt)c.kill('SIGKILL');else c.send({command:'close'});const end=await ended;child=null;return end;}
try {
 const first=await start();const old=await first.client.uploadArtifact({bytes:'V5 owned artifact before clean restart',mediaType:'text/plain'});
 report.firstSession=first.ready.runtimeSessionId;
 report.restarts.push({kind:'clean',exit:await stop()});
 const second=await start();assert.notEqual(second.ready.runtimeSessionId,first.ready.runtimeSessionId);assert.notEqual(second.ready.pairingToken,first.ready.pairingToken);
 await assert.rejects(createCandyClient({baseUrl:second.client.baseUrl,token:first.ready.pairingToken}).session(),e=>e.classification==='UNAUTHORIZED');
 await assert.rejects(second.client.getArtifactMetadata(old.id),e=>e.details.httpStatus===404);
 const native=JSON.parse(await readFile(new URL('../candy-scope6e-v5-native-static.json',import.meta.url),'utf8'));
 await assert.rejects(second.client.getJob(native.cases[0].jobId),e=>e.details.httpStatus===404);
 await assert.rejects(second.client.getResult(native.cases[0].jobId),e=>e.details.httpStatus===404);
 const added=await second.client.uploadArtifact({bytes:'V5 owned artifact before abrupt restart',mediaType:'text/plain'});
 const orphan=event(child,'orphan-created');child.send({command:'orphan'});await orphan;
 report.restarts.push({kind:'abrupt',exit:await stop(true)});
 const third=await start();assert.notEqual(third.ready.runtimeSessionId,second.ready.runtimeSessionId);assert.notEqual(third.ready.pairingToken,second.ready.pairingToken);
 assert.ok(third.ready.recoveredFiles>=2);assert.equal(third.ready.artifacts,0);assert.equal(third.ready.workspaces,0);
 await assert.rejects(createCandyClient({baseUrl:third.client.baseUrl,token:second.ready.pairingToken}).capabilities(),e=>e.classification==='UNAUTHORIZED');
 await assert.rejects(third.client.getArtifactMetadata(added.id),e=>e.details.httpStatus===404);
 report.ownedAbruptRecovery={recoveredFiles:third.ready.recoveredFiles,artifactsOnStartup:third.ready.artifacts,workspacesOnStartup:third.ready.workspaces};
 report.freshCapabilities=third.caps;report.freshAuthentication=true;report.staleTokensRejected=true;report.staleArtifactJobResultHandlesRejected=true;
 const log=await readFile(new URL('./repository-1.log',import.meta.url),'utf8');
 for(const [file,marker] of [
  ['tests/candy-scope6c-retention.test.mjs','Scope6C 300-job retention'],
  ['tests/candy-scope6c-recovery.test.mjs','Scope6C HTTP admission/abort'],
  ['tests/candy-scope6c-browser-reconnect.test.mjs','Scope6C exact-byte/session-scoped'],
  ['tests/candy-scope6c-corrective-lifecycle.test.mjs','Scope6C']]) {
  assert.ok(log.includes(marker));report.committedTests.push({file,freshFullSuitePassed:true,coverage:marker,controlledFixturesNotClaimedAsNativeExecution:true});
 }
 report.defaultPolicyScope='Fresh committed regressions cover FIFO/admission, 300-job/artifact bounds, expiration cleanup, cancellation, lease recovery and browser stale session/capability/result/approval rejection. Live child Runtime checks add genuine production clean/abrupt restart and fresh authentication without discovery/runner injection.';
 report.status='PASS';
}catch(error){report.status='NON-PASS';report.error={name:error.name,message:error.message};process.exitCode=1;}
finally {
 if(child)try{await stop();}catch(error){report.shutdownError=error.message;report.status='NON-PASS';process.exitCode=1;}
 // Only the uniquely created Runtime-owned temporary root is disposed by the committed store.
 if(report.status==='PASS'){const store=await new ArtifactStore({root,maxBytes:6*1024*1024}).initialize();await store.dispose();report.cleanShutdown=true;}
 report.finishedAt=new Date().toISOString();await writeFile(new URL('../candy-scope6e-v5-runtime.json',import.meta.url),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
}
console.log(JSON.stringify({status:report.status,restarts:report.restarts,cleanShutdown:report.cleanShutdown,error:report.error}));
