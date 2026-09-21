import assert from "node:assert/strict";
import childProcess from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
import { promisify } from "node:util";
import { access, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
const root = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const runtimeRoot = join(root,"candy-runtime");
const originalExec = childProcess.execFile;
const exec = promisify(originalExec);
let probeFault = null;
let holdGpuProbe = false, heldProbe = null;
// Controlled operator-side environment failures. Production HTTP cannot select
// this test fixture or replace probes; real parity is qualified separately.
childProcess.execFile = (command,args,options,callback) => {
  if (command === "wsl.exe" && holdGpuProbe && args.includes("/usr/lib/wsl/lib/nvidia-smi")) return originalExec(command,args,options,(error,stdout,stderr)=>{heldProbe=()=>callback(error,stdout,stderr);});
  if (command === "wsl.exe" && probeFault && (probeFault === "wsl_unavailable" || args.includes("/usr/lib/wsl/lib/nvidia-smi"))) {
    queueMicrotask(()=>callback(probeFault === "wsl_unavailable" ? new Error("Controlled WSL absence") : null,"",""));
    return {kill(){}};
  }
  return originalExec(command,args,options,callback);
};
childProcess.execFile[promisify.custom] = (command,args,options) => new Promise((resolve,reject)=>childProcess.execFile(command,args,options,(error,stdout,stderr)=>error?reject(error):resolve({stdout,stderr})));
syncBuiltinESMExports();
const {verifyQualifiedMotifBackend,MOTIF_SPECS,motifRecordPath,motifEvidencePaths,sha256} = await import("../src/capabilities/motifQualification.js");
const {NativeProcessRunner} = await import("../src/backends/nativeProcessRunner.js");
const {JobManager} = await import("../src/jobs/jobManager.js");
const {ArtifactStore} = await import("../src/artifacts/artifactStore.js");
const {createRuntimeConfig} = await import("../src/config.js");
const {MOTIF_RUNTIME_REQUEST,MOTIF_ALGORITHM,MOTIF_TAXONOMY} = await import("../../src/candy/contracts/runtimeMotif.js");
const {ALL_30_MOTIF_WITNESSES} = await import("../../tests/fixtures/candy-scope4-motifs.mjs");
const {packCudaMotifRequest} = await import("./hypergraph-motif-cuda-contract.mjs");
const {acceptMotifNative} = await import("../src/backends/motifJobAdapter.js");
const report={schemaVersion:"candy.scope4c-boundary-qualification/1",status:"RUNNING",readiness:[],lifecycle:[],resultConfusion:[],resource:[]};
const fixture=await mkdtemp(join(runtimeRoot,".local","scope4c-boundary-"));
const copyRuntime=join(fixture,"runtime");
const workspace=await mkdtemp(join(tmpdir(),"scope4c-process-fixture-"));
const wsl=path=>`/mnt/${path[0].toLowerCase()}${path.slice(2).replaceAll("\\","/")}`;
const quote=value=>`'${value.replaceAll("'","'\\''")}'`;
const poll=async condition=>{const deadline=Date.now()+20000;while(Date.now()<deadline){if(await condition())return;await new Promise(resolve=>setTimeout(resolve,20));}throw new Error("Bounded qualification observation timed out");};
const absent=async path=>{try{await access(path);return false;}catch{return true;}};
const noOrphans=async()=>{try{const value=await exec("wsl.exe",["-d","Ubuntu","--exec","/usr/bin/pgrep","-af","scope4c-slow|/usr/bin/sleep 31.117"],{timeout:5000,windowsHide:true,shell:false});assert.equal(value.stdout.trim(),"");}catch(error){assert.equal(error.code,1,error.message);}};
try {
  for(const [backend,spec] of Object.entries(MOTIF_SPECS)) {
    for(const relative of [join("native",spec.directory,"build",spec.binary),join("native",spec.directory,"src","main.cu"),join("native",spec.directory,"Makefile"),join(".local",`${backend.toLowerCase()}-qualified-build.json`)]){const target=join(copyRuntime,relative);await mkdir(dirname(target),{recursive:true});await copyFile(join(runtimeRoot,relative),target);}
    for(const relative of motifEvidencePaths(spec)){const target=join(fixture,relative);await mkdir(dirname(target),{recursive:true});await copyFile(join(root,relative),target);}
  }
  for(const [backend,spec] of Object.entries(MOTIF_SPECS)) {
    assert.equal((await verifyQualifiedMotifBackend({runtimeRoot:copyRuntime},backend)).available,true,"Copied exact qualification must be ready");
    const recordPath=motifRecordPath(copyRuntime,backend),recordBytes=await readFile(recordPath),record=JSON.parse(recordBytes);
    const binary=join(copyRuntime,"native",spec.directory,"build",spec.binary),source=join(copyRuntime,"native",spec.directory,"src","main.cu"),makefile=join(copyRuntime,"native",spec.directory,"Makefile"),evidence=join(fixture,motifEvidencePaths(spec)[0]);
    const mutations=[
      ["missing-binary",binary,null],["missing-record",recordPath,null],["malformed-record",recordPath,Buffer.from("{")],
      ["stale-binary",binary,Buffer.concat([await readFile(binary),Buffer.from("stale")])],
      ["stale-source",source,Buffer.concat([await readFile(source),Buffer.from("stale")])],
      ["stale-makefile",makefile,Buffer.concat([await readFile(makefile),Buffer.from("stale")])],
      ...Object.entries({"wrong-architecture":{architecture:"sm_90"},"invalid-device":{device:{...record.device,id:255}},"wrong-taxonomy":{taxonomyVersion:"invented"},"wrong-qualified-commit":{qualifiedCommit:"0".repeat(40)},"wrong-runtime":{runtimeVersion:99999},"wrong-compiler":{nvccVersion:"0"}}).map(([id,change])=>[id,recordPath,Buffer.from(JSON.stringify({...record,...change}))]),
      ["missing-evidence",evidence,null],["corrupt-evidence",evidence,Buffer.from("{}")],
    ];
    for(const [id,path,replacement] of mutations){const previous=await readFile(path);try{if(replacement===null)await rm(path);else await writeFile(path,replacement);assert.equal((await verifyQualifiedMotifBackend({runtimeRoot:copyRuntime},backend)).available,false,id);report.readiness.push({backend,id,status:"UNAVAILABLE",productionSourceTouched:false});}finally{await writeFile(path,previous);}}
    for(const fault of ["no_gpu","wsl_unavailable"]){probeFault=fault;try{assert.equal((await verifyQualifiedMotifBackend({runtimeRoot:copyRuntime},backend)).available,false);report.readiness.push({backend,id:fault,status:"UNAVAILABLE",environmentFailure:"controlled_probe_fixture"});}finally{probeFault=null;}}
    assert.equal((await verifyQualifiedMotifBackend({runtimeRoot:copyRuntime},backend)).available,true);
  }
  await noOrphans();
  const marker=join(workspace,"started"),slow=join(workspace,"scope4c-slow.sh");
  await writeFile(slow,`#!/bin/bash\nset -eu\nprintf started > ${quote(wsl(marker))}\nexec /usr/bin/sleep 31.117\n`,{mode:0o700});
  const trusted={CUDA_STATIC:{available:true,path:slow,fingerprint:`sha256:${sha256(await readFile(slow))}`,device:{id:0}}};
  const runner=new NativeProcessRunner({runtimeRoot,stdoutBytes:4096,stderrBytes:4096,motifBackendDiscovery:trusted});
  const requestPath=join(workspace,"request.txt");await writeFile(requestPath,"qualification-only");
  const aborted=new AbortController();aborted.abort();await assert.rejects(runner.run({backend:"CUDA_STATIC",deviceId:0,requestPath,timeoutMs:5000,signal:aborted.signal}),error=>error.code==="JOB_CANCELLED");assert.equal(await absent(marker),true);report.lifecycle.push({id:"before-spawn",classification:"JOB_CANCELLED",launched:false});
  const store=await new ArtifactStore({root:join(workspace,"artifacts"),maxBytes:100000}).initialize();
  const graph=ALL_30_MOTIF_WITNESSES[0].graph,artifact=await store.put(Buffer.from(JSON.stringify(graph)),"application/vnd.candy.graph+json");
  const snapshot={schemaVersion:"candy.graph-snapshot/1",graphId:graph.graphId,graphVersion:graph.graphVersion,graphType:graph.graphType,directed:false,weightModel:{kind:"nonnegative_integer",objectives:["weight"]},vertexCount:graph.vertices.length,hyperedgeCount:graph.hyperedges.length,canonicalArtifactRef:artifact,provenance:{}};
  const payload=()=>({schemaVersion:"candy.job-submit/1",request:{schemaVersion:MOTIF_RUNTIME_REQUEST,requestId:randomUUID(),algorithm:MOTIF_ALGORITHM,taxonomyVersion:MOTIF_TAXONOMY,backend:"CUDA_STATIC",mode:"STATIC",graphRef:{graphId:graph.graphId,graphVersion:graph.graphVersion},deviceId:0,timeoutMs:5000},graphSnapshot:snapshot,graphArtifactId:artifact.id});
  let shutdownExecutions=0;
  const shutdownRace=new JobManager({artifactStore:store,config:createRuntimeConfig({nativeRunner:{run(){shutdownExecutions++;throw Error("Post-shutdown spawn");}}})});
  holdGpuProbe=true;const inFlight=assert.rejects(shutdownRace.submit(payload()),error=>error.code==="BACKEND_UNAVAILABLE");await poll(()=>Boolean(heldProbe));await shutdownRace.close();holdGpuProbe=false;heldProbe();heldProbe=null;await inFlight;assert.equal(shutdownRace.jobs.size,0);assert.equal(shutdownExecutions,0);report.lifecycle.push({id:"shutdown-during-discovery",classification:"BACKEND_UNAVAILABLE",jobReserved:false,nativeSpawned:false});
  const paths=[];const managedRunner={run:options=>{paths.push(options.requestPath);return runner.run(options);}};
  const manager=new JobManager({artifactStore:store,config:createRuntimeConfig({nativeRunner:managedRunner,motifBackendDiscovery:trusted})});
  const first=await manager.submit(payload());await poll(async()=>!(await absent(marker)));
  const queued=await manager.submit(payload());assert.equal(manager.cancel(queued.jobId).status,"cancelled");assert.equal(manager.cancel(queued.jobId).status,"cancelled");
  assert.equal(manager.cancel(first.jobId).status,"cancelling");manager.cancel(first.jobId);await poll(()=>manager.get(first.jobId).status==="cancelled");
  await assert.rejects(Promise.resolve().then(()=>manager.result(first.jobId)));for(const path of paths)assert.equal(await absent(dirname(path)),true);await noOrphans();report.lifecycle.push({id:"running-and-queued-repeated-cancel",runningStatus:"cancelled",queuedStatus:"cancelled",tempRequestsRemoved:true,orphan:false,fixture:"real_Windows_WSL_process_control_not_forced_GPU_delay"});
  await rm(marker,{force:true});const duringClose=await manager.submit(payload());await poll(async()=>!(await absent(marker)));await manager.close();assert.equal(manager.get(duringClose.jobId).status,"cancelled");await assert.rejects(manager.submit(payload()),error=>error.code==="BACKEND_UNAVAILABLE");await noOrphans();for(const path of paths)assert.equal(await absent(dirname(path)),true);report.lifecycle.push({id:"shutdown-drain",tempRequestsRemoved:true,orphan:false,postShutdownSubmission:"BACKEND_UNAVAILABLE"});
  await rm(marker,{force:true});await assert.rejects(runner.run({backend:"CUDA_STATIC",deviceId:0,requestPath,timeoutMs:1000}),error=>error.code==="PROCESS_TIMEOUT");await noOrphans();report.lifecycle.push({id:"process-timeout",classification:"PROCESS_TIMEOUT",orphan:false,fixture:"real_Windows_WSL_process_control"});
  const fault=join(runtimeRoot,"native","hypergraph-motif-cuda","build","candy-hypergraph-motif-cuda-fault-LAUNCH");
  const faultDiscovery={CUDA_STATIC:{...trusted.CUDA_STATIC,path:fault}};
  const faultManager=new JobManager({artifactStore:store,config:createRuntimeConfig({motifBackendDiscovery:faultDiscovery})});const failed=await faultManager.submit(payload());await poll(()=>faultManager.get(failed.jobId).status==="failed");assert.equal(faultManager.get(failed.jobId).error.classification,"BACKEND_UNAVAILABLE");assert.throws(()=>faultManager.result(failed.jobId));await faultManager.close();report.lifecycle.push({id:"qualified-native-launch-failure",classification:"BACKEND_UNAVAILABLE",resultAccepted:false,fixture:"unchanged_qualified_fault_binary"});
  const realRunner=new NativeProcessRunner({runtimeRoot,stdoutBytes:100000,stderrBytes:4096});const packed=packCudaMotifRequest(graph);await writeFile(requestPath,packed.text);const native=await realRunner.run({backend:"CUDA_STATIC",deviceId:0,requestPath,timeoutMs:5000});const job={jobId:randomUUID(),request:payload().request,payload:{graphArtifactId:artifact.id}};
  acceptMotifNative(native,packed,job,randomUUID());
  for(const [id,change] of [["backend",{backend:"CPU_REFERENCE_ORACLE"}],["mode",{mode:"INCREMENTAL"}],["taxonomy",{taxonomyVersion:"invented"}],["graph",{inputGraphRef:{graphId:"another",graphVersion:1}}],["device",{cuda:{...JSON.parse(native.stdout).cuda,deviceIndex:255}}]]) {assert.throws(()=>acceptMotifNative({...native,stdout:JSON.stringify({...JSON.parse(native.stdout),...change})},packed,job,"session"),error=>error.code==="RESULT_VALIDATION_FAILURE");report.resultConfusion.push({id,rejected:true});}
  const unavailable=new JobManager({artifactStore:store,config:createRuntimeConfig({motifBackendDiscovery:{CUDA_STATIC:{available:false}},nativeRunner:{run(){throw Error("Fallback executed");}}})});await assert.rejects(unavailable.submit(payload()),error=>error.code==="BACKEND_UNAVAILABLE");report.readiness.push({id:"unavailable-submission",classification:"BACKEND_UNAVAILABLE",fallbackExecuted:false});
  const tiny=await new ArtifactStore({root:join(workspace,"bounded-store"),maxBytes:10,maxArtifacts:2,maxTotalBytes:4}).initialize();await tiny.put(Buffer.from("ab"),"text/plain");await tiny.put(Buffer.from("cd"),"text/plain");await assert.rejects(tiny.put(Buffer.from("e"),"text/plain"),error=>error.code==="RESOURCE_LIMIT");report.resource.push({id:"artifact-retention-budget",classification:"RESOURCE_LIMIT"});
  const bounded=new JobManager({artifactStore:store,config:createRuntimeConfig({limits:{maxJobs:1},motifBackendDiscovery:trusted,nativeRunner:{run(){throw Error("controlled failure");}}})});await bounded.submit(payload());await assert.rejects(bounded.submit(payload()),error=>error.code==="RESOURCE_LIMIT");await bounded.close();report.resource.push({id:"job-retention-budget",classification:"RESOURCE_LIMIT"});
  report.status="BOUNDARY_QUALIFICATION_PASS";
} catch(error){report.status="BOUNDARY_QUALIFICATION_FAIL";report.error=error.stack;process.exitCode=1;console.error(error.message);}
finally {probeFault=null;childProcess.execFile=originalExec;syncBuiltinESMExports();await rm(fixture,{recursive:true,force:true,maxRetries:5,retryDelay:100});await rm(workspace,{recursive:true,force:true,maxRetries:5,retryDelay:100});await writeFile(join(root,"artifacts","candy-scope4c-boundary-qualification.json"),JSON.stringify(report,null,2)+"\n");console.log(`${report.status}: ${report.readiness.length} readiness, ${report.lifecycle.length} lifecycle, ${report.resultConfusion.length} result checks`);}
