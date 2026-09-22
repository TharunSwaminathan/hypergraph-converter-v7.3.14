import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createCandyClient } from "../../src/candy/client.js";
import { MOTIF_ALGORITHM, MOTIF_TAXONOMY, MOTIF_RUNTIME_REQUEST } from "../../src/candy/contracts/runtimeMotif.js";
import { ALL_30_MOTIF_WITNESSES, ANCHOR_OVER_SUBTRACTION_COUNTEREXAMPLE, ANCHOR_COUNTEREXAMPLE_DELETE } from "../../tests/fixtures/candy-scope4-motifs.mjs";
import { countHypergraphThreeEdgeMotifs } from "../../src/candy/hypergraphMotifs/referenceOracle.js";
import { canonicalizeHypergraphIncidence } from "../../src/candy/adapters/hypergraphIncidenceAdapter.js";
import { applyHypergraphMotifUpdate } from "../../src/candy/adapters/hypergraphUpdateAdapter.js";

const report = {schemaVersion:"candy.scope4c-live-runtime/1",status:"RUNNING",cases:[],failures:[]};
const outputUrl = process.env.CANDY_QUALIFICATION_OUTPUT
  ? new URL(process.env.CANDY_QUALIFICATION_OUTPUT, import.meta.url)
  : new URL("../../artifacts/candy-scope4c-live-runtime-qualification.json", import.meta.url);
