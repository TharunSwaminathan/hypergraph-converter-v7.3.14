import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createCandyClient } from "./client.js";
import { intersectCandyCapabilities } from "./capabilityDiscovery.js";
import { candyRuntimeEnabled, DEFAULT_CANDY_RUNTIME_URL } from "./featureFlag.js";
import { boundedCandyJobObservation } from "./resultObservation.js";
import { validateCandySubmissionIntent } from "./requestPolicy.js";
import { submitMotifWorkflow, validateBrowserMotifResult } from "./motifWorkflow.js";

const TOKEN_KEY = "hypergraph-studio.candy-runtime-token.session";
const safeSession = () => typeof sessionStorage === "undefined" ? null : sessionStorage;

export function useCandyRuntime({ graphType = null, graphId = null, graphVersion = 0, vertexCount = 0, edgeCount = 0, graphValue = null, pendingUpdate = null } = {}) {
  const enabled = candyRuntimeEnabled();
  const tokenRef = useRef(safeSession()?.getItem(TOKEN_KEY) ?? "");
  const declarationRef = useRef(null);
  const bindingsRef = useRef(new Map());
  const contextRef = useRef(null);
  const [state, setState] = useState(() => ({
    featureEnabled: enabled,
    status: enabled ? "not_discovered" : "disabled",
    baseUrl: DEFAULT_CANDY_RUNTIME_URL,
    authorized: false,
    runtimeVersion: null,
    capabilityStatus: "unavailable",
    capabilityReason: null,
    runtimeCapabilityStatus: "unavailable",
    capabilities: [],
    runtimeCapabilities: [],
    lastError: null,
    jobs: [],
    selectedJob: null,
  }));
  const graph = useMemo(() => ({ graphType, id: graphId, version: graphVersion, vertexCount, edgeCount }), [graphType, graphId, graphVersion, vertexCount, edgeCount]);
  const contextKey = useMemo(() => JSON.stringify({graphId,graphVersion,graphType,graphValue,pendingUpdate}), [graphId,graphVersion,graphType,graphValue,pendingUpdate]);
  useEffect(() => {
    contextRef.current = contextKey;
    let active=true;
    crypto.subtle.digest("SHA-256",new TextEncoder().encode(contextKey)).then(bytes=>{
      if(active) setState(current=>({...current,motifContextVersion:`sha256:${Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,"0")).join("")}`,selectedMotifResult:null}));
    });
    return ()=>{active=false;};
  }, [contextKey]);
  const client = useCallback(() => createCandyClient({ baseUrl: state.baseUrl, token: tokenRef.current }), [state.baseUrl]);

  const pair = useCallback(value => {
    const token = String(value ?? "").trim();
    tokenRef.current = token;
    bindingsRef.current.clear();
    declarationRef.current = null;
    if (token) safeSession()?.setItem(TOKEN_KEY, token); else safeSession()?.removeItem(TOKEN_KEY);
    setState(current => ({ ...current, authorized: false, status: token ? "not_discovered" : "unauthorized", capabilities: [], runtimeCapabilities: [], capabilityStatus: "unavailable", capabilityReason: null, runtimeCapabilityStatus: "unavailable", runtimeSessionId: null, jobs: [], selectedJob: null, selectedMotifResult: null, lastError: null }));
    return { ok: Boolean(token) };
  }, []);

  const discover = useCallback(async () => {
    if (!enabled) return { ok: false, classification: "feature_disabled", error: "CANDY native integration is disabled; browser-only mode remains active." };
    setState(current => ({ ...current, status: "discovering", lastError: null }));
    try {
      const runtimeClient = client();
      const health = await runtimeClient.health();
      if (health.schemaVersion !== "candy.runtime-api/1") throw Object.assign(new Error("The companion API schema is incompatible."), { classification: "incompatible" });
      const declaration = await runtimeClient.capabilities();
      declarationRef.current = declaration;
      const discovered = intersectCandyCapabilities(declaration, { authorized: true });
      const intersection = intersectCandyCapabilities(declaration, { authorized: true, graphType: graphType ?? "__NO_ACTIVE_GRAPH__" });
      setState(current => ({ ...current, status: "ready", authorized: true, runtimeVersion: health.serviceVersion, runtimeSessionId: declaration.runtimeSessionId ?? null, motifReadiness: declaration.motifReadiness ?? [], capabilityStatus: intersection.status, capabilityReason: intersection.reason, runtimeCapabilityStatus: discovered.status, capabilities: intersection.capabilities, runtimeCapabilities: discovered.capabilities, lastError: null }));
      return { ok: true, health, intersection, discovered };
    } catch (error) {
      const classification = error.classification ?? "BACKEND_UNAVAILABLE";
      const status = classification === "UNAUTHORIZED" ? "unauthorized" : classification === "incompatible" ? "incompatible" : "unavailable";
      setState(current => ({ ...current, status, authorized: false, capabilities: [], runtimeCapabilities: [], capabilityStatus: "unavailable", capabilityReason: null, runtimeCapabilityStatus: "unavailable", lastError: { classification, message: error.message } }));
      return { ok: false, classification, error: error.message };
    }
  }, [client, enabled, graphType]);

  useEffect(() => {
    if (!state.authorized || !declarationRef.current) return;
    const intersection = intersectCandyCapabilities(declarationRef.current, { authorized: true, graphType: graphType ?? "__NO_ACTIVE_GRAPH__" });
    setState(current => ({ ...current, capabilityStatus: intersection.status, capabilityReason: intersection.reason, capabilities: intersection.capabilities }));
  }, [graphType, state.authorized]);

  const getJobStatus = useCallback(async jobId => {
    try {
      const job = await client().getJob(jobId);
      const observation = boundedCandyJobObservation(job);
      setState(current => ({ ...current, selectedJob: observation, jobs: [...current.jobs.filter(item => item.jobId !== observation.jobId), observation].slice(-8) }));
      return { ok: true, job: observation };
    } catch (error) { return { ok: false, classification: error.classification, error: error.message }; }
  }, [client]);

  const cancelJob = useCallback(async jobId => {
    try {
      const job = boundedCandyJobObservation(await client().cancelJob(jobId));
      setState(current => ({ ...current, selectedJob: job, jobs: [...current.jobs.filter(item => item.jobId !== job.jobId), job].slice(-8) }));
      return { ok: true, job };
    } catch (error) { return { ok: false, classification: error.classification, error: error.message }; }
  }, [client]);

  const openResult = useCallback(async jobId => {
    try {
      const result = await client().getResult(jobId);
      if (contextRef.current !== contextKey) throw Object.assign(new Error("The workspace changed before result observation."),{classification:"STALE_GRAPH_VERSION"});
      if (bindingsRef.current.has(jobId) || result.schemaVersion === "candy.runtime-motif-result/1") {
        const accepted = bindingsRef.current.get(jobId);
        if (!accepted || accepted.contextKey !== contextKey || accepted.binding.runtimeSessionId !== declarationRef.current?.runtimeSessionId || result.jobId !== jobId) throw Object.assign(new Error("The motif result targets a stale graph, update, job or Runtime session."), { classification: "STALE_GRAPH_VERSION" });
        await validateBrowserMotifResult(result,accepted.binding);
        if (contextRef.current !== contextKey) throw Object.assign(new Error("The workspace changed during result validation."),{classification:"STALE_GRAPH_VERSION"});
      }
      const observation = boundedCandyJobObservation(result);
      setState(current => ({ ...current, selectedJob: observation, selectedMotifResult: result.schemaVersion === "candy.runtime-motif-result/1" ? result : null }));
      return { ok: true, observation };
    } catch (error) { return { ok: false, classification: error.classification, error: error.message }; }
  }, [client,contextKey]);

  const submitFromAssistant = useCallback(async argumentsValue => {
    if (["CUDA_STATIC","CUDA_INCREMENTAL"].includes(argumentsValue.backend)) {
      if (!enabled || !state.authorized) return {ok:false,classification:"BACKEND_UNAVAILABLE",error:"Authenticated Runtime motif integration is unavailable.",nativeJobCreated:false};
      const advertised=state.capabilities.some(cap=>cap.backend===argumentsValue.backend && cap.modes.includes(argumentsValue.mode));
      if (!advertised) return {ok:false,classification:"BACKEND_UNAVAILABLE",error:"The exact requested motif backend is unavailable. No fallback was selected.",nativeJobCreated:false};
      const session=declarationRef.current?.runtimeSessionId;
      try {
        if (!graphValue || graphValue.graphType !== graphType || graphValue.graphId !== graphId || graphValue.graphVersion !== graphVersion) throw Object.assign(new Error("The authoritative motif graph does not match the current workspace identity and type."), {classification:"STALE_GRAPH_VERSION"});
        const accepted=await submitMotifWorkflow({client:client(),graphValue,pendingUpdate,argumentsValue,runtimeSessionId:session,isCurrent:()=>contextRef.current===contextKey && declarationRef.current?.runtimeSessionId===session});
        bindingsRef.current.set(accepted.job.jobId,{binding:accepted.binding,contextKey});
        const observation=boundedCandyJobObservation(accepted.job);
        setState(current=>({...current,selectedJob:observation,selectedMotifResult:null,jobs:[...current.jobs.filter(item=>item.jobId!==observation.jobId),observation].slice(-8)}));
        return {ok:true,job:observation,nativeJobCreated:true,workspaceMutated:false};
      } catch(error) {return {ok:false,classification:error.code??error.classification??"ALGORITHM_FAILURE",error:error.message,nativeJobCreated:false,workspaceMutated:false};}
    }
    const safety = validateCandySubmissionIntent(argumentsValue, graph);
    if (!safety.ok) return { ok: false, classification: safety.classification, error: safety.message, nativeJobCreated: false, implicitProjectionPerformed: false };
    const advertised = state.capabilities.some(capability => capability.backend === argumentsValue.backend && capability.modes.includes(argumentsValue.mode));
    if (!advertised) return { ok: false, classification: "BACKEND_UNAVAILABLE", error: `${argumentsValue.backend} is not currently advertised for ${argumentsValue.mode}. No fallback backend was selected.`, nativeJobCreated: false, implicitProjectionPerformed: false };
    return { ok: false, classification: "INVALID_GRAPH_SCHEMA", error: "This Hypergraph Studio does not currently expose an authoritative ordinary-graph artifact to CANDY. Importing or projecting one requires a separately authorized workflow.", nativeJobCreated: false };
  }, [graph, graphType, graphId, graphVersion, state.capabilities,state.authorized,enabled,client,graphValue,pendingUpdate,contextKey]);

  return {
    state: Object.freeze({ ...state, graphType, graphId, graphVersion, edgeCount, pendingUpdateContext: graphType === "DynamicHypergraph" && pendingUpdate ? {updateId:pendingUpdate.updateId,baseGraphRef:pendingUpdate.baseGraphRef,nextGraphVersion:pendingUpdate.nextGraphVersion} : null }),
    actions: Object.freeze({ pair, discover, getJobStatus, cancelJob, openResult, submitFromAssistant }),
  };
}
