import { buildSafeModelPreview } from "./modelPromptBuilder.js";
import { EXPORT_IDS, GRAPH_LAYOUT_IDS, GRAPH_VIEW_IDS, INPUT_ROUTE_IDS, SECTION_IDS } from "./capabilityRegistry.js";

function compactBatch(batch) {
  if (!batch) return null;
  return {
    id: batch.id,
    label: batch.label,
    version: batch.version ?? 1,
    parseMode: batch.parseMode ?? "unknown",
    detectedFormat: batch.detectedFormat ?? null,
    fileNames: batch.files?.map(file => file.name) ?? batch.fileNames ?? [],
    fileCount: batch.files?.length ?? batch.fileCount ?? 0,
    metadataOnly: Boolean(batch.metadataOnly),
    batchUpdate: Boolean(batch.batchUpdate),
    separateGraphFiles: Boolean(batch.separateGraphFiles),
    mixedFormats: Boolean(batch.mixedFormats),
    mappingSpecStatus: batch.mappingSpecStatus ?? "none",
    hasMappingSpec: Boolean(batch.mappingSpec),
    hasDeterministicDraftMapping: Boolean(batch.deterministicDraftMapping),
    hasRepairedMapping: Boolean(batch.repairedMapping),
    hasGeneratedParserFromMapping: Boolean(batch.generatedParserFromMapping),
    expectedOutputComparisonStatus: batch.expectedOutputComparison?.status ?? null,
  };
}

function compactStats(state) {
  const stats = state?.stats;
  if (!stats) return null;
  return {
    hyperedges: stats.E ?? state.hyperedgeCount ?? 0,
    vertices: stats.V ?? state.vertexCount ?? 0,
    minCardinality: stats.min ?? null,
    maxCardinality: stats.max ?? null,
    averageCardinality: stats.avg ?? null,
    hasTime: Boolean(stats.hasT),
    hasWeight: Boolean(stats.hasW),
  };
}

export function buildOrchestratorContext({
  state,
  activeBatch = null,
  previewLimits = {},
  locationLike = null,
} = {}) {
  const preview = activeBatch ? buildSafeModelPreview(activeBatch, previewLimits) : null;
  const localModel = state?.localModel ?? {};
  const locationSnapshot = locationLike ? {
    origin: locationLike.origin,
    protocol: locationLike.protocol,
    hostname: locationLike.hostname,
  } : null;

  return {
    appVersion: "v7.1-conversational-hypergraph-assistant",
    privacy: {
      offlineOnly: true,
      cloudApisAllowed: false,
      fullFilesIncluded: false,
      filePreviewsAreUntrustedData: true,
    },
    currentRoute: {
      fmt: state?.fmt ?? null,
      label: state?.formatLabel ?? null,
      allowedInputRoutes: INPUT_ROUTE_IDS,
    },
    dashboard: {
      activeSection: state?.activeSection ?? "mappings",
      allowedSections: SECTION_IDS,
      expId: state?.expId ?? null,
      allowedExportPreviews: EXPORT_IDS,
      vizLimit: state?.vizLimit ?? 50,
      graphView: state?.graphView ?? "hypergraph",
      graphLayout: state?.graphLayout ?? "force",
      graphSearch: state?.graphSearch ?? "",
      allowedGraphViews: GRAPH_VIEW_IDS,
      allowedGraphLayouts: GRAPH_LAYOUT_IDS,
    },
    graph: {
      hasGraph: Boolean(state?.hasGraph),
      canonicalGraphAvailableForExports: Boolean(state?.hasGraph),
      hyperedgeCount: state?.hyperedgeCount ?? 0,
      vertexCount: state?.vertexCount ?? 0,
      incidenceCount: state?.incidenceCount ?? 0,
      graphVersion: state?.graphVersion ?? 0,
      stats: compactStats(state),
      warningCount: state?.warningCount ?? 0,
      error: state?.err ?? "",
    },
    activeBatch: compactBatch(activeBatch ?? state?.activeBatch),
    uploadWorkspace: {
      activeBatchId: state?.activeBatchId ?? null,
      previousBatchId: state?.previousBatchId ?? null,
      batchVersion: state?.batchVersion ?? 0,
      batchCount: state?.agentBatches?.length ?? 0,
      activeFileCount: state?.agentFileCount ?? 0,
      batches: (state?.agentBatches ?? []).slice(-6),
    },
    boundedActiveBatchPreview: preview,
    customParser: {
      fileCount: state?.customFileCount ?? 0,
      codeVersion: state?.customCodeVersion ?? 0,
      codeSource: state?.customCodeSource ?? "user",
      hasCode: Boolean(state?.customCodeExists),
      hasResult: Boolean(state?.customResultId),
      resultCount: state?.customResultCount ?? 0,
      running: Boolean(state?.customRunning),
      latestError: state?.customErr ?? "",
      binding: state?.customCodeBinding ?? null,
    },
    localModel: {
      enabled: localModel.config?.enabled !== false,
      runtime: localModel.config?.runtime ?? "ollama",
      activeTransport: localModel.config?.activeTransport ?? null,
      activeBaseUrl: localModel.config?.activeBaseUrl ?? "",
      model: localModel.config?.model ?? "",
      status: localModel.status ?? "disconnected",
      message: localModel.message ?? "",
    },
    deployment: {
      location: locationSnapshot,
      diagnosticsClassification: localModel.diagnostics?.lastConnectionErrorClassification ?? null,
    },
  };
}