const child = fork(fileURLToPath(new URL("./scope4c-live-server.mjs",import.meta.url)),[],{stdio:["ignore","pipe","pipe","ipc"]});
// Private IPC carries the approved pairing credential; it is never recorded.
const ready = await new Promise((resolve,reject) => { child.once("message",resolve);child.once("error",reject);child.once("exit",code=>reject(new Error(`Runtime startup failed: ${code}`))); });
assert.equal(ready.platform,"win32");
const baseUrl = `http://127.0.0.1:${ready.port}`;
const client = createCandyClient({baseUrl,token:ready.pairingToken,fetchImpl:(url,options)=>fetch(url,{...options,headers:{...options.headers,Origin:"http://localhost:5173"}})});
report.runtime = {pid:ready.pid,platform:ready.platform,host:"127.0.0.1",distro:"Ubuntu",transport:"authenticated_http_browser_client"};
async function payload(graph,update=null,timeoutMs=5000) {
  const graphArtifact = await client.uploadArtifact({bytes:graph,mediaType:"application/vnd.candy.graph+json"});
  const updateArtifact = update ? await client.uploadArtifact({bytes:update,mediaType:"application/vnd.candy.updates+json"}) : null;
  const mode = update ? "INCREMENTAL" : "STATIC";
  const request = {schemaVersion:MOTIF_RUNTIME_REQUEST,requestId:randomUUID(),algorithm:MOTIF_ALGORITHM,taxonomyVersion:MOTIF_TAXONOMY,backend:update?"CUDA_INCREMENTAL":"CUDA_STATIC",mode,graphRef:{graphId:graph.graphId,graphVersion:graph.graphVersion},deviceId:0,timeoutMs,...(update?{updateRef:{updateId:update.updateId,artifactId:updateArtifact.id,nextGraphVersion:update.nextGraphVersion}}:{})};
  const snapshot = {schemaVersion:"candy.graph-snapshot/1",graphId:graph.graphId,graphVersion:graph.graphVersion,graphType:graph.graphType,directed:false,weightModel:{kind:"nonnegative_integer",objectives:["weight"]},vertexCount:graph.vertices.length,hyperedgeCount:graph.hyperedges.length,canonicalArtifactRef:graphArtifact,provenance:{source:"scope4c-live-authoritative-fixture"}};
  return {schemaVersion:"candy.job-submit/1",request,graphSnapshot:snapshot,graphArtifactId:graphArtifact.id,...(update?{updateBatchArtifactId:updateArtifact.id}:{})};
}
async function submit(graph,update=null,timeoutMs=5000) { return client.submitJob(await payload(graph,update,timeoutMs)); }
async function rejectedHttp(id,path,expected,{method="GET",body,authorization=`Bearer ${ready.pairingToken}`,origin="http://localhost:5173"}={}) {
  const response=await fetch(baseUrl+path,{method,headers:{Origin:origin,...(authorization?{Authorization:authorization}:{}),...(body!==undefined?{"Content-Type":"application/json"}:{})},body});
  const value=await response.json();assert.equal(response.status,expected,id);assert.equal(JSON.stringify(value).includes(ready.pairingToken),false,"Credential leaked");
  report.failures.push({id,httpStatus:response.status,classification:value.classification??null,secretEchoed:false});
}
async function wait(job) {
  const deadline=Date.now()+40000;
  let lastStatus;
  while (Date.now()<deadline) {
    const status=await client.getJob(job.jobId);
    lastStatus = status;
    if (["completed","failed","cancelled"].includes(status.status)) return status;
    await new Promise(resolve=>setTimeout(resolve,30));
  }
  throw new Error(`Job did not finish within qualification polling bound: ${JSON.stringify(lastStatus)}`);
}
async function parity(id,graph,update=null) {
  const before=JSON.stringify(graph);
  const job=await submit(graph,update);
  const status=await wait(job);
  assert.equal(status.status,"completed",JSON.stringify(status.error));
  const result=await client.getResult(job.jobId);
  assert.equal(result.validation.status,"passed");assert.equal(result.native.cuda.kernelLaunchSucceeded,true);assert.equal(result.native.cuda.synchronizationSucceeded,true);
  const old=countHypergraphThreeEdgeMotifs(canonicalizeHypergraphIncidence(graph));
  if (!update) assert.deepEqual(result.native.counts,old.counts);
  else {
    const next=applyHypergraphMotifUpdate(canonicalizeHypergraphIncidence(graph),update);
    const counts=countHypergraphThreeEdgeMotifs(next.graph ?? canonicalizeHypergraphIncidence(next.value));
    assert.deepEqual(result.native.deltaCounts,counts.counts.map((value,i)=>value-old.counts[i]));
    assert.equal(result.native.deltaTotalConnectedTriples,counts.totalConnectedTriples-old.totalConnectedTriples);
    assert.equal(result.interpretation,"delta_only");
  }
  assert.equal(JSON.stringify(graph),before);
  report.cases.push({id,jobId:job.jobId,backend:result.backend,mode:result.mode,lifecycle:status.lifecycle,graphArtifactId:result.graphArtifactId,requestDigest:result.requestDigest,counts:result.native.counts??result.native.deltaCounts,total:result.native.totalConnectedTriples??result.native.deltaTotalConnectedTriples,cuda:result.native.cuda,resultArtifactRef:result.resultArtifactRef,workspaceUnchanged:true});
}
try {
  const declaration=await client.capabilities();
  assert.equal(declaration.capabilities.filter(cap=>cap.algorithm===MOTIF_ALGORITHM).length,2);
  report.runtimeSessionId=declaration.runtimeSessionId;
  await parity("static-open-wedge",ALL_30_MOTIF_WITNESSES[0].graph);
  await parity("static-closed",ALL_30_MOTIF_WITNESSES.find(w=>w.family==="CLOSED_TRIANGLE")?.graph??ALL_30_MOTIF_WITNESSES[29].graph);
  const graph=structuredClone(ALL_30_MOTIF_WITNESSES[0].graph);graph.graphType="DynamicHypergraph";
  const update=(deletions,insertions,id)=>({schemaVersion:"candy.hypergraph-3edge-motif-update/1",updateId:id,baseGraphRef:{graphId:graph.graphId,graphVersion:graph.graphVersion},nextGraphVersion:graph.graphVersion+1,ordering:"DELETE_THEN_INSERT",collisionPolicy:"REJECT_EXCEPT_EXACT_DELETE_REINSERT",deletions,insertions});
  await parity("incremental-delete",graph,update([graph.hyperedges[0].id],[],"delete"));
  await parity("incremental-insert",graph,update([],[{id:"scope4c-new-edge",vertices:[graph.vertices[0]]}],"insert"));
  await parity("incremental-replace",graph,update([graph.hyperedges[0].id],[{id:graph.hyperedges[0].id,vertices:[graph.vertices[0]]}],"replace"));
  await parity("incremental-anchor-counterexample",ANCHOR_OVER_SUBTRACTION_COUNTEREXAMPLE,ANCHOR_COUNTEREXAMPLE_DELETE);
  const mixed=structuredClone(ANCHOR_OVER_SUBTRACTION_COUNTEREXAMPLE);mixed.graphType="Hypergraph";await parity("static-multiclass",mixed);
  await rejectedHttp("missing-bearer","/v1/capabilities",401,{authorization:null});
  await rejectedHttp("wrong-bearer","/v1/capabilities",401,{authorization:"Bearer deliberately-wrong-qualification-credential"});
  await rejectedHttp("wrong-origin","/v1/capabilities",403,{origin:"https://evil.example"});
  await rejectedHttp("malformed-json","/v1/jobs",400,{method:"POST",body:"{"});
  await rejectedHttp("oversized-body","/v1/jobs",413,{method:"POST",body:"x".repeat(8*1024*1024+1)});
  await rejectedHttp("unknown-route","/v1/unknown-capability",404);
  await rejectedHttp("invalid-artifact-ref","/v1/artifacts/sha256:../../secret/metadata",404);
  await rejectedHttp("absent-artifact-ref",`/v1/artifacts/sha256:${"0".repeat(64)}/metadata`,400);
  await rejectedHttp("invalid-job-id","/v1/jobs/invented",404);
  await rejectedHttp("nonexistent-job-cancel",`/v1/jobs/${randomUUID()}/cancel`,400,{method:"POST",body:"{}"});
  const valid=await payload(ALL_30_MOTIF_WITNESSES[0].graph);
  for(const [id,change] of [["unknown-capability",{capability:"EXEC_SHELL"}],["wrong-backend",{backend:"CUDA_INCREMENTAL"}],["wrong-mode",{mode:"COMPARE"}],["wrong-taxonomy",{taxonomyVersion:"invented"}],["caller-new",{newGraph:{}}],["candidate-injection",{candidateTuples:[]}]]) await rejectedHttp(id,"/v1/jobs",400,{method:"POST",body:JSON.stringify({...valid,request:{...valid.request,...change}})});
  await rejectedHttp("ordinary-motif-type","/v1/jobs",400,{method:"POST",body:JSON.stringify({...valid,graphSnapshot:{...valid.graphSnapshot,graphType:"OrdinaryGraph",edgeCount:0,hyperedgeCount:undefined}})});
  await rejectedHttp("stale-request-ref","/v1/jobs",400,{method:"POST",body:JSON.stringify({...valid,request:{...valid.request,graphRef:{...valid.request.graphRef,graphVersion:999}}})});
  await rejectedHttp("stale-artifact-ref","/v1/jobs",400,{method:"POST",body:JSON.stringify({...valid,graphArtifactId:`sha256:${"0".repeat(64)}`,graphSnapshot:{...valid.graphSnapshot,canonicalArtifactRef:{...valid.graphSnapshot.canonicalArtifactRef,id:`sha256:${"0".repeat(64)}`}}})});
  const timedOut=await wait(await submit(ALL_30_MOTIF_WITNESSES[0].graph,null,1));assert.equal(timedOut.status,"failed");assert.equal(timedOut.error.classification,"PROCESS_TIMEOUT");
  await assert.rejects(client.getResult(timedOut.jobId));report.failures.push({id:"real-native-timeout",classification:timedOut.error.classification,lifecycle:timedOut.lifecycle,resultAccepted:false});
  const cancelled=await submit(ALL_30_MOTIF_WITNESSES[0].graph);await client.cancelJob(cancelled.jobId);await client.cancelJob(cancelled.jobId);const cancelledStatus=await wait(cancelled);assert.equal(cancelledStatus.status,"cancelled");await assert.rejects(client.getResult(cancelled.jobId));report.failures.push({id:"real-native-cancel-repeat",classification:cancelledStatus.error?.classification??"JOB_CANCELLED",lifecycle:cancelledStatus.lifecycle,resultAccepted:false});
  const finalDeclaration=await client.capabilities();assert.equal(finalDeclaration.runtimeSessionId,declaration.runtimeSessionId);report.httpServerSurvivedAdversarialRequests=true;
  report.status="LIVE_RUNTIME_QUALIFICATION_PASS";
} catch(error) {report.status="LIVE_RUNTIME_QUALIFICATION_FAIL";report.error=error.stack;process.exitCode=1;console.error(error.message);}
finally {
  child.send("close");await new Promise(resolve=>child.once("exit",resolve));
  await writeFile(outputUrl,JSON.stringify(report,null,2)+"\n");
  console.log(`${report.status}: ${report.cases.length} live Runtime/CUDA parity cases`);
}
