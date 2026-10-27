import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {join} from 'node:path';
const extraction=JSON.parse(await readFile(new URL('./extraction.json',import.meta.url),'utf8'));
const {startCandyRuntime}=await import(pathToFileURL(join(extraction.root,'candy-runtime/src/server.js')));
const {createCandyClient}=await import(pathToFileURL(join(extraction.root,'src/candy/client.js')));
const {countHypergraphThreeEdgeMotifs}=await import(pathToFileURL(join(extraction.root,'src/candy/hypergraphMotifs/referenceOracle.js')));
const {ALL_30_MOTIF_WITNESSES}=await import(pathToFileURL(join(extraction.root,'tests/fixtures/candy-scope4-motifs.mjs')));
const report={baseline:extraction.baseline,root:extraction.root,startedAt:new Date().toISOString(),purpose:'Bounded diagnosis of first failed V5 hard gate; no corrective applied',cleanShutdown:false};
let runtime;
try {
 runtime=await startCandyRuntime({port:0});const base=`http://127.0.0.1:${runtime.port}`;
 const client=createCandyClient({baseUrl:base,token:runtime.pairingToken});
 report.health=await client.health();report.capabilities=await client.capabilities();
 const graph=ALL_30_MOTIF_WITNESSES[0].graph;
 report.cpuReference=countHypergraphThreeEdgeMotifs(graph);assert.deepEqual(report.cpuReference.counts,[1,...Array(29).fill(0)]);
 report.uploadedArtifact=await client.uploadArtifact({bytes:graph,mediaType:'application/vnd.candy.graph+json'});
 try{report.clientMetadata=await client.getArtifactMetadata(report.uploadedArtifact.id);report.clientUnexpectedlySucceeded=true;}
 catch(error){report.clientError={name:error.name,classification:error.classification,message:error.message,details:error.details};}
 const encoded=`/v1/artifacts/${encodeURIComponent(report.uploadedArtifact.id)}/metadata`;
 const literal=`/v1/artifacts/${report.uploadedArtifact.id}/metadata`;
 report.requests=[];
 for(const path of [encoded,literal]) {
  const response=await fetch(base+path,{headers:{Authorization:`Bearer ${runtime.pairingToken}`}});
  report.requests.push({method:'GET',path,httpStatus:response.status,body:await response.json()});
 }
 assert.equal(report.requests[0].httpStatus,404);assert.equal(report.requests[0].body.message,'Unknown runtime route.');
 assert.equal(report.requests[1].httpStatus,200);assert.equal(report.requests[1].body.id,report.uploadedArtifact.id);
 assert.equal(report.clientError.details.httpStatus,404);
 report.status='REPRODUCED_PRODUCT_CONTRACT_MISMATCH';
}catch(error){report.status='DIAGNOSIS_INCOMPLETE';report.diagnosticError={name:error.name,message:error.message};process.exitCode=1;}
finally {
 if(runtime)try{await runtime.close();report.cleanShutdown=true;}catch(error){report.shutdownError=error.message;process.exitCode=1;}
 report.finishedAt=new Date().toISOString();await writeFile(new URL('./extracted-metadata-route-repro.json',import.meta.url),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
}
console.log(JSON.stringify({status:report.status,requests:report.requests?.map(x=>({path:x.path,httpStatus:x.httpStatus})),clientError:report.clientError,cleanShutdown:report.cleanShutdown}));
