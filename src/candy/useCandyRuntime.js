import { useCallback, useEffect, useLayoutEffect, useState, useSyncExternalStore } from "react";
import { createCandyClient } from "./client.js";
import { intersectCandyCapabilities } from "./capabilityDiscovery.js";
import { candyRuntimeEnabled, DEFAULT_CANDY_RUNTIME_URL } from "./featureFlag.js";
import { validateCandySubmissionIntent } from "./requestPolicy.js";
import { createMotifAnalysisController } from "./motifAnalysisController.js";
import { motifApplicationBinding, motifAuthorityKey, motifPreflight } from "./motifPreflight.js";

const TOKEN_KEY = "hypergraph-studio.candy-runtime-token.session";
// Storage may be denied, cleared, or injected. Pairing remains a credential
// hint only: every new owner starts unauthorized and requires discovery.
function pairingStorage(value) {
  try {
    const storage = globalThis.sessionStorage;
    if (value === undefined) return storage?.getItem(TOKEN_KEY) ?? "";
    if (value) storage?.setItem(TOKEN_KEY, value); else storage?.removeItem(TOKEN_KEY);
  } catch { /* Keep live pairing usable when browser storage is unavailable. */ }
  return "";
}

function createLiveContext(initial) {
  let value=initial, declaration=null, generation=0, mounted=true;
  return Object.freeze({get:()=>value,update:patch=>{value={...value,...patch};},
    getDeclaration:()=>declaration,setDeclaration:next=>{declaration=next;},
    nextDiscovery:()=>++generation,isCurrent:expected=>mounted && expected===generation,
    mount:()=>{mounted=true;},unmount:()=>{mounted=false;generation++;}});
}

