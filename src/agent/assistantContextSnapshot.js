const MAX_TEXT = 240;
const MAX_HISTORY = 5;
const MAX_CAPABILITIES = 6;
const MAX_JOBS = 5;
const MAX_COUNTS = 30;
const MAX_REFERENCES = 6;

function text(value, limit = MAX_TEXT) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function finite(value) {
  if (value == null || typeof value === "boolean" || (typeof value === "string" && !value.trim())) return null;
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function safeRef(value) {
  if (!value || typeof value !== "object") return null;
  return {
    graphId: text(value.graphId, 120) || null,
    graphVersion: finite(value.graphVersion),
  };
}

function safeMutation(value) {
  if (!value || typeof value !== "object") return null;
  return {
    revision: finite(value.revision),
    source: text(value.source, 80) || null,
    summary: text(value.summary, 300) || null,
    graphVersion: finite(value.graphVersion ?? value.nextGraphVersion),
    timestamp: text(value.timestamp ?? value.createdAt, 80) || null,
  };
}

function summarizeVerifiedReferences(value) {
  if (Array.isArray(value)) {
    return value.slice(-MAX_REFERENCES).map(reference => ({
      kind: text(reference?.kind ?? reference?.type, 80) || null,
      id: text(reference?.id ?? reference?.entityId ?? reference?.graphId, 160) || null,
      graphVersion: finite(reference?.graphVersion),
    }));
  }

  // The live application currently supplies recentReferenceContext(), whose
  // canonical shape is { vertices: string[], hyperedges: string[] }. Keep this
  // bounded and read-only while preserving the entity type.
  if (value && typeof value === "object") {
    const vertices = Array.isArray(value.vertices) ? value.vertices.slice(-MAX_REFERENCES) : [];
    const hyperedges = Array.isArray(value.hyperedges) ? value.hyperedges : [];
    return [
      ...vertices.map(id => ({ kind: "vertex", id: text(id, 160) || null, graphVersion: null })),
      ...hyperedges.slice(-MAX_REFERENCES).map(id => ({ kind: "hyperedge", id: text(id, 160) || null, graphVersion: null })),
    ].filter(reference => reference.id).slice(-MAX_REFERENCES);
  }

  return [];
}

export function summarizeAlgorithmState(algo = {}) {
  const result = algo?.result ?? null;
  // The Algorithms owner recomputes synchronously for its current input. An
  // explicitly stale/error result must never acquire computed authority here.
  const status = algo.isCurrent === false || algo.status === "stale" || result?.status === "stale"
    ? "stale"
    : algo.error || algo.status === "error" ? "error"
      : result ? text(result.status ?? algo.status, 80) || "computed" : "not_computed";
  const common = {
    selectedId: text(algo?.algorithmId, 80) || null,
    selectedLabel: text(algo?.algorithm?.label, 120) || null,
    hasResult: Boolean(result),
    status,
    error: text(algo?.error, 300) || null,
    startVertex: algo?.startVertex == null ? null : text(algo.startVertex, 120),
    targetVertex: algo?.targetVertex == null ? null : text(algo.targetVertex, 120),
  };
  if (!result) return Object.freeze(common);

  let summary;
  switch (algo.algorithmId) {
    case "connected_components":
      summary = {
        kind: "connected_components",
        count: finite(result.count) ?? 0,
        largestSize: finite(result.components?.[0]?.size) ?? 0,
        componentSizes: (result.components ?? []).slice(0, 12).map(component => finite(component.size) ?? 0),
      };
      break;
    case "bfs":
    case "dfs":
      summary = {
        kind: text(result.algorithm, 80) || algo.algorithmId,
        reached: finite(result.reached) ?? 0,
        total: finite(result.total) ?? 0,
        visitOrderPreview: (result.visitOrder ?? []).slice(0, 20).map(item => text(item, 120)),
      };
      break;
    case "shortest_path":
      summary = {
        kind: "shortest_path",
        reachable: result.reachable ?? null,
        distance: result.targetVertex != null && result.distances instanceof Map
          ? (Number.isFinite(result.distances.get(result.targetVertex)) ? result.distances.get(result.targetVertex) : null)
          : null,
        hopCount: Array.isArray(result.path) && result.path.length ? result.path.length - 1 : null,
        pathPreview: (result.path ?? []).slice(0, 20).map(item => text(item, 120)),
        warningCount: Array.isArray(result.warnings) ? result.warnings.length : 0,
      };
      break;
    case "degree_distribution":
      summary = {
        kind: "degree_distribution",
        totalVertices: finite(result.totalVertices) ?? 0,
        minDegree: finite(result.min),
        maxDegree: finite(result.max),
        averageDegree: finite(result.avg),
        highestDegreeVertices: (result.entries ?? []).slice(0, 8).map(entry => ({
          vertex: text(entry.vertex, 120),
          degree: finite(entry.degree),
        })),
      };
      break;
    case "k_core":
      summary = {
        kind: "k_core",
        status: text(result.status, 80) || "computed",
        degeneracy: status === "computed" ? finite(result.degeneracy) : null,
        shellCount: status === "computed" ? (Array.isArray(result.cores) ? result.cores.length : 0) : null,
        highestShells: status === "computed" ? (result.cores ?? []).slice(0, 8).map(core => ({ k: finite(core.k), size: finite(core.size) })) : [],
        exceededResource: text(result.exceededResource, 120) || null,
        reason: text(result.reason, 300) || null,
      };
      break;
    default:
      summary = { kind: text(result.algorithm, 80) || text(algo.algorithmId, 80) || "unknown" };
  }
  return Object.freeze({ ...common, result: Object.freeze(summary) });
}

function summarizeCandyResult(result) {
  if (!result || typeof result !== "object") return null;
  const native = result.native ?? {};
  const counts = native.counts ?? native.deltaCounts ?? result.counts ?? result.deltaCounts;
  return {
    algorithm: text(result.algorithm ?? native.algorithm, 120) || null,
    backend: text(result.backend ?? native.backend, 80) || null,
    mode: text(result.mode ?? native.mode, 80) || null,
    interpretation: text(result.interpretation, 120) || null,
    inputGraphRef: safeRef(result.inputGraphRef ?? result.graphRef),
    outputGraphRef: safeRef(result.outputGraphRef ?? native.outputGraphRef),
    totalConnectedTriples: finite(native.totalConnectedTriples ?? native.deltaTotalConnectedTriples ?? result.totalConnectedTriples),
    counts: Array.isArray(counts) ? counts.slice(0, MAX_COUNTS).map(value => finite(value) ?? 0) : null,
    validationStatus: text(result.validation?.status ?? native.validation?.status, 80) || null,
  };
}

function summarizeCandy(candy = {}) {
  const capabilities = (candy.capabilities ?? []).slice(0, MAX_CAPABILITIES).map(item => ({
    capability: text(item.capability, 120) || null,
    algorithm: text(item.algorithm, 120) || null,
    backend: text(item.backend, 80) || null,
    modes: (item.modes ?? []).slice(0, 4).map(mode => text(mode, 60)),
    devices: (item.devices ?? []).slice(0, 4).map(device => ({
      id: finite(device.id),
      name: text(device.name, 120) || null,
      computeCapability: text(device.computeCapability, 40) || null,
      qualifiedArchitecture: text(device.qualifiedArchitecture, 40) || null,
    })),
  }));
  const jobs = (candy.jobs ?? []).slice(-MAX_JOBS).map(job => ({
    jobId: text(job.jobId, 120) || null,
    status: text(job.status, 80) || null,
    algorithm: text(job.algorithm, 120) || null,
    backend: text(job.backend, 80) || null,
    mode: text(job.mode, 80) || null,
    errorClassification: text(job.error?.classification ?? job.errorClassification, 120) || null,
  }));
  return {
    featureEnabled: Boolean(candy.featureEnabled),
    status: text(candy.status, 80) || "disabled",
    authorized: Boolean(candy.authorized),
    runtimeVersion: text(candy.runtimeVersion, 80) || null,
    capabilityStatus: text(candy.capabilityStatus, 80) || "unavailable",
    capabilityReason: text(candy.capabilityReason, 240) || null,
    runtimeCapabilityStatus: text(candy.runtimeCapabilityStatus, 80) || "unavailable",
    analysisStatus: text(candy.analysisStatus, 80) || null,
    capabilities,
    jobs,
    selectedResult: summarizeCandyResult(candy.selectedMotifResult),
    staticAvailability: candy.staticAvailability ? {
      ready: Boolean(candy.staticAvailability.ready),
      reason: text(candy.staticAvailability.reason, 160) || null,
      classification: text(candy.staticAvailability.classification, 120) || null,
    } : null,
    incrementalAvailability: candy.incrementalAvailability ? {
      ready: Boolean(candy.incrementalAvailability.ready),
      reason: text(candy.incrementalAvailability.reason, 160) || null,
      classification: text(candy.incrementalAvailability.classification, 120) || null,
    } : null,
  };
}

function summarizePendingUpdate(pending, candy) {
  if (!pending) return null;
  return {
    updateId: text(pending.updateId, 120) || null,
    revision: finite(pending.revision),
    status: text(pending.status, 80) || null,
    baseGraphVersion: finite(pending.baseGraphVersion),
    nextGraphVersion: finite(pending.nextGraphVersion),
    motifImpact: text(pending.motifImpact, 80) || null,
    operationCount: finite(pending.operationCount),
    resultCurrent: Boolean(pending.resultCurrent),
    staleReason: text(pending.staleReason, 240) || null,
    analysisStatus: text(candy?.analysisStatus, 80) || null,
  };
}

/**
 * Produce a bounded, read-only view of live application state for ordinary
 * assistant conversation. This intentionally excludes graph bodies, parser
 * source, Runtime credentials, native paths, confirmation tokens and mutation
 * plans. The snapshot is context only; it grants the model no execution authority.
 */
export function buildAssistantApplicationSnapshot(state = {}) {
  const activeBatch = state.activeBatch ?? null;
  const selectedMapping = state.selectedMappingSummary ?? null;
  const snapshot = {
    schemaVersion: 1,
    authority: "live_application_state_read_only",
    graph: {
      available: Boolean(state.hasGraph),
      id: text(state.graphId, 120) || null,
      version: finite(state.graphVersion) ?? 0,
      type: text(state.graphType ?? state.candy?.graphType, 80) || "Hypergraph",
      fingerprint: text(state.graphFingerprint, 96) || null,
      counts: {
        hyperedges: finite(state.hyperedgeCount) ?? 0,
        vertices: finite(state.vertexCount) ?? 0,
        incidences: finite(state.incidenceCount) ?? 0,
        committedHyperedges: finite(state.committedHyperedgeCount) ?? 0,
      },
      statistics: state.resultSummary ? { ...state.resultSummary } : null,
      preview: {
        active: Boolean(state.batchPreviewActive),
        previewHyperedges: finite(state.batchPreviewHyperedgeCount) ?? 0,
        parsedUpdates: finite(state.batchParsedCount) ?? 0,
        unknownUpdates: finite(state.batchUnknownCount) ?? 0,
        visualLimit: finite(state.vizLimit) ?? 0,
      },
      history: {
        count: finite(state.graphHistoryCount) ?? 0,
        lastMutation: safeMutation(state.lastGraphMutation),
        recent: (state.recentGraphHistory ?? []).slice(-MAX_HISTORY).map(event => ({
          id: text(event.id, 120) || null,
          graphId: text(event.graphId, 120) || null,
          graphVersion: finite(event.graphVersion),
          timestamp: text(event.timestamp, 80) || null,
          source: text(event.source, 80) || null,
          summary: text(event.summary, 300) || null,
          beforeGraphType: text(event.beforeGraphType, 80) || null,
          afterGraphType: text(event.afterGraphType, 80) || null,
        })),
      },
    },
    ui: {
      activeSection: text(state.activeSection, 80) || null,
      inputRoute: text(state.formatLabel ?? state.fmt, 120) || null,
      exportPreview: text(state.expId, 120) || null,
      selectedMappingId: text(state.selectedMappingId, 80) || null,
      selectedEntity: state.selectedGraphEntity ? {
        type: text(state.selectedGraphEntity.type, 80) || null,
        id: text(state.selectedGraphEntity.id, 160) || null,
      } : null,
      selectionLabel: text(state.selectionLabel, 180) || null,
      visualization: {
        view: text(state.graphView, 80) || null,
        layout: text(state.graphLayout, 80) || null,
        search: text(state.graphSearch, 160) || null,
        limit: finite(state.vizLimit) ?? 0,
      },
    },
    mapping: {
      selected: selectedMapping ? {
        id: text(selectedMapping.id, 80) || null,
        title: text(selectedMapping.title, 120) || null,
        status: text(selectedMapping.status, 80) || null,
        reason: text(selectedMapping.reason, 200) || null,
        totalRows: finite(selectedMapping.totalRows),
        visibleRows: finite(selectedMapping.visibleRows),
        complete: Boolean(selectedMapping.complete),
      } : null,
      activeBatch: activeBatch ? {
        id: text(activeBatch.id, 120) || null,
        label: text(activeBatch.label, 160) || null,
        version: finite(activeBatch.version) ?? 0,
        parseMode: text(activeBatch.parseMode, 80) || "unknown",
        mappingStatus: text(activeBatch.mappingSpecStatus, 80) || "none",
        mappingRevision: finite(activeBatch.mappingRevision) ?? 0,
        groupingStatus: text(activeBatch.groupingStatus, 80) || "none",
        groupingRevision: finite(activeBatch.groupingRevision) ?? 0,
        transformationPlanStatus: text(activeBatch.transformationPlanStatus, 80) || "none",
      } : null,
    },
    parser: {
      running: Boolean(state.customRunning),
      codeAvailable: Boolean(state.customCodeExists),
      codeSource: text(state.customCodeSource, 80) || null,
      resultAvailable: Boolean(state.customResultId),
      resultHyperedges: finite(state.customResultCount) ?? 0,
      error: text(state.customErr, 300) || null,
    },
    algorithm: state.algorithmSummary ?? null,
    pendingDynamicUpdate: summarizePendingUpdate(state.pendingDynamicUpdate, state.candy),
    candy: summarizeCandy(state.candy),
    recentVerifiedReferences: summarizeVerifiedReferences(state.recentVerifiedReferences),
    recentActivity: (state.agentBatches ?? []).slice(-MAX_HISTORY).map(batch => ({
      kind: "dataset_batch",
      id: text(batch.id, 120) || null,
      label: text(batch.label, 160) || null,
      status: text(batch.status, 80) || null,
      mappingStatus: text(batch.mappingSpecStatus, 80) || null,
    })),
  };
  return Object.freeze(snapshot);
}
