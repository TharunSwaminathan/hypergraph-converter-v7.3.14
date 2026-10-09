import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { startCandyRuntime } from '../src/server.js';
import { createCandyClient } from '../../src/candy/client.js';
import { intersectCandyCapabilities } from '../../src/candy/capabilityDiscovery.js';
import { createGraphState, commitGraphState, graphIdentityFromState } from '../../src/graph/graphState.js';
import { createMotifAnalysisController } from '../../src/candy/motifAnalysisController.js';
import { collisionA, collisionB } from '../../tests/fixtures/candy-scope5f-collision.mjs';

const beforeFix=process.argv.includes('--before-fix');
const report={schemaVersion:'candy.scope5f-collision/1',evidenceKind:'REAL_RUNTIME_CUDA_PRODUCTION_CONTROLLERS',visibleBrowser:false,beforeFix,oldGraph:collisionA,replacementGraph:collisionB};
const runtime=await startCandyRuntime({port:0});
try {
  const client=createCandyClient({baseUrl:`http://127.0.0.1:${runtime.port}`,token:runtime.pairingToken,
    fetchImpl:(url,opts)=>fetch(url,{...opts,headers:{...opts.headers,Origin:'http://localhost:5173'}})});
  const declaration=await client.capabilities(),capabilities=intersectCandyCapabilities(declaration,{authorized:true,graphType:'Hypergraph'}).capabilities;
  let graph=createGraphState(structuredClone(collisionA));
  const state={featureEnabled:true,authorized:true,runtimeSessionId:declaration.runtimeSessionId,capabilities};
  const analysis=createMotifAnalysisController({getContext:()=>({graph,pendingUpdate:null,runtime:state}),getClient:()=>client});
  const selector={mode:'STATIC',backend:'CUDA_STATIC',deviceId:0,timeoutMs:5000};
  async function run(){const staged=analysis.stage(selector);assert.ok(staged.ok,JSON.stringify(staged));const submitted=await analysis.submit(selector,staged.confirmation);assert.ok(submitted.ok);for(let i=0;i<1000;i++){const job=await analysis.getJobStatus(submitted.job.jobId);assert.ok(job.ok);if(job.job.status==='completed')break;assert.notEqual(job.job.status,'failed',JSON.stringify(job));await new Promise(r=>setTimeout(r,20));}assert.ok((await analysis.openResult(submitted.job.jobId)).ok);return analysis.currentResult();}
  const result=await run();report.oldAuthority=graphIdentityFromState(graph);report.oldResult=result;
  graph=commitGraphState(graph,structuredClone(collisionB),{replacement:true});report.replacementAuthority=graphIdentityFromState(graph);
  assert.equal(report.oldAuthority.graphFingerprint,graph.graphFingerprint);assert.notDeepEqual(collisionA,collisionB);
  report.oldResultCurrentAfterReplacement=Boolean(analysis.currentResult());
  const reopened=await analysis.openResult(result.jobId);report.oldResultCanBeSelected=reopened.ok;
  if(beforeFix){assert.ok(report.oldResultCurrentAfterReplacement);assert.ok(reopened.ok);assert.equal(graph.graphId,report.oldAuthority.graphId);assert.equal(graph.graphVersion,report.oldAuthority.graphVersion);}
  else{assert.equal(report.oldResultCurrentAfterReplacement,false);assert.equal(reopened.ok,false);assert.notEqual(graph.graphId,report.oldAuthority.graphId);assert.equal(graph.graphVersion,report.oldAuthority.graphVersion+1);}
  const newResult=await run();report.replacementResult=newResult;
  assert.equal(result.result.native.totalConnectedTriples,1);assert.equal(newResult.result.native.totalConnectedTriples,0);
  report.status=beforeFix?'DEFECT_REPRODUCED':'CORRECTION_PASS';analysis.dispose();
} catch(error){report.status='QUALIFICATION_FAIL';report.error=error.stack;process.exitCode=1;console.error(error.stack);}
finally{await runtime.close();await writeFile(new URL(`../../artifacts/candy-scope5f-collision-${beforeFix?'before':'after'}.json`,import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(report.status);}
