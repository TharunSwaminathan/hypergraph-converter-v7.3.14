import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createCandyClient } from "./client.js";
import { intersectCandyCapabilities } from "./capabilityDiscovery.js";
import { candyRuntimeEnabled, DEFAULT_CANDY_RUNTIME_URL } from "./featureFlag.js";
import { boundedCandyJobObservation } from "./resultObservation.js";
import { validateCandySubmissionIntent } from "./requestPolicy.js";

const TOKEN_KEY = "hypergraph-studio.candy-runtime-token.session";
const safeSession = () => typeof sessionStorage === "undefined" ? null : sessionStorage;

export function useCandyRuntime({ graphType = null, graphId = null, graphVersion = 0, vertexCount = 0, edgeCount = 0 } = {}) {
  const enabled = candyRuntimeEnabled();
  const tokenRef = useRef(safeSession()?.getItem(TOKEN_KEY) ?? "");
  const declarationRef = useRef(null);
  const [state, setState] = useState(() => ({
    featureEnabled: enabled,
    status: enabled ? "not_discovered" : "disabled",
    baseUrl: DEFAULT_CANDY_RUNTIME_URL,
    authorized: false,
    runtimeVersion: null,
    capabilityStatus: "unavailable",
    capabilities: [],
    lastError: null,
    jobs: [],
    selectedJob: null,
  }));
  const graph = useMemo(() => ({ graphType, id: graphId, version: graphVersion, vertexCount, edgeCount }), [graphType, graphId, graphVersion, vertexCount, edgeCount]);
  const client = useCallback(() => createCandyClient({ baseUrl: state.baseUrl, token: tokenRef.current }), [state.baseUrl]);

  const pair = useCallback(value => {
    const token = String(value ?? "").trim();
    tokenRef.current = token;
    if (token) safeSession()?.setItem(TOKEN_KEY, token); else safeSession()?.removeItem(TOKEN_KEY);
    setState(current => ({ ...current, authorized: false, status: token ? "not_discovered" : "unauthorized", capabilities: [], capabilityStatus: "unavailable", lastError: null }));
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
      const intersection = intersectCandyCapabilities(declaration, { authorized: true, graphType: graphType ?? "__NO_ACTIVE_GRAPH__" });
      setState(current => ({ ...current, status: "ready", authorized: true, runtimeVersion: health.serviceVersion, capabilityStatus: intersection.status, capabilities: intersection.capabilities, lastError: null }));
      return { ok: true, health, intersection };
    } catch (error) {
      const classification = error.classification ?? "BACKEND_UNAVAILABLE";
      const status = classification === "UNAUTHORIZED" ? "unauthorized" : classification === "incompatible" ? "incompatible" : "unavailable";
      setState(current => ({ ...current, status, authorized: false, capabilities: [], capabilityStatus: "unavailable", lastError: { classification, message: error.message } }));
      return { ok: false, classification, error: error.message };
    }
  }, [client, enabled, graphType]);

  useEffect(() => {
    if (!state.authorized || !declarationRef.current) return;
    const intersection = intersectCandyCapabilities(declarationRef.current, { authorized: true, graphType: graphType ?? "__NO_ACTIVE_GRAPH__" });
    setState(current => ({ ...current, capabilityStatus: intersection.status, capabilities: intersection.capabilities }));
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
      const observation = boundedCandyJobObservation(result);
      setState(current => ({ ...current, selectedJob: observation }));
      return { ok: true, result, observation };
    } catch (error) { return { ok: false, classification: error.classification, error: error.message }; }
  }, [client]);

  const submitFromAssistant = useCallback(async argumentsValue => {
    const safety = validateCandySubmissionIntent(argumentsValue, graph);
    if (!safety.ok) return { ok: false, classification: safety.classification, error: safety.message, nativeJobCreated: false, implicitProjectionPerformed: false };
    return { ok: false, classification: "INVALID_GRAPH_SCHEMA", error: "This Hypergraph Studio does not currently expose an authoritative ordinary-graph artifact to CANDY. Importing or projecting one requires a separately authorized workflow.", nativeJobCreated: false };
  }, [graph]);

  return {
    state: Object.freeze({ ...state, graphType }),
    actions: Object.freeze({ pair, discover, getJobStatus, cancelJob, openResult, submitFromAssistant }),
  };
}
