import assert from 'node:assert/strict';
import { readFile,writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
const extraction=JSON.parse(await readFile(new URL('./extraction.json',import.meta.url),'utf8'));
const root=extraction.root;
const {startCandyRuntime}=await import(pathToFileURL(join(root,'candy-runtime/src/server.js')));
const {createCandyClient}=await import(pathToFileURL(join(root,'src/candy/client.js')));
const {countHypergraphThreeEdgeMotifs}=await import(pathToFileURL(join(root,'src/candy/hypergraphMotifs/referenceOracle.js')));
const {ALL_30_MOTIF_WITNESSES}=await import(pathToFileURL(join(root,'tests/fixtures/candy-scope4-motifs.mjs')));
const report={baseline:extraction.baseline,root,startedAt:new Date().toISOString(),privateStateInjected:false,injectedDiscovery:false,injectedRunner:false,cleanShutdown:false};
let runtime;
try {
 runtime=await startCandyRuntime({port:0});
 const client=createCandyClient({baseUrl:`http://127.0.0.1:${runtime.port}`,token:runtime.pairingToken});
 report.health=await client.health();assert.equal(report.health.runtimeStatus,'ready');
 report.declaration=await client.capabilities();
 for(const backend of ['CUDA_STATIC','CUDA_INCREMENTAL']) {
  assert.equal(report.declaration.capabilities.some(c=>c.backend===backend),false);
  assert.equal(report.declaration.motifReadiness.find(c=>c.backend===backend).status,'UNAVAILABLE');
 }
 const graph=ALL_30_MOTIF_WITNESSES[0].graph;
 const artifact=await client.uploadArtifact({bytes:graph,mediaType:'application/vnd.candy.graph+json'});
 report.normalArtifactMetadata=await client.getArtifactMetadata(artifact.id);assert.equal(report.normalArtifactMetadata.id,artifact.id);
 report.cpuBrowserSafeReference=countHypergraphThreeEdgeMotifs(graph);assert.deepEqual(report.cpuBrowserSafeReference.counts,[1,...Array(29).fill(0)]);
 const anonymous=createCandyClient({baseUrl:client.baseUrl,token:'invalid-session-only-proof'});
 await assert.rejects(anonymous.capabilities(),e=>e.classification==='UNAUTHORIZED');report.authenticationEnforced=true;
 report.truthfulCudaFailClosed=true;report.status='PASS';
}catch(error){report.status='NON-PASS';report.error={name:error.name,message:error.message};process.exitCode=1;}
finally {
 if(runtime)try{await runtime.close();report.cleanShutdown=true;}catch(error){report.status='NON-PASS';report.shutdownError=error.message;process.exitCode=1;}
 report.finishedAt=new Date().toISOString();await writeFile(new URL('./extracted-runtime.json',import.meta.url),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
}
console.log(JSON.stringify({status:report.status,readiness:report.declaration?.motifReadiness,cleanShutdown:report.cleanShutdown,error:report.error}));
