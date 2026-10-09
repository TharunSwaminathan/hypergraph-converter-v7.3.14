// Real local model, production bounded orchestrator/controllers, actual Runtime.
// Controller evidence only; no claim of visible browser/Assistant panel evidence.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { startCandyRuntime } from '../src/server.js';
import { createCandyClient } from '../../src/candy/client.js';
import { intersectCandyCapabilities } from '../../src/candy/capabilityDiscovery.js';
import { createMotifAnalysisController } from '../../src/candy/motifAnalysisController.js';
import { motifPreflight } from '../../src/candy/motifPreflight.js';
import { createGraphState,commitGraphState,graphIdentityFromState } from '../../src/graph/graphState.js';
import { createPendingHypergraphUpdateController } from '../../src/graph/pendingHypergraphUpdate.js';
import { createDynamicUpdateControls } from '../../src/graph/dynamicUpdateControls.js';
import { createMutationPlan } from '../../src/graph/graphMutationValidator.js';
import { buildAuthoritativeOrchestratorObservation } from '../../src/agent/orchestratorObservation.js';
import { buildReactOrchestratorRequest } from '../../src/agent/reactOrchestrator.js';
import { runBoundedOrchestrator } from '../../src/agent/orchestratorLoop.js';
import { authorizeDynamicUpdateAction } from '../../src/agent/dynamicUpdatePolicy.js';
import { authorizeCandyReactAction } from '../../src/agent/candyActionAuthorization.js';
import { DEFAULT_LOCAL_MODEL_TIMEOUT_MS,LOCAL_MODEL_KEEP_ALIVE } from '../../src/agent/localModelSettings.js';