export function useCandyRuntime({ graphState = null, getGraphState = null, pendingController = null,
  graphType = null, graphId = null, graphVersion = 0, graphFingerprint = null, vertexCount = 0, edgeCount = 0,
  graphValue = null, pendingUpdate = null } = {}) {
  const enabled = candyRuntimeEnabled();
  const [state, setState] = useState(() => ({ featureEnabled:enabled,status:enabled?"not_discovered":"disabled",
    baseUrl:DEFAULT_CANDY_RUNTIME_URL,authorized:false,runtimeVersion:null,runtimeSessionId:null,
    capabilityStatus:"unavailable",capabilityReason:null,runtimeCapabilityStatus:"unavailable",
    capabilities:[],runtimeCapabilities:[],lastError:null }));
  const [live] = useState(() => createLiveContext({graphState,getGraphState,pendingController,graphValue,pendingUpdate,graphType,graphFingerprint,state,token:pairingStorage()}));
  const [controller] = useState(() => createMotifAnalysisController({
    getContext:()=>{
      const current=live.get();
      const graph=current.getGraphState?.() ?? current.graphState ?? {...current.graphValue,graphFingerprint:current.graphFingerprint};
      return {graph,pendingUpdate:current.pendingController?.getCurrent() ?? (current.pendingController ? null : current.pendingUpdate),runtime:current.state};
    },
    getClient:()=>createCandyClient({baseUrl:live.get().state.baseUrl,token:live.get().token}),
  }));
  useLayoutEffect(() => {
    live.update({graphState,getGraphState,pendingController,graphValue,pendingUpdate,graphType,graphFingerprint,state});
    controller.synchronize();
  });
  const analysis=useSyncExternalStore(controller.subscribe,controller.getSnapshot,controller.getSnapshot);
  const authoritativeGraph = graphState ?? {...graphValue,graphFingerprint};
  const authoritativePending = pendingController ? pendingController.getCurrent() : pendingUpdate;
  const applicationBinding=motifApplicationBinding(authoritativeGraph,authoritativePending);
  const contextKey=motifAuthorityKey(applicationBinding);
  useEffect(()=>{ controller.synchronize(); },[controller,contextKey,state.runtimeSessionId,state.authorized]);
  useEffect(()=>{
    live.mount(); controller.activate();
    return ()=>{ live.unmount(); controller.dispose(); };
  },[controller,live]);

  const pair = useCallback(value => {
    const token=String(value ?? "").trim();
    live.nextDiscovery(); controller.invalidate();
    live.update({token}); live.setDeclaration(null);
    pairingStorage(token);
    const next={...live.get().state,authorized:false,status:token?"not_discovered":"unauthorized",runtimeSessionId:null,
      capabilities:[],runtimeCapabilities:[],capabilityStatus:"unavailable",capabilityReason:null,runtimeCapabilityStatus:"unavailable",lastError:null};
    live.update({state:next}); setState(next);
    return {ok:Boolean(token)};
  },[controller,live]);

  const discover = useCallback(async () => {
    if (!enabled) return {ok:false,classification:"feature_disabled",error:"CANDY native integration is disabled; browser-only mode remains active."};
    const generation=live.nextDiscovery();
    controller.invalidate(); live.setDeclaration(null);
    const initial={...live.get().state,status:"discovering",authorized:false,runtimeSessionId:null,capabilities:[],runtimeCapabilities:[],lastError:null};
    live.update({state:initial}); setState(initial);
    const check=()=>{if(!live.isCurrent(generation)) throw Object.assign(new Error("Runtime discovery was superseded or unmounted."),{classification:"STALE_GRAPH_VERSION"});};
    try {
      check();
      const client=createCandyClient({baseUrl:initial.baseUrl,token:live.get().token});
      const health=await client.health(); check();
      if(health.schemaVersion!=="candy.runtime-api/1") throw Object.assign(new Error("The companion API schema is incompatible."),{classification:"incompatible"});
      const declaration=await client.capabilities(); check();
      if(typeof declaration.runtimeSessionId!=="string" || !declaration.runtimeSessionId) throw Object.assign(new Error("Runtime session identity is unavailable."),{classification:"incompatible"});
      const discovered=intersectCandyCapabilities(declaration,{authorized:true});
      const currentType=live.get().getGraphState?.()?.graphType ?? live.get().graphType;
      const intersection=intersectCandyCapabilities(declaration,{authorized:true,graphType:currentType ?? "__NO_ACTIVE_GRAPH__"});
      live.setDeclaration(declaration);
      const next={...live.get().state,status:"ready",authorized:true,runtimeVersion:health.serviceVersion,runtimeSessionId:declaration.runtimeSessionId,
        motifReadiness:declaration.motifReadiness ?? [],capabilityStatus:intersection.status,capabilityReason:intersection.reason,
        runtimeCapabilityStatus:discovered.status,capabilities:intersection.capabilities,runtimeCapabilities:discovered.capabilities,lastError:null};
      live.update({state:next}); setState(next);
      return {ok:true,health,intersection,discovered};
    } catch(error) {
      const classification=error.classification ?? "BACKEND_UNAVAILABLE";
      if(live.isCurrent(generation)) {
        const next={...live.get().state,status:classification==="UNAUTHORIZED"?"unauthorized":classification==="incompatible"?"incompatible":"unavailable",
          authorized:false,runtimeSessionId:null,capabilities:[],runtimeCapabilities:[],lastError:{classification,message:error.message}};
        live.update({state:next}); setState(next);
      }
      return {ok:false,classification,error:error.message};
    }
  },[controller,enabled,live]);

  useEffect(()=>{
    if(!state.authorized || !live.getDeclaration()) return;
    const intersection=intersectCandyCapabilities(live.getDeclaration(),{authorized:true,graphType:graphType ?? "__NO_ACTIVE_GRAPH__"});
    setState(current=>({...current,capabilityStatus:intersection.status,capabilityReason:intersection.reason,capabilities:intersection.capabilities}));
  },[graphType,state.authorized,live]);

  const submitFromAssistant = useCallback(async (argumentsValue,confirmation) => {
    if(["CUDA_STATIC","CUDA_INCREMENTAL"].includes(argumentsValue.backend)) return controller.submit(argumentsValue,confirmation);
    const safety=validateCandySubmissionIntent(argumentsValue,{graphType});
    return {ok:false,classification:safety.ok?"INVALID_GRAPH_SCHEMA":safety.classification,
      error:safety.ok?"No authoritative ordinary-graph artifact is exposed; projection requires a separate workflow.":safety.message,nativeJobCreated:false,implicitProjectionPerformed:false};
  },[controller,graphType]);

  const availability=mode=>{
    const backend=mode==="STATIC"?"CUDA_STATIC":"CUDA_INCREMENTAL";
    const capability=state.capabilities.find(cap=>cap.backend===backend);
    return motifPreflight({graph:authoritativeGraph,pendingUpdate:authoritativePending,runtime:state,
      argumentsValue:{mode,backend,deviceId:capability?.devices?.[0]?.id,timeoutMs:5000,
      ...(mode==="INCREMENTAL"?{updateContextId:authoritativePending?.updateId}:{})}});
  };
  const resultEvidence=controller.currentResult({applicationBinding,runtimeSessionId:state.runtimeSessionId});
  return {
    state:Object.freeze({...state,graphType,graphId,graphVersion,graphFingerprint,edgeCount,vertexCount,
      motifContextVersion:contextKey,applicationBinding,analysisStatus:analysis.status,
      lastError:analysis.lastError ?? state.lastError,jobs:analysis.job?[analysis.job]:[],selectedJob:analysis.job,
      selectedMotifResult:resultEvidence?.result ?? null,resultEvidence,
      staticAvailability:availability("STATIC"),incrementalAvailability:availability("INCREMENTAL"),
      pendingUpdateContext:authoritativePending?.status==="VALIDATED" && authoritativePending.motifImpact==="CHANGED"
        ? Object.freeze({...applicationBinding,baseGraphRef:authoritativePending.baseGraphRef}):null}),
    actions:Object.freeze({pair,discover,stageMotifAnalysis:controller.stage,cancelMotifConfirmation:controller.cancelConfirmation,getJobStatus:controller.getJobStatus,
      cancelJob:controller.cancelJob,openResult:controller.openResult,submitFromAssistant}),
  };
}
