import { canonicalizeHypergraphIncidence } from "./adapters/hypergraphIncidenceAdapter.js";
import { applyHypergraphMotifUpdate } from "./adapters/hypergraphUpdateAdapter.js";
import { MOTIF_ALGORITHM, MOTIF_BACKENDS, MOTIF_TAXONOMY, MOTIF_RUNTIME_REQUEST, MOTIF_RUNTIME_RESULT } from "./contracts/runtimeMotif.js";
import { CANDY_ERROR_CODES, CandyContractError } from "./contracts/errorClasses.js";
import { canonicalIdentifierKey, createCanonicalIdentifierMapping } from "./adapters/identifierMapping.js";
import { motifGraphBudget, QUALIFIED_MOTIF_LIMITS } from "./motifPreflight.js";

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
export async function submitMotifWorkflow({client,graphValue,pendingUpdate=null,argumentsValue,runtimeSessionId,applicationBinding=null,isCurrent=()=>true}) {
  const errors=motifSelectorErrors(argumentsValue);
  if (errors.length) fail(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA,"Motif action arguments violate the bounded selector schema.");
  const check=()=>{if(!isCurrent()) fail(CANDY_ERROR_CODES.STALE_GRAPH_VERSION,"Graph, pending update or Runtime session changed during analysis authorization.");};
  check();
  const prepared = prepareBrowserMotifRequest(graphValue, pendingUpdate, argumentsValue);
  const canonical = prepared.graph;
  const incremental=argumentsValue.mode === "INCREMENTAL";
  if (incremental && canonical.graphType !== "DynamicHypergraph") fail(CANDY_ERROR_CODES.INVALID_GRAPH_TYPE,"Incremental motif analysis requires an authoritative DynamicHypergraph.");
  if (incremental && (!pendingUpdate || pendingUpdate.updateId !== argumentsValue.updateContextId)) fail(CANDY_ERROR_CODES.INVALID_UPDATE_BATCH,"No matching authoritative pending update exists. The workspace was not changed.");
  const nativeRequestDigest = await sha256(prepared.digestContent); check();
  const graphText=boundedArtifactText(graphValue),updateText=incremental?boundedArtifactText(pendingUpdate):null;
  const graphArtifactId = `sha256:${await sha256(graphText)}`; check();
  const updateArtifactId = incremental ? `sha256:${await sha256(updateText)}` : null; check();
  check();
  const graphArtifact=await client.uploadArtifact({bytes:graphValue,mediaType:"application/vnd.candy.graph+json"});check();
  if (graphArtifact.id !== graphArtifactId) fail(CANDY_ERROR_CODES.RESULT_VALIDATION_FAILURE,"Uploaded graph artifact does not match the exact authorized content.");
  const updateArtifact=incremental?await client.uploadArtifact({bytes:pendingUpdate,mediaType:"application/vnd.candy.updates+json"}):null;check();
  if (incremental && updateArtifact.id !== updateArtifactId) fail(CANDY_ERROR_CODES.RESULT_VALIDATION_FAILURE,"Uploaded update artifact does not match the exact authorized content.");
  const request={schemaVersion:MOTIF_RUNTIME_REQUEST,requestId:crypto.randomUUID(),algorithm:MOTIF_ALGORITHM,taxonomyVersion:MOTIF_TAXONOMY,backend:argumentsValue.backend,mode:argumentsValue.mode,graphRef:{graphId:canonical.graphId,graphVersion:canonical.graphVersion},deviceId:argumentsValue.deviceId,timeoutMs:argumentsValue.timeoutMs,
    ...(incremental?{updateRef:{updateId:pendingUpdate.updateId,artifactId:updateArtifact.id,nextGraphVersion:pendingUpdate.nextGraphVersion}}:{})};
  const graphSnapshot={schemaVersion:"candy.graph-snapshot/1",graphId:canonical.graphId,graphVersion:canonical.graphVersion,graphType:canonical.graphType,directed:false,weightModel:{kind:"nonnegative_integer",objectives:["weight"]},vertexCount:canonical.vertexCount,hyperedgeCount:canonical.hyperedgeCount,canonicalArtifactRef:graphArtifact,provenance:{source:"authoritative_workspace_incidence"}};
  Object.freeze(request.graphRef); if (request.updateRef) Object.freeze(request.updateRef);
  const job=await client.submitJob({schemaVersion:"candy.job-submit/1",request,graphSnapshot,graphArtifactId:graphArtifact.id,...(incremental?{updateBatchArtifactId:updateArtifact.id}:{})});
  if (!isCurrent()) { void Promise.resolve().then(()=>client.cancelJob(job.jobId)).catch(()=>{}); check(); }
  if (!job.jobId || job.algorithm !== request.algorithm || job.backend !== request.backend || job.mode !== request.mode || JSON.stringify(job.graphRef) !== JSON.stringify(request.graphRef)) fail(CANDY_ERROR_CODES.RESULT_VALIDATION_FAILURE,"Submitted job identity differs from the authorized request.");
  return {job,binding:Object.freeze({runtimeSessionId,jobId:job.jobId,requestId:request.requestId,graphRef:request.graphRef,graphArtifactId:graphArtifact.id,updateRef:request.updateRef??null,backend:request.backend,mode:request.mode,deviceId:request.deviceId,algorithm:MOTIF_ALGORITHM,taxonomyVersion:MOTIF_TAXONOMY,nativeRequestDigest,applicationBinding,nativeIdentity:prepared.nativeIdentity??null})};
}
export async function validateBrowserMotifResult(result,binding) {
  if (!binding || result?.schemaVersion !== MOTIF_RUNTIME_RESULT || result.algorithm !== MOTIF_ALGORITHM || result.taxonomyVersion !== MOTIF_TAXONOMY
    || result.runtimeSessionId !== binding.runtimeSessionId || result.requestId !== binding.requestId || binding.jobId && result.jobId !== binding.jobId || result.backend !== binding.backend || result.mode !== binding.mode
    || result.graphArtifactId !== binding.graphArtifactId || JSON.stringify(result.inputGraphRef) !== JSON.stringify(binding.graphRef)
    || JSON.stringify(result.updateRef) !== JSON.stringify(binding.updateRef) || result.validation?.status !== "passed" || result.execution?.exitCode !== 0) fail(CANDY_ERROR_CODES.RESULT_VALIDATION_FAILURE,"Motif result does not match this authorized browser job and Runtime session.");
  const native=result.native,incremental=result.mode === "INCREMENTAL";
  if (binding.nativeIdentity) {
    for (const [field,expected] of Object.entries(binding.nativeIdentity)) if(native?.[field]!==expected) fail(CANDY_ERROR_CODES.RESULT_VALIDATION_FAILURE,"Native affected-work identity differs from the qualified transition.");
    for (const [field,bound] of [["oldAffectedCounts",native.oldCandidateCount],["newAffectedCounts",native.newCandidateCount]]) {
      if(!Array.isArray(native[field]) || native[field].length!==30 || !native[field].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=bound)
        || native[field].reduce((a,b)=>a+b,0)>bound) fail(CANDY_ERROR_CODES.RESULT_VALIDATION_FAILURE,"Invalid bounded affected counts.");
    }
    if(!native.deltaCounts?.every((n,i)=>n===native.newAffectedCounts[i]-native.oldAffectedCounts[i])) fail(CANDY_ERROR_CODES.RESULT_VALIDATION_FAILURE,"Affected counts do not match the signed delta.");
  }
  const counts=incremental?native?.deltaCounts:native?.counts,total=incremental?native?.deltaTotalConnectedTriples:native?.totalConnectedTriples;
  if (!Array.isArray(counts) || counts.length !== 30 || !counts.every(value=>Number.isSafeInteger(value)&&(incremental||value>=0))
    || !Number.isSafeInteger(total) || counts.reduce((sum,value)=>sum+value,0)!==total || native.backend !== binding.backend || native.mode !== binding.mode
    || native.algorithm !== MOTIF_ALGORITHM || native.taxonomyVersion !== MOTIF_TAXONOMY || native.cuda?.deviceIndex !== binding.deviceId
    || native.cuda.kernelLaunchSucceeded !== true || native.cuda.synchronizationSucceeded !== true
    || incremental && (native.requestDigest !== result.requestDigest || native.updateId !== binding.updateRef.updateId || native.outputGraphRef?.graphVersion !== binding.updateRef.nextGraphVersion)
    || binding.nativeRequestDigest && (result.requestDigest !== binding.nativeRequestDigest || incremental && native.requestDigest !== binding.nativeRequestDigest)
    || binding.jobId && (JSON.stringify(native.inputGraphRef) !== JSON.stringify(binding.graphRef)
      || incremental && native.outputGraphRef?.graphId !== binding.graphRef.graphId
      || native.cuda.compiledArchitecture !== "sm_120" || native.cuda.compilerVersion !== "13.4.59" || native.cuda.runtimeVersion !== 13040 || native.cuda.computeMajor !== 12 || native.cuda.computeMinor !== 0)
    || result.interpretation !== (incremental?"delta_only":"absolute_counts")) fail(CANDY_ERROR_CODES.RESULT_VALIDATION_FAILURE,"Motif result contains incompatible counts or execution metadata.");
  const {resultArtifactRef,...artifactContent}=result;
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify(artifactContent)));
  const id=`sha256:${Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,"0")).join("")}`;
  if (resultArtifactRef?.id !== id) fail(CANDY_ERROR_CODES.RESULT_VALIDATION_FAILURE,"Motif result artifact digest does not match its content.");
  return result;
}

