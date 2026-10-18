// External observation only: never substitutes a backend or qualification.
import childProcess from 'node:child_process';
import fs from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { cpus, totalmem, release } from 'node:os';
import assert from 'node:assert/strict';
import { promisify } from 'node:util';

const output=process.argv.find(a=>a.startsWith('--output='))?.slice(9);
const stopFile=process.argv.find(a=>a.startsWith('--stop-file='))?.slice(12);
if(!output) throw Error('Explicit additive --output required');
try { await fs.access(output); throw Error('Refusing to overwrite existing evidence'); } catch(e) { if(e.code!=='ENOENT') throw e; }
const counters={childProcesses:0,qualificationReads:0,capabilityRequests:0};
const probeFailures=[];
const ownedGroups=new Set(),supervisors=new Set();let peakSupervisors=0;
const originalExec=childProcess.execFile, originalSpawn=childProcess.spawn, originalRead=fs.readFile;
childProcess.execFile=function(...args){counters.childProcesses++;return originalExec.apply(this,args);};
// execFile has a custom promisify contract returning {stdout,stderr}; preserve it.
childProcess.execFile[promisify.custom]=async(...args)=>{counters.childProcesses++;try{return await promisify(originalExec)(...args);}catch(e){if(probeFailures.length<100)probeFailures.push({command:args[0],code:e.code,killed:e.killed,signal:e.signal,at:new Date().toISOString()});throw e;}};
childProcess.spawn=function(...args){
 counters.childProcesses++;const child=originalSpawn.apply(this,args);
 if(args[1]?.some(a=>String(a).endsWith('nativeSupervisor.sh'))){
   supervisors.add(child);peakSupervisors=Math.max(peakSupervisors,supervisors.size);
   let line='';child.stdout.on('data',chunk=>{if(line.includes('\n'))return;line+=chunk.toString();const match=/^CANDY_PROCESS_GROUP:([1-9][0-9]*)\n/.exec(line);if(match)ownedGroups.add(Number(match[1]));});
   child.once('close',()=>supervisors.delete(child));
 }
 return child;
};
fs.readFile=async function(path,...args){if(/qualified-build|scope4b[12]-.*qualification|motif-cuda.*(?:main\.cu|Makefile|build)/i.test(String(path)))counters.qualificationReads++;return originalRead.call(this,path,...args);};
syncBuiltinESMExports();
const {startCandyRuntime}=await import('../candy-runtime/src/server.js');
const {createCandyClient}=await import('../src/candy/client.js');
const {createGraphState,graphIdentityFromState,commitGraphState}=await import('../src/graph/graphState.js');
const {createMutationPlan}=await import('../src/graph/graphMutationValidator.js');
const {createPendingHypergraphUpdateController}=await import('../src/graph/pendingHypergraphUpdate.js');
const {createMotifAnalysisController}=await import('../src/candy/motifAnalysisController.js');
const {intersectCandyCapabilities}=await import('../src/candy/capabilityDiscovery.js');
const {createBenchmarkFixture}=await import('./benchmarks/scope6a-fixtures.mjs');
const samples=[],checkpoints=[];
const timed=async(boundary,fn)=>{const t=performance.now(),before={...counters};try{const result=await fn();samples.push({boundary,ms:performance.now()-t,status:'PASS',childProcesses:counters.childProcesses-before.childProcesses,qualificationReads:counters.qualificationReads-before.qualificationReads});return result;}catch(e){samples.push({boundary,ms:performance.now()-t,status:'FAIL',classification:e.code??e.classification,message:e.message});throw e;}};
let runtime,client,declaration,context;
let interrupted=false;
process.once('SIGINT',()=>{interrupted=true;for(const job of runtime?.jobs.jobs.values()??[])if(!terminals.has(job.status))runtime.jobs.cancel(job.jobId);});
const terminals=new Set(['completed','failed','cancelled']);
async function start(limits){runtime=await timed('cold-start',()=>startCandyRuntime({port:0,...(limits?{limits}:{})}));console.log(JSON.stringify({pid:process.pid,port:runtime.port,artifactRoot:runtime.artifactStore.root}));client=createCandyClient({baseUrl:`http://127.0.0.1:${runtime.port}`,token:runtime.pairingToken});assert.equal((await fetch(`http://127.0.0.1:${runtime.port}/v1/health`)).status,200);}
async function discover(name){declaration=await timed(name,()=>{counters.capabilityRequests++;return client.capabilities();});context={featureEnabled:true,authorized:true,runtimeSessionId:declaration.runtimeSessionId,capabilities:intersectCandyCapabilities(declaration,{authorized:true,graphType:'DynamicHypergraph'}).capabilities};}
async function checkpoint(label){
 const metadata=[...runtime.artifactStore.metadataById.values()];
 const ps=await promisify(originalExec)('wsl.exe',['-d','Ubuntu','--exec','/usr/bin/ps','-eo','pid,pgid,stat'],{windowsHide:true,timeout:5000,maxBuffer:1024*1024});
 const owned=ps.stdout.trim().split('\n').slice(1).map(line=>line.trim().split(/\s+/)).filter(row=>ownedGroups.has(Number(row[1])));
 const processCounts={supervisorHandles:supervisors.size,peakSupervisors,observedGroups:ownedGroups.size,ownedLiveProcesses:owned.filter(row=>!row[2].startsWith('Z')).length,ownedZombieProcesses:owned.filter(row=>row[2].startsWith('Z')).length};
 checkpoints.push({label,retainedJobs:runtime.jobs.jobs.size,retainedArtifacts:metadata.length,retainedArtifactBytes:metadata.reduce((n,m)=>n+m.byteLength,0),queueDepth:[...runtime.jobs.jobs.values()].filter(j=>!terminals.has(j.status)).length,files:(await fs.readdir(runtime.artifactStore.root)).length,workspaces:(await fs.readdir(new URL('file:///'+runtime.artifactStore.root.replaceAll('\\','/')+'/workspaces'))).length,rssBytes:process.memoryUsage().rss,processCounts,counters:{...counters}});
 assert.equal(processCounts.ownedLiveProcesses,0,'No owned native process at a drained checkpoint');assert.equal(processCounts.ownedZombieProcesses,0,'No owned zombie at a drained checkpoint');
}
function owner(){let graph=createGraphState(createBenchmarkFixture('S2').graph.hyperedges,{graphType:'DynamicHypergraph'});const pending=createPendingHypergraphUpdateController({getGraphState:()=>graph,commit:(rows,options)=>graph=commitGraphState(graph,rows,options)});const analysis=createMotifAnalysisController({getContext:()=>({graph,pendingUpdate:pending.getCurrent(),runtime:context}),getClient:()=>client});return {analysis,pending,get graph(){return graph;},async stage(){await pending.stage(createMutationPlan({graphIdentity:graphIdentityFromState(graph),operations:[{type:'ADD_INCIDENCE',hyperedgeId:graph.hyperedges[0].id,vertexId:'scope6c-new'}],summary:'Public Scope6C fixture'}));},dispose(){analysis.dispose();pending.dispose();}};}
async function terminal(id){const until=Date.now()+90000;let job;do{job=await client.getJob(id);if(terminals.has(job.status))return job;await new Promise(r=>setTimeout(r,20));}while(Date.now()<until);throw Error('Bounded terminal wait exceeded');}
async function submit(h,mode,timeoutMs=5000){const args={mode,backend:mode==='STATIC'?'CUDA_STATIC':'CUDA_INCREMENTAL',deviceId:0,timeoutMs,...(mode==='INCREMENTAL'?{updateContextId:h.pending.getCurrent().updateId}:{})};const staged=h.analysis.stage(args);assert.ok(staged.ok,JSON.stringify(staged));const sent=await h.analysis.submit(args,staged.confirmation);assert.ok(sent.ok,JSON.stringify(sent));return sent.job;}
const report={schemaVersion:'candy.scope6c-runtime-measurement/1',capturedAt:new Date().toISOString(),pid:process.pid,node:process.version,os:release(),cpu:cpus()[0]?.model,ramBytes:totalmem(),methodology:'Single isolated Node observer/service process; monotonic HTTP/controller boundaries; wrappers count actual execFile/spawn and qualification-related readFile calls. RSS includes harness and service, not isolated heap. No browser timings. OS page cache not reset. Fresh native one-shot process per job.',samples,checkpoints,failures:[],probeFailures};
try{
 await start();await discover('first-discovery');for(let i=0;i<5;i++)await discover('repeated-discovery');
 report.capabilities=declaration.capabilities;report.motifReadiness=declaration.motifReadiness;
 assert.ok(context.capabilities.some(c=>c.backend==='CUDA_STATIC'),'Trusted STATIC unavailable');assert.ok(context.capabilities.some(c=>c.backend==='CUDA_INCREMENTAL'),'Trusted INCREMENTAL unavailable');
 const h=owner();await h.stage();await checkpoint('initial');
 for(const mode of ['STATIC','INCREMENTAL'])for(let i=0;i<6;i++)await timed(`${i===0?'first':'repeated'}-${mode.toLowerCase()}`,async()=>{const j=await submit(h,mode),done=await terminal(j.jobId);assert.equal(done.status,'completed',JSON.stringify(done));assert.ok((await h.analysis.openResult(j.jobId)).ok);const r=h.analysis.currentResult().result;assert.ok(r.native.cuda.kernelLaunchSucceeded&&r.native.cuda.synchronizationSucceeded);assert.ok((r.native.counts??r.native.deltaCounts).every(n=>n===0),'S2 disjoint truth');report.lastJobId=j.jobId;});
 await checkpoint('after-12-real-jobs');
 const cycles=Number(process.argv.find(a=>a.startsWith('--cycles='))?.slice(9)??0);
 if(!Number.isSafeInteger(cycles)||cycles<0||cycles>1000)throw Error('Soak cycles must be 0..1000');
 report.soak={requestedCycles:cycles,completed:0};
 for(let i=0;i<cycles;i++){
   if(stopFile)try{await fs.access(stopFile);interrupted=true;}catch(e){if(e.code!=='ENOENT')throw e;}
   if(interrupted)throw Error('Measurement interrupted; partial samples retained without qualification');
   if(i%2)await h.stage(); // fresh pending revision, never replay an approval
   await timed('soak-'+(i%2?'incremental':'static'),async()=>{
     const j=await submit(h,i%2?'INCREMENTAL':'STATIC'),done=await terminal(j.jobId);
     assert.equal(done.status,'completed',JSON.stringify(done));assert.ok((await h.analysis.openResult(j.jobId)).ok);
     const result=h.analysis.currentResult().result;assert.ok((result.native.counts??result.native.deltaCounts).every(n=>n===0));
     assert.ok(result.native.cuda.kernelLaunchSucceeded && result.native.cuda.synchronizationSucceeded);
     report.soak.completed++;
   });
   if((i+1)%25===0){await checkpoint(`soak-${i+1}`);console.log(JSON.stringify({soakCompleted:i+1,jobs:runtime.jobs.jobs.size,artifacts:runtime.artifactStore.metadataById.size,rssBytes:process.memoryUsage().rss}));}
 }
 const cancelled=await submit(h,'STATIC');await client.cancelJob(cancelled.jobId);assert.equal((await terminal(cancelled.jobId)).status,'cancelled');await checkpoint('cancelled');
 const timeout=await submit(h,'STATIC',1);const failed=await terminal(timeout.jobId);assert.equal(failed.status,'failed');assert.equal(failed.error.classification,'PROCESS_TIMEOUT');await checkpoint('failed-timeout');
 await timed('valid-job-after-failures',async()=>assert.equal((await terminal((await submit(h,'STATIC')).jobId)).status,'completed'));
 const oldSession=context.runtimeSessionId,oldClient=client,oldJob=report.lastJobId,oldPort=runtime.port;
 h.dispose();await timed('shutdown',()=>runtime.close());runtime=null;
 await assert.rejects(oldClient.getJob(oldJob));
 await start();await discover('restart-reconnect-discovery');assert.notEqual(context.runtimeSessionId,oldSession);await assert.rejects(client.getJob(oldJob));
 const wrong=await fetch(`http://127.0.0.1:${runtime.port}/v1/capabilities`,{headers:{Authorization:'Bearer deliberately-invalid-stale-token'}});assert.equal(wrong.status,401);
 const fresh=owner();await timed('fresh-job-after-restart',async()=>assert.equal((await terminal((await submit(fresh,'STATIC')).jobId)).status,'completed'));fresh.dispose();await checkpoint('restarted');report.restart={freshSession:true,oldJobRejected:true,absenceRejected:true,wrongTokenStatus:wrong.status,oldPort,newPort:runtime.port};
 await runtime.close();runtime=null;
 // Same production retention logic at a deliberately small bound exposes the
 // lifetime-ceiling behavior without hundreds of expensive qualification rounds.
 await start({maxJobs:4,maxTerminalJobs:4});await discover('retention-probe-discovery');const probe=owner();let accepted=0,rejected=null;
 for(let i=0;i<8;i++){try{const j=await submit(probe,'STATIC');assert.equal((await terminal(j.jobId)).status,'completed');accepted++;}catch(e){rejected={classification:e.code??e.classification,message:e.message};break;}}
 await checkpoint('small-bound-retention-probe');report.retentionProbe={configuredMaxJobs:4,attempts:8,accepted,rejected,notDefaultCapacityBenchmark:true};probe.dispose();
 report.status='PASS';
}catch(e){report.status='FAIL';report.failures.push({message:e.message,stack:e.stack});process.exitCode=1;}
finally{if(runtime)try{await runtime.close();}catch(e){report.status='FAIL';report.failures.push({phase:'close',message:e.message,details:e.details});process.exitCode=1;}report.finishedAt=new Date().toISOString();report.counters=counters;report.observedSourceDigest=createHash('sha256').update(await originalRead(new URL('../candy-runtime/src/jobs/jobManager.js',import.meta.url))).digest('hex');try{report.qualificationParsing=(await import('../candy-runtime/src/capabilities/qualificationJson.js')).qualificationJsonCache.stats();}catch{}await fs.writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output,status:report.status,samples:samples.length,failures:report.failures}));}
