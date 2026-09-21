import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";
import { writeFile } from "node:fs/promises";
import { buildReactOrchestratorRequest } from "../../src/agent/reactOrchestrator.js";
import { DEFAULT_LOCAL_MODEL_TIMEOUT_MS, LOCAL_MODEL_KEEP_ALIVE } from "../../src/agent/localModelSettings.js";
import { runBoundedOrchestrator } from "../../src/agent/orchestratorLoop.js";
import { createCandyClient } from "../../src/candy/client.js";
import { intersectCandyCapabilities } from "../../src/candy/capabilityDiscovery.js";
import { submitMotifWorkflow, validateBrowserMotifResult } from "../../src/candy/motifWorkflow.js";
import { ALL_30_MOTIF_WITNESSES, ANCHOR_OVER_SUBTRACTION_COUNTEREXAMPLE, ANCHOR_COUNTEREXAMPLE_DELETE } from "../../tests/fixtures/candy-scope4-motifs.mjs";

const report={schemaVersion:"candy.scope4c-live-ollama/1",status:"RUNNING",cases:[]};
const child=fork(fileURLToPath(new URL("./scope4c-live-server.mjs",import.meta.url)),[],{stdio:["ignore","pipe","pipe","ipc"]});
const ready=await new Promise((resolve,reject)=>{child.once("message",resolve);child.once("error",reject);child.once("exit",code=>reject(new Error(`Runtime startup failed: ${code}`)));});
const client=createCandyClient({baseUrl:`http://127.0.0.1:${ready.port}`,token:ready.pairingToken});
try {
  const version=await (await fetch("http://127.0.0.1:11434/api/version",{signal:AbortSignal.timeout(10000)})).json();
  const tags=await (await fetch("http://127.0.0.1:11434/api/tags",{signal:AbortSignal.timeout(10000)})).json();
  const model=tags.models.find(model=>model.name==="qwen3:8b");assert.ok(model,"Required installed qwen3:8b is missing");
  report.model={name:model.name,digest:model.digest,version:version.version,details:model.details};
  const declaration=await client.capabilities();
  async function caseRun(id,query,graph,update=null,{unavailable=false,inventedFirst=false}={}) {
    const intersection=intersectCandyCapabilities(declaration,{authorized:true,graphType:graph.graphType});
    const observation={graph:{available:true,id:graph.graphId,version:graph.graphVersion,graphType:graph.graphType,vertexCount:graph.vertices.length,edgeCount:graph.hyperedges.length},
      candy:{featureEnabled:true,authorized:true,capabilityStatus:unavailable?"unavailable":"ready",runtimeSessionId:declaration.runtimeSessionId,capabilities:unavailable?[]:intersection.capabilities,
        pendingUpdateContext:update?{updateId:update.updateId,baseGraphRef:update.baseGraphRef,nextGraphVersion:update.nextGraphVersion}:null,jobs:[]},
      availableCapabilities:unavailable?[]:["SUBMIT_CANDY_MOTIF_JOB"],stateVersionToken:`${id}-authoritative-context`,pendingConfirmation:null};
    const outputs=[];let proposed=null;
    const result=await runBoundedOrchestrator({userQuery:query,getObservation:async lastToolResult=>({...observation,lastToolResult}),
      callModel:async ({observation:current,stepIndex})=>{
        if(inventedFirst && stepIndex===0) return{ok:true,step:{outcome:"PROPOSE_ACTION",action:"SUBMIT_CANDY_MOTIF_JOB",arguments:{mode:"STATIC",backend:"CUDA_STATIC",deviceId:0,timeoutMs:5000,newGraph:{}},requiresUserInput:false,userMessage:null,finish:false}};
        const request=buildReactOrchestratorRequest({userQuery:query,observation:current});
        const response=await fetch("http://127.0.0.1:11434/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"qwen3:8b",stream:false,think:false,keep_alive:LOCAL_MODEL_KEEP_ALIVE,messages:request.messages,format:request.responseSchema,options:{temperature:0}}),signal:AbortSignal.timeout(DEFAULT_LOCAL_MODEL_TIMEOUT_MS)});
        assert.ok(response.ok,`Ollama HTTP ${response.status}`);
        const output=await response.json();outputs.push({raw:output.message.content,done:output.done,doneReason:output.done_reason,promptChars:request.promptChars});
        return{ok:true,raw:output.message.content,promptChars:request.promptChars};
      },stageConfirmation:async step=>{proposed=step;return{ok:true,outcome:"exact_cuda_confirmation_staged"};},
      executeAction:async()=>{throw new Error("CUDA action bypassed confirmation");}});
    const item={id,query,graphType:graph.graphType,syntheticInvalidFirstStep:inventedFirst,outcome:result.outcome,classification:result.classification??null,error:result.error??null,metrics:result.metrics,outputs,proposal:proposed?{action:proposed.action,arguments:proposed.arguments}:null,workspaceMutated:false};
    report.cases.push(item);
    if (["A_STATIC","B_INCREMENTAL","F_SCHEMA_RECOVERY"].includes(id)) {
      assert.equal(result.stopReason,"confirmation",JSON.stringify(item));assert.ok(proposed);assert.equal(proposed.action,"SUBMIT_CANDY_MOTIF_JOB");
      assert.equal(proposed.arguments.mode,update?"INCREMENTAL":"STATIC");
      // Scope4C explicitly authorizes these live qualification executions. The
      // product proposal above still stages confirmation and creates no job.
      const accepted=await submitMotifWorkflow({client,graphValue:graph,pendingUpdate:update,argumentsValue:proposed.arguments,runtimeSessionId:declaration.runtimeSessionId});
      let status;
      for(let i=0;i<400;i++){status=await client.getJob(accepted.job.jobId);if(["completed","failed","cancelled"].includes(status.status))break;await new Promise(resolve=>setTimeout(resolve,30));}
      assert.equal(status.status,"completed",JSON.stringify(status.error));
      const runtimeResult=await client.getResult(accepted.job.jobId);await validateBrowserMotifResult(runtimeResult,accepted.binding);
      item.liveRuntime={jobId:accepted.job.jobId,backend:runtimeResult.backend,mode:runtimeResult.mode,interpretation:runtimeResult.interpretation,validation:runtimeResult.validation,resultArtifactRef:runtimeResult.resultArtifactRef,cuda:runtimeResult.native.cuda};
    } else {assert.equal(result.metrics.modelCalls,0);assert.equal(result.outcome,"motif_request_rejected");}
    console.log(`${id}: ${result.outcome}, ${outputs.length} live Ollama responses`);
  }
  const graph=ALL_30_MOTIF_WITNESSES[0].graph;
  await caseRun("A_STATIC","Count the 3-edge motifs on the current hypergraph using CUDA.",graph);
  await caseRun("B_INCREMENTAL","How do the motif counts change if I apply this update?",ANCHOR_OVER_SUBTRACTION_COUNTEREXAMPLE,ANCHOR_COUNTEREXAMPLE_DELETE);
  await caseRun("C_ORDINARY","Count the 3-edge motifs on the current hypergraph using CUDA.",{...graph,graphType:"OrdinaryGraph"});
  await caseRun("D_HYPERGRAPH_INCREMENTAL","Run incremental motif analysis.",graph);
  await caseRun("E_UNAVAILABLE","Count the 3-edge motifs on the current hypergraph using CUDA.",graph,null,{unavailable:true});
  await caseRun("F_SCHEMA_RECOVERY","Count the 3-edge motifs on the current hypergraph using CUDA.",graph,null,{inventedFirst:true});
  await caseRun("G_PROJECTION","Project this and then count motifs.",graph);
  report.status="LIVE_OLLAMA_QUALIFICATION_PASS";
} catch(error){report.status="LIVE_OLLAMA_QUALIFICATION_FAIL";report.error=error.stack;process.exitCode=1;console.error(error.message);}
finally {child.send("close");await new Promise(resolve=>child.once("exit",resolve));await writeFile(new URL("../../artifacts/candy-scope4c-live-ollama-qualification.json",import.meta.url),JSON.stringify(report,null,2)+"\n");console.log(report.status);}