const report={schemaVersion:'candy.scope5f-assistant/1',evidenceKind:'INSTALLED_MODEL_PRODUCTION_ORCHESTRATOR_CONTROLLER_REAL_RUNTIME',visibleBrowser:false,cases:[]};
let runtime,analysis,pending;
try {
  const version=await (await fetch('http://127.0.0.1:11434/api/version')).json();
  const tags=await (await fetch('http://127.0.0.1:11434/api/tags')).json();
  const model=tags.models.find(m=>m.name==='qwen3:8b');assert.ok(model);
  report.model={name:model.name,digest:model.digest,version:version.version,details:model.details};
  runtime=await startCandyRuntime({port:0});let jobs=0,commits=0;
  const real=createCandyClient({baseUrl:`http://127.0.0.1:${runtime.port}`,token:runtime.pairingToken,fetchImpl:(url,options)=>fetch(url,{...options,headers:{...options.headers,Origin:'http://localhost:5173'}})});
  const client={...real,async submitJob(value){jobs++;return real.submitJob(value);}};
  const declaration=await client.capabilities();
  const contextRuntime={featureEnabled:true,authorized:true,runtimeSessionId:declaration.runtimeSessionId,capabilities:intersectCandyCapabilities(declaration,{authorized:true,graphType:'DynamicHypergraph'}).capabilities};
  let graph=createGraphState([['h1',['a','b']],['h2',['b','c']],['h3',['b','d']]].map(([id,vertices])=>({id,vertices,time:null,weight:1,attributes:{}})),{graphType:'DynamicHypergraph'});
  pending=createPendingHypergraphUpdateController({getGraphState:()=>graph,commit:(edges,options)=>{graph=commitGraphState(graph,edges,options);commits++;return graph;}});
  analysis=createMotifAnalysisController({getContext:()=>({graph,pendingUpdate:pending.getCurrent(),runtime:contextRuntime}),getClient:()=>client});
  const args=()=>({mode:'INCREMENTAL',backend:'CUDA_INCREMENTAL',deviceId:0,timeoutMs:5000,updateContextId:pending.getCurrent()?.updateId});
  const candy=()=>({state:{...contextRuntime,analysisStatus:analysis.getSnapshot().status,selectedJob:analysis.getSnapshot().job,resultEvidence:analysis.currentResult(),incrementalAvailability:motifPreflight({graph,pendingUpdate:pending.getCurrent(),runtime:contextRuntime,argumentsValue:args()})},actions:{stageMotifAnalysis:analysis.stage,submitFromAssistant:analysis.submit}});
  const controls=createDynamicUpdateControls({pendingController:pending,getGraphState:()=>graph,getCandy:candy});
  async function stage(hyperedgeId='h2'){return controls.stagePlan(createMutationPlan({graphIdentity:graphIdentityFromState(graph),operations:[{type:'REMOVE_HYPEREDGE',hyperedgeId}],summary:'Assistant live qualification'}));}
  const observe=lastToolResult=>buildAuthoritativeOrchestratorObservation({state:{...graphIdentityFromState(graph),hasGraph:true,pendingDynamicUpdate:controls.observe(),candy:{...candy().state,status:'ready',capabilityStatus:'ready',pendingUpdateContext:pending.getCurrent()?{updateId:pending.getCurrent().updateId,baseGraphRef:pending.getCurrent().baseGraphRef,nextGraphVersion:pending.getCurrent().nextGraphVersion}:null}},lastToolResult});
  async function ask(id,query,expected) {
    const outputs=[];let staged;
    const before=JSON.stringify(graph),beforeJobs=jobs,beforeCommits=commits;
    const result=await runBoundedOrchestrator({userQuery:query,getObservation:observe,
      callModel:async({observation})=>{
        const request=buildReactOrchestratorRequest({userQuery:query,observation});
        const res=await fetch('http://127.0.0.1:11434/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:model.name,stream:false,think:false,keep_alive:LOCAL_MODEL_KEEP_ALIVE,messages:request.messages,format:request.responseSchema,options:{temperature:0}}),signal:AbortSignal.timeout(DEFAULT_LOCAL_MODEL_TIMEOUT_MS)});
        assert.ok(res.ok);const output=await res.json();outputs.push({raw:output.message.content,done:output.done,promptChars:request.promptChars});return {ok:true,raw:output.message.content,promptChars:request.promptChars};
      },
      authorizeAction:({action,observation})=>action.includes('DYNAMIC_HYPERGRAPH')?authorizeDynamicUpdateAction(action,query):authorizeCandyReactAction(action,query,observation),
      stageConfirmation:({action,arguments:value})=>{
        staged=action==='APPLY_DYNAMIC_HYPERGRAPH_UPDATE'?controls.requestApply(value):action==='ANALYZE_DYNAMIC_HYPERGRAPH_UPDATE'?controls.requestAnalysis(value):analysis.stage(value);
        return staged;
      },executeAction:({action,arguments:value})=>{assert.equal(action,'DISCARD_DYNAMIC_HYPERGRAPH_UPDATE');return controls.discard(value);}});
    const item={id,query,result,outputs,graphUnchanged:JSON.stringify(graph)===before,newJobs:jobs-beforeJobs,commits:commits-beforeCommits};report.cases.push(item);
    assert.equal(item.graphUnchanged,true);assert.equal(item.newJobs,0);assert.equal(item.commits,0);assert.ok(result.ok,JSON.stringify(item));assert.ok(result.metrics.iterations<=8);assert.ok(result.metrics.actionsExecuted<=1);
    if(expected==='confirmation'){assert.equal(result.stopReason,'confirmation');assert.ok(staged?.confirmation);}else assert.equal(result.lastToolResult.action,expected);
    return {result,staged,item};
  }
  await stage();const delta=await ask('model-incremental','Run incremental motif analysis.','confirmation');
  const selector=delta.staged.argumentsValue??delta.result.step.arguments;
  const submitted=await analysis.submit(selector,delta.staged.confirmation);assert.ok(submitted.ok);assert.equal(commits,0);
  let remote;for(let i=0;i<1200;i++){remote=await client.getJob(submitted.job.jobId);if(['completed','failed','cancelled'].includes(remote.status))break;await new Promise(r=>setTimeout(r,40));}
  assert.equal(remote.status,'completed',JSON.stringify(remote));assert.ok((await analysis.openResult(remote.jobId)).ok);assert.ok(analysis.currentResult());
  delta.item.liveRuntime={jobId:remote.jobId,result:analysis.currentResult().result,graphCommits:commits};
  const apply=await ask('model-separate-apply','Apply the pending update.','confirmation');const beforeJobs=jobs;
  await controls.confirmApply(apply.staged.confirmation);assert.equal(commits,1);assert.equal(jobs,beforeJobs);assert.equal(analysis.currentResult(),null);assert.equal(pending.getCurrent(),null);
  apply.item.confirmedApply={commits:1,newJobs:0,resultNotCurrent:true};
  await stage('h1');await ask('model-discard','Discard the pending update.','DISCARD_DYNAMIC_HYPERGRAPH_UPDATE');assert.equal(pending.getCurrent(),null);
  report.status='PASS';report.runtimeSessionId=declaration.runtimeSessionId;report.jobs=jobs;report.commits=commits;
} catch(error){report.status='FAIL';report.error=error.stack;process.exitCode=1;console.error(error.stack);}
finally{analysis?.dispose();pending?.dispose();await runtime?.close();report.finishedAt=new Date().toISOString();await writeFile(new URL('../../artifacts/candy-scope5f-assistant-qualification.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(`Scope5F installed model/controller: ${report.status}`);}
