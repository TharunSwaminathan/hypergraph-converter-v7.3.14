import { DEFAULT_CANDY_RUNTIME_URL } from "./featureFlag.js";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost"]);
const ERROR_SCHEMA = "candy.algorithm-error/1";

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

export function createCandyClient({ baseUrl = DEFAULT_CANDY_RUNTIME_URL, token = "", fetchImpl = globalThis.fetch } = {}) {
  const origin = validateCandyRuntimeUrl(baseUrl);
  if (typeof fetchImpl !== "function") throw new TypeError("A fetch implementation is required.");
  const request = async (path, { method = "GET", body, protectedOperation = true } = {}) => {
    const headers = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (protectedOperation) {
      if (!token) throw new CandyClientError("UNAUTHORIZED", "Enter the session pairing credential from the local companion.");
      headers.Authorization = `Bearer ${token}`;
    }
    let response;
    try { response = await fetchImpl(`${origin}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store" }); }
    catch { throw new CandyClientError("BACKEND_UNAVAILABLE", "The local CANDY Runtime Companion is unavailable. Browser-only mode remains active."); }
    let payload;
    try { payload = await response.json(); }
    catch { throw new CandyClientError("OUTPUT_PARSE_FAILURE", "The local companion returned invalid JSON."); }
    if (!response.ok) {
      const classification = response.status === 401 ? "UNAUTHORIZED" : payload?.schemaVersion === ERROR_SCHEMA && typeof payload.classification === "string" ? payload.classification : "BACKEND_UNAVAILABLE";
      throw new CandyClientError(classification, payload?.message || "The local companion rejected the request.", payload?.details ?? {});
    }
    return payload;
  };
  return Object.freeze({
    baseUrl: origin,
    health: () => request("/v1/health", { protectedOperation: false }),
    capabilities: () => request("/v1/capabilities"),
    uploadArtifact: ({ bytes, mediaType }) => request("/v1/artifacts", { method: "POST", body: { schemaVersion: "candy.artifact-upload/1", mediaType, contentEncoding: "base64", content: bytesToBase64(bytes) } }),
    submitJob: payload => request("/v1/jobs", { method: "POST", body: payload }),
    getJob: jobId => request(`/v1/jobs/${encodeURIComponent(jobId)}`),
    cancelJob: jobId => request(`/v1/jobs/${encodeURIComponent(jobId)}/cancel`, { method: "POST", body: {} }),
    getResult: jobId => request(`/v1/jobs/${encodeURIComponent(jobId)}/result`),
  });
}

function bytesToBase64(value) {
  const bytes = value instanceof Uint8Array ? value : new TextEncoder().encode(typeof value === "string" ? value : JSON.stringify(value));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
