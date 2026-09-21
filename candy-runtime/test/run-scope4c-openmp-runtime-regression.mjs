import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createCandyClient } from "../../src/candy/client.js";
const report={schemaVersion:"candy.scope4c-openmp-runtime/1",status:"RUNNING",cases:[]};
const child=fork(fileURLToPath(new URL("./scope4c-live-server.mjs",import.meta.url)),[],{stdio:["ignore","pipe","pipe","ipc"]});
const ready=await new Promise((resolve,reject)=>{child.once("message",resolve);child.once("error",reject);child.once("exit",code=>reject(Error(`Runtime failed: ${code}`)));});
const client=createCandyClient({baseUrl:`http://127.0.0.1:${ready.port}`,token:ready.pairingToken,fetchImpl:(url,options)=>fetch(url,{...options,headers:{...options.headers,Origin:"http://127.0.0.1:5173"}})});
const upload=(bytes,mediaType)=>client.uploadArtifact({bytes,mediaType});
async function terminal(job){for(let i=0;i<1000;i++){const value=await client.getJob(job.jobId);if(["completed","failed","cancelled"].includes(value.status))return value;await new Promise(resolve=>setTimeout(resolve,20));}throw Error("Bounded OpenMP job polling failed");}
try{
  const declaration=await client.capabilities();assert.ok(declaration.capabilities.some(cap=>cap.backend==="LOCAL_OPENMP"));assert.equal(declaration.capabilities.some(cap=>cap.backend==="LOCAL_CUDA"),false,"Prior unqualified CUDA attestation state must be restored");
  const graph={graphType:"DynamicOrdinaryGraph",directed:true,vertices:["A","B","C"],edges:[{source:"A",target:"B",weight:1},{source:"B",target:"C",weight:2}]};
  const graphArtifact=await upload(graph,"application/vnd.candy.graph+json");
  const snapshot={schemaVersion:"candy.graph-snapshot/1",graphId:"scope4c-openmp",graphVersion:1,graphType:graph.graphType,directed:true,weightModel:{kind:"nonnegative_integer",objectives:["cost"]},vertexCount:3,edgeCount:2,canonicalArtifactRef:graphArtifact,provenance:{}};
  const base={schemaVersion:"candy.algorithm-request/1",requestId:randomUUID(),capability:"RUN_SSSP",algorithm:"SSSP",algorithmVersion:"scope1-openmp-sssp/1",mode:"STATIC",backend:"LOCAL_OPENMP",graphRef:{graphId:snapshot.graphId,graphVersion:1},parameters:{sourceVertexId:"A",objective:"cost"},resourceHints:{threads:2,timeoutMs:10000}};
  const payload={schemaVersion:"candy.job-submit/1",request:base,graphSnapshot:snapshot,graphArtifactId:graphArtifact.id};
  const first=await client.submitJob(payload);const firstStatus=await terminal(first);assert.equal(firstStatus.status,"completed",JSON.stringify(firstStatus.error));const absolute=await client.getResult(first.jobId);assert.equal(absolute.modelSummary.reachableCount,3);report.cases.push({id:"static",jobId:first.jobId,backend:absolute.backend,validation:absolute.validation});
  const insertions=await upload({edges:[{source:"A",target:"C",weight:1}]},"application/vnd.candy.updates+json"),deletions=await upload({edges:[]},"application/vnd.candy.updates+json");
  const descriptor=await upload({schemaVersion:"candy.graph-update-batch/1",updateBatchId:"updates",baseGraphRef:base.graphRef,insertionsArtifactRef:insertions,deletionsArtifactRef:deletions,semantics:{ordering:"DELETE_THEN_INSERT",duplicatePolicy:"REJECT",conflictPolicy:"REJECT"}},"application/vnd.candy.updates+json");
  const prior=await upload({schemaVersion:"candy.property-state/1",sessionId:"prior",graphId:snapshot.graphId,graphVersion:1,algorithmStateVersion:1,sourceVertexId:"A",objective:"cost",distances:[0,1,3],parents:[-1,0,1]},"application/vnd.candy.state+json");
  const incremental={...payload,request:{...base,requestId:randomUUID(),mode:"INCREMENTAL",propertyStateRef:{sessionId:"prior",graphId:snapshot.graphId,graphVersion:1,algorithmStateVersion:1},updateBatchRef:{updateBatchId:"updates",baseGraphId:snapshot.graphId,baseGraphVersion:1}},propertyStateArtifactId:prior.id,updateBatchArtifactId:descriptor.id};
  const second=await client.submitJob(incremental);assert.equal((await terminal(second)).status,"completed");const delta=await client.getResult(second.jobId);assert.ok(delta.modelSummary.affectedCount>0);report.cases.push({id:"incremental",jobId:second.jobId,backend:delta.backend,affectedCount:delta.modelSummary.affectedCount});
  const cancelled=await client.submitJob({...payload,request:{...base,requestId:randomUUID()}});await client.cancelJob(cancelled.jobId);await client.cancelJob(cancelled.jobId);assert.equal((await terminal(cancelled)).status,"cancelled");await assert.rejects(client.getResult(cancelled.jobId));report.cases.push({id:"repeated-cancel",resultAccepted:false});
  report.cudaUnavailableOpenmpExplicitlyAvailable=true;report.implicitCudaFallback=false;report.platform=ready.platform;report.status="OPENMP_RUNTIME_REGRESSION_PASS";
}catch(error){report.status="OPENMP_RUNTIME_REGRESSION_FAIL";report.error=error.stack;process.exitCode=1;console.error(error.message);}
finally{child.send("close");await new Promise(resolve=>child.once("exit",resolve));await writeFile(new URL("../../artifacts/candy-scope4c-openmp-runtime-regression.json",import.meta.url),JSON.stringify(report,null,2)+"\n");console.log(report.status);}
