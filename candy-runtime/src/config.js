import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const SERVICE_VERSION = "candy-runtime-companion/1";
export const API_SCHEMA_VERSION = "candy.runtime-api/1";
export const CAPABILITY_SCHEMA_VERSION = "candy.capabilities/1";
export const ARTIFACT_UPLOAD_SCHEMA_VERSION = "candy.artifact-upload/1";
export const JOB_SUBMIT_SCHEMA_VERSION = "candy.job-submit/1";

export const DEFAULT_ALLOWED_ORIGINS = Object.freeze([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://hypergraphproject.github.io",
]);

export const DEFAULT_LIMITS = Object.freeze({
  requestBytes: 8 * 1024 * 1024,
  artifactBytes: 6 * 1024 * 1024,
  resultBytes: 8 * 1024 * 1024,
  stdoutBytes: 8 * 1024 * 1024,
  stderrBytes: 64 * 1024,
  maxVertices: 1_000_000,
  maxEdges: 10_000_000,
  maxUpdates: 1_000_000,
  maxJobs: 256,
  maxCudaVertices: 10_000,
});

const runtimeRoot = resolve(fileURLToPath(new URL("../", import.meta.url)));

export function createRuntimeConfig(overrides = {}) {
  const host = overrides.host ?? "127.0.0.1";
  if (host !== "127.0.0.1") throw new Error("The CANDY companion may bind only to 127.0.0.1 in Scope 2.");
  return Object.freeze({
    host,
    port: overrides.port ?? 8791,
    allowedOrigins: Object.freeze([...(overrides.allowedOrigins ?? DEFAULT_ALLOWED_ORIGINS)]),
    limits: Object.freeze({ ...DEFAULT_LIMITS, ...(overrides.limits ?? {}) }),
    artifactRoot: overrides.artifactRoot,
    runtimeRoot,
    backendAvailable: overrides.backendAvailable,
    cudaBackendDiscovery: overrides.cudaBackendDiscovery,
    nativeRunner: overrides.nativeRunner,
  });
}
