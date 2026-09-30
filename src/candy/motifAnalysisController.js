import { motifSelectorErrors, prepareBrowserMotifRequest, submitMotifWorkflow } from "./motifWorkflow.js";
import { motifApplicationBinding, motifAuthorityKey, motifGraphValue, motifPreflight } from "./motifPreflight.js";
import { createMotifResultRegistry } from "./motifResultRegistry.js";
import { boundedCandyJobObservation } from "./resultObservation.js";
import { CONFIRMATION_TTL_MS } from "../agent/confirmationState.js";

export const MOTIF_ANALYSIS_ACTION = "run_candy_expensive_compute";
export const MOTIF_ANALYSIS_STATUS = Object.freeze({ NONE:"NONE", CONFIRMATION_REQUIRED:"CONFIRMATION_REQUIRED", STAGED:"STAGED", RUNNING:"RUNNING", RESULT_READY:"RESULT_READY", FAILED:"FAILED", CANCELLED:"CANCELLED", STALE:"STALE" });
const fail = (code, message) => { throw Object.assign(new Error(message), {code}); };
const rejected = error => ({ok:false,classification:error.code ?? error.classification ?? "ALGORITHM_FAILURE",error:error.message,workspaceMutated:false});

// One volatile analysis owner, independent of the Scope 5B Apply controller.
export function createMotifAnalysisController({ getContext, getClient }) {
  const registry = createMotifResultRegistry(), listeners = new Set();
  let state=Object.freeze({status:"NONE",job:null,resultEvidence:null,lastError:null});
  let epoch=0, active=true, approval=null, jobBinding=null, currentKey=null;
  const emit = patch => { state=Object.freeze({...state,...patch}); for (const listener of listeners) listener(); };
  const context = () => {
    const value=getContext();
    const applicationBinding=motifApplicationBinding(value.graph,value.pendingUpdate);
    return {...value,applicationBinding,key:motifAuthorityKey(applicationBinding)};
  };
  const isCurrent = (captured, generation) => active && epoch===generation
    && context().key===captured.key && context().runtime.runtimeSessionId===captured.runtime.runtimeSessionId
    && context().runtime.authorized;
  const cancelBestEffort = binding => {
    if (binding?.jobId) void Promise.resolve().then(()=>binding.client.cancelJob(binding.jobId)).catch(()=>{});
  };
  const invalidate = (status="STALE") => {
    epoch++; approval=null; registry.clear(); cancelBestEffort(jobBinding); jobBinding=null; currentKey=null;
    emit({status,job:null,resultEvidence:null,lastError:null});
  };
  const requireJob = jobId => {
    if (!jobBinding || jobBinding.jobId!==jobId) fail("STALE_GRAPH_VERSION","No current authority exists for this job.");
    if (!isCurrent(jobBinding.context,jobBinding.epoch)) {
      invalidate(); fail("STALE_GRAPH_VERSION","This job no longer has current application/session authority.");
    }
    return jobBinding;
  };
  const checkJob = (value, binding) => {
    const expected=binding.binding;
    if (value.jobId!==expected.jobId || value.algorithm!==expected.algorithm || value.backend!==expected.backend
      || value.mode!==expected.mode || JSON.stringify(value.graphRef)!==JSON.stringify(expected.graphRef))
      fail("RESULT_VALIDATION_FAILURE","Job observation differs from the exact authorized job.");
  };
  const controller = {
    subscribe(listener) { listeners.add(listener); return ()=>listeners.delete(listener); },
    getSnapshot:()=>state,
    availability(argumentsValue) { const c=context(); return motifPreflight({graph:c.graph,pendingUpdate:c.pendingUpdate,argumentsValue,runtime:c.runtime}); },
    synchronize() { if (currentKey && (currentKey!==context().key || jobBinding && !isCurrent(jobBinding.context,jobBinding.epoch)
      || approval && !isCurrent(approval.context,approval.epoch))) invalidate(); },
    invalidate,
    activate() { active=true; },
    dispose() { active=false; invalidate(); listeners.clear(); },
    stage(argumentsValue) {
      try {
        if (!active) fail("STALE_GRAPH_VERSION","The analysis owner is unmounted.");
        if (motifSelectorErrors(argumentsValue).length) fail("INVALID_GRAPH_SCHEMA","Only bounded qualified motif selectors are accepted.");
        const c=context(), preflight=controller.availability(argumentsValue);
        if (!preflight.ok) fail(preflight.classification,preflight.message);
        // Exact packed feasibility follows cheap counts, before approval or upload.
        prepareBrowserMotifRequest(motifGraphValue(c.graph),c.pendingUpdate?.motifUpdate,argumentsValue);
        invalidate("CONFIRMATION_REQUIRED"); currentKey=c.key;
        const token=Object.freeze({id:crypto.randomUUID(),actionType:MOTIF_ANALYSIS_ACTION,
          ...c.applicationBinding,...argumentsValue,runtimeSessionId:c.runtime.runtimeSessionId,
          createdAt:Date.now(),expiresAt:Date.now()+CONFIRMATION_TTL_MS});
        approval={token,argumentsValue:Object.freeze({...argumentsValue}),context:c,epoch};
        return {ok:true,confirmation:token,workspaceMutated:false,nativeJobCreated:false};
      } catch(error) { return rejected(error); }
    },
    async submit(argumentsValue, confirmation) {
      let captured, generation;
      try {
        if (!approval || approval.token!==confirmation || confirmation.actionType!==MOTIF_ANALYSIS_ACTION
          || Date.now()>confirmation.expiresAt || motifSelectorErrors(argumentsValue).length
          || JSON.stringify(argumentsValue)!==JSON.stringify(approval.argumentsValue)
          || !isCurrent(approval.context,approval.epoch)) fail("STALE_CONFIRMATION","A fresh exact analysis confirmation is required. Apply approval cannot analyze.");
        captured=approval.context; generation=approval.epoch; approval=null;
        const preflight=controller.availability(argumentsValue);
        if (!preflight.ok) fail(preflight.classification,preflight.message);
        emit({status:"STAGED",lastError:null});
        const client=getClient();
        const accepted=await submitMotifWorkflow({client,graphValue:motifGraphValue(captured.graph),pendingUpdate:captured.pendingUpdate?.motifUpdate,
          argumentsValue,runtimeSessionId:captured.runtime.runtimeSessionId,applicationBinding:captured.applicationBinding,isCurrent:()=>isCurrent(captured,generation)});
        if (!isCurrent(captured,generation)) { cancelBestEffort({...accepted.binding,client}); fail("STALE_GRAPH_VERSION","Analysis changed before job attachment."); }
        jobBinding={...accepted.binding,binding:accepted.binding,client,context:captured,epoch:generation};
        emit({status:"RUNNING",job:boundedCandyJobObservation(accepted.job),resultEvidence:null});
        return {ok:true,job:state.job,nativeJobCreated:true,workspaceMutated:false};
      } catch(error) {
        if (generation!==undefined && generation===epoch) {
          if (!isCurrent(captured,generation)) invalidate();
          else emit({status:"FAILED",lastError:{classification:error.code ?? error.classification,message:error.message}});
        }
        return {...rejected(error),nativeJobCreated:false};
      }
    },
    async getJobStatus(jobId) {
      try {
        const binding=requireJob(jobId);
        const job=await binding.client.getJob(jobId); requireJob(jobId); checkJob(job,binding);
        const observation=boundedCandyJobObservation(job);
        if (["failed","cancelled"].includes(job.status)) {
          jobBinding=null; approval=null; registry.clear();
          emit({status:job.status==="cancelled"?"CANCELLED":"FAILED",job:observation,resultEvidence:null,lastError:job.error ?? null});
        } else emit({job:observation});
        return {ok:true,job:observation,workspaceMutated:false};
      } catch(error) { return rejected(error); }
    },
    async cancelJob(jobId) {
      try {
        const binding=requireJob(jobId);
        // Revoke locally before awaiting the companion; late success is inert.
        epoch++; jobBinding=null; approval=null; registry.clear();
        const generation=epoch;
        emit({status:"CANCELLED",resultEvidence:null,job:state.job?{...state.job,status:"cancelled"}:null});
        await binding.client.cancelJob(jobId);
        return {ok:true,job:generation===epoch?state.job:{jobId,status:"cancelled"},workspaceMutated:false};
      } catch(error) { return rejected(error); }
    },
    async openResult(jobId) {
      let binding;
      try {
        binding=requireJob(jobId);
        const job=await binding.client.getJob(jobId); requireJob(jobId); checkJob(job,binding);
        if (job.status!=="completed") {
          if (["failed","cancelled"].includes(job.status)) {
            jobBinding=null; approval=null; registry.clear();
            emit({status:job.status==="cancelled"?"CANCELLED":"FAILED",job:boundedCandyJobObservation(job),resultEvidence:null,lastError:job.error ?? null});
          }
          fail(job.error?.classification ?? "RESULT_VALIDATION_FAILURE","Only a completed current job can supply a result.");
        }
        const result=await binding.client.getResult(jobId); requireJob(jobId);
        const evidence=await registry.accept(result,binding.binding,()=>isCurrent(binding.context,binding.epoch) && jobBinding===binding);
        requireJob(jobId);
        emit({status:"RESULT_READY",resultEvidence:evidence,job:boundedCandyJobObservation(evidence.result)});
        return {ok:true,observation:state.job,workspaceMutated:false};
      } catch(error) {
        if (binding && jobBinding===binding) { registry.clear(); jobBinding=null; emit({status:"FAILED",resultEvidence:null,lastError:{classification:error.code ?? error.classification,message:error.message}}); }
        return rejected(error);
      }
    },
    currentResult(authority = null) { return active ? registry.getCurrent(authority ?? {applicationBinding:context().applicationBinding,runtimeSessionId:context().runtime.runtimeSessionId}) : null; },
  };
  return Object.freeze(controller);
}
