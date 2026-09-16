import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalOrdinaryGraphToCsr } from "../../../src/candy/adapters/csrAdapter.js";
import { validateAlgorithmRequest, validateAlgorithmResult, validateGraphSnapshot, validateGraphUpdateBatch } from "../../../src/candy/contracts/algorithmSchemas.js";
import { CANDY_SCHEMA_VERSIONS } from "../../../src/candy/contracts/schemaVersions.js";
import { CANDY_ERROR_CODES, CandyContractError } from "../../../src/candy/contracts/errorClasses.js";
import { JOB_SUBMIT_SCHEMA_VERSION } from "../config.js";
import { parseNativeResult, serializeNativeSsspRequest } from "../backends/nativeRequestAdapter.js";
import { NativeProcessRunner } from "../backends/nativeProcessRunner.js";

const TERMINAL = new Set(["completed", "failed", "cancelled"]);
const SUBMIT_KEYS = new Set(["schemaVersion", "request", "graphSnapshot", "graphArtifactId", "propertyStateArtifactId", "updateBatchArtifactId"]);
function exactSubmit(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CandyContractError(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA, "Job submission must be an object.");
  const unknown = Object.keys(value).filter(key => !SUBMIT_KEYS.has(key));
  if (unknown.length || value.schemaVersion !== JOB_SUBMIT_SCHEMA_VERSION) throw new CandyContractError(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA, "Job submission uses missing, unknown, or incompatible fields.", { unknown });
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function parseJson(bytes, classification = CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA) {
  try { return JSON.parse(bytes.toString("utf8")); }
  catch { throw new CandyContractError(classification, "Immutable CANDY artifact is not valid JSON."); }
}

function validatePriorState(value, request, csr) {
  const keys = ["schemaVersion", "sessionId", "graphId", "graphVersion", "algorithmStateVersion", "sourceVertexId", "objective", "distances", "parents"];
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key)) || keys.some(key => !Object.hasOwn(value, key))) {
    throw new CandyContractError(CANDY_ERROR_CODES.STALE_PROPERTY_STATE, "Prior property-state artifact is malformed.");
  }
  if (value.schemaVersion !== "candy.property-state/1" || value.graphId !== request.graphRef.graphId || value.graphVersion !== request.graphRef.graphVersion || value.sourceVertexId !== request.parameters.sourceVertexId || value.objective !== request.parameters.objective || !Number.isSafeInteger(value.algorithmStateVersion) || value.algorithmStateVersion < 1) {
    throw new CandyContractError(CANDY_ERROR_CODES.STALE_PROPERTY_STATE, "Prior property state does not match the exact graph, source, objective, and version.");
  }
  if (!Array.isArray(value.distances) || !Array.isArray(value.parents) || value.distances.length !== csr.vertexCount || value.parents.length !== csr.vertexCount) throw new CandyContractError(CANDY_ERROR_CODES.STALE_PROPERTY_STATE, "Prior property-state vectors do not match the graph mapping.");
  return value;
}

function validateUpdateEdges(value, maxUpdates) {
  if (!value || value.schemaVersion !== "candy.edge-updates/1" || !Array.isArray(value.insertions) || !Array.isArray(value.deletions)) throw new CandyContractError(CANDY_ERROR_CODES.INVALID_UPDATE_BATCH, "Update edge artifact is malformed.");
  if (value.insertions.length + value.deletions.length > maxUpdates) throw new CandyContractError(CANDY_ERROR_CODES.RESOURCE_LIMIT, "Update batch exceeds its configured limit.");
  const baseEdge = edge => edge && typeof edge === "object" && !Array.isArray(edge) && Object.hasOwn(edge, "source") && Object.hasOwn(edge, "target");
  const validDeletion = edge => baseEdge(edge) && Object.keys(edge).length === 2 && Object.keys(edge).every(key => ["source", "target"].includes(key));
  const validInsertion = edge => baseEdge(edge) && Object.keys(edge).length === 3 && Object.keys(edge).every(key => ["source", "target", "weight"].includes(key)) && Number.isSafeInteger(edge.weight) && edge.weight >= 0 && edge.weight <= 2_147_483_647;
  if (!value.deletions.every(validDeletion) || !value.insertions.every(validInsertion)) throw new CandyContractError(CANDY_ERROR_CODES.INVALID_UPDATE_BATCH, "Update edges are malformed or use unsupported weights.");
  return value;
}

function publicJob(job) {
  return {
    schemaVersion: "candy.job-status/1",
    jobId: job.jobId,
    requestHash: job.requestHash,
    status: job.status,
    algorithm: job.request.algorithm,
    backend: job.request.backend,
    mode: job.request.mode,
    graphRef: job.request.graphRef,
    sourceVertexId: job.request.parameters.sourceVertexId,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    resultRef: job.resultRef ?? null,
    error: job.error ?? null,
    lifecycle: Object.freeze([...(job.lifecycle ?? [job.status])].slice(-12)),
  };
}

