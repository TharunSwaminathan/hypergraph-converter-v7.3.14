import { canonicalizeHypergraphIncidence } from "./adapters/hypergraphIncidenceAdapter.js";
import { applyHypergraphMotifUpdate } from "./adapters/hypergraphUpdateAdapter.js";
import { MOTIF_ALGORITHM, MOTIF_BACKENDS, MOTIF_TAXONOMY, MOTIF_RUNTIME_REQUEST, MOTIF_RUNTIME_RESULT } from "./contracts/runtimeMotif.js";
import { CANDY_ERROR_CODES, CandyContractError } from "./contracts/errorClasses.js";

export function motifSelectorErrors(value = {}) {
  const keys=["mode","backend","deviceId","timeoutMs","updateContextId"];
  const errors=Object.keys(value).filter(key=>!keys.includes(key)).map(key=>`arguments.${key} is not allowed for motif analysis.`);
  if (!Object.hasOwn(MOTIF_BACKENDS,value.mode) || value.backend !== MOTIF_BACKENDS[value.mode]) errors.push("Motif mode and backend must match exactly.");
  if (!Number.isSafeInteger(value.deviceId) || value.deviceId < 0 || value.deviceId > 255) errors.push("deviceId must be a discovered qualified integer.");
  if (!Number.isSafeInteger(value.timeoutMs) || value.timeoutMs < 1 || value.timeoutMs > 60000) errors.push("timeoutMs must be an integer from 1 to 60000.");
  if (value.mode === "STATIC" && Object.hasOwn(value,"updateContextId") || value.mode === "INCREMENTAL" && (typeof value.updateContextId !== "string" || !value.updateContextId || value.updateContextId.length > 512)) errors.push("INCREMENTAL requires the authoritative pending update selector; STATIC forbids it.");
  return errors;
}
const fail=(code,message)=>{throw new CandyContractError(code,message);};
export async function submitMotifWorkflow({client,graphValue,pendingUpdate=null,argumentsValue,runtimeSessionId,isCurrent=()=>true}) {
  const errors=motifSelectorErrors(argumentsValue);
  if (errors.length) fail(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA,"Motif action arguments violate the bounded selector schema.");
  const canonical=canonicalizeHypergraphIncidence(graphValue,{maxHyperedges:256,maxTotalIncidences:100000});
  const incremental=argumentsValue.mode === "INCREMENTAL";
  if (incremental && canonical.graphType !== "DynamicHypergraph") fail(CANDY_ERROR_CODES.INVALID_GRAPH_TYPE,"Incremental motif analysis requires an authoritative DynamicHypergraph.");
  if (incremental && (!pendingUpdate || pendingUpdate.updateId !== argumentsValue.updateContextId)) fail(CANDY_ERROR_CODES.INVALID_UPDATE_BATCH,"No matching authoritative pending update exists. The workspace was not changed.");
  if (incremental) applyHypergraphMotifUpdate(canonical,pendingUpdate);
  const check=()=>{if(!isCurrent()) fail(CANDY_ERROR_CODES.STALE_GRAPH_VERSION,"Graph, pending update or Runtime session changed during analysis authorization.");};
  check();
  const graphArtifact=await client.uploadArtifact({bytes:graphValue,mediaType:"application/vnd.candy.graph+json"});check();
  const updateArtifact=incremental?await client.uploadArtifact({bytes:pendingUpdate,mediaType:"application/vnd.candy.updates+json"}):null;check();
  const request={schemaVersion:MOTIF_RUNTIME_REQUEST,requestId:crypto.randomUUID(),algorithm:MOTIF_ALGORITHM,taxonomyVersion:MOTIF_TAXONOMY,backend:argumentsValue.backend,mode:argumentsValue.mode,graphRef:{graphId:canonical.graphId,graphVersion:canonical.graphVersion},deviceId:argumentsValue.deviceId,timeoutMs:argumentsValue.timeoutMs,
    ...(incremental?{updateRef:{updateId:pendingUpdate.updateId,artifactId:updateArtifact.id,nextGraphVersion:pendingUpdate.nextGraphVersion}}:{})};
  const graphSnapshot={schemaVersion:"candy.graph-snapshot/1",graphId:canonical.graphId,graphVersion:canonical.graphVersion,graphType:canonical.graphType,directed:false,weightModel:{kind:"nonnegative_integer",objectives:["weight"]},vertexCount:canonical.vertexCount,hyperedgeCount:canonical.hyperedgeCount,canonicalArtifactRef:graphArtifact,provenance:{source:"authoritative_workspace_incidence"}};
  const job=await client.submitJob({schemaVersion:"candy.job-submit/1",request,graphSnapshot,graphArtifactId:graphArtifact.id,...(incremental?{updateBatchArtifactId:updateArtifact.id}:{})});
  if (!isCurrent()) {await client.cancelJob(job.jobId);check();}
  return {job,binding:{runtimeSessionId,requestId:request.requestId,graphRef:request.graphRef,graphArtifactId:graphArtifact.id,updateRef:request.updateRef??null,backend:request.backend,mode:request.mode,deviceId:request.deviceId}};
}
export async function validateBrowserMotifResult(result,binding) {
  if (!binding || result?.schemaVersion !== MOTIF_RUNTIME_RESULT || result.algorithm !== MOTIF_ALGORITHM || result.taxonomyVersion !== MOTIF_TAXONOMY
    || result.runtimeSessionId !== binding.runtimeSessionId || result.requestId !== binding.requestId || result.backend !== binding.backend || result.mode !== binding.mode
    || result.graphArtifactId !== binding.graphArtifactId || JSON.stringify(result.inputGraphRef) !== JSON.stringify(binding.graphRef)
    || JSON.stringify(result.updateRef) !== JSON.stringify(binding.updateRef) || result.validation?.status !== "passed" || result.execution?.exitCode !== 0) fail(CANDY_ERROR_CODES.RESULT_VALIDATION_FAILURE,"Motif result does not match this authorized browser job and Runtime session.");
  const native=result.native,incremental=result.mode === "INCREMENTAL";
  const counts=incremental?native?.deltaCounts:native?.counts,total=incremental?native?.deltaTotalConnectedTriples:native?.totalConnectedTriples;
  if (!Array.isArray(counts) || counts.length !== 30 || !counts.every(value=>Number.isSafeInteger(value)&&(incremental||value>=0))
    || !Number.isSafeInteger(total) || counts.reduce((sum,value)=>sum+value,0)!==total || native.backend !== binding.backend || native.mode !== binding.mode
    || native.algorithm !== MOTIF_ALGORITHM || native.taxonomyVersion !== MOTIF_TAXONOMY || native.cuda?.deviceIndex !== binding.deviceId
    || native.cuda.kernelLaunchSucceeded !== true || native.cuda.synchronizationSucceeded !== true
    || incremental && (native.requestDigest !== result.requestDigest || native.updateId !== binding.updateRef.updateId || native.outputGraphRef?.graphVersion !== binding.updateRef.nextGraphVersion)
    || result.interpretation !== (incremental?"delta_only":"absolute_counts")) fail(CANDY_ERROR_CODES.RESULT_VALIDATION_FAILURE,"Motif result contains incompatible counts or execution metadata.");
  const {resultArtifactRef,...artifactContent}=result;
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify(artifactContent)));
  const id=`sha256:${Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,"0")).join("")}`;
  if (resultArtifactRef?.id !== id) fail(CANDY_ERROR_CODES.RESULT_VALIDATION_FAILURE,"Motif result artifact digest does not match its content.");
  return result;
}
