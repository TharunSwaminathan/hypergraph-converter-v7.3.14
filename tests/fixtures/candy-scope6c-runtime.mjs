import { mkdtemp,readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ArtifactStore } from '../../candy-runtime/src/artifacts/artifactStore.js';
import { JobManager } from '../../candy-runtime/src/jobs/jobManager.js';
import { createRuntimeConfig } from '../../candy-runtime/src/config.js';
export const graph={graphType:'OrdinaryGraph',directed:true,vertices:['A'],edges:[]};
export function nativeResult(graphId='scope6c') {return {schemaVersion:'candy.native-sssp-result/1',ok:true,algorithm:'SSSP',mode:'STATIC',graphId,graphVersion:1,source:0,vertexCount:1,reachableCount:1,unreachableCount:0,affectedVertices:0,validation:{status:'not_requested'},metrics:{},distances:[0],parents:[-1]};}
export async function payload(store,id='scope6c') {
 const artifact=await store.put(Buffer.from(JSON.stringify(graph)),'application/vnd.candy.graph+json');
 const graphSnapshot={schemaVersion:'candy.graph-snapshot/1',graphId:id,graphVersion:1,graphType:'OrdinaryGraph',directed:true,weightModel:{kind:'nonnegative_integer',objectives:['cost']},vertexCount:1,edgeCount:0,canonicalArtifactRef:artifact,provenance:{}};
 const request={schemaVersion:'candy.algorithm-request/1',requestId:crypto.randomUUID(),capability:'RUN_SSSP',algorithm:'SSSP',algorithmVersion:'scope1-openmp-sssp/1',mode:'STATIC',backend:'LOCAL_OPENMP',graphRef:{graphId:id,graphVersion:1},parameters:{sourceVertexId:'A',objective:'cost'},resourceHints:{threads:1,timeoutMs:1000}};
 return {schemaVersion:'candy.job-submit/1',request,graphSnapshot,graphArtifactId:artifact.id};
}
export async function terminal(manager,id) {for(let i=0;i<1000;i++){const job=manager.jobs.get(id);if(!job || job.finished)return manager.get(id);await new Promise(r=>setTimeout(r,2));}throw Error('Fixture job did not drain');}
export async function fixture(limits={}) {
 const root=await mkdtemp(join(tmpdir(),'candy-scope6c-test-'));
 const store=await new ArtifactStore({root,maxBytes:4096,maxArtifacts:32,maxTotalBytes:128*1024}).initialize();
 const state={mode:'success',calls:0,concurrent:0,peak:0,gate:null};
 const runner={async run({requestPath,signal}){
   state.calls++;state.concurrent++;state.peak=Math.max(state.peak,state.concurrent);
   const mode=state.mode;
   try {
     if(mode==='hold')await new Promise((resolve,reject)=>{state.gate=resolve;signal.addEventListener('abort',()=>reject(Object.assign(Error('cancelled'),{code:'JOB_CANCELLED'})),{once:true});});
     if(mode==='crash')return {stdout:'{}',exitCode:1};
     if(mode==='throw')throw Error('Fixture failure');
     const text=await readFile(requestPath,'utf8');const id=/^graph_id (.+)$/m.exec(text)[1];
     return {stdout:JSON.stringify(nativeResult(id)),exitCode:0};
   }finally{state.concurrent--;}
 }};
 const config=createRuntimeConfig({backendAvailable:true,nativeRunner:runner,limits:{maxJobs:16,maxActiveJobs:4,maxTerminalJobs:3,...limits}});
 const manager=new JobManager({artifactStore:store,config});
 return {root,store,manager,state,config,async dispose(){await manager.close();await store.dispose();}};
}
