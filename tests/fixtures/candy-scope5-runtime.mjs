import { createHash } from "node:crypto";
import { createGraphState, graphIdentityFromState, commitGraphState } from "../../src/graph/graphState.js";
import { createMutationPlan } from "../../src/graph/graphMutationValidator.js";
import { createPendingHypergraphUpdateController } from "../../src/graph/pendingHypergraphUpdate.js";
import { createMotifAnalysisController } from "../../src/candy/motifAnalysisController.js";
import { packCudaMotifRequest } from "../../candy-runtime/test/hypergraph-motif-cuda-contract.mjs";
import { packCudaIncrementalRequest } from "../../candy-runtime/test/hypergraph-motif-cuda-incremental-contract.mjs";
import { acceptMotifNative } from "../../candy-runtime/src/backends/motifJobAdapter.js";
import { countHypergraphThreeEdgeMotifs } from "../../src/candy/hypergraphMotifs/referenceOracle.js";
import { MOTIF_ALGORITHM, MOTIF_TAXONOMY } from "../../src/candy/contracts/runtimeMotif.js";

export const artifactId = value => `sha256:${createHash("sha256").update(typeof value==="string"?value:JSON.stringify(value)).digest("hex")}`;
export function sealResult(result) { const {resultArtifactRef,...content}=result; return {...content,resultArtifactRef:{id:artifactId(content),mediaType:"application/vnd.candy.result+json"}}; }
export const edge=(id,vertices)=>({id,vertices,weight:1,time:null,attributes:{}});
export const selector=(pending,mode="INCREMENTAL")=>({mode,backend:mode==="STATIC"?"CUDA_STATIC":"CUDA_INCREMENTAL",deviceId:0,timeoutMs:5000,...(mode==="INCREMENTAL"?{updateContextId:pending.updateId}:{})});
export const qualifiedRuntime=()=>({featureEnabled:true,authorized:true,runtimeSessionId:"session-5c",capabilities:["STATIC","INCREMENTAL"].map(mode=>({algorithm:MOTIF_ALGORITHM,backend:mode==="STATIC"?"CUDA_STATIC":"CUDA_INCREMENTAL",modes:[mode],graphTypes:mode==="STATIC"?["Hypergraph","DynamicHypergraph"]:["DynamicHypergraph"],devices:[{id:0}]}))});

export async function harness({operations=[{type:"ADD_INCIDENCE",hyperedgeId:"h1",vertexId:"c"}]}={}) {
  let graph=createGraphState([edge("h1",["a","b"]),edge("h2",["b","c"]),edge("h3",["b","d"])],{graphType:"DynamicHypergraph"});
  let runtime=qualifiedRuntime(),commits=0,uploads=0,submissions=0,cancellations=0;
  const pending=createPendingHypergraphUpdateController({getGraphState:()=>graph,commit:(edges,options)=>{commits++;graph=commitGraphState(graph,edges,options);return graph;}});
  const stage=async ops=>pending.stage(createMutationPlan({graphIdentity:graphIdentityFromState(graph),operations:ops,summary:"5C test pending"}));
  await stage(operations);
  const artifacts=new Map();
  let payload=null,job=null,result=null;
  const client={
    async uploadArtifact({bytes,mediaType}) { uploads++; const id=artifactId(bytes); artifacts.set(id,structuredClone(bytes)); return {id,mediaType}; },
    async submitJob(value) {
      submissions++;payload=structuredClone(value);
      const request=payload.request;
      job={schemaVersion:"candy.job-status/1",jobId:`job-${submissions}`,algorithm:request.algorithm,backend:request.backend,mode:request.mode,graphRef:request.graphRef,status:"completed"};
      const graphValue=artifacts.get(payload.graphArtifactId),incremental=request.mode==="INCREMENTAL";
      const packed=incremental?packCudaIncrementalRequest(graphValue,artifacts.get(payload.updateBatchArtifactId),request.deviceId):packCudaMotifRequest(graphValue,request.deviceId);
      const cuda={deviceIndex:0,deviceName:"Qualified test device",computeMajor:12,computeMinor:0,compiledArchitecture:"sm_120",compilerVersion:"13.4.59",runtimeVersion:13040,driverVersion:13040,kernelLaunchSucceeded:true,synchronizationSucceeded:true,kernelMilliseconds:1};
      let native;
      if(incremental) {
        const old=packed.oldCandidateCount?countHypergraphThreeEdgeMotifs(packed.oldGraph).counts:Array(30).fill(0);
        const next=packed.newCandidateCount?countHypergraphThreeEdgeMotifs(packed.newGraph).counts:Array(30).fill(0);
        const delta=next.map((n,i)=>n-old[i]);
        native={ok:true,schemaVersion:"candy.hypergraph-motif-cuda-incremental-result/1",algorithm:MOTIF_ALGORITHM,taxonomyVersion:MOTIF_TAXONOMY,backend:request.backend,mode:request.mode,inputGraphRef:request.graphRef,outputGraphRef:{graphId:graphValue.graphId,graphVersion:request.updateRef.nextGraphVersion},updateId:request.updateRef.updateId,requestDigest:packed.digest,
          oldAffectedEdgeCount:packed.oldAffected.length,newAffectedEdgeCount:packed.newAffected.length,oldCandidateCount:packed.oldCandidateCount,newCandidateCount:packed.newCandidateCount,oldAffectedCounts:old,newAffectedCounts:next,deltaCounts:delta,deltaTotalConnectedTriples:delta.reduce((a,b)=>a+b,0),cuda};
      } else { const counted=countHypergraphThreeEdgeMotifs(graphValue); native={ok:true,schemaVersion:"candy.hypergraph-motif-cuda-static-result/1",algorithm:MOTIF_ALGORITHM,taxonomyVersion:MOTIF_TAXONOMY,backend:request.backend,mode:request.mode,inputGraphRef:request.graphRef,counts:counted.counts,totalConnectedTriples:counted.totalConnectedTriples,cuda}; }
      result=sealResult(acceptMotifNative({stdout:JSON.stringify(native),exitCode:0,fingerprint:artifactId("qualified-test-build")},packed,{jobId:job.jobId,request,payload},runtime.runtimeSessionId));
      return job;
    },
    async getJob(){return job;},async getResult(){return result;},async cancelJob(){cancellations++;return {...job,status:"cancelled"};},
  };
  const analysis=createMotifAnalysisController({getContext:()=>({graph,pendingUpdate:pending.getCurrent(),runtime}),getClient:()=>client});
  return {client,pending,analysis,stage,get graph(){return graph;},set graph(v){graph=v;},get runtime(){return runtime;},set runtime(v){runtime=v;},
    get result(){return result;},set result(v){result=v;},get job(){return job;},set job(v){job=v;},get payload(){return payload;},
    get counts(){return {commits,uploads,submissions,cancellations};},
    async run(mode="INCREMENTAL") {const args=selector(pending.getCurrent(),mode),staged=analysis.stage(args);if(!staged.ok)throw new Error(staged.error);return analysis.submit(args,staged.confirmation);},
  };
}