export class JobManager {
  constructor({ artifactStore, config }) {
    this.artifactStore = artifactStore;
    this.config = config;
    this.jobs = new Map();
    this.runner = config.nativeRunner ?? new NativeProcessRunner({ runtimeRoot: config.runtimeRoot, stdoutBytes: config.limits.stdoutBytes, stderrBytes: config.limits.stderrBytes, cudaBackendDiscovery: config.cudaBackendDiscovery });
  }

  async submit(payload) {
    exactSubmit(payload);
    const snapshot = validateGraphSnapshot(payload.graphSnapshot);
    const request = validateAlgorithmRequest(payload.request, snapshot); // Graph type fails closed here, before native preparation.
    if (payload.graphArtifactId !== snapshot.canonicalArtifactRef.id) throw new CandyContractError(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA, "Graph artifact does not match GraphSnapshot.canonicalArtifactRef.");
    this.artifactStore.metadata(payload.graphArtifactId);
    if (this.jobs.size >= this.config.limits.maxJobs) throw new CandyContractError(CANDY_ERROR_CODES.RESOURCE_LIMIT, "Runtime job retention limit reached.");
    const requestHash = `sha256:${createHash("sha256").update(stable({ request, snapshot, graphArtifactId: payload.graphArtifactId, propertyStateArtifactId: payload.propertyStateArtifactId ?? null, updateBatchArtifactId: payload.updateBatchArtifactId ?? null })).digest("hex")}`;
    const duplicate = [...this.jobs.values()].find(job => job.requestHash === requestHash && !["failed", "cancelled"].includes(job.status));
    if (duplicate) return publicJob(duplicate);
    const now = new Date().toISOString();
    const job = { jobId: randomUUID(), requestHash, request, snapshot, payload, status: "queued", lifecycle: ["queued"], createdAt: now, updatedAt: now, controller: new AbortController(), resultRef: null, error: null };
    this.jobs.set(job.jobId, job);
    queueMicrotask(() => this.execute(job).catch(() => {}));
    return publicJob(job);
  }

