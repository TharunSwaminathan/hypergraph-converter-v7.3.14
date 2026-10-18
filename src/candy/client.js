import { DEFAULT_CANDY_RUNTIME_URL } from "./featureFlag.js";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost"]);
const ERROR_SCHEMA = "candy.algorithm-error/1";
const transportOptions = ({ signal, timeoutMs } = {}) => ({ signal, ...(timeoutMs === undefined ? {} : { timeoutMs }) });

export class CandyClientError extends Error {
  constructor(classification, message, details = {}) {
    super(message);
    this.name = "CandyClientError";
    this.classification = classification;
    this.details = details;
  }
}

export function validateCandyRuntimeUrl(value) {
  let parsed;
  try { parsed = new URL(value); }
  catch { throw new CandyClientError("BACKEND_UNAVAILABLE", "CANDY companion URL is invalid."); }
  if (parsed.protocol !== "http:" || !LOOPBACK_HOSTS.has(parsed.hostname) || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new CandyClientError("BACKEND_UNAVAILABLE", "CANDY companion must use an unauthenticated URL at HTTP loopback (127.0.0.1 or localhost). The pairing token is sent separately.");
  }
  return parsed.origin;
}

export function createCandyClient({ baseUrl = DEFAULT_CANDY_RUNTIME_URL, token = "", fetchImpl = globalThis.fetch, signal: lifetimeSignal, onConnectionFailure } = {}) {
  const origin = validateCandyRuntimeUrl(baseUrl);
  if (typeof fetchImpl !== "function") throw new TypeError("A fetch implementation is required.");
  const request = async (path, { method = "GET", body, protectedOperation = true, signal, timeoutMs = 15000 } = {}) => {
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000) throw new RangeError("Transport deadline must be 1..120000 ms.");
    const headers = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (protectedOperation) {
      if (!token) throw new CandyClientError("UNAUTHORIZED", "Enter the session pairing credential from the local companion.");
      headers.Authorization = `Bearer ${token}`;
    }
    const transport = new AbortController();
    const sources = [...new Set([lifetimeSignal, signal].filter(Boolean))];
    let rejectAbort;
    const aborted = new Promise((_, reject) => { rejectAbort = reject; });
    const abort = classification => {
      if (transport.signal.aborted) return;
      transport.abort();
      rejectAbort(new CandyClientError(classification, classification === "REQUEST_TIMEOUT" ? "The companion request exceeded its transport deadline." : "The companion request was cancelled."));
    };
    const onAbort = () => abort("REQUEST_ABORTED");
    for (const source of sources) source.addEventListener("abort", onAbort, { once: true });
    const timer = setTimeout(() => abort("REQUEST_TIMEOUT"), timeoutMs);
    // Race covers both fetch and body decoding, including transports that ignore
    // AbortSignal. Late settlement has no authority and remains handled.
    const perform = async () => {
      let response;
      try { response = await fetchImpl(`${origin}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store", signal: transport.signal }); }
      catch { throw new CandyClientError("BACKEND_UNAVAILABLE", "The local CANDY Runtime Companion is unavailable. Browser-only mode remains active."); }
      let payload;
      try { payload = await response.json(); }
      catch { throw new CandyClientError("OUTPUT_PARSE_FAILURE", "The local companion returned invalid JSON."); }
      if (!response.ok) {
        const classification = response.status === 401 ? "UNAUTHORIZED" : payload?.schemaVersion === ERROR_SCHEMA && typeof payload.classification === "string" ? payload.classification : "BACKEND_UNAVAILABLE";
        throw new CandyClientError(classification, payload?.message || "The local companion rejected the request.", {...payload?.details,httpStatus:response.status});
      }
      return payload;
    };
    try {
      if (sources.some(source => source.aborted)) onAbort();
      return await Promise.race([aborted, transport.signal.aborted ? aborted : perform()]);
    } catch(error) {
      if(["UNAUTHORIZED","BACKEND_UNAVAILABLE","REQUEST_TIMEOUT","OUTPUT_PARSE_FAILURE"].includes(error.classification))onConnectionFailure?.(error);
      throw error;
    } finally {
      clearTimeout(timer);
      for (const source of sources) source.removeEventListener("abort", onAbort);
    }
  };
  return Object.freeze({
    baseUrl: origin,
    health: (options = {}) => request("/v1/health", { ...transportOptions(options), protectedOperation: false }),
    capabilities: (options = {}) => request("/v1/capabilities", transportOptions(options)),
    session: (options = {}) => request("/v1/session", transportOptions(options)),
    getArtifactMetadata: (id, options = {}) => request(`/v1/artifacts/${encodeURIComponent(id)}/metadata`, transportOptions(options)),
    uploadArtifact: ({ bytes, mediaType }, options = {}) => request("/v1/artifacts", { ...transportOptions(options), timeoutMs: options.timeoutMs ?? 30000, method: "POST", body: { schemaVersion: "candy.artifact-upload/1", mediaType, contentEncoding: "base64", content: bytesToBase64(bytes) } }),
    submitJob: (payload, options = {}) => request("/v1/jobs", { ...transportOptions(options), method: "POST", body: payload }),
    getJob: (jobId, options = {}) => request(`/v1/jobs/${encodeURIComponent(jobId)}`, transportOptions(options)),
    cancelJob: (jobId, options = {}) => request(`/v1/jobs/${encodeURIComponent(jobId)}/cancel`, { ...transportOptions(options), method: "POST", body: {} }),
    getResult: (jobId, options = {}) => request(`/v1/jobs/${encodeURIComponent(jobId)}/result`, transportOptions(options)),
  });
}

function bytesToBase64(value) {
  const bytes = value instanceof Uint8Array ? value : new TextEncoder().encode(typeof value === "string" ? value : JSON.stringify(value));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
