import http from "node:http";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ArtifactStore } from "./artifacts/artifactStore.js";
import { createSessionAuth } from "./auth/sessionAuth.js";
import { buildCapabilityDeclaration } from "./capabilities/capabilityRegistry.js";
import { API_SCHEMA_VERSION, ARTIFACT_UPLOAD_SCHEMA_VERSION, CAPABILITY_SCHEMA_VERSION, createRuntimeConfig, JOB_SUBMIT_SCHEMA_VERSION, SERVICE_VERSION } from "./config.js";
import { corsHeaders, readJsonBody, statusForError, structuredError, writeJson } from "./http/httpUtils.js";
import { JobManager } from "./jobs/jobManager.js";
import { CANDY_ERROR_CODES, CandyContractError } from "../../src/candy/contracts/errorClasses.js";
import { CANDY_SCHEMA_VERSIONS } from "../../src/candy/contracts/schemaVersions.js";

const ARTIFACT_ROUTE = /^\/v1\/artifacts\/(sha256:[a-f0-9]{64})\/metadata$/;
const JOB_ROUTE = /^\/v1\/jobs\/([0-9a-f-]{36})$/;
const JOB_CANCEL_ROUTE = /^\/v1\/jobs\/([0-9a-f-]{36})\/cancel$/;
const JOB_RESULT_ROUTE = /^\/v1\/jobs\/([0-9a-f-]{36})\/result$/;

function protectedRequest(request, response, config, auth) {
  const origin = request.headers.origin;
  if (origin && !config.allowedOrigins.includes(origin)) {
    writeJson(response, 403, { schemaVersion: CANDY_SCHEMA_VERSIONS.ALGORITHM_ERROR, classification: "ALGORITHM_FAILURE", message: "Browser origin is not allowed.", userCorrectable: true, retryable: false, details: {} });
    return false;
  }
  if (!auth.authorize(request.headers.authorization)) {
    writeJson(response, 401, { schemaVersion: CANDY_SCHEMA_VERSIONS.ALGORITHM_ERROR, classification: "ALGORITHM_FAILURE", message: "Pairing authentication is required.", userCorrectable: true, retryable: false, details: {} }, corsHeaders(origin, config.allowedOrigins));
    return false;
  }
  return true;
}

function decodeArtifactUpload(value, limit) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(key => !["schemaVersion", "mediaType", "contentEncoding", "content"].includes(key)) || value.schemaVersion !== ARTIFACT_UPLOAD_SCHEMA_VERSION || typeof value.content !== "string") {
    throw new CandyContractError(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA, "Artifact upload uses an incompatible schema.");
  }
  let bytes;
  if (value.contentEncoding === "utf8") bytes = Buffer.from(value.content, "utf8");
  else if (value.contentEncoding === "base64" && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value.content)) bytes = Buffer.from(value.content, "base64");
  else throw new CandyContractError(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA, "Unsupported artifact content encoding.");
  if (bytes.length > limit) throw new CandyContractError(CANDY_ERROR_CODES.RESOURCE_LIMIT, "Artifact exceeds the configured size limit.");
  return { bytes, mediaType: value.mediaType };
}

export async function startCandyRuntime(overrides = {}) {
  const config = createRuntimeConfig(overrides);
  const auth = createSessionAuth(overrides.pairingToken);
  const artifactRoot = config.artifactRoot ?? await mkdtemp(join(tmpdir(), "candy-runtime-artifacts-"));
  const artifactStore = await new ArtifactStore({ root: artifactRoot, maxBytes: config.limits.artifactBytes }).initialize();
  const jobs = new JobManager({ artifactStore, config });
  const capabilities = await buildCapabilityDeclaration(config);
  const server = http.createServer(async (request, response) => {
    const origin = request.headers.origin;
    const cors = corsHeaders(origin, config.allowedOrigins);
    if (request.method === "OPTIONS") {
      if (!origin || !config.allowedOrigins.includes(origin)) return writeJson(response, 403, { error: "Origin is not allowed." });
      response.writeHead(204, { ...cors, "cache-control": "no-store" });
      return response.end();
    }
    if (request.method === "GET" && request.url === "/v1/health") {
      return writeJson(response, 200, {
        schemaVersion: API_SCHEMA_VERSION,
        serviceVersion: SERVICE_VERSION,
        schemaVersions: [API_SCHEMA_VERSION, CAPABILITY_SCHEMA_VERSION, ARTIFACT_UPLOAD_SCHEMA_VERSION, JOB_SUBMIT_SCHEMA_VERSION, ...Object.values(CANDY_SCHEMA_VERSIONS)],
        platform: process.platform === "win32" ? "windows-wsl-boundary" : "linux",
        runtimeStatus: "ready",
      }, cors);
    }
    if (!protectedRequest(request, response, config, auth)) return;
    try {
      if (request.method === "GET" && request.url === "/v1/capabilities") return writeJson(response, 200, capabilities, cors);
      if (request.method === "POST" && request.url === "/v1/artifacts") {
        const upload = decodeArtifactUpload(await readJsonBody(request, config.limits.requestBytes), config.limits.artifactBytes);
        return writeJson(response, 201, await artifactStore.put(upload.bytes, upload.mediaType), cors);
      }
      const artifact = ARTIFACT_ROUTE.exec(request.url);
      if (request.method === "GET" && artifact) return writeJson(response, 200, artifactStore.metadata(artifact[1]), cors);
      if (request.method === "POST" && request.url === "/v1/jobs") return writeJson(response, 202, await jobs.submit(await readJsonBody(request, config.limits.requestBytes)), cors);
      const status = JOB_ROUTE.exec(request.url);
      if (request.method === "GET" && status) return writeJson(response, 200, jobs.get(status[1]), cors);
      const cancel = JOB_CANCEL_ROUTE.exec(request.url);
      if (request.method === "POST" && cancel) return writeJson(response, 200, jobs.cancel(cancel[1]), cors);
      const result = JOB_RESULT_ROUTE.exec(request.url);
      if (request.method === "GET" && result) return writeJson(response, 200, jobs.result(result[1]), cors);
      return writeJson(response, 404, { schemaVersion: CANDY_SCHEMA_VERSIONS.ALGORITHM_ERROR, classification: "ALGORITHM_FAILURE", message: "Unknown runtime route.", userCorrectable: true, retryable: false, details: {} }, cors);
    } catch (error) {
      if (!response.headersSent) writeJson(response, statusForError(error), structuredError(error), cors);
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.port, config.host, resolve);
  });
  const address = server.address();
  return Object.freeze({
    host: config.host,
    port: address.port,
    pairingToken: auth.token,
    capabilities,
    jobs,
    artifactStore,
    async close() {
      await new Promise(resolve => server.close(resolve));
      if (!config.artifactRoot) await artifactStore.dispose();
    },
  });
}