  get(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) throw new CandyContractError(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA, "Unknown CANDY job ID.");
    return publicJob(job);
  }

  result(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) throw new CandyContractError(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA, "Unknown CANDY job ID.");
    if (job.status !== "completed" || !job.fullResult) throw new CandyContractError(job.status === "cancelled" ? CANDY_ERROR_CODES.JOB_CANCELLED : CANDY_ERROR_CODES.ALGORITHM_FAILURE, "CANDY job has no accepted result.");
    return job.fullResult;
  }

  cancel(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) throw new CandyContractError(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA, "Unknown CANDY job ID.");
    if (job.status === "cancelled" || job.status === "cancelling") return publicJob(job);
    if (TERMINAL.has(job.status)) return publicJob(job);
    this.transition(job, job.status === "queued" ? "cancelled" : "cancelling");
    job.controller.abort();
    if (job.status === "cancelling") this.transition(job, "cancelled");
    return publicJob(job);
  }

  transition(job, status) {
    job.status = status;
    if (job.lifecycle.at(-1) !== status) job.lifecycle.push(status);
    job.updatedAt = new Date().toISOString();
  }

  async execute(job) {
    let workspace;
    try {
      if (job.controller.signal.aborted) return;
      this.transition(job, "preparing");
      const graph = parseJson(await this.artifactStore.read(job.payload.graphArtifactId));
      if (graph.graphType !== job.snapshot.graphType) throw new CandyContractError(CANDY_ERROR_CODES.INVALID_GRAPH_TYPE, "Canonical graph artifact type does not match its snapshot.");
      const csr = canonicalOrdinaryGraphToCsr(graph, { limits: { maxVertices: this.config.limits.maxVertices, maxEdges: this.config.limits.maxEdges } });
      if (job.request.backend === "LOCAL_CUDA" && csr.vertexCount > this.config.limits.maxCudaVertices) throw new CandyContractError(CANDY_ERROR_CODES.RESOURCE_LIMIT, "Graph exceeds the qualified CUDA vertex limit.");
      if (csr.vertexCount !== job.snapshot.vertexCount || csr.edgeCount !== job.snapshot.edgeCount) throw new CandyContractError(CANDY_ERROR_CODES.STALE_GRAPH_VERSION, "Canonical graph cardinality changed after job authorization.");
      let priorState = null;
      let updates = null;
      if (job.request.mode !== "STATIC") {
        if (!job.payload.propertyStateArtifactId || !job.payload.updateBatchArtifactId) throw new CandyContractError(CANDY_ERROR_CODES.STALE_PROPERTY_STATE, "Incremental execution requires prior-state and update artifacts.");
        priorState = validatePriorState(parseJson(await this.artifactStore.read(job.payload.propertyStateArtifactId), CANDY_ERROR_CODES.STALE_PROPERTY_STATE), job.request, csr);
        const descriptor = parseJson(await this.artifactStore.read(job.payload.updateBatchArtifactId), CANDY_ERROR_CODES.INVALID_UPDATE_BATCH);
        validateGraphUpdateBatch(descriptor, job.request.graphRef);
        if (descriptor.updateBatchId !== job.request.updateBatchRef.updateBatchId) throw new CandyContractError(CANDY_ERROR_CODES.INVALID_UPDATE_BATCH, "Update artifact identity does not match the request.");
        const insertionArtifact = parseJson(await this.artifactStore.read(descriptor.insertionsArtifactRef.id), CANDY_ERROR_CODES.INVALID_UPDATE_BATCH);
        const deletionArtifact = parseJson(await this.artifactStore.read(descriptor.deletionsArtifactRef.id), CANDY_ERROR_CODES.INVALID_UPDATE_BATCH);
        updates = validateUpdateEdges({ schemaVersion: "candy.edge-updates/1", insertions: insertionArtifact.edges, deletions: deletionArtifact.edges }, this.config.limits.maxUpdates);
      }
      const mappingArtifact = await this.artifactStore.put(Buffer.from(JSON.stringify({ schemaVersion: CANDY_SCHEMA_VERSIONS.VERTEX_MAPPING, ordering: csr.mapping.ordering, entries: csr.mapping.entries })), "application/json");
      workspace = await mkdtemp(join(tmpdir(), "candy-job-"));
      const requestPath = join(workspace, "request.txt");
      await writeFile(requestPath, serializeNativeSsspRequest({ request: job.request, graphSnapshot: job.snapshot, csr, priorState, updates }), { encoding: "utf8", mode: 0o600 });
      if (job.controller.signal.aborted) throw new CandyContractError(CANDY_ERROR_CODES.JOB_CANCELLED, "CANDY job was cancelled before native execution.");
      this.transition(job, "running");
      const processResult = await this.runner.run({ backend: job.request.backend, requestPath, timeoutMs: job.request.resourceHints.timeoutMs, signal: job.controller.signal });
      if (job.controller.signal.aborted) throw new CandyContractError(CANDY_ERROR_CODES.JOB_CANCELLED, "CANDY job was cancelled before result acceptance.");
      this.transition(job, "validating");
      const native = parseNativeResult(processResult.stdout);
      if (processResult.exitCode !== 0) throw new CandyContractError(CANDY_ERROR_CODES.PROCESS_CRASH, "Native SSSP returned success content with a non-zero exit status.", { exitCode: processResult.exitCode });
      if (native.backend !== job.request.backend || native.graphId !== job.request.graphRef.graphId || native.graphVersion !== job.request.graphRef.graphVersion || native.mode !== job.request.mode || native.source !== csr.mapping.toNative(job.request.parameters.sourceVertexId)) throw new CandyContractError(CANDY_ERROR_CODES.RESULT_VALIDATION_FAILURE, "Native result identity does not match the authorized job.");
      const fullArtifact = await this.artifactStore.put(Buffer.from(JSON.stringify({ ...native, vertexMapping: csr.mapping.entries })), "application/vnd.candy.result+json");
      const result = {
        schemaVersion: CANDY_SCHEMA_VERSIONS.ALGORITHM_RESULT,
        jobId: job.jobId,
        requestId: job.request.requestId,
        algorithm: "SSSP",
        backend: job.request.backend,
        mode: job.request.mode,
        inputGraphRef: job.request.graphRef,
        resultType: "ShortestPathTree",
        execution: { status: "completed", exitCode: 0 },
        modelSummary: { sourceVertexId: job.request.parameters.sourceVertexId, reachableCount: native.reachableCount, unreachableCount: native.unreachableCount, affectedCount: native.affectedVertices, runtimeMs: Number(native.metrics?.computeMs ?? native.metrics?.kernelMs ?? 0), validationStatus: native.validation?.status ?? "not_requested" },
        resultArtifactRef: fullArtifact,
        mappingArtifactRef: mappingArtifact,
        metrics: native.metrics ?? {},
        validation: { status: native.validation?.status ?? "not_requested", method: job.request.mode === "COMPARE" ? "native_static_reference" : "native_semantic_validation" },
        warnings: [],
      };
      validateAlgorithmResult(result);
      if (job.controller.signal.aborted) throw new CandyContractError(CANDY_ERROR_CODES.JOB_CANCELLED, "CANDY job was cancelled before result acceptance.");
      job.fullResult = result;
      job.resultRef = fullArtifact.id;
      this.transition(job, "completed");
    } catch (error) {
      if (job.controller.signal.aborted || error?.code === CANDY_ERROR_CODES.JOB_CANCELLED) {
        job.error = new CandyContractError(CANDY_ERROR_CODES.JOB_CANCELLED, "CANDY job was cancelled.").toJSON();
        this.transition(job, "cancelled");
      } else {
        const safe = error instanceof CandyContractError ? error : new CandyContractError(CANDY_ERROR_CODES.ALGORITHM_FAILURE, "CANDY job failed during controlled execution.");
        job.error = safe.toJSON();
        this.transition(job, "failed");
      }
    } finally {
      if (workspace) await rm(workspace, { recursive: true, force: true });
    }
  }
}