// Browser identity projection of the frozen qualified transport, not a motif
// computation or executable request. Parity-tested against both frozen packers.
export function prepareBrowserMotifRequest(value, update, selector) {
  const budget = motifGraphBudget(value);
  if (!budget.ok) fail(budget.classification, budget.message);
  const graph = canonicalizeHypergraphIncidence(value, {maxHyperedges:256,maxTotalIncidences:100000});
  const hex = value => Array.from({length:value.length}, (_,i)=>value.charCodeAt(i).toString(16).padStart(4,"0")).join("");
  const rows = graph => {
    const offsets=[0], members=[];
    for (const edge of graph.hyperedges) { for (const member of edge.vertexNativeIndices) members.push(member); offsets.push(members.length); }
    return [`offsets ${offsets.length} ${offsets.join(" ")}`,`memberships ${members.length} ${members.join(" ")}`];
  };
  if (selector.mode === "STATIC") return {graph,digestContent:[
    "CANDY_HYPERGRAPH_MOTIF_CUDA_STATIC_REQUEST_V1", `algorithm ${MOTIF_ALGORITHM}`, `taxonomy ${MOTIF_TAXONOMY}`,"mode STATIC",
    `graph_type ${graph.graphType}`,`graph_id_u16 ${hex(graph.graphId)}`,`graph_version ${graph.graphVersion}`,`cuda_device ${selector.deviceId}`,
    `vertex_count ${graph.vertexCount}`,`hyperedge_count ${graph.hyperedgeCount}`,`incidence_count ${graph.incidenceCount}`,...rows(graph),"END", ""].join("\n")};
  if (graph.graphType !== "DynamicHypergraph") fail(CANDY_ERROR_CODES.INVALID_GRAPH_TYPE,"Incremental motif analysis requires DynamicHypergraph.");
  if (!update || update.updateId !== selector.updateContextId) fail(CANDY_ERROR_CODES.INVALID_UPDATE_BATCH,"No matching authoritative pending update exists.");
  if(update.updateId.length>512) fail(CANDY_ERROR_CODES.RESOURCE_LIMIT,"Update identity exceeds the qualified transport limit.");
  if (update.deletions?.length > 256 || update.insertions?.length > 256) fail(CANDY_ERROR_CODES.RESOURCE_LIMIT,"Incremental operations exceed the qualified limit.");
  let inserted=0;
  for (const edge of update.insertions ?? []) { inserted += edge.vertices?.length ?? 0; if (inserted>100000) fail(CANDY_ERROR_CODES.RESOURCE_LIMIT,"Inserted incidences exceed the qualified limit."); }
  const applied = applyHypergraphMotifUpdate(graph, update);
  const nextBudget=motifGraphBudget(applied.value);
  if (!nextBudget.ok) fail(nextBudget.classification,nextBudget.message);
  const next=canonicalizeHypergraphIncidence(applied.value,{maxHyperedges:256,maxTotalIncidences:100000});
  const edgeIds=new Map([...graph.hyperedgeMapping.entries,...next.hyperedgeMapping.entries].map(entry=>[entry.key,entry.canonicalId]));
  const commonEdges=createCanonicalIdentifierMapping([...edgeIds.values()],{schemaVersion:"standalone.common-edge-tags/1",label:"common hyperedge"});
  const choose3=n=>n<3?0:n*(n-1)*(n-2)/6;
  const nativeIdentity={};
  const snapshot=(source,ids,prefix)=>{
    const keys=new Set(ids.map(id=>canonicalIdentifierKey(id))),offsets=[0],members=[],affected=[],tags=[];
    source.hyperedges.forEach((edge,i)=>{
      tags.push(commonEdges.toNative(edge.canonicalId));
      const row=edge.vertexNativeIndices.map(v=>next.vertexMapping.toNative(source.vertexMapping.toCanonical(v))).sort((a,b)=>a-b);
      for (const v of row) members.push(v);
      offsets.push(members.length);
      if(keys.has(canonicalIdentifierKey(edge.canonicalId))) affected.push(i);
    });
    const candidates=choose3(source.hyperedgeCount)-choose3(source.hyperedgeCount-affected.length);
    nativeIdentity[prefix==="old_"?"oldAffectedEdgeCount":"newAffectedEdgeCount"]=affected.length;
    nativeIdentity[prefix==="old_"?"oldCandidateCount":"newCandidateCount"]=candidates;
    return [`${prefix}vertex_count ${next.vertexCount}`,`${prefix}hyperedge_count ${source.hyperedgeCount}`,`${prefix}incidence_count ${source.incidenceCount}`,
      `${prefix}edge_tags ${tags.length} ${tags.join(" ")}`,`${prefix}offsets ${offsets.length} ${offsets.join(" ")}`,`${prefix}memberships ${members.length} ${members.join(" ")}`,
      `${prefix}affected ${affected.length} ${affected.join(" ")}`,`${prefix}candidate_count ${candidates}`];
  };
  const digestContent=[`algorithm ${MOTIF_ALGORITHM}`,`taxonomy ${MOTIF_TAXONOMY}`,"mode INCREMENTAL","graph_type DynamicHypergraph",
    `graph_id_u16 ${hex(graph.graphId)}`,`old_graph_version ${graph.graphVersion}`,`new_graph_version ${next.graphVersion}`,`update_id_u16 ${hex(update.updateId)}`,`cuda_device ${selector.deviceId}`,
    ...snapshot(graph,applied.update.deletions,"old_"),...snapshot(next,applied.update.insertions.map(edge=>edge.id),"new_"),"END",""].join("\n");
  const packedBytes=new TextEncoder().encode(`CANDY_HYPERGRAPH_MOTIF_CUDA_INCREMENTAL_REQUEST_V1\nrequest_digest ${"0".repeat(64)}\n${digestContent}`).length;
  if(packedBytes>QUALIFIED_MOTIF_LIMITS.maxPackedBytes) fail(CANDY_ERROR_CODES.RESOURCE_LIMIT,"Packed request exceeds the qualified 2MiB bound.");
  return {graph,digestContent,packedBytes,nativeIdentity:Object.freeze(nativeIdentity)};
}

function boundedArtifactText(value) {
  const text=JSON.stringify(value);
  if(new TextEncoder().encode(text).length>6*1024*1024) fail(CANDY_ERROR_CODES.RESOURCE_LIMIT,"Artifact exceeds the qualified 6MiB limit before upload.");
  return text;
}

async function sha256(text) {
  const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map(byte=>byte.toString(16).padStart(2,"0")).join("");
}
