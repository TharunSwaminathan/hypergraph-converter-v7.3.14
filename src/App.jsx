import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { T, inputSt } from "./theme.js";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import BarChart from "./components/BarChart.jsx";
import Viz from "./components/Viz.jsx";
import { Pill, StatCard, MappingBox } from "./components/ui.jsx";
import { useUpload, useMultiUpload } from "./hooks/useFileUpload.js";
import { normalizeParsedHyperedges, autoDetect, parseInputFormat } from "./utils/parsers.js";
import { arrayMax } from "./utils/numeric.js";
import { parseBatchUpdates, applyBatchUpdates, batchUpdatesToMutationOperations } from "./utils/batchUpdates.js";
import {
  buildH2V, buildV2H, buildH2HBounded, buildV2VBounded, buildCSR,
  expH2V, expV2H, expH2HResult, expH2HAvailabilityResult, expV2V, expIncidence, expBipartite, expClique, expMatrixResult, expCSRCsv, expCanonicalJSON,
  computeStats, countTriadsBounded, validateHes, notRequestedDerived, DERIVED_STATUS,
} from "./utils/mappings.js";
import { shouldRequestH2H, shouldRequestV2V } from "./utils/derivedRequests.js";
import {
  buildAiPrompt, DEFAULT_CUSTOM_PARSER, runCustomParser,
  buildBatchCustomParserTemplate, normalizeCustomParserOutput,
} from "./utils/customParser.js";
import AlgorithmsPanel from "./components/AlgorithmsPanel.jsx";
import TriadStatistic from "./components/TriadStatistic.jsx";
import AdvancedOptionsPanel from "./components/AdvancedOptionsPanel.jsx";
import { useAlgorithms } from "./hooks/useAlgorithms.js";
import AgentChatPanel from "./components/AgentChatPanel.jsx";
import {
  analyzeUploadBatch,
  detectUploadedFiles,
  findSuspiciousOutputWarnings,
  getFormatDetails,
  readUploadedTextFiles,
} from "./agent/fileDetection.js";
import {
  generateConversationWithLocalModel,
  generateWithLocalModel,
} from "./agent/localModelClient.js";
import {
  buildRuntimeCommands,
  createRuntimeDiagnosticsSnapshot,
  detectDeploymentMode,
  diagnosticsEstablishConnection,
  formatActionableRuntimeError,
  isIsolatedRuntimeProbeMode,
  runRuntimeDiagnostics,
  runtimeCommandLabel,
} from "./agent/localRuntimeDiagnostics.js";
import {
  connectOllamaAutomatically,
  DIRECT_OLLAMA_BASE_URL,
  BRIDGE_OLLAMA_BASE_URL,
  getOllamaAttemptOrder,
  listModelsForTransport,
} from "./agent/ollamaConnectionManager.js";
import {
  DEFAULT_LOCAL_MODEL_TEMPERATURE,
  DEFAULT_LOCAL_MODEL_TIMEOUT_MS,
  LOCAL_MODEL_TASK_TIMEOUTS,
  LOCAL_MODEL_SETTINGS_VERSION,
  RECOMMENDED_OLLAMA_MODEL, LOCAL_MODEL_DISABLED_MESSAGE,
  isEmptyOrPlaceholderModel, loadLocalModelConfig, saveLocalModelConfig,
} from "./agent/localModelSettings.js";
import { createLocalModelRequestCoordinator } from "./agent/localModelRequestCoordinator.js";
import {
  createLocalModelGenerationState,
  generationStateForOutcome,
  generationStateForStart,
  generationStateForStopping,
  runtimeBannerText,
} from "./agent/localModelRuntimeState.js";
import {
  appendBoundedRequestDiagnostic,
  createLocalModelRequestDiagnostic,
} from "./agent/ollamaMetrics.js";
import {
  addVerifiedGraphReferences,
  createGraphConversationReferences,
  pruneGraphConversationReferences,
  recentReferenceContext,
  referencesFromMutationPlan,
} from "./agent/graphConversationReferences.js";
import {
  buildConversationPrompt,
  buildLocalModelRequest,
  buildSafeModelPreview,
  buildSessionSummaryPrompt,
} from "./agent/modelPromptBuilder.js";
import { generateValidatedModelResponse, rawResponsePreview } from "./agent/modelReliability.js";
import { validateParserBatchBinding } from "./agent/parserBinding.js";
import { extractFirstJsonObject } from "./agent/modelResponseValidator.js";
import { buildParserTrainingExample, downloadParserTrainingExample } from "./agent/trainingExampleBuilder.js";
import { generateParserFromMappingSpec } from "./agent/mappingSpecParserGenerator.js";
import { compareWithExpectedOutput, parseExpectedOutputText } from "./agent/expectedOutputComparison.js";
import { buildMappingFineTuneExample, downloadMappingArtifact } from "./agent/mappingSpecTrainingBuilder.js";
import { buildDeterministicPreMapping } from "./agent/deterministicPreMapping.js";
import { profileDatasetFiles } from "./agent/datasetProfiler.js";
import { profileDatasetRelationships } from "./agent/datasetRelationshipProfiler.js";
import { buildDatasetGroupingDraft } from "./agent/datasetGrouping.js";
import { buildDatasetMappingSpecV2FromBatch } from "./agent/deterministicMappingV2.js";
import { buildTransformationPlanFromMapping, describeTransformationPlan } from "./agent/transformationPlan.js";
import { buildParserReconciliationReport, parserReconciliationAllowsApply } from "./agent/parserReconciliation.js";
import { planDatasetInterpretation } from "./agent/datasetInterpretationPlanner.js";
import { planDatasetMappingPatch } from "./agent/datasetMappingPatchPlanner.js";
import { ensureDatasetMappingV2ForBatch } from "./agent/datasetMappingBootstrap.js";
import {
  buildDeterministicDatasetMappingPatch,
  formatDatasetMappingPatchSummary,
} from "./agent/deterministicDatasetMappingPatch.js";
import { validateDatasetMappingPatchDraft } from "./agent/datasetMappingPatchValidator.js";
import { applyDatasetMappingPatch } from "./agent/datasetMappingPatchApplier.js";
import { autoRepairMappingSpec } from "./agent/mappingSpecAutoRepair.js";
import { validateMappingWithSeverity } from "./agent/mappingSpecValidationSeverity.js";
import { buildOllamaOrchestratorRequest } from "./agent/ollamaOrchestrator.js";
import { validateOrRepairActionPlan } from "./agent/orchestrationPlanner.js";
import { getAiPromptTarget, isAiPromptTargetId } from "./agent/prompts/externalAiPromptPrompt.js";
import { analyzeDeterministicNlu } from "./agent/deterministicNlu/deterministicNlu.js";
import { compileDeterministicAction } from "./agent/deterministicNlu/compileDeterministicAction.js";
import { prepareDeterministicTurn } from "./agent/deterministicNlu/prepareDeterministicTurn.js";
import { upsertRuntimeTrace } from "./agent/deterministicNlu/runtimeInstrumentation.js";
import { createDeterministicContextBinding, bindingMismatch } from "./agent/deterministicNlu/contextBinding.js";
import { createGraphIdentity, nextCommittedGraphIdentity } from "./graph/graphIdentity.js";
import { createMutationPlan } from "./graph/graphMutationValidator.js";
import { previewGraphMutation } from "./graph/graphMutationPreview.js";
import { createGraphHistoryEvent, appendGraphHistory } from "./graph/graphHistory.js";
import { compileGraphMutationGrammar } from "./agent/deterministicNlu/domains/graphMutationGrammar.js";
import {
  isPlausibleGraphMutationText,
  planGraphMutationWithModel,
  resolveGraphMutationDraftToPlan,
} from "./agent/graphMutationModelPlanner.js";
import { interpretCustomParserConversation } from "./agent/customParserConversation.js";
import {
  createParserProfileFromMapping,
  deleteParserProfile,
  exportParserProfiles,
  loadParserProfiles,
  matchParserProfiles,
  upsertParserProfile,
} from "./agent/parserProfiles.js";

const FMTS = [
  { id: "simple", label: "H2V / Simple", sub: "h0: A, B @time=2024", group: "core" },
  { id: "cornell", label: "Cornell / SNAP", sub: "nverts + simplices + times", group: "core" },
  { id: "incidence", label: "Incidence Edge List", sub: "hid, vid, time, weight per row", group: "core" },
  { id: "csv", label: "CSV", sub: "each row = one hyperedge", group: "core" },
  { id: "edgelist", label: "Edge List", sub: "v1 v2 per row", group: "core" },
  { id: "json", label: "JSON", sub: "[{id, vertices}] or canonical object", group: "core" },
  { id: "v2h", label: "V2H", sub: "A: h0, h2", group: "core" },
  { id: "h2h", label: "H2H", sub: "h0: h1[shared: A,B]", group: "core" },
  { id: "csr_json", label: "CSR JSON", sub: "{vertexIds, h2vCSR:{offsets,indices}}", group: "core" },
  { id: "csr_csv", label: "CSR / CSC CSV", sub: "vertexIds, rowOffsets, columnIndices…", group: "core" },
  { id: "adjlist", label: "Adjacency List", sub: "node: neighbor neighbor …", group: "core" },
  { id: "freeform", label: "Freeform / NLP", sub: "natural language → auto extract", group: "advanced" },
  { id: "ai_prompt", label: "AI Prompt", sub: "generate prompt for Claude / GPT", group: "advanced" },
  { id: "custom", label: "Custom Parser", sub: "write your own JS parser", group: "advanced" },
];

const EX = {
  simple: "h0 [t=10]: 1, 2, 3\nh1 [t=15]: 2, 4 @weight=2\nh2 [t=21]: 1, 3, 4, 5",
  cornell: { nv: "3\n2\n4", sv: "1\n2\n3\n2\n4\n1\n3\n4\n5", tv: "10\n15\n21" },
  incidence: "h0,1,10,1\nh0,2,10,1\nh0,3,10,1\nh1,2,15,2\nh1,4,15,2\nh2,1,21,1\nh2,3,21,1\nh2,4,21,1\nh2,5,21,1",
  csv: "1 2 3\n2 4\n1 3 4 5",
  edgelist: "1 2\n2 3\n1 3\n3 4",
  json: JSON.stringify([{ id: "h0", vertices: [1, 2, 3], time: 10 }, { id: "h1", vertices: [2, 4], time: 15, weight: 2 }, { id: "h2", vertices: [1, 3, 4, 5], time: 21 }], null, 2),
  v2h: "1: h0, h2\n2: h0, h1\n3: h0, h2\n4: h1, h2\n5: h2",
  h2h: "h0: h1[shared: 2], h2[shared: 1,3]\nh1: h0[shared: 2], h2[shared: 4]\nh2: h0[shared: 1,3], h1[shared: 4]",
  csr_json: JSON.stringify({ vertexIds: ["1", "2", "3", "4", "5"], hyperedgeIds: ["h0", "h1", "h2"], hyperedgeTimes: [10, 15, 21], h2vCSR: { offsets: [0, 3, 5, 9], indices: [0, 1, 2, 1, 3, 0, 2, 3, 4] } }, null, 2),
  csr_csv: "vertexIds,1,2,3,4,5\nhyperedgeIds,h0,h1,h2\nrowOffsets,0,3,5,9\ncolumnIndices,0,1,2,1,3,0,2,3,4\nhyperedgeTimes,10,15,21",
  adjlist: "1: 2 3\n2: 1 4\n3: 1 4\n4: 2 3",
  freeform: "Paper 1 has Alice, Bob, and Charlie as co-authors. Paper 2 involves Bob, Charlie, and David. Paper 3 was written by Alice and David together.",
  ai_prompt: "Paper 1 has Alice, Bob, and Charlie as co-authors.\nPaper 2 involves Bob, Charlie, and David.\nTransaction T10 includes Milk, Bread, Eggs.\nEvent EV1 includes P01, P02, P03.",
  custom: DEFAULT_CUSTOM_PARSER,
  batch: "ADD_HYPEREDGE h5: A, B, C\nREMOVE_HYPEREDGE h1\nADD_VERTEX h0: D\nREMOVE_VERTEX h2: A\nUPDATE_WEIGHT h0: 2.5\nUPDATE_TIME h0: 2027\nSET_ATTR h0: priority=high",
};

const EMPTY_FILES = Object.freeze([]);

// App
function AppCore() {
  const [fmt, setFmt] = useState("simple");
  const [texts, setTexts] = useState({});
  const [nv, setNv] = useState(""); const [sv, setSv] = useState(""); const [tv, setTv] = useState("");
  // Custom parser state
  const [customCode, setCustomCode] = useState(DEFAULT_CUSTOM_PARSER);
  const [customCodeVersion, setCustomCodeVersion] = useState(0);
  const [customCodeSource, setCustomCodeSource] = useState("default");
  const [customCodeBinding, setCustomCodeBinding] = useState(null);
  const [customFiles, setCustomFiles] = useState([]);
  const [customResult, setCustomResult] = useState(null);
  const [customErr, setCustomErr] = useState("");
  const [customRunning, setCustomRunning] = useState(false);
  const [customLogs, setCustomLogs] = useState([]);
  const [customResultId, setCustomResultId] = useState(null);
  const [parserProfiles, setParserProfiles] = useState(() => loadParserProfiles());
  const [parserProfileNotice, setParserProfileNotice] = useState("");
  // Optional local-model assist. Settings contain no keys and requests remain local-only.
  const [localModelConfig, setLocalModelConfig] = useState(loadLocalModelConfig);
  const [localModelStatus, setLocalModelStatus] = useState("disconnected");
  const [localModelMessage, setLocalModelMessage] = useState(
    localModelConfig.enabled === false ? LOCAL_MODEL_DISABLED_MESSAGE : "Settings loaded. Start Ollama, then click Connect.",
  );
  const [localModelModels, setLocalModelModels] = useState([]);
  const [localModelBusy, setLocalModelBusy] = useState(false);
  const localModelCoordinatorRef = useRef(createLocalModelRequestCoordinator());
  const [localModelCoordinatorSnapshot, setLocalModelCoordinatorSnapshot] = useState(() => localModelCoordinatorRef.current.getSnapshot());
  const [localModelGeneration, setLocalModelGeneration] = useState(() => createLocalModelGenerationState({ updatedAt: null }));
  const [localModelRequestHistory, setLocalModelRequestHistory] = useState([]);
  const [runtimeDiagnostics, setRuntimeDiagnostics] = useState(() => createRuntimeDiagnosticsSnapshot(localModelConfig));
  const [runtimeProbeResult, setRuntimeProbeResult] = useState(null);
  const [runtimeDiagnosticsBusy, setRuntimeDiagnosticsBusy] = useState(false);
  const [lastModelAssist, setLastModelAssist] = useState(null);
  const [modelDebug, setModelDebug] = useState(null);
  const [localModelLastConversation, setLocalModelLastConversation] = useState({
    status: "idle",
    message: "",
    classification: "",
    updatedAt: null,
  });
  // Agent uploads are isolated by event; file actions always use the active batch.
  const [agentFileBatches, setAgentFileBatches] = useState([]);
  const [activeBatchId, setActiveBatchId] = useState(null);
  const [lastTouchedBatchId, setLastTouchedBatchId] = useState(null);
  const [batchVersion, setBatchVersion] = useState(0);
  const batchCounterRef = useRef(0);
  const uploadNonceRef = useRef(0);
  const uploadReadControllerRef = useRef(null);
  const customResultCounterRef = useRef(0);
  const modelRunCounterRef = useRef(0);
  const starterCounterRef = useRef(0);
  // Batch update state (Advanced Options panel, lives under the visualization —
  // it edits the currently-loaded graph, so it's independent of `fmt`/`texts`).
  const [batchText, setBatchTextRaw] = useState(EX.batch);
  const [applyBatch, setApplyBatch] = useState(false);
  // (batchWarnings is derived below, together with finalHes)
  // Output state
  const [hes, setHes] = useState(null); const [warnings, setWarnings] = useState([]); const [err, setErr] = useState(""); const [loading, setLoading] = useState(false);
  const [vizLimit, setVizLimit] = useState(50); const [activeSection, setActiveSection] = useState("mappings");
  const [selectedMappingId, setSelectedMappingId] = useState("h2v");
  const [expId, setExpId] = useState("h2v_txt");
  const [activeToolsSection, setActiveToolsSection] = useState("advanced");
  const [aiPromptTargetId, setAiPromptTargetId] = useState("canonical");
  const [graphView, setGraphView] = useState("hypergraph");
  const [graphLayout, setGraphLayout] = useState("force");
  const [graphSearch, setGraphSearch] = useState("");
  const [graphResetNonce, setGraphResetNonce] = useState(0);
  const [graphReheatNonce, setGraphReheatNonce] = useState(0);
  const [graphPngNonce, setGraphPngNonce] = useState(0);
  const [graphIdentity, setGraphIdentity] = useState(() => createGraphIdentity([]));
  const [graphHistory, setGraphHistory] = useState([]);
  const [selectedGraphEntity, setSelectedGraphEntity] = useState(null);
  const [selectionNotice, setSelectionNotice] = useState("");
  const [graphConversationReferences, setGraphConversationReferences] = useState(() => createGraphConversationReferences());
  const [deterministicTurnTraces, setDeterministicTurnTraces] = useState([]);
  const graphVersion = graphIdentity.graphVersion;
  const [notice, setNotice] = useState("");
  const vizRef = useRef(null);
  const dashboardSectionRef = useRef(null);
  const showNotice = msg => { setNotice(msg); setTimeout(() => setNotice(""), 3500); };
  const activeAgentBatch = useMemo(
    () => agentFileBatches.find(batch => batch.id === activeBatchId) ?? null,
    [activeBatchId, agentFileBatches],
  );
  const agentFiles = activeAgentBatch?.files ?? EMPTY_FILES;
  const agentDetection = activeAgentBatch?.detectedFormat ?? null;
  const activeBatchRef = useRef({ id: activeBatchId, version: activeAgentBatch?.version ?? 0 });

  useEffect(() => {
    activeBatchRef.current = { id: activeBatchId, version: activeAgentBatch?.version ?? 0 };
  }, [activeAgentBatch?.version, activeBatchId]);

  useEffect(() => {
    saveLocalModelConfig({
      ...localModelConfig,
      settingsVersion: localModelConfig.settingsVersion ?? LOCAL_MODEL_SETTINGS_VERSION,
    });
  }, [localModelConfig]);

  useEffect(() => {
    setRuntimeDiagnostics(current => {
      const snapshot = createRuntimeDiagnosticsSnapshot(localModelConfig);
      return {
        ...current,
        deploymentInfo: snapshot.deploymentInfo,
        baseUrl: snapshot.baseUrl,
        baseUrlInfo: snapshot.baseUrlInfo,
        selectedModel: snapshot.selectedModel,
        activeTransport: snapshot.activeTransport,
        activeTransportLabel: snapshot.activeTransportLabel,
        activeEndpoint: snapshot.activeEndpoint,
        commands: snapshot.commands,
      };
    });
  }, [localModelConfig]);

  const txt = texts[fmt] ?? "";
  const commitGraph = useCallback((nextHyperedges, {
    source = "manual",
    summary = "Graph committed",
    replacement = false,
    clear = false,
    plan = null,
    preview = null,
    warnings: nextWarnings = null,
  } = {}) => {
    const previousHyperedges = hes ?? [];
    const normalizedNext = nextHyperedges?.length ? nextHyperedges : null;
    const nextIdentity = nextCommittedGraphIdentity(graphIdentity, normalizedNext ?? [], { replacement: replacement || clear });
    const graphChanged = nextIdentity.graphFingerprint !== graphIdentity.graphFingerprint;
    setHes(normalizedNext);
    if (Array.isArray(nextWarnings)) setWarnings(nextWarnings);
    setGraphIdentity(nextIdentity);
    if (graphChanged) {
      setGraphHistory(current => appendGraphHistory(current, createGraphHistoryEvent({
        graphIdentity: nextIdentity,
        beforeHyperedges: previousHyperedges,
        afterHyperedges: normalizedNext ?? [],
        plan: plan ?? { summary },
        preview,
        source,
      })));
      setSelectedGraphEntity(null);
      setSelectionNotice("Selection cleared because the graph changed.");
    }
    return {
      ok: true,
      graphId: nextIdentity.graphId,
      graphVersion: nextIdentity.graphVersion,
      graphFingerprint: nextIdentity.graphFingerprint,
      graphChanged,
      hyperedgeCount: normalizedNext?.length ?? 0,
    };
  }, [graphIdentity, hes]);

  const setTxt = useCallback(v => {
    setTexts(previous => ({ ...previous, [fmt]: v }));
  }, [fmt]);

  const setBatchText = useCallback(v => {
    setBatchTextRaw(v);
  }, []);

  function updateCustomCode(code, source = "user", binding = undefined) {
    setCustomCode(code);
    setCustomCodeSource(source);
    if (binding !== undefined) setCustomCodeBinding(binding);
    else if (source === "default" || source === "example") setCustomCodeBinding(null);
    setCustomCodeVersion(version => version + 1);
  }

  const [fEl, fGo] = useUpload((c, f, error) => { if (error) { showNotice(error.message || "Upload failed."); return; } setTxt(c); showNotice("Loaded: " + f.name); });
  const [nvEl, nvGo] = useUpload((c, _f, error) => { if (error) showNotice(error.message || "Upload failed."); else setNv(c); });
  const [svEl, svGo] = useUpload((c, _f, error) => { if (error) showNotice(error.message || "Upload failed."); else setSv(c); });
  const [tvEl, tvGo] = useUpload((c, _f, error) => { if (error) showNotice(error.message || "Upload failed."); else setTv(c); });
  const [cfEl, cfGo] = useMultiUpload((files, error) => { if (error) { setCustomErr(error.message || "Upload failed."); showNotice("Upload failed."); return; } setCustomFiles(files); setCustomCodeBinding(null); setCustomResult(null); setCustomResultId(null); setCustomErr(""); setCustomLogs([]); showNotice(files.length + " file(s) loaded."); });

  function loadEx() {
    if (fmt === "cornell") { setNv(EX.cornell.nv); setSv(EX.cornell.sv); setTv(EX.cornell.tv); }
    else if (fmt === "custom") { updateCustomCode(EX.custom, "example"); }
    else setTxt(EX[fmt] || "");
  }
  function sw(f) {
    setFmt(f);
    setErr("");
  }

  function copyAiPrompt() {
    const rawText = txt || "(paste your text above first)";
    const prompt = buildAiPrompt(rawText, { targetExportId: aiPromptTargetId });
    navigator.clipboard.writeText(prompt)
      .then(() => showNotice(`AI prompt copied for ${getAiPromptTarget(aiPromptTargetId).label}.`))
      .catch(() => showNotice("Copy failed — please copy manually from the preview below."));
  }

  function autoDetectFmt() {
    const t = fmt === "cornell" ? sv : txt;
    if (!t.trim()) { setErr("No text to auto-detect."); return; }
    const detected = autoDetect(t.trim());
    sw(detected); setTexts(p => ({ ...p, [detected]: t }));
    showNotice("Auto-detected format: " + detected);
  }

  const parseAndCommit = useCallback((targetFormat, payload, { preserveOnError = false } = {}) => {
    setErr(""); setLoading(true);
    if (!preserveOnError) { setHes(null); setWarnings([]); }
    return new Promise(resolve => setTimeout(() => {
      try {
        const raw = parseInputFormat(targetFormat, payload);
        if (!raw || !raw.length) throw new Error("No hyperedges found. Check your input.");
        const { hyperedges: norm, warnings: w } = normalizeParsedHyperedges(targetFormat, raw);
        const commit = commitGraph(norm, {
          source: "parse",
          summary: `Parsed ${norm.length} hyperedge${norm.length === 1 ? "" : "s"} from ${targetFormat}.`,
          replacement: true,
          warnings: w,
        });
        setActiveSection("mappings");
        const vertices = new Set(norm.flatMap(hyperedge => hyperedge.vertices.map(String))).size;
        const incidences = norm.reduce((sum, hyperedge) => sum + hyperedge.vertices.length, 0);
        resolve({ ok: true, ...commit, hyperedgeCount: norm.length, vertexCount: vertices, incidenceCount: incidences, parsedHyperedges: norm });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        setErr(message);
        resolve({ ok: false, error: message });
      }
      finally { setLoading(false); }
    }, 10));
  }, [commitGraph]);

  const parse = useCallback(() => {
    if (fmt === "custom" || fmt === "ai_prompt") {
      return Promise.resolve({ ok: false, error: "This route does not use the standard parser." });
    }
    return parseAndCommit(fmt, { text: txt, nverts: nv, simplices: sv, times: tv }, { preserveOnError: true });
  }, [fmt, nv, parseAndCommit, sv, tv, txt]);

  function payloadForAgentFiles(files, targetFormat) {
    if (targetFormat === "cornell") {
      const byName = fragment => files.find(file => file.name.toLowerCase().includes(fragment))?.text ?? "";
      return { nverts: byName("nverts"), simplices: byName("simplices"), times: byName("times") };
    }
    return { text: files[0]?.text ?? "" };
  }

  function stageAgentFiles(files, targetFormat) {
    if (!files.length) return { ok: false, error: "Upload at least one file first." };
    if (targetFormat === "custom") {
      setCustomFiles(files);
      setCustomResult(null); setCustomResultId(null); setCustomErr(""); setCustomLogs([]);
      setFmt("custom"); setErr("");
      return { ok: true, formatId: "custom", label: "Custom Parser" };
    }
    if (targetFormat === "cornell") {
      const payload = payloadForAgentFiles(files, targetFormat);
      if (!payload.nverts || !payload.simplices) {
        return { ok: false, error: "Cornell / SNAP routing needs both nverts and simplices files." };
      }
      setNv(payload.nverts); setSv(payload.simplices); setTv(payload.times);
      setFmt("cornell"); setErr("");
      return { ok: true, formatId: "cornell", label: "Cornell / SNAP" };
    }
    if (files.length !== 1) {
      return { ok: false, error: "Multiple files need Cornell / SNAP or Custom Parser routing." };
    }
    const details = getFormatDetails(targetFormat);
    if (!details) return { ok: false, error: "That uploaded-file route is not supported." };
    setTexts(previous => ({ ...previous, [targetFormat]: files[0].text }));
    setFmt(targetFormat); setErr("");
    return { ok: true, formatId: targetFormat, label: details.label };
  }

  function buildAgentBatch(files, id, label, existingMode = null) {
    const analysis = analyzeUploadBatch(files, autoDetect);
    const initialParseMode = analysis.detectedFormat.formatId === "cornell"
      ? "together"
      : existingMode ?? (files.length === 1 ? "together" : "unknown");
    const datasetProfile = profileDatasetFiles(files);
    const relationshipEvidence = profileDatasetRelationships(datasetProfile);
    const groupingDraft = buildDatasetGroupingDraft(datasetProfile, relationshipEvidence, { parseMode: initialParseMode });
    const parseMode = analysis.detectedFormat.formatId === "cornell" ? "together" : groupingDraft.parseMode;
    return {
      id,
      label,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      files,
      fileSummaries: analysis.fileSummaries,
      detectedFormat: analysis.detectedFormat,
      detectedRoles: analysis.detectedRoles,
      parseMode,
      datasetProfile,
      relationshipEvidence,
      datasetInterpretationDraft: null,
      datasetGroups: groupingDraft.groups,
      activeDatasetGroupId: groupingDraft.groups.find(group => group.kind === "static_graph")?.id ?? null,
      groupingRevision: 0,
      groupingHistory: [{
        revision: 0,
        source: "deterministic profile",
        createdAt: new Date().toISOString(),
        summary: groupingDraft.status === "needs_clarification"
          ? "Initial grouping draft needs clarification."
          : "Initial grouping draft created from bounded profile evidence.",
      }],
      groupingStatus: groupingDraft.status,
      groupingQuestions: groupingDraft.questions,
      metadataOnly: analysis.metadataOnly,
      batchUpdate: analysis.batchUpdate,
      separateGraphFiles: analysis.separateGraphFiles,
      mixedFormats: analysis.mixedFormats,
      modelStatus: "none",
      parserStatus: "none",
      modelRuns: [],
      statsSnapshot: null,
      mappingSpec: null,
      mappingSource: "none",
      mappingRevision: 0,
      mappingHistory: [],
      mappingSpecStatus: "none",
      mappingSpecValidationErrors: [],
      mappingValidationWarnings: [],
      mappingRepairNotes: [],
      mappingInformationalNotes: [],
      deterministicDraftMapping: null,
      modelRefinedMapping: null,
      repairedMapping: null,
      mappingValidation: null,
      selectedMappingForParser: null,
      preMappingDiagnostics: null,
      mappingSpecAccepted: false,
      mappingFeedback: {
        accepted: false,
        rejected: false,
        corrected: false,
        parserWorked: null,
        notes: "",
      },
      mappingPreview: null,
      mappingUserIntent: "",
      mappingTurnDiagnostics: [],
      generatedParserFromMapping: "",
      transformationPlan: null,
      transformationPlanPreview: [],
      transformationPlanStatus: "none",
      transformationPlanFingerprint: null,
      parserReconciliation: null,
      expectedOutputComparison: null,
      fineTuneExamples: [],
      status: "active",
    };
  }

  function recordBatchModelRun(batchId, run) {
    setAgentFileBatches(current => current.map(batch => {
      if (batch.id !== batchId) return batch;
      const modelRuns = [...(batch.modelRuns ?? []), run].slice(-8);
      const modelStatus = run.status === "generated"
        ? "generated"
        : run.status === "repaired"
          ? "repaired"
          : run.status === "failed"
            ? "failed"
            : batch.modelStatus;
      return {
        ...batch,
        modelRuns,
        modelStatus,
        parserStatus: run.parserInserted ? "inserted" : batch.parserStatus,
        updatedAt: new Date().toISOString(),
      };
    }));
  }

  function updateBatchParserStatus(batchId, parserStatus, statsSnapshot = undefined) {
    if (!batchId) return;
    setAgentFileBatches(current => current.map(batch => batch.id === batchId ? {
      ...batch,
      parserStatus,
      ...(statsSnapshot === undefined ? {} : { statsSnapshot }),
      updatedAt: new Date().toISOString(),
    } : batch));
  }

  function updateBatchMapping(batchId, patch) {
    if (!batchId) return;
    setAgentFileBatches(current => current.map(batch => batch.id === batchId ? {
      ...batch,
      ...(patch.mappingSpec && batch.mappingSpec ? {
        mappingHistory: [
          ...(batch.mappingHistory ?? []),
          {
            revision: batch.mappingRevision ?? 0,
            mappingSpec: batch.mappingSpec,
            transformationPlanFingerprint: batch.transformationPlanFingerprint ?? null,
            createdAt: new Date().toISOString(),
            reason: `before ${(patch.mappingSource ?? batch.mappingSource ?? "mapping update")}`,
          },
        ].slice(-20),
      } : {}),
      ...patch,
      updatedAt: new Date().toISOString(),
    } : batch));
    setBatchVersion(version => version + 1);
  }

  function undoLastMappingChange() {
    if (!activeAgentBatch?.mappingHistory?.length) return { ok: false, error: "There is no previous mapping revision to restore." };
    const previous = activeAgentBatch.mappingHistory.at(-1);
    updateBatchMapping(activeAgentBatch.id, {
      mappingSpec: previous.mappingSpec,
      repairedMapping: previous.mappingSpec,
      mappingRevision: (activeAgentBatch.mappingRevision ?? 0) + 1,
      mappingSource: "undo",
      mappingHistory: activeAgentBatch.mappingHistory.slice(0, -1),
      generatedParserFromMapping: "",
      transformationPlan: null,
      transformationPlanPreview: [],
      transformationPlanStatus: "stale_after_undo",
      transformationPlanFingerprint: null,
      parserReconciliation: null,
      parserStatus: "stale_mapping",
      mappingSpecAccepted: false,
    });
    return { ok: true, restoredRevision: previous.revision };
  }

  function mappingPreviewFor(batch) {
    return buildSafeModelPreview(batch, {
      maxPreviewFiles: localModelConfig.maxPreviewFiles,
      maxPreviewLinesPerFile: localModelConfig.maxPreviewLinesPerFile,
    });
  }

  function buildMappingWorkflow(batch, candidate = null, {
    preview = null,
    deterministicDraft = null,
    diagnostics = null,
    expectedOutputComparison = null,
  } = {}) {
    const safePreview = preview ?? mappingPreviewFor(batch);
    const legacyPreMapping = () => buildDeterministicPreMapping(batch, safePreview);
    const preMapping = deterministicDraft && diagnostics
      ? { spec: deterministicDraft, diagnostics }
      : batch?.datasetProfile
        ? {
          spec: buildDatasetMappingSpecV2FromBatch(batch),
          diagnostics: {
            version: 2,
            datasetProfile: batch.datasetProfile,
            relationshipEvidence: batch.relationshipEvidence ?? [],
            groups: batch.datasetGroups ?? [],
            validationFiles: (batch.datasetGroups ?? []).filter(group => group.kind === "validation_only").flatMap(group => group.fileNames ?? []).map(fileName => ({ fileName })),
            sharedKeys: (batch.relationshipEvidence ?? []).slice(0, 8),
            roleGuesses: batch.fileSummaries ?? [],
            legacyDraft: legacyPreMapping().spec,
          },
        }
        : legacyPreMapping();
    const repair = autoRepairMappingSpec(candidate ?? preMapping.spec, {
      batch,
      preview: safePreview,
      deterministicDraft: preMapping.spec,
      diagnostics: preMapping.diagnostics,
    });
    const repairedCandidate = candidate !== null && repair.originalSpec == null ? null : repair.spec;
    const validation = validateMappingWithSeverity(repairedCandidate, {
      batch,
      preview: safePreview,
      repairNotes: repair.repairNotes,
      autoRepairWarnings: repair.warnings,
      expectedOutputComparison,
    });
    return { preview: safePreview, preMapping, repair, validation };
  }

  function mappingPatchFromWorkflow(workflow, source, userIntent, extra = {}) {
    return {
      mappingSpec: workflow.validation.spec,
      mappingSource: source,
      mappingSpecStatus: workflow.validation.status,
      mappingSpecValidationErrors: workflow.validation.fatalErrors,
      mappingValidationWarnings: workflow.validation.warnings,
      mappingRepairNotes: workflow.validation.repairNotes,
      mappingInformationalNotes: workflow.validation.informationalNotes,
      deterministicDraftMapping: workflow.preMapping.spec,
      repairedMapping: workflow.validation.spec,
      mappingValidation: {
        fatalErrors: workflow.validation.fatalErrors,
        repairableErrors: workflow.validation.repairableErrors,
        repairNotes: workflow.validation.repairNotes,
        warnings: workflow.validation.warnings,
        informationalNotes: workflow.validation.informationalNotes,
        status: workflow.validation.status,
      },
      selectedMappingForParser: workflow.validation.canGenerateParser ? "repairedMapping" : null,
      preMappingDiagnostics: workflow.preMapping.diagnostics,
      mappingPreview: workflow.preview,
      mappingUserIntent: userIntent,
      ...extra,
    };
  }

  function mappingPatchValidationContext(batch) {
    return {
      fileNames: (batch?.datasetProfile?.files ?? []).map(file => file.fileName),
      headersByFile: Object.fromEntries((batch?.datasetProfile?.files ?? []).map(file => [
        file.fileName,
        (file.columns ?? []).map(column => column.name),
      ])),
      groupIds: (batch?.mappingSpec?.groups ?? batch?.datasetGroups ?? []).map(group => group.id),
    };
  }

  function appendMappingDiagnostic(batch, diagnostic) {
    return [...(batch?.mappingTurnDiagnostics ?? []), {
      requestId: diagnostic.requestId ?? `mapping-${Date.now().toString(36)}`,
      detectedIntent: diagnostic.detectedIntent ?? "explicit_patch",
      selectedPlanner: diagnostic.selectedPlanner,
      genericActionPlannerCalled: false,
      routePlannerCalled: false,
      activeBatchId: batch?.id ?? null,
      activeRoute: fmt,
      parseMode: batch?.parseMode ?? "unknown",
      mappingRevisionBefore: batch?.mappingRevision ?? 0,
      mappingRevisionAfter: diagnostic.mappingRevisionAfter ?? batch?.mappingRevision ?? 0,
      modelAttempted: Boolean(diagnostic.modelAttempted),
      modelOutcome: diagnostic.modelOutcome ?? "not_attempted",
      fallbackUsed: Boolean(diagnostic.fallbackUsed),
      patchValidationErrors: diagnostic.patchValidationErrors ?? [],
      patchOperationTypes: diagnostic.patchOperationTypes ?? [],
      filesResolved: diagnostic.filesResolved ?? [],
      columnsResolved: diagnostic.columnsResolved ?? [],
      nluDomain: diagnostic.nluDomain ?? "",
      nluIntent: diagnostic.nluIntent ?? "",
      nluConfidence: diagnostic.nluConfidence ?? null,
      nluTrace: diagnostic.nluTrace ?? null,
      runtimeClassification: diagnostic.runtimeClassification ?? "",
      elapsedMs: Math.max(0, Math.round(diagnostic.elapsedMs ?? 0)),
      createdAt: new Date().toISOString(),
    }].slice(-12);
  }

  function recordMappingDiagnosticOnly(batch, diagnostic) {
    if (!batch?.id) return;
    setAgentFileBatches(current => current.map(item => item.id === batch.id ? {
      ...item,
      mappingTurnDiagnostics: appendMappingDiagnostic(item, diagnostic),
      updatedAt: new Date().toISOString(),
    } : item));
    setBatchVersion(version => version + 1);
  }

  function invalidateCustomParserPreviewForMapping(batchId) {
    if (customCodeBinding?.batchId !== batchId) return;
    setCustomResult(null);
    setCustomResultId(null);
    setCustomErr("");
    setCustomLogs([]);
  }

  function applyTypedMappingPatchToBatch(batchSnapshot, baseSpec, patchDraft, {
    source = "deterministic_mapping_fallback",
    userIntent = "",
    modelAttempted = false,
    modelOutcome = "not_attempted",
    fallbackUsed = false,
    bootstrapGenerated = false,
    fallbackReason = "",
    requestId = null,
    startedAt = performance.now(),
    fallbackDiagnostics = {},
    detectedIntent = "explicit_patch",
    selectedPlanner = null,
    precompiledDraftUsed = false,
    recompiled = true,
    semanticConfidence = null,
    authoritativeCompiler = null,
    genericActionPlannerCalled = false,
    legacyParserCalled = false,
  } = {}) {
    const patchValidation = validateDatasetMappingPatchDraft(patchDraft, {
      ...mappingPatchValidationContext({ ...batchSnapshot, mappingSpec: baseSpec }),
      groupIds: (baseSpec.groups ?? []).map(group => group.id),
    });
    const baseDiagnostic = {
      requestId,
      detectedIntent,
      selectedPlanner: selectedPlanner ?? fallbackDiagnostics.plannerPath ?? (fallbackUsed ? "deterministic_mapping_fallback" : "dataset_mapping_patch"),
      modelAttempted,
      modelOutcome,
      fallbackUsed,
      runtimeClassification: fallbackReason,
      patchValidationErrors: patchValidation.errors ?? [],
      patchOperationTypes: (patchDraft.operations ?? []).map(operation => operation.type),
      filesResolved: fallbackDiagnostics.filesResolved ?? [],
      columnsResolved: fallbackDiagnostics.columnsResolved ?? [],
      nluDomain: fallbackDiagnostics.nluDomain ?? "",
      nluIntent: fallbackDiagnostics.nluIntent ?? "",
      nluConfidence: fallbackDiagnostics.nluConfidence ?? null,
      nluTrace: fallbackDiagnostics.nluTrace ?? null,
      semanticConfidence: semanticConfidence ?? fallbackDiagnostics.semanticConfidence ?? null,
      authoritativeCompiler: authoritativeCompiler ?? fallbackDiagnostics.authoritativeCompiler ?? fallbackDiagnostics.plannerPath ?? "",
      precompiledDraftUsed,
      recompiled,
      modelCalled: modelAttempted,
      genericActionPlannerCalled,
      legacyParserCalled,
      elapsedMs: performance.now() - startedAt,
    };
    if (!patchValidation.ok) {
      recordMappingDiagnosticOnly(batchSnapshot, baseDiagnostic);
      return { ok: false, error: patchValidation.errors.join(" "), validation: patchValidation, diagnostics: baseDiagnostic };
    }
    if (patchValidation.draft.classification !== "patch") {
      recordMappingDiagnosticOnly(batchSnapshot, {
        ...baseDiagnostic,
        selectedPlanner: "mapping_question",
        modelOutcome: patchValidation.draft.classification,
      });
      return {
        ok: true,
        applied: null,
        clarification: patchValidation.draft.clarificationQuestion ?? "",
        message: patchValidation.draft.clarificationQuestion ?? "I need one more mapping detail before changing the DatasetMappingSpec.",
      };
    }
    const applied = applyDatasetMappingPatch(baseSpec, patchValidation.draft, {
      fileProfiles: batchSnapshot.datasetProfile?.files ?? [],
      source,
      history: batchSnapshot.mappingHistory ?? [],
    });
    const mappingRevisionAfter = applied.spec?.mappingRevision ?? batchSnapshot.mappingRevision ?? 0;
    const diagnostic = {
      ...baseDiagnostic,
      mappingRevisionAfter,
      patchValidationErrors: applied.ok ? [] : applied.errors ?? baseDiagnostic.patchValidationErrors,
      elapsedMs: performance.now() - startedAt,
    };
    if (!applied.ok) {
      recordMappingDiagnosticOnly(batchSnapshot, diagnostic);
      return { ok: false, error: applied.errors?.join(" ") || "The typed mapping patch failed DatasetMappingSpec v2 validation.", validation: applied.validation, diagnostics: diagnostic };
    }
    if (applied.noChange) {
      recordMappingDiagnosticOnly(batchSnapshot, {
        ...diagnostic,
        modelOutcome: "no_change",
        mappingRevisionAfter: batchSnapshot.mappingRevision ?? 0,
      });
      return {
        ok: true,
        noChange: true,
        applied,
        message: formatDatasetMappingPatchSummary({ spec: applied.spec, applied, noChange: true }),
      };
    }
    updateBatchMapping(batchSnapshot.id, {
      mappingSpec: applied.spec,
      repairedMapping: applied.spec,
      mappingRevision: applied.spec.mappingRevision,
      mappingHistory: applied.history,
      mappingSource: source,
      mappingSpecStatus: applied.validation.warnings?.length ? "valid_with_warnings" : "valid",
      mappingSpecValidationErrors: [],
      mappingValidationWarnings: applied.validation.warnings ?? [],
      mappingRepairNotes: [],
      mappingInformationalNotes: applied.validation.notes ?? [],
      deterministicDraftMapping: bootstrapGenerated ? baseSpec : batchSnapshot.deterministicDraftMapping ?? baseSpec,
      modelRefinedMapping: modelAttempted && !fallbackUsed ? applied.spec : batchSnapshot.modelRefinedMapping,
      selectedMappingForParser: "repairedMapping",
      mappingValidation: {
        fatalErrors: [],
        repairableErrors: [],
        repairNotes: [],
        warnings: applied.validation.warnings ?? [],
        informationalNotes: applied.validation.notes ?? [],
        status: applied.validation.warnings?.length ? "valid_with_warnings" : "valid",
      },
      preMappingDiagnostics: batchSnapshot.preMappingDiagnostics,
      mappingPreview: batchSnapshot.mappingPreview ?? mappingPreviewFor(batchSnapshot),
      mappingUserIntent: userIntent,
      mappingSpecAccepted: false,
      generatedParserFromMapping: "",
      transformationPlan: null,
      transformationPlanPreview: [],
      transformationPlanStatus: "stale_after_mapping_patch",
      transformationPlanFingerprint: null,
      parserReconciliation: null,
      expectedOutputComparison: null,
      parserStatus: "stale_mapping",
      mappingTurnDiagnostics: appendMappingDiagnostic(batchSnapshot, diagnostic),
    });
    invalidateCustomParserPreviewForMapping(batchSnapshot.id);
    return {
      ok: true,
      applied,
      fallbackUsed,
      modelAttempted,
      bootstrapGenerated,
      diagnostics: diagnostic,
      message: formatDatasetMappingPatchSummary({
        spec: applied.spec,
        applied,
        fallbackUsed,
        modelAttempted,
        bootstrapGenerated,
      }),
    };
  }

  function generateDeterministicMapping(userIntent = "Infer a mapping without a model") {
    if (!activeAgentBatch) return { ok: false, error: "Upload an active file batch first." };
    const workflow = buildMappingWorkflow(activeAgentBatch);
    updateBatchMapping(activeAgentBatch.id, mappingPatchFromWorkflow(
      workflow,
      workflow.repair.changed ? "deterministic repaired" : "deterministic draft",
      userIntent,
      {
        mappingRevision: (activeAgentBatch.mappingRevision ?? 0) + 1,
        modelRefinedMapping: null,
        mappingSpecAccepted: false,
        generatedParserFromMapping: "",
        mappingFeedback: {
          ...(activeAgentBatch.mappingFeedback ?? {}),
          accepted: false,
          rejected: false,
        },
      },
    ));
    return workflow.validation.canGenerateParser
      ? {
        ok: true,
        spec: workflow.validation.spec,
        validation: workflow.validation,
        message: workflow.repair.repairNotes.length
          ? `Created and auto-repaired a deterministic draft mapping. ${workflow.repair.repairNotes.join(" ")}`
          : "Created and validated a deterministic draft mapping. Review it or generate parser code from it.",
      }
      : { ok: false, spec: workflow.validation.spec, validation: workflow.validation, error: workflow.validation.message };
  }

  function validateActiveMappingSpec(candidate = activeAgentBatch?.mappingSpec) {
    if (!activeAgentBatch) return { ok: false, error: "Upload an active file batch first." };
    const workflow = buildMappingWorkflow(activeAgentBatch, candidate, {
      preview: activeAgentBatch.mappingPreview,
      deterministicDraft: activeAgentBatch.deterministicDraftMapping,
      diagnostics: activeAgentBatch.preMappingDiagnostics,
      expectedOutputComparison: activeAgentBatch.expectedOutputComparison,
    });
    updateBatchMapping(activeAgentBatch.id, mappingPatchFromWorkflow(
      workflow,
      workflow.repair.changed ? "repaired" : activeAgentBatch.mappingSource,
      activeAgentBatch.mappingUserIntent,
      {
        mappingRevision: (activeAgentBatch.mappingRevision ?? 0) + (workflow.repair.changed ? 1 : 0),
        modelRefinedMapping: activeAgentBatch.modelRefinedMapping,
      },
    ));
    return workflow.validation.canGenerateParser
      ? { ok: true, spec: workflow.validation.spec, validation: workflow.validation, message: `Mapping status: ${workflow.validation.status.replaceAll("_", " ")}.` }
      : { ok: false, spec: workflow.validation.spec, validation: workflow.validation, error: workflow.validation.message };
  }

  function applyEditedMappingSpec(jsonText, source = "user edited") {
    if (!activeAgentBatch) return { ok: false, error: "Upload an active file batch first." };
    const workflow = buildMappingWorkflow(activeAgentBatch, jsonText, {
      preview: activeAgentBatch.mappingPreview,
      deterministicDraft: activeAgentBatch.deterministicDraftMapping,
      diagnostics: activeAgentBatch.preMappingDiagnostics,
      expectedOutputComparison: activeAgentBatch.expectedOutputComparison,
    });
    updateBatchMapping(activeAgentBatch.id, mappingPatchFromWorkflow(
      workflow,
      workflow.repair.changed ? `${source} + repaired` : source,
      activeAgentBatch.mappingUserIntent,
      {
        mappingRevision: (activeAgentBatch.mappingRevision ?? 0) + 1,
        modelRefinedMapping: activeAgentBatch.modelRefinedMapping,
        mappingSpecAccepted: false,
        mappingFeedback: {
          ...(activeAgentBatch.mappingFeedback ?? {}),
          accepted: false,
          rejected: false,
          corrected: source === "user edited" ? true : activeAgentBatch.mappingFeedback?.corrected,
        },
      },
    ));
    return workflow.validation.canGenerateParser
      ? { ok: true, spec: workflow.validation.spec, validation: workflow.validation, message: "Your edited mapping was auto-repaired where safe, validated, and stored only with this batch." }
      : { ok: false, spec: workflow.validation.spec, validation: workflow.validation, error: workflow.validation.message };
  }

  function applyMappingConversationForAgent(text) {
    if (!activeAgentBatch?.mappingSpec) return { ok: false, noMatch: true };
    const interpreted = interpretCustomParserConversation(text, activeAgentBatch.mappingSpec, activeAgentBatch);
    if (interpreted.noMatch) return interpreted;
    if (!interpreted.ok) return interpreted;
    const applied = applyEditedMappingSpec(interpreted.spec, "conversation mapping correction");
    return {
      ...applied,
      notes: interpreted.notes,
      message: applied.ok
        ? `${interpreted.message} The mapping was auto-repaired/validated and stored with the active batch.`
        : applied.error,
    };
  }

  function autoRepairActiveMapping() {
    if (!activeAgentBatch?.mappingSpec) return { ok: false, error: "There is no active mapping to repair." };
    return applyEditedMappingSpec(activeAgentBatch.mappingSpec, "auto repaired");
  }

  function useDeterministicDraftMapping() {
    if (!activeAgentBatch?.deterministicDraftMapping) return generateDeterministicMapping("Use deterministic draft");
    const workflow = buildMappingWorkflow(activeAgentBatch, activeAgentBatch.deterministicDraftMapping, {
      preview: activeAgentBatch.mappingPreview,
      deterministicDraft: activeAgentBatch.deterministicDraftMapping,
      diagnostics: activeAgentBatch.preMappingDiagnostics,
      expectedOutputComparison: activeAgentBatch.expectedOutputComparison,
    });
    updateBatchMapping(activeAgentBatch.id, mappingPatchFromWorkflow(
      workflow,
      workflow.repair.changed ? "deterministic repaired" : "deterministic draft",
      activeAgentBatch.mappingUserIntent,
      { mappingRevision: (activeAgentBatch.mappingRevision ?? 0) + 1 },
    ));
    return workflow.validation.canGenerateParser
      ? { ok: true, spec: workflow.validation.spec, message: "The deterministic draft is selected after auto-repair and validation." }
      : { ok: false, error: workflow.validation.message };
  }

  function useRepairedMapping() {
    if (!activeAgentBatch?.repairedMapping) return { ok: false, error: "There is no repaired mapping available." };
    return validateActiveMappingSpec(activeAgentBatch.repairedMapping);
  }

  async function runDatasetInterpretationAssist(userIntent = "Interpret the active dataset meaning") {
    if (!activeAgentBatch?.datasetProfile) return { ok: false, error: "Upload an active file batch first." };
    if (localModelConfig.enabled === false) return { ok: false, error: LOCAL_MODEL_DISABLED_MESSAGE };
    if (!localModelConfig.model.trim()) return { ok: false, error: "No local model name is selected." };
    if (localModelStatus !== "connected") return { ok: false, error: "Connect Ollama before requesting model interpretation. Deterministic profiling still works offline." };
    const batchSnapshot = activeAgentBatch;
    return runExclusiveLocalModelTask({
      task: "plan_dataset_interpretation",
      message: "Interpreting bounded dataset profile evidence with the local model…",
      timeoutMs: LOCAL_MODEL_TASK_TIMEOUTS.dataset_interpretation_total,
      run: async ({ signal, timeoutMs, onMetrics }) => {
        const result = await planDatasetInterpretation({
          config: localModelConfig,
          datasetProfile: batchSnapshot.datasetProfile,
          relationshipEvidence: batchSnapshot.relationshipEvidence ?? [],
          groupingDraft: {
            groups: batchSnapshot.datasetGroups ?? [],
            parseMode: batchSnapshot.parseMode,
            questions: batchSnapshot.groupingQuestions ?? [],
          },
          userIntent,
          signal,
          timeoutMs,
          onMetrics,
        });
        if (result.ok && activeBatchRef.current.id === batchSnapshot.id) {
          updateBatchMapping(batchSnapshot.id, {
            datasetInterpretationDraft: result.draft,
            modelStatus: "interpreted",
          });
          recordBatchModelRun(batchSnapshot.id, {
            id: `dataset-interpretation-${Date.now().toString(36)}`,
            task: "plan_dataset_interpretation",
            runtime: "ollama",
            model: localModelConfig.model,
            status: "generated",
            createdAt: new Date().toISOString(),
            summary: result.draft.summary,
            validationErrors: [],
            parserInserted: false,
          });
        }
        return {
          ...result,
          message: result.ok
            ? "Dataset interpretation draft stored for review. It did not mutate the graph or run code."
            : result.error,
        };
      },
    });
  }

  async function runDatasetMappingPatchAssist(userIntent = "Refine the active mapping", options = {}) {
    if (!activeAgentBatch) return { ok: false, error: "Upload an active file batch first." };
    const startedAt = performance.now();
    const batchSnapshot = activeAgentBatch;
    const ensure = ensureDatasetMappingV2ForBatch({
      batch: batchSnapshot,
      reason: options.source ?? "chat",
      allowDeterministicGeneration: options.allowBootstrap !== false,
    });
    if (!ensure.ok) {
      recordMappingDiagnosticOnly(batchSnapshot, {
        detectedIntent: "explicit_patch",
        selectedPlanner: "deterministic_mapping_fallback",
        modelAttempted: false,
        modelOutcome: "bootstrap_failed",
        fallbackUsed: false,
        patchValidationErrors: ensure.validation?.errors ?? [ensure.error].filter(Boolean),
        elapsedMs: performance.now() - startedAt,
      });
      return { ok: false, error: ensure.error };
    }
    const baseSpec = ensure.spec;
    const precompiledDraft = options.precompiledDraft ?? null;
    const precompiledDiagnostics = options.precompiledDiagnostics ?? {};
    if (options.contextBinding) {
      const stale = bindingIsStaleForScope(options.contextBinding, "mapping", options.pendingAction ?? null);
      if (stale.stale) {
        return {
          ok: false,
          stale: true,
          error: "The active dataset mapping changed after I interpreted that request. Please send the mapping edit again.",
          diagnostics: {
            selectedPlanner: "deterministic_nlu_precompiled",
            precompiledDraftUsed: Boolean(precompiledDraft),
            recompiled: false,
            staleBinding: stale,
            modelAttempted: false,
            modelCalled: false,
            fallbackUsed: false,
            legacyParserCalled: false,
            genericActionPlannerCalled: false,
            elapsedMs: performance.now() - startedAt,
          },
        };
      }
    }
    if (precompiledDraft) {
      if (precompiledDraft.classification === "clarification") {
        const diagnostic = {
          detectedIntent: precompiledDiagnostics.nluIntent ?? "dataset_mapping",
          selectedPlanner: "deterministic_nlu_precompiled",
          modelAttempted: false,
          modelCalled: false,
          modelOutcome: "clarification",
          fallbackUsed: false,
          precompiledDraftUsed: true,
          recompiled: false,
          semanticConfidence: options.semanticConfidence ?? precompiledDiagnostics.semanticConfidence ?? null,
          authoritativeCompiler: precompiledDiagnostics.authoritativeCompiler ?? "dataset_mapping_v1",
          patchOperationTypes: [],
          filesResolved: precompiledDiagnostics.filesResolved ?? [],
          columnsResolved: precompiledDiagnostics.columnsResolved ?? [],
          nluDomain: precompiledDiagnostics.nluDomain,
          nluIntent: precompiledDiagnostics.nluIntent,
          nluConfidence: precompiledDiagnostics.nluConfidence,
          nluTrace: precompiledDiagnostics.nluTrace,
          legacyParserCalled: false,
          genericActionPlannerCalled: false,
          elapsedMs: performance.now() - startedAt,
        };
        recordMappingDiagnosticOnly(batchSnapshot, diagnostic);
        return {
          ok: true,
          applied: null,
          fallbackUsed: false,
          clarification: precompiledDraft.clarificationQuestion,
          message: precompiledDraft.clarificationQuestion ?? "I need one more mapping detail before changing the DatasetMappingSpec.",
          diagnostics: diagnostic,
        };
      }
      return applyTypedMappingPatchToBatch(batchSnapshot, baseSpec, precompiledDraft, {
        source: "deterministic nlu precompiled patch",
        userIntent,
        modelAttempted: false,
        modelOutcome: "deterministic_nlu_precompiled",
        fallbackUsed: false,
        startedAt,
        fallbackDiagnostics: precompiledDiagnostics,
        bootstrapGenerated: ensure.generated,
        detectedIntent: precompiledDiagnostics.nluIntent ?? "dataset_mapping",
        selectedPlanner: "deterministic_nlu_precompiled",
        precompiledDraftUsed: true,
        recompiled: false,
        semanticConfidence: options.semanticConfidence ?? precompiledDiagnostics.semanticConfidence ?? null,
        authoritativeCompiler: precompiledDiagnostics.authoritativeCompiler ?? "dataset_mapping_v1",
        genericActionPlannerCalled: false,
        legacyParserCalled: false,
      });
    }
    if (options.skipDeterministicRecompile) {
      return {
        ok: false,
        error: "The central deterministic compiler did not produce a mapping patch, so I did not reparse the raw text through the legacy mapping path.",
        diagnostics: {
          selectedPlanner: "deterministic_nlu_precompiled",
          precompiledDraftUsed: false,
          recompiled: false,
          modelAttempted: false,
          modelCalled: false,
          fallbackUsed: false,
          legacyParserCalled: false,
          genericActionPlannerCalled: false,
          elapsedMs: performance.now() - startedAt,
        },
      };
    }
    const runDeterministicFallback = ({
      modelAttempted = false,
      modelOutcome = "not_attempted",
      fallbackReason = "",
      requestId = null,
    } = {}) => {
      const fallback = buildDeterministicDatasetMappingPatch(userIntent, {
        batch: batchSnapshot,
        mappingSpec: baseSpec,
        datasetProfile: batchSnapshot.datasetProfile,
        relationshipEvidence: batchSnapshot.relationshipEvidence ?? [],
      });
      if (!fallback.ok) {
        recordMappingDiagnosticOnly(batchSnapshot, {
          requestId,
          detectedIntent: "explicit_patch",
          selectedPlanner: "deterministic_mapping_fallback",
          modelAttempted,
          modelOutcome,
          fallbackUsed: true,
          runtimeClassification: fallbackReason,
          patchValidationErrors: [fallback.error].filter(Boolean),
          elapsedMs: performance.now() - startedAt,
        });
        return {
          ok: false,
          fallbackUsed: true,
          fallbackReason,
          error: fallback.error || "The deterministic mapping fallback could not parse that mapping request safely.",
        };
      }
      if (fallback.draft.classification === "clarification") {
        recordMappingDiagnosticOnly(batchSnapshot, {
          requestId,
          detectedIntent: "explicit_patch",
          selectedPlanner: "deterministic_mapping_fallback",
          modelAttempted,
          modelOutcome: "clarification",
          fallbackUsed: true,
          runtimeClassification: fallbackReason,
          patchOperationTypes: [],
          filesResolved: fallback.diagnostics?.filesResolved ?? [],
          columnsResolved: fallback.diagnostics?.columnsResolved ?? [],
          elapsedMs: performance.now() - startedAt,
        });
        return {
          ok: true,
          applied: null,
          fallbackUsed: true,
          clarification: fallback.clarification,
          message: fallback.clarification,
        };
      }
      return applyTypedMappingPatchToBatch(batchSnapshot, baseSpec, fallback.draft, {
        source: modelAttempted ? "deterministic mapping fallback after local model" : "deterministic mapping fallback",
        userIntent,
        modelAttempted,
        modelOutcome,
        fallbackUsed: true,
        fallbackReason,
        requestId,
        startedAt,
        fallbackDiagnostics: fallback.diagnostics,
        bootstrapGenerated: ensure.generated,
      });
    };

    const deterministicFirst = buildDeterministicDatasetMappingPatch(userIntent, {
      batch: batchSnapshot,
      mappingSpec: baseSpec,
      datasetProfile: batchSnapshot.datasetProfile,
      relationshipEvidence: batchSnapshot.relationshipEvidence ?? [],
    });
    if (deterministicFirst.ok && deterministicFirst.diagnostics?.plannerPath === "deterministic_nlu") {
      if (deterministicFirst.draft.classification === "clarification") {
        recordMappingDiagnosticOnly(batchSnapshot, {
          detectedIntent: deterministicFirst.diagnostics.nluIntent ?? "dataset_mapping",
          selectedPlanner: "deterministic_nlu",
          modelAttempted: false,
          modelOutcome: "clarification",
          fallbackUsed: false,
          patchOperationTypes: [],
          filesResolved: deterministicFirst.diagnostics.filesResolved ?? [],
          columnsResolved: deterministicFirst.diagnostics.columnsResolved ?? [],
          nluDomain: deterministicFirst.diagnostics.nluDomain,
          nluIntent: deterministicFirst.diagnostics.nluIntent,
          nluConfidence: deterministicFirst.diagnostics.nluConfidence,
          nluTrace: deterministicFirst.diagnostics.nluTrace,
          elapsedMs: performance.now() - startedAt,
        });
        return {
          ok: true,
          applied: null,
          fallbackUsed: false,
          clarification: deterministicFirst.clarification,
          message: deterministicFirst.clarification,
        };
      }
      return applyTypedMappingPatchToBatch(batchSnapshot, baseSpec, deterministicFirst.draft, {
        source: "deterministic conversational nlu",
        userIntent,
        modelAttempted: false,
        modelOutcome: "deterministic_nlu",
        fallbackUsed: false,
        startedAt,
        fallbackDiagnostics: deterministicFirst.diagnostics,
        bootstrapGenerated: ensure.generated,
        detectedIntent: deterministicFirst.diagnostics.nluIntent ?? "dataset_mapping",
        selectedPlanner: "deterministic_nlu",
      });
    }

    const canUseModel = localModelConfig.enabled !== false
      && Boolean(localModelConfig.model.trim())
      && localModelStatus === "connected";

    if (!canUseModel) {
      return runDeterministicFallback({
        modelAttempted: false,
        modelOutcome: localModelConfig.enabled === false ? "disabled" : localModelStatus === "connected" ? "model_missing" : "disconnected",
        fallbackReason: localModelConfig.enabled === false ? LOCAL_MODEL_DISABLED_MESSAGE : "local model not connected",
      });
    }

    return runExclusiveLocalModelTask({
      task: "plan_dataset_mapping_patch",
      message: "Planning a typed mapping patch with the local model…",
      timeoutMs: LOCAL_MODEL_TASK_TIMEOUTS.mapping_patch_total,
      run: async ({ requestId, signal, timeoutMs, onMetrics }) => {
        const result = await planDatasetMappingPatch({
          config: localModelConfig,
          mappingSpec: baseSpec,
          datasetProfile: batchSnapshot.datasetProfile,
          relationshipEvidence: batchSnapshot.relationshipEvidence ?? [],
          userIntent,
          history: batchSnapshot.mappingHistory ?? [],
          signal,
          timeoutMs,
          onMetrics,
        });
        if (result.aborted) {
          recordMappingDiagnosticOnly(batchSnapshot, {
            requestId,
            detectedIntent: "explicit_patch",
            selectedPlanner: "dataset_mapping_patch",
            modelAttempted: true,
            modelOutcome: "aborted",
            fallbackUsed: false,
            runtimeClassification: result.classification ?? "request_aborted",
            elapsedMs: performance.now() - startedAt,
          });
          return {
            ...result,
            message: "Stopped. No mapping patch was applied and no deterministic fallback ran.",
          };
        }
        if (result.ok && result.applied && activeBatchRef.current.id === batchSnapshot.id) {
          return {
            ...applyTypedMappingPatchToBatch(batchSnapshot, baseSpec, result.draft, {
              source: "local model patch + deterministic validation",
              userIntent,
              modelAttempted: true,
              modelOutcome: result.applied.noChange ? "no_change" : "valid_patch",
              fallbackUsed: false,
              requestId,
              startedAt,
              bootstrapGenerated: ensure.generated,
            }),
            request: result.request,
            rawResponse: result.rawResponse,
            attempts: result.attempts,
            repairAttempts: result.repairAttempts,
          };
        }
        if (result.ok && !result.applied) {
          recordMappingDiagnosticOnly(batchSnapshot, {
            requestId,
            detectedIntent: "explicit_patch",
            selectedPlanner: "dataset_mapping_patch",
            modelAttempted: true,
            modelOutcome: "clarification",
            fallbackUsed: false,
            patchValidationErrors: [],
            elapsedMs: performance.now() - startedAt,
          });
          return {
            ...result,
            message: result.clarification || "The local mapping planner requested clarification; no mapping patch was applied.",
          };
        }
        return {
          ...runDeterministicFallback({
            modelAttempted: true,
            modelOutcome: result.classification || "invalid_typed_patch",
            fallbackReason: result.error || result.classification || "invalid typed mapping patch",
            requestId,
          }),
          classification: result.classification,
          attempts: result.attempts,
          repairAttempts: result.repairAttempts,
          modelError: result.error,
          fallbackUsed: true,
        };
      },
    });
  }

  function generateTransformationPlanFromActiveMapping() {
    const candidate = activeAgentBatch?.repairedMapping ?? activeAgentBatch?.mappingSpec;
    if (!candidate) return { ok: false, error: "Generate or enter a mapping spec first." };
    const workflow = buildMappingWorkflow(activeAgentBatch, candidate, {
      preview: activeAgentBatch.mappingPreview,
      deterministicDraft: activeAgentBatch.deterministicDraftMapping,
      diagnostics: activeAgentBatch.preMappingDiagnostics,
      expectedOutputComparison: activeAgentBatch.expectedOutputComparison,
    });
    if (!workflow.validation.canGenerateParser) return { ok: false, error: workflow.validation.message, validation: workflow.validation };
    const planResult = buildTransformationPlanFromMapping(workflow.validation.spec);
    if (!planResult.ok) return { ok: false, error: planResult.error };
    const transformationPlanPreview = describeTransformationPlan(planResult.plan);
    const mappingRevision = (activeAgentBatch.mappingRevision ?? 0) + (workflow.repair.changed ? 1 : 0);
    updateBatchMapping(activeAgentBatch.id, {
      ...mappingPatchFromWorkflow(workflow, activeAgentBatch.mappingSource, activeAgentBatch.mappingUserIntent, {
        mappingRevision,
        modelRefinedMapping: activeAgentBatch.modelRefinedMapping,
      }),
      transformationPlan: planResult.plan,
      transformationPlanPreview,
      transformationPlanStatus: "generated",
      transformationPlanFingerprint: planResult.plan.planFingerprint,
      parserReconciliation: null,
      selectedMappingForParser: "repairedMapping",
      parserStatus: activeAgentBatch.generatedParserFromMapping ? "stale_plan_regenerated" : "plan_generated",
    });
    return {
      ok: true,
      plan: planResult.plan,
      preview: transformationPlanPreview,
      message: `Transformation plan generated with ${planResult.plan.steps.length.toLocaleString()} steps. No parser code was inserted or run.`,
    };
  }

  function generateParserFromActiveMapping() {
    const candidate = activeAgentBatch?.repairedMapping ?? activeAgentBatch?.mappingSpec;
    if (!candidate) return { ok: false, error: "Generate or enter a mapping spec first." };
    const workflow = buildMappingWorkflow(activeAgentBatch, candidate, {
      preview: activeAgentBatch.mappingPreview,
      deterministicDraft: activeAgentBatch.deterministicDraftMapping,
      diagnostics: activeAgentBatch.preMappingDiagnostics,
      expectedOutputComparison: activeAgentBatch.expectedOutputComparison,
    });
    if (!workflow.validation.canGenerateParser) return { ok: false, error: workflow.validation.message, validation: workflow.validation };
    const generated = generateParserFromMappingSpec(workflow.validation.spec);
    if (!generated.ok) {
      if (generated.builtinRoute) {
        return { ok: false, error: generated.error, builtinRoute: generated.builtinRoute };
      }
      return generated;
    }
    const generatedAt = new Date().toISOString();
    const mappingRevision = (activeAgentBatch.mappingRevision ?? 0) + (workflow.repair.changed ? 1 : 0);
    const repairComment = workflow.validation.repairNotes.length
      ? `// Mapping auto-repair notes:\n${workflow.validation.repairNotes.map(note => `// - ${note}`).join("\n")}\n`
      : "";
    const generatedCode = `${repairComment}${generated.code}`;
    const transformationPlan = generated.transformationPlan ?? null;
    const transformationPlanPreview = transformationPlan ? describeTransformationPlan(transformationPlan) : [];
    const modelRunId = `mapping-parser-${++starterCounterRef.current}`;
    const binding = {
      batchId: activeAgentBatch.id,
      batchVersion: activeAgentBatch.version ?? 1,
      parseMode: activeAgentBatch.parseMode,
      mappingRevision,
      transformationPlanFingerprint: transformationPlan?.planFingerprint ?? null,
      modelRunId,
      generatedAt,
      modelRuntime: "deterministic-mapping",
      modelName: "",
    };
    setCustomFiles(activeAgentBatch.files);
    updateCustomCode(generatedCode, "mapping", binding);
    setCustomResult(null); setCustomResultId(null); setCustomErr(""); setCustomLogs([]);
    setFmt("custom"); setErr("");
    updateBatchMapping(activeAgentBatch.id, {
      ...mappingPatchFromWorkflow(workflow, activeAgentBatch.mappingSource, activeAgentBatch.mappingUserIntent, {
        mappingRevision,
        modelRefinedMapping: activeAgentBatch.modelRefinedMapping,
      }),
      generatedParserFromMapping: generatedCode,
      transformationPlan,
      transformationPlanPreview,
      transformationPlanStatus: transformationPlan ? "generated" : "legacy",
      transformationPlanFingerprint: transformationPlan?.planFingerprint ?? null,
      parserReconciliation: null,
      selectedMappingForParser: "repairedMapping",
      parserStatus: "inserted",
    });
    setLastModelAssist(current => ({
      ...(current?.batchId === activeAgentBatch.id ? current : {}),
      task: "generate_parser_from_mapping",
      batchId: activeAgentBatch.id,
      batchVersion: activeAgentBatch.version ?? 1,
      userIntent: activeAgentBatch.mappingUserIntent ?? "",
      modelOutput: workflow.validation.spec,
      validationResult: { passed: true, warnings: workflow.validation.warnings, errors: [] },
      preview: activeAgentBatch.mappingPreview,
      parserRunResult: { passed: false, stats: null },
      userAccepted: Boolean(activeAgentBatch.mappingFeedback?.accepted),
      localRuntime: { runtime: "deterministic-mapping", transport: "none", model: "" },
      finalParserInserted: true,
      fallbackUsed: false,
      binding,
      createdAt: generatedAt,
    }));
    return {
      ok: true,
      code: generatedCode,
      kind: generated.kind,
      transformationPlan,
      transformationPlanPreview,
      binding,
      message: "Parser generated from the validated mapping and inserted into Custom Parser Studio. It has not been run yet.",
    };
  }

  function setActiveMappingFeedback(patch) {
    if (!activeAgentBatch?.mappingSpec) return { ok: false, error: "There is no active mapping spec to review." };
    const feedback = { ...(activeAgentBatch.mappingFeedback ?? {}), ...patch };
    updateBatchMapping(activeAgentBatch.id, {
      mappingFeedback: feedback,
      mappingSpecAccepted: Boolean(feedback.accepted),
    });
    return { ok: true, feedback };
  }

  function exportActiveMappingSpec() {
    if (!activeAgentBatch?.mappingSpec) return { ok: false, error: "There is no mapping spec to export." };
    downloadMappingArtifact(activeAgentBatch.mappingSpec, `${activeAgentBatch.id}-dataset-mapping-spec.json`);
    return { ok: true };
  }

  function exportMappingFineTuneExample(includeFullFiles = false) {
    if (!activeAgentBatch?.mappingSpec) return { ok: false, error: "Generate and validate a mapping spec first." };
    const example = buildMappingFineTuneExample({
      batch: activeAgentBatch,
      preview: activeAgentBatch.mappingPreview ?? mappingPreviewFor(activeAgentBatch),
      userIntent: activeAgentBatch.mappingUserIntent,
      mappingSpec: activeAgentBatch.mappingSpec,
      deterministicDraftMapping: activeAgentBatch.deterministicDraftMapping,
      modelRefinedMapping: activeAgentBatch.modelRefinedMapping,
      repairedMapping: activeAgentBatch.repairedMapping,
      mappingValidation: activeAgentBatch.mappingValidation,
      selectedMappingForParser: activeAgentBatch.selectedMappingForParser,
      parserCode: activeAgentBatch.generatedParserFromMapping,
      parserRunStats: activeAgentBatch.statsSnapshot,
      expectedOutputComparison: activeAgentBatch.expectedOutputComparison,
      feedback: activeAgentBatch.mappingFeedback,
      includeFullFiles,
    });
    updateBatchMapping(activeAgentBatch.id, {
      fineTuneExamples: [...(activeAgentBatch.fineTuneExamples ?? []), example].slice(-20),
    });
    downloadMappingArtifact(example, `${activeAgentBatch.id}-mapping-finetune-example.json`);
    return { ok: true, includeFullFiles, fileCount: example.input.filePreviews.length };
  }

  function exportMappingFineTuneJsonl() {
    const examples = agentFileBatches.flatMap(batch => batch.fineTuneExamples ?? []);
    if (!examples.length) return { ok: false, error: "Export at least one mapping fine-tuning example first." };
    downloadMappingArtifact(examples.map(example => JSON.stringify(example)).join("\n"), "hypergraph-mapping-finetune-examples.jsonl", "application/x-ndjson");
    return { ok: true, count: examples.length };
  }

  function compareActiveExpectedOutput() {
    if (!activeAgentBatch?.mappingSpec) return { ok: false, error: "Generate a mapping spec first." };
    if (!customResult?.hyperedges?.length) return { ok: false, error: "Run the generated parser first so there is an actual result to compare." };
    const expectedMapping = activeAgentBatch.mappingSpec.files?.find(file => file.role === "validation_expected_output" && file.useAsInput === false);
    if (!expectedMapping) return { ok: false, error: "The mapping does not identify an expected-output validation file." };
    const expectedFile = activeAgentBatch.files.find(file => file.name === expectedMapping.fileName);
    if (!expectedFile) return { ok: false, error: "The mapped expected-output file is no longer in the active batch." };
    const expectedValue = parseExpectedOutputText(expectedFile.text, expectedFile.name);
    const comparison = compareWithExpectedOutput(customResult.hyperedges, expectedValue);
    updateBatchMapping(activeAgentBatch.id, { expectedOutputComparison: comparison });
    return comparison.ok
      ? { ok: true, comparison, message: `Compared parser output with ${expectedFile.name}: ${comparison.vertexSetsMatched}/${comparison.vertexSetsTotal} hyperedge vertex sets matched.` }
      : { ok: false, comparison, error: comparison.warnings.join(" ") };
  }

  function renameAgentBatch(batchId, label) {
    const nextLabel = String(label ?? "").trim().slice(0, 80);
    if (!nextLabel) return { ok: false, error: "Enter a non-empty batch name." };
    const batch = agentFileBatches.find(item => item.id === batchId);
    if (!batch) return { ok: false, error: "That batch no longer exists." };
    setAgentFileBatches(current => current.map(item => item.id === batchId
      ? { ...item, label: nextLabel, updatedAt: new Date().toISOString() }
      : item));
    setBatchVersion(version => version + 1);
    return { ok: true, batch: { ...batch, label: nextLabel } };
  }

  function duplicateAgentBatch(batchId) {
    const source = agentFileBatches.find(item => item.id === batchId);
    if (!source) return { ok: false, error: "That batch no longer exists." };
    const batchNumber = ++batchCounterRef.current;
    const nonce = `duplicate-${++uploadNonceRef.current}-${batchNumber}`;
    const files = source.files.map((file, index) => ({ ...file, id: `${nonce}-${index}` }));
    const duplicate = {
      ...buildAgentBatch(files, `batch-${batchNumber}`, `${source.label} copy`, source.parseMode),
      status: "active",
    };
    setAgentFileBatches(current => [
      ...current.map(batch => ({ ...batch, status: "inactive" })),
      duplicate,
    ]);
    setActiveBatchId(duplicate.id);
    setLastTouchedBatchId(duplicate.id);
    setBatchVersion(version => version + 1);
    setCustomFiles([]);
    setCustomResult(null); setCustomResultId(null); setCustomErr(""); setCustomLogs([]);
    return { ok: true, batch: duplicate };
  }

  function deleteAgentBatch(batchId) {
    const batch = agentFileBatches.find(item => item.id === batchId);
    if (!batch) return { ok: false, error: "That batch no longer exists." };
    if (batchId === activeBatchId) return clearAgentFiles();
    setAgentFileBatches(current => current.filter(item => item.id !== batchId));
    setBatchVersion(version => version + 1);
    return { ok: true, removedBatch: batch };
  }

  function previousAgentBatch() {
    const activeIndex = agentFileBatches.findIndex(batch => batch.id === activeBatchId);
    if (activeIndex > 0) return agentFileBatches[activeIndex - 1];
    if (activeIndex === 0) return null;
    return agentFileBatches.at(-1) ?? null;
  }

  async function uploadAgentFiles(rawFiles) {
    uploadReadControllerRef.current?.abort();
    const controller = new AbortController();
    uploadReadControllerRef.current = controller;
    try {
      const uploadNonce = `upload-${++uploadNonceRef.current}`;
      const files = await readUploadedTextFiles(rawFiles, uploadNonce, { signal: controller.signal });
      if (uploadReadControllerRef.current !== controller || controller.signal.aborted) {
        return { ok: false, cancelled: true, error: "Upload cancelled because a newer upload started." };
      }
      const batchNumber = ++batchCounterRef.current;
      const batch = buildAgentBatch(files, `batch-${batchNumber}`, `Batch ${batchNumber}`);
      const previousBatchId = activeBatchId;
      setAgentFileBatches(previous => [
        ...previous.map(item => ({ ...item, status: "inactive" })),
        batch,
      ]);
      setActiveBatchId(batch.id); setLastTouchedBatchId(batch.id);
      setBatchVersion(version => version + 1);
      setCustomCodeBinding(null);
      setLastModelAssist(null);
      setModelDebug(null);
      setCustomResult(null); setCustomResultId(null); setCustomErr(""); setCustomLogs([]);
      setCustomFiles(batch.detectedFormat.formatId === "custom" ? files : []);
      const names = files.map(file => file.name).join(", ");
      return {
        ok: true,
        count: files.length,
        names,
        batch,
        batchId: batch.id,
        hadPreviousBatch: Boolean(previousBatchId),
        previousBatchId,
        detection: batch.detectedFormat,
        message: previousBatchId
          ? `Uploaded ${files.length} new file${files.length === 1 ? "" : "s"} as ${batch.label}, a new dataset batch. Do you want to parse this new batch or add it to the previous batch?`
          : `Uploaded ${files.length} file${files.length === 1 ? "" : "s"} as ${batch.label}: ${names}.`,
      };
    } catch (error) {
      if (error?.name === "AbortError") return { ok: false, cancelled: true, error: "Upload cancelled." };
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    } finally {
      if (uploadReadControllerRef.current === controller) uploadReadControllerRef.current = null;
    }
  }

  function clearAgentFiles() {
    if (!activeAgentBatch) return { ok: false, error: "There is no active upload batch." };
    const remaining = agentFileBatches.filter(batch => batch.id !== activeBatchId);
    const nextActive = remaining.at(-1) ?? null;
    setAgentFileBatches(remaining.map(batch => ({ ...batch, status: batch.id === nextActive?.id ? "active" : "inactive" })));
    setActiveBatchId(nextActive?.id ?? null); setLastTouchedBatchId(nextActive?.id ?? null);
    setBatchVersion(version => version + 1);
    setCustomFiles(customCodeBinding?.batchId === nextActive?.id ? nextActive.files : []);
    setCustomResult(null); setCustomErr(""); setCustomLogs([]);
    setCustomResultId(null);
    return { ok: true, remaining: nextActive?.files.length ?? 0, activeBatch: nextActive };
  }

  function clearAllAgentBatches() {
    setAgentFileBatches([]); setActiveBatchId(null); setLastTouchedBatchId(null);
    setBatchVersion(version => version + 1);
    setCustomFiles([]); setCustomResult(null); setCustomResultId(null); setCustomErr(""); setCustomLogs([]);
    return { ok: true };
  }

  function setActiveAgentBatch(batchId) {
    const batch = agentFileBatches.find(item => item.id === batchId);
    if (!batch) return { ok: false, changedState: false, error: "That upload batch no longer exists." };
    // Re-activating the batch that's already active must be a true no-op:
    // no status churn, no batchVersion bump, and — critically — no clearing
    // of parser result/logs/errors/preview state that the person may still
    // be looking at (V7310-D11).
    if (batchId === activeBatchId) {
      return { ok: true, changedState: false, outcome: "batch_already_active", changedKeys: [], batch };
    }
    setAgentFileBatches(previous => previous.map(item => ({ ...item, status: item.id === batchId ? "active" : "inactive" })));
    setActiveBatchId(batchId); setLastTouchedBatchId(batchId);
    setBatchVersion(version => version + 1);
    setCustomFiles(customCodeBinding?.batchId === batchId ? batch.files : []);
    setCustomResult(null); setCustomResultId(null); setCustomErr(""); setCustomLogs([]);
    return {
      ok: true,
      changedState: true,
      outcome: "batch_activated",
      changedKeys: ["agentFileBatches", "activeBatchId", "lastTouchedBatchId", "batchVersion", "customFiles", "customResult", "customResultId", "customErr", "customLogs"],
      batch,
    };
  }

  function viewPreviousAgentBatch() {
    const previous = previousAgentBatch();
    return previous ? setActiveAgentBatch(previous.id) : { ok: false, error: "There is no previous upload batch." };
  }

  function clearPreviousAgentBatch() {
    const previous = previousAgentBatch();
    if (!previous) return { ok: false, error: "There is no previous upload batch." };
    setAgentFileBatches(current => current.filter(batch => batch.id !== previous.id));
    setBatchVersion(version => version + 1);
    return { ok: true, removedBatch: previous };
  }

  function addActiveFilesToPreviousBatch() {
    const previous = previousAgentBatch();
    if (!previous || !activeAgentBatch) return { ok: false, error: "A previous and active batch are both required." };
    const merged = {
      ...buildAgentBatch(
        [...previous.files, ...activeAgentBatch.files],
        previous.id,
        previous.label,
        "unknown",
      ),
      version: (previous.version ?? 1) + 1,
      createdAt: previous.createdAt,
      modelRuns: previous.modelRuns ?? [],
    };
    const currentId = activeAgentBatch.id;
    setAgentFileBatches(current => current
      .filter(batch => batch.id !== currentId)
      .map(batch => batch.id === previous.id ? merged : { ...batch, status: "inactive" }));
    setActiveBatchId(previous.id); setLastTouchedBatchId(previous.id);
    setBatchVersion(version => version + 1);
    setCustomFiles([]); setCustomResult(null); setCustomResultId(null); setCustomErr(""); setCustomLogs([]);
    return { ok: true, batch: merged };
  }

  function setAgentBatchParseMode(mode) {
    if (!activeAgentBatch) return { ok: false, error: "There is no active upload batch." };
    if (!["unknown", "together", "separate", "grouped"].includes(mode)) return { ok: false, error: "Unsupported parse mode." };
    const updated = {
      ...activeAgentBatch,
      parseMode: mode,
      groupingRevision: (activeAgentBatch.groupingRevision ?? 0) + 1,
      groupingStatus: mode === "unknown" ? "needs_clarification" : "validated",
      groupingHistory: [
        ...(activeAgentBatch.groupingHistory ?? []),
        {
          revision: (activeAgentBatch.groupingRevision ?? 0) + 1,
          source: "user parse-mode selection",
          createdAt: new Date().toISOString(),
          summary: `Parse mode set to ${mode}.`,
        },
      ].slice(-20),
      ...(activeAgentBatch.mappingSpec ? {
        mappingSpecStatus: "invalid",
        mappingSpecValidationErrors: [`Batch parse mode changed to ${mode}. Update and validate the mapping before generating a new parser.`],
      } : {}),
      version: (activeAgentBatch.version ?? 1) + 1,
      updatedAt: new Date().toISOString(),
    };
    setAgentFileBatches(current => current.map(batch => batch.id === updated.id ? updated : batch));
    setLastTouchedBatchId(updated.id); setBatchVersion(version => version + 1);
    setCustomResult(null); setCustomResultId(null);
    return { ok: true, batch: updated };
  }

  function removeAgentFile(fileId) {
    const next = agentFiles.filter(file => file.id !== fileId);
    if (!next.length) return clearAgentFiles();
    const updated = {
      ...buildAgentBatch(next, activeAgentBatch.id, activeAgentBatch.label, next.length === 1 ? "together" : activeAgentBatch.parseMode),
      version: (activeAgentBatch.version ?? 1) + 1,
      createdAt: activeAgentBatch.createdAt,
      modelRuns: activeAgentBatch.modelRuns ?? [],
      modelStatus: activeAgentBatch.modelStatus ?? "none",
      parserStatus: activeAgentBatch.parserStatus ?? "none",
      statsSnapshot: activeAgentBatch.statsSnapshot ?? null,
    };
    setAgentFileBatches(current => current.map(batch => batch.id === updated.id ? updated : batch));
    setLastTouchedBatchId(updated.id); setBatchVersion(version => version + 1);
    setCustomFiles(current => current.filter(file => file.id !== fileId));
    setCustomResult(null); setCustomResultId(null);
    return { ok: true, remaining: next.length, detection: updated.detectedFormat, batch: updated };
  }

  function autoDetectAgentFiles() {
    if (!agentFiles.length) return { ok: false, error: "Upload at least one file first." };
    const analysis = analyzeUploadBatch(agentFiles, autoDetect);
    const detection = analysis.detectedFormat;
    const targetBatchId = activeBatchId;
    setAgentFileBatches(current => current.map(batch => batch.id === targetBatchId
      ? {
        ...batch,
        ...analysis,
        detectedFormat: detection,
        version: (batch.version ?? 1) + 1,
        updatedAt: new Date().toISOString(),
      }
      : batch));
    setBatchVersion(version => version + 1);
    if (!detection.formatId) return { ok: false, error: detection.reason, detection };
    const staged = stageAgentFiles(agentFiles, detection.formatId);
    return { ...staged, detection };
  }

  function routeAgentFiles(targetFormat) {
    const staged = stageAgentFiles(agentFiles, targetFormat);
    if (!staged.ok) return staged;
    const details = getFormatDetails(targetFormat);
    const detection = {
      formatId: targetFormat,
      routeId: details?.routeId ?? null,
      label: staged.label,
      confidence: "user-selected",
      reason: `You selected the ${staged.label} route for the attached file${agentFiles.length === 1 ? "" : "s"}.`,
    };
    const targetBatchId = activeBatchId;
    setAgentFileBatches(current => current.map(batch => batch.id === targetBatchId
      ? {
        ...batch,
        detectedFormat: detection,
        version: (batch.version ?? 1) + 1,
        updatedAt: new Date().toISOString(),
      }
      : batch));
    setBatchVersion(version => version + 1);
    return { ...staged, detection };
  }

  function useAgentFilesWithCustomParser() {
    return routeAgentFiles("custom");
  }

  function prepareCustomParserForActiveBatch() {
    if (!activeAgentBatch) return { ok: false, error: "Upload files first." };
    if (agentFiles.length > 1 && activeAgentBatch.parseMode === "unknown") {
      return { ok: false, error: "Confirm whether these files should be parsed together or separately first." };
    }
    const generatedAt = new Date().toISOString();
    const modelRunId = `starter-${++starterCounterRef.current}`;
    const binding = {
      batchId: activeAgentBatch.id,
      batchVersion: activeAgentBatch.version ?? 1,
      parseMode: activeAgentBatch.parseMode,
      modelRunId,
      generatedAt,
      modelRuntime: "deterministic",
      modelName: "",
    };
    setCustomFiles(agentFiles);
    updateCustomCode(buildBatchCustomParserTemplate(activeAgentBatch), "deterministic", binding);
    setCustomResult(null); setCustomResultId(null); setCustomErr(""); setCustomLogs([]);
    setFmt("custom"); setErr("");
    updateBatchParserStatus(activeAgentBatch.id, "inserted");
    setLastModelAssist(current => ({
      task: "deterministic_starter",
      batchId: activeAgentBatch.id,
      batchVersion: activeAgentBatch.version ?? 1,
      userIntent: "Generate deterministic starter parser",
      modelOutput: null,
      validationResult: { passed: true, warnings: ["Deterministic starter requires user review and column adjustments."] },
      preview: current?.batchId === activeAgentBatch.id ? current.preview : null,
      modelAttempts: current?.batchId === activeAgentBatch.id ? current.modelAttempts ?? [] : [],
      parserRunResult: { passed: false, stats: null },
      userAccepted: false,
      localRuntime: { runtime: "deterministic", transport: "none", model: "" },
      finalParserInserted: true,
      fallbackUsed: true,
      createdAt: generatedAt,
    }));
    return {
      ok: true,
      formatId: "custom",
      mode: activeAgentBatch.parseMode,
      binding,
      message: activeAgentBatch.parseMode === "separate"
        ? "Generated a separate-file starter. The dashboard displays one active graph at a time, so select one file per run."
        : "Generated a deterministic combined starter for the active batch. It is commented, safe, and has not been run.",
    };
  }

  async function parseAgentFiles(targetFormat) {
    if (!agentFiles.length) return { ok: false, error: "Upload at least one file first." };
    if (activeAgentBatch.metadataOnly) return { ok: false, error: "This looks like metadata only. I need an edge, incidence, or hyperedge membership file to build a graph." };
    if (agentFiles.length > 1 && activeAgentBatch.parseMode === "unknown" && agentDetection?.formatId !== "cornell") {
      return { ok: false, error: "Confirm whether the active files should be parsed together or separately first." };
    }
    if (activeAgentBatch.parseMode === "separate") {
      return { ok: false, error: "The dashboard displays one active graph at a time. Choose one file or parse the batch together as a temporal dataset." };
    }
    const detection = agentDetection ?? detectUploadedFiles(agentFiles, autoDetect);
    const formatToUse = targetFormat || detection.formatId;
    if (!formatToUse) return { ok: false, error: detection.reason };
    if (formatToUse === "custom") return { ok: false, error: "Use Custom Parser, then run its code with confirmation." };
    const staged = stageAgentFiles(agentFiles, formatToUse);
    if (!staged.ok) return staged;
    const result = await parseAndCommit(formatToUse, payloadForAgentFiles(agentFiles, formatToUse), { preserveOnError: true });
    if (!result.ok) return result;
    const suspiciousWarnings = findSuspiciousOutputWarnings(result.parsedHyperedges, activeAgentBatch);
    if (suspiciousWarnings.length) setWarnings(current => [...current, ...suspiciousWarnings]);
    const statsSnapshot = {
      vertices: result.vertexCount,
      hyperedges: result.hyperedgeCount,
      incidences: result.incidenceCount,
    };
    setAgentFileBatches(current => current.map(batch => batch.id === activeAgentBatch.id
      ? { ...batch, statsSnapshot, updatedAt: new Date().toISOString() }
      : batch));
    const safeResult = { ...result };
    delete safeResult.parsedHyperedges;
    return { ...safeResult, suspiciousWarnings };
  }

  function updateLocalModelSettings(patch) {
    const current = localModelConfig;
    const next = {
      ...current,
      ...patch,
      runtime: "ollama",
      transportPreference: "auto",
      model: isEmptyOrPlaceholderModel(patch.model ?? current.model)
        ? RECOMMENDED_OLLAMA_MODEL
        : String(patch.model ?? current.model).trim(),
    };
    next.temperature = Math.max(0, Math.min(1, Number(next.temperature ?? DEFAULT_LOCAL_MODEL_TEMPERATURE)));
    next.timeoutMs = Math.max(1000, Math.min(DEFAULT_LOCAL_MODEL_TIMEOUT_MS, Number(next.timeoutMs ?? DEFAULT_LOCAL_MODEL_TIMEOUT_MS)));
    next.maxPreviewFiles = Math.max(1, Math.min(10, Number(next.maxPreviewFiles ?? 10)));
    next.maxPreviewLinesPerFile = Math.max(1, Math.min(50, Number(next.maxPreviewLinesPerFile ?? 50)));
    next.settingsVersion = LOCAL_MODEL_SETTINGS_VERSION;

    const comparableKeys = ["enabled", "model", "temperature", "timeoutMs", "maxPreviewFiles", "maxPreviewLinesPerFile"];
    const changedKeys = comparableKeys.filter(key => next[key] !== current[key]);
    const connectionChanged = ["enabled", "model"].some(key => changedKeys.includes(key));
    setLocalModelConfig(next);

    if (!connectionChanged) {
      return { ok: true, changedState: changedKeys.length > 0, changedKeys, previous: current, next };
    }

    setLocalModelStatus(next.enabled === false ? "disabled" : "disconnected");
    setLocalModelModels([]);
    setRuntimeProbeResult(null);
    setRuntimeDiagnostics(createRuntimeDiagnosticsSnapshot(next));
    setLocalModelMessage(next.enabled === false
      ? LOCAL_MODEL_DISABLED_MESSAGE
      : `Ollama settings updated. Start Ollama with ${next.model || RECOMMENDED_OLLAMA_MODEL}, then click Connect.`);
    return { ok: true, changedState: changedKeys.length > 0, changedKeys, previous: current, next };
  }

  function effectiveLocalModelConfig(overrides = {}) {
    let model = overrides.model ?? localModelConfig.model;
    if (isEmptyOrPlaceholderModel(model)) model = RECOMMENDED_OLLAMA_MODEL;
    return {
      ...localModelConfig,
      ...overrides,
      enabled: overrides.enabled ?? localModelConfig.enabled,
      runtime: "ollama",
      transportPreference: "auto",
      model,
    };
  }

  async function testConfiguredLocalModel(overrides = {}) {
    const effective = effectiveLocalModelConfig(overrides);
    if (effective.enabled === false) {
      const enabledConfig = { ...effective, enabled: true };
      setLocalModelConfig(enabledConfig);
      return testConfiguredLocalModel({ ...overrides, enabled: true });
    }
    setLocalModelBusy(true);
    setLocalModelStatus("connecting");
    setLocalModelMessage(`Connecting to ${effective.model || RECOMMENDED_OLLAMA_MODEL} through direct Ollama or the local bridge...`);
    try {
      const result = await connectOllamaAutomatically(effective, {
        preferTransport: overrides.preferTransport ?? null,
      });
      if (!result.ok) {
        const failureSnapshot = {
          ...createRuntimeDiagnosticsSnapshot(effective),
          ranAt: new Date().toISOString(),
          mode: "connect",
          attempts: result.attempts,
          lastConnectionErrorClassification: result.classification,
          suggestedFix: result.suggestedFix,
          summary: `${result.message}\n${result.details || ""}`.trim(),
          overallStatus: "failed",
        };
        setRuntimeDiagnostics(failureSnapshot);
        setLocalModelStatus("error");
        setLocalModelMessage(failureSnapshot.summary);
        return { ok: false, error: failureSnapshot.summary, ...result };
      }
      const nextConfig = {
        ...effective,
        enabled: true,
        activeTransport: result.transport,
        activeBaseUrl: result.baseUrl,
        lastSuccessfulTransport: result.transport,
      };
      setLocalModelConfig(nextConfig);
      setRuntimeDiagnostics({
        ...createRuntimeDiagnosticsSnapshot(nextConfig),
        ranAt: new Date().toISOString(),
        mode: "connect",
        attempts: result.attempts,
        directRuntimeReachability: result.transport === "direct"
          ? { status: "ok", message: "Direct Ollama connected.", baseUrl: DIRECT_OLLAMA_BASE_URL }
          : { status: "not_tested", message: "Direct Ollama was not required after the remembered transport succeeded." },
        bridgeReachability: result.transport === "bridge"
          ? { status: "ok", message: "Local bridge connected.", baseUrl: BRIDGE_OLLAMA_BASE_URL }
          : { status: "not_tested", message: "Local bridge was not required after direct Ollama succeeded." },
        modelListingStatus: { status: "ok", message: `Model listing returned ${result.models.length} model${result.models.length === 1 ? "" : "s"}.`, models: result.models },
        generationStatus: { status: "ok", message: "Tiny structured generation returned JSON status ok." },
        overallStatus: "ok",
        summary: result.message,
      });
      setLocalModelStatus("connected");
      setLocalModelMessage(result.message);
      setLocalModelModels(result.models);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const classified = formatActionableRuntimeError(error, effective);
      const failureSnapshot = {
        ...createRuntimeDiagnosticsSnapshot(effective),
        ranAt: new Date().toISOString(),
        mode: "connect",
        lastConnectionErrorClassification: classified.classification,
        suggestedFix: classified.suggestedFix,
        summary: `${message}\n${classified.suggestedFix}`.trim(),
        overallStatus: "failed",
      };
      setRuntimeDiagnostics(failureSnapshot);
      setLocalModelStatus("error");
      setLocalModelMessage(failureSnapshot.summary);
      return { ok: false, error: message };
    } finally {
      setLocalModelBusy(false);
    }
  }

  async function listConfiguredLocalModels(overrides = {}) {
    const effective = effectiveLocalModelConfig(overrides);
    setLocalModelBusy(true);
    try {
      const selected = effective.model || RECOMMENDED_OLLAMA_MODEL;
      const attempts = [];
      let result = { models: [], listingAvailable: false, message: "" };
      for (const transport of getOllamaAttemptOrder(effective, overrides.preferTransport ?? null)) {
        try {
          const models = await listModelsForTransport(transport, effective);
          result = { models, listingAvailable: true, message: `Model listing succeeded through ${transport === "bridge" ? "Local Bridge" : "Direct Ollama"}.`, transport };
          attempts.push({ transport, ok: true, models });
          break;
        } catch (error) {
          attempts.push({
            transport,
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      if (!result.listingAvailable) {
        const details = attempts.map(attempt => `${attempt.transport}: ${attempt.error}`).join("\n");
        throw new Error(`Could not list Ollama models through direct Ollama or the local bridge.\n${details}`.trim());
      }
      const installed = result.models.includes(selected);
      const message = installed
        ? `${selected} is installed.`
        : `${selected} is not installed. Run: ollama pull ${selected}`;
      setRuntimeProbeResult({
        ...createRuntimeDiagnosticsSnapshot(effective),
        ranAt: new Date().toISOString(),
        mode: "model-list-probe",
        attempts,
        modelListingStatus: { status: installed ? "ok" : "failed", message, models: result.models },
        overallStatus: installed ? "ok" : "failed",
        summary: message,
      });
      setLocalModelModels(result.models);
      setLocalModelMessage(message);
      return { ok: true, ...result, message };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const classified = formatActionableRuntimeError(error, effective);
      setRuntimeProbeResult({
        ...createRuntimeDiagnosticsSnapshot(effective),
        ranAt: new Date().toISOString(),
        mode: "model-list-probe",
        modelListingStatus: { status: "failed", message, models: [], classification: classified.classification, suggestedFix: classified.suggestedFix },
        lastConnectionErrorClassification: classified.classification,
        suggestedFix: classified.suggestedFix,
        overallStatus: "failed",
        summary: classified.suggestedFix,
      });
      return { ok: false, error: message };
    } finally {
      setLocalModelBusy(false);
    }
  }

  async function runLocalRuntimeDiagnostics(mode = "current") {
    if (mode === "graph-planner") {
      setRuntimeDiagnosticsBusy(true);
      try {
        return await runGraphPlannerReadinessDiagnostic();
      } finally {
        setRuntimeDiagnosticsBusy(false);
      }
    }
    const isolatedProbe = isIsolatedRuntimeProbeMode(mode);
    const testGeneration = mode === "generation" || mode === "current";
    setRuntimeDiagnosticsBusy(true);
    try {
      const result = await runRuntimeDiagnostics({
        config: localModelConfig,
        mode,
        testGeneration,
        fetchImpl: fetch,
        locationLike: window.location,
      });
      if (isolatedProbe) {
        setRuntimeProbeResult(result);
      } else {
        setRuntimeDiagnostics(result);
        if (diagnosticsEstablishConnection(result)) {
          setLocalModelConfig(current => ({
            ...current,
            enabled: true,
            activeTransport: result.activeTransport,
            activeBaseUrl: result.baseUrl,
            lastSuccessfulTransport: result.activeTransport,
          }));
          setLocalModelStatus("connected");
          setLocalModelModels(result.modelListingStatus?.models ?? []);
        } else if (result.overallStatus === "failed") {
          setLocalModelStatus("error");
        }
        if (result.summary) setLocalModelMessage(result.summary);
      }
      return {
        ok: result.overallStatus !== "failed",
        message: result.summary,
        diagnostics: result,
        isolatedProbe,
      };
    } catch (error) {
      const effective = effectiveLocalModelConfig();
      const classified = formatActionableRuntimeError(error, effective);
      const failureSnapshot = {
        ...createRuntimeDiagnosticsSnapshot(effective),
        ranAt: new Date().toISOString(),
        mode,
        lastConnectionErrorClassification: classified.classification,
        suggestedFix: classified.suggestedFix,
        summary: classified.suggestedFix,
        overallStatus: "failed",
      };
      if (isolatedProbe) setRuntimeProbeResult(failureSnapshot);
      else {
        setRuntimeDiagnostics(failureSnapshot);
        setLocalModelStatus("error");
        setLocalModelMessage(classified.suggestedFix);
      }
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        classification: classified.classification,
        suggestedFix: classified.suggestedFix,
        diagnostics: failureSnapshot,
        isolatedProbe,
      };
    } finally {
      setRuntimeDiagnosticsBusy(false);
    }
  }

  async function copyRuntimeDiagnosticCommand(kind) {
    const commands = runtimeDiagnostics?.commands ?? buildRuntimeCommands(localModelConfig, detectDeploymentMode(window.location));
    const text = commands[kind];
    if (!text) return { ok: false, error: `No ${runtimeCommandLabel(kind)} is available yet.` };
    try {
      await navigator.clipboard.writeText(text);
      return { ok: true, message: `Copied ${runtimeCommandLabel(kind)}.` };
    } catch (error) {
      return {
        ok: false,
        error: `Could not copy ${runtimeCommandLabel(kind)} automatically. ${error instanceof Error ? error.message : String(error)}`,
        text,
      };
    }
  }

  function getGitHubPagesRuntimeHelp() {
    const commands = buildRuntimeCommands(localModelConfig, detectDeploymentMode(window.location));
    return { ok: true, message: commands.githubPagesSetupHelp };
  }

  async function runGraphPlannerReadinessDiagnostic() {
    const effective = effectiveLocalModelConfig();
    if (localModelStatus !== "connected") {
      return { ok: false, error: "Connect Ollama before running the full graph-planner readiness test." };
    }
    const testHyperedges = [{ id: "h0", vertices: ["4", "5"] }];
    const testIdentity = createGraphIdentity(testHyperedges);
    const result = await runExclusiveLocalModelTask({
      task: "graph_mutation_planner_diagnostic",
      message: "Testing full graph mutation planner readiness…",
      timeoutMs: LOCAL_MODEL_TASK_TIMEOUTS.graph_mutation_planner_total,
      run: ({ signal, timeoutMs, onMetrics }) => planGraphMutationWithModel({
        config: effective,
        userQuery: "Add vertex 4 to h0 again.",
        hyperedges: testHyperedges,
        graphIdentity: testIdentity,
        graphHistory: [],
        selectedEntity: null,
        pendingAction: null,
        conversation: [],
        recentReferences: { vertices: [], hyperedges: [] },
        signal,
        timeoutMs,
        onMetrics,
      }),
    });
    if (result.busy) return { ok: false, error: result.error, classification: result.classification };
    if (result.aborted) return { ok: false, aborted: true, error: "Stopped. No graph change was prepared.", classification: "request_aborted" };
    const resolved = result.ok
      ? resolveGraphMutationDraftToPlan({
        draft: result.draft,
        hyperedges: testHyperedges,
        graphIdentity: testIdentity,
        graphHistory: [],
        selectedEntity: null,
        pendingAction: null,
        recentReferences: { vertices: [], hyperedges: [] },
      })
      : null;
    const passed = Boolean(result.ok && resolved?.ok);
    const message = passed
      ? `Graph planner readiness passed in ${result.elapsedMs ?? "unknown"} ms. Prompt ${result.request?.promptChars ?? 0} chars; schema ${result.request?.schemaChars ?? 0} chars.`
      : `Graph planner readiness failed. ${result.fallbackReason || resolved?.message || resolved?.error || "The draft was invalid."}`;
    const snapshot = {
      ...createRuntimeDiagnosticsSnapshot(effective),
      ranAt: new Date().toISOString(),
      mode: "graph-planner",
      plannerReadiness: {
        status: passed ? "ok" : "failed",
        message,
        promptChars: result.request?.promptChars ?? 0,
        schemaChars: result.request?.schemaChars ?? 0,
        repairPromptChars: result.request?.repairPromptChars ?? 0,
        elapsedMs: result.elapsedMs ?? null,
        metrics: result.metrics ?? [],
        attempts: result.attempts ?? [],
      },
      overallStatus: passed ? "ok" : "failed",
      summary: message,
    };
    setRuntimeProbeResult(snapshot);
    setRuntimeDiagnostics(current => ({ ...current, plannerReadiness: snapshot.plannerReadiness }));
    return { ok: passed, message, diagnostics: snapshot };
  }

  async function runMappingSpecAssist(userIntent = "", repair = false) {
    if (!activeAgentBatch) return { ok: false, error: "Upload an active file batch first." };
    const batchSnapshot = activeAgentBatch;
    const versionSnapshot = batchSnapshot.version ?? 1;
    const task = repair ? "repair_mapping_spec" : "generate_mapping_spec";
    const modelRunId = `mapping-run-${++modelRunCounterRef.current}`;
    const generatedAt = new Date().toISOString();
    const previewLimits = {
      maxPreviewFiles: localModelConfig.maxPreviewFiles,
      maxPreviewLinesPerFile: localModelConfig.maxPreviewLinesPerFile,
    };
    const preview = buildSafeModelPreview(batchSnapshot, previewLimits);
    const preMapping = buildDeterministicPreMapping(batchSnapshot, preview);
    const draftWorkflow = buildMappingWorkflow(batchSnapshot, preMapping.spec, {
      preview,
      deterministicDraft: preMapping.spec,
      diagnostics: preMapping.diagnostics,
      expectedOutputComparison: batchSnapshot.expectedOutputComparison,
    });
    const saveDraftFallback = (reason, validationErrors = []) => {
      updateBatchMapping(batchSnapshot.id, mappingPatchFromWorkflow(
        draftWorkflow,
        draftWorkflow.repair.changed ? "deterministic repaired" : "deterministic draft",
        userIntent,
        {
          mappingRevision: (batchSnapshot.mappingRevision ?? 0) + 1,
          modelRefinedMapping: null,
          mappingSpecAccepted: false,
          generatedParserFromMapping: "",
          expectedOutputComparison: null,
        },
      ));
      if (!draftWorkflow.validation.canGenerateParser) {
        return { ok: false, error: `${reason} The deterministic draft is also invalid. ${draftWorkflow.validation.message}`, validationErrors };
      }
      return {
        ok: true,
        task,
        data: draftWorkflow.validation.spec,
        mappingSpec: draftWorkflow.validation.spec,
        mappingOnly: true,
        insertedParser: false,
        fallbackUsed: true,
        batchLabel: batchSnapshot.label,
        repairAttempts: 0,
        message: `The local model could not refine the mapping, but the deterministic draft mapping is valid after auto-repair. ${reason}`,
      };
    };

    if (localModelConfig.enabled === false) return saveDraftFallback(LOCAL_MODEL_DISABLED_MESSAGE);
    if (!localModelConfig.model.trim()) return saveDraftFallback("No local model name is selected.");
    if (localModelStatus !== "connected") return saveDraftFallback("The local model connection is not ready.");
    if (repair && !batchSnapshot.mappingSpec) return saveDraftFallback("There was no prior model mapping to repair.");

    let request = null;
    setLocalModelBusy(true);
    setLocalModelMessage(`Refining the deterministic DatasetMappingSpec for ${batchSnapshot.label} with schema enforcement…`);
    try {
      request = buildLocalModelRequest(task, {
        batch: batchSnapshot,
        userIntent,
        mappingSpec: repair ? batchSnapshot.mappingSpec : null,
        deterministicDraftMapping: preMapping.spec,
        preMappingDiagnostics: preMapping.diagnostics,
        previewLimits,
      });
      const result = await generateValidatedModelResponse({
        config: localModelConfig,
        request,
        expectedTask: task,
        expectedParseMode: batchSnapshot.parseMode,
        activeFileNames: batchSnapshot.files.map(file => file.name),
        validate: raw => {
          const autoRepair = autoRepairMappingSpec(raw, {
            batch: batchSnapshot,
            preview: request.preview,
            deterministicDraft: preMapping.spec,
            diagnostics: preMapping.diagnostics,
          });
          if (!autoRepair.originalSpec) {
            return {
              ok: false,
              data: null,
              errors: ["Model response did not contain a DatasetMappingSpec JSON object."],
              message: "The model response could not be extracted as mapping JSON.",
            };
          }
          const validation = validateMappingWithSeverity(autoRepair.spec, {
            batch: batchSnapshot,
            preview: request.preview,
            repairNotes: autoRepair.repairNotes,
            autoRepairWarnings: autoRepair.warnings,
            expectedOutputComparison: batchSnapshot.expectedOutputComparison,
          });
          return {
            ok: validation.canGenerateParser,
            data: validation.spec,
            errors: [...validation.fatalErrors, ...validation.repairableErrors],
            message: validation.message,
            modelRefinedSpec: autoRepair.originalSpec,
            repairNotes: autoRepair.repairNotes,
            severity: validation,
          };
        },
      });
      const validationErrors = result.validation?.errors ?? [];
      setModelDebug({
        batchId: batchSnapshot.id,
        batchVersion: versionSnapshot,
        task,
        modelRunId,
        modelRuntime: "ollama",
        modelName: localModelConfig.model,
        promptSummary: {
          filesIncluded: request.preview.files.length,
          promptChars: result.request?.promptChars ?? request.promptChars,
          previewIsPartial: request.previewIsPartial,
          mappingOnly: true,
          deterministicDraftIncluded: true,
          validationFiles: preMapping.diagnostics.validationFiles.map(file => file.fileName),
          sharedKeys: preMapping.diagnostics.sharedKeys,
        },
        lastRawResponse: rawResponsePreview(result.rawResponse),
        parsedJsonPreview: result.data,
        validationErrors,
        repairAttempts: result.repairAttempts,
        attempts: result.attempts,
      });
      if (!result.ok) {
        recordBatchModelRun(batchSnapshot.id, {
          id: modelRunId,
          task,
          runtime: "ollama",
          model: localModelConfig.model,
          status: "failed",
          createdAt: generatedAt,
          summary: result.error,
          validationErrors,
          parserInserted: false,
        });
        setLocalModelStatus("error");
        setLocalModelMessage("The model refinement failed; the deterministic draft remains available.");
        return { ...saveDraftFallback(result.error, validationErrors), repairAttempts: result.repairAttempts, offerFallback: true };
      }
      if (activeBatchRef.current.id !== batchSnapshot.id || activeBatchRef.current.version !== versionSnapshot) {
        return { ok: false, error: "The active batch changed while the local model was working. I discarded the response." };
      }
      const spec = result.data;
      const severity = result.validation?.severity ?? validateMappingWithSeverity(spec, {
        batch: batchSnapshot,
        preview: request.preview,
        repairNotes: result.validation?.repairNotes ?? [],
      });
      const refinedWorkflow = {
        preview: request.preview,
        preMapping,
        repair: {
          spec,
          originalSpec: result.validation?.modelRefinedSpec ?? spec,
          repairNotes: result.validation?.repairNotes ?? [],
          warnings: [],
          changed: Boolean(result.validation?.repairNotes?.length),
        },
        validation: severity,
      };
      updateBatchMapping(batchSnapshot.id, mappingPatchFromWorkflow(
        refinedWorkflow,
        severity.repairNotes.length ? "model refined + repaired" : "model refined",
        userIntent,
        {
          mappingRevision: (batchSnapshot.mappingRevision ?? 0) + 1,
          modelRefinedMapping: result.validation?.modelRefinedSpec ?? spec,
          mappingSpecAccepted: false,
          generatedParserFromMapping: "",
          expectedOutputComparison: null,
          mappingFeedback: {
            accepted: false,
            rejected: false,
            corrected: false,
            parserWorked: null,
            notes: "",
          },
        },
      ));
      const assist = {
        task,
        batchId: batchSnapshot.id,
        batchVersion: versionSnapshot,
        modelRunId,
        modelRuntime: "ollama",
        modelName: localModelConfig.model,
        userIntent,
        modelOutput: spec,
        validationResult: { passed: true, warnings: severity.warnings, errors: [] },
        preview: request.preview,
        modelAttempts: result.attempts,
        parserRunResult: { passed: false, stats: null },
        userAccepted: false,
        localRuntime: { runtime: "ollama", transport: localModelConfig.activeTransport, model: localModelConfig.model },
        finalParserInserted: false,
        fallbackUsed: false,
        createdAt: generatedAt,
      };
      setLastModelAssist(assist);
      recordBatchModelRun(batchSnapshot.id, {
        id: modelRunId,
        task,
        runtime: "ollama",
        model: localModelConfig.model,
        status: result.repairAttempts > 0 || severity.repairNotes.length ? "repaired" : "generated",
        createdAt: generatedAt,
        summary: spec.summary,
        validationErrors: [],
        parserInserted: false,
      });
      setLocalModelStatus("connected");
      setLocalModelMessage(`The deterministic draft was refined, auto-repaired, and validated for ${batchSnapshot.label}.`);
      return {
        ok: true,
        task,
        data: spec,
        mappingSpec: spec,
        mappingOnly: true,
        insertedParser: false,
        batchLabel: batchSnapshot.label,
        repairAttempts: result.repairAttempts,
        message: severity.repairNotes.length
          ? `I created a deterministic draft first, refined it with the local model, and auto-repaired the result. ${severity.repairNotes.join(" ")}`
          : "I created a deterministic draft mapping first and used the local model only to refine it. You can review it or generate parser code from it.",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setLocalModelStatus("error");
      setLocalModelMessage("The model refinement failed; the deterministic draft remains available.");
      recordBatchModelRun(batchSnapshot.id, {
        id: modelRunId,
        task,
        runtime: "ollama",
        model: localModelConfig.model,
        status: "failed",
        createdAt: generatedAt,
        summary: message,
        validationErrors: [message],
        parserInserted: false,
      });
      return { ...saveDraftFallback(message, [message]), offerFallback: true };
    } finally {
      setLocalModelBusy(false);
    }
  }

  async function runLocalModelAssist(task, userIntent = "") {
    if (task === "generate_custom_parser" || task === "generate_mapping_spec") {
      return runMappingSpecAssist(userIntent, false);
    }
    if (task === "repair_mapping_spec") return runMappingSpecAssist(userIntent, true);
    if (!activeAgentBatch) return { ok: false, error: "Upload an active file batch first." };
    if (localModelConfig.enabled === false) return { ok: false, error: LOCAL_MODEL_DISABLED_MESSAGE };
    if (!localModelConfig.model.trim()) {
      return {
        ok: false,
        error: `The Ollama model name is missing; this release expects ${RECOMMENDED_OLLAMA_MODEL}. Restart from run-with-ollama after restoring settings.`,
      };
    }
    if (localModelStatus !== "connected") return { ok: false, error: "Test the local model connection before requesting model assistance." };
    if (["generate_custom_parser", "repair_custom_parser"].includes(task)
      && agentFiles.length > 1
      && activeAgentBatch.parseMode === "unknown") {
      return { ok: false, error: "Choose whether the active files should be parsed together or separately first." };
    }
    if (task === "generate_custom_parser" && activeAgentBatch.parseMode === "separate" && agentFiles.length > 1) {
      return { ok: false, error: "This batch is set to separate datasets. The dashboard visualizes one active graph at a time. Put each file in its own batch or activate one file before generating a parser." };
    }
    if (task === "repair_custom_parser" && !customCode.trim()) return { ok: false, error: "There is no current parser code to repair." };
    if (task === "repair_custom_parser" && !customErr.trim()) return { ok: false, error: "There is no latest custom parser error to repair." };

    const batchSnapshot = activeAgentBatch;
    const versionSnapshot = batchSnapshot.version ?? 1;
    const modelRunId = `model-run-${++modelRunCounterRef.current}`;
    const generatedAt = new Date().toISOString();
    const modelIdentity = {
      batchId: batchSnapshot.id,
      batchVersion: versionSnapshot,
      parseMode: batchSnapshot.parseMode,
      modelRunId,
      generatedAt,
      modelRuntime: "ollama",
      modelName: localModelConfig.model,
    };
    const activeFileNames = batchSnapshot.files.map(file => file.name);
    const previewLimits = {
      maxPreviewFiles: localModelConfig.maxPreviewFiles,
      maxPreviewLinesPerFile: localModelConfig.maxPreviewLinesPerFile,
    };
    const allAttempts = [];
    let roleAnalysis = null;
    let finalRequest = null;
    setLocalModelBusy(true);
    setLocalModelMessage(`Running ${task.replaceAll("_", " ")} with schema enforcement and active-batch previews…`);
    try {
      if (task === "generate_custom_parser") {
        const analysisRequest = buildLocalModelRequest("analyze_file_roles", {
          batch: batchSnapshot,
          userIntent,
          previewLimits,
        });
        const analysisResult = await generateValidatedModelResponse({
          config: localModelConfig,
          request: analysisRequest,
          expectedTask: "analyze_file_roles",
          expectedParseMode: batchSnapshot.parseMode,
          activeFileNames,
        });
        allAttempts.push(...analysisResult.attempts);
        finalRequest = analysisResult.request;
        if (!analysisResult.ok) {
          const validationErrors = analysisResult.validation?.errors ?? [];
          setModelDebug({
            ...modelIdentity,
            task: "analyze_file_roles",
            batchId: batchSnapshot.id,
            batchVersion: versionSnapshot,
            promptSummary: {
              filesIncluded: analysisRequest.preview.files.length,
              promptChars: analysisRequest.promptChars,
              previewIsPartial: analysisRequest.previewIsPartial,
            },
            lastRawResponse: rawResponsePreview(analysisResult.rawResponse),
            parsedJsonPreview: analysisResult.data,
            validationErrors,
            repairAttempts: analysisResult.repairAttempts,
            attempts: allAttempts,
          });
          recordBatchModelRun(batchSnapshot.id, {
            id: modelRunId,
            task,
            runtime: "ollama",
            model: localModelConfig.model,
            status: "failed",
            createdAt: generatedAt,
            summary: analysisResult.error,
            validationErrors,
            parserInserted: false,
          });
          setLocalModelStatus("error");
          setLocalModelMessage(analysisResult.error);
          setLastModelAssist({
            ...modelIdentity,
            task,
            batchId: batchSnapshot.id,
            batchVersion: versionSnapshot,
            userIntent,
            modelOutput: null,
            validationResult: { passed: false, warnings: [], errors: validationErrors },
            preview: analysisRequest.preview,
            modelAttempts: allAttempts,
            parserRunResult: { passed: false, stats: null },
            userAccepted: false,
            localRuntime: { runtime: "ollama", transport: localModelConfig.activeTransport, model: localModelConfig.model },
            finalParserInserted: false,
            fallbackUsed: false,
            createdAt: generatedAt,
          });
          return {
            ok: false,
            error: analysisResult.error,
            validationErrors,
            repairAttempts: analysisResult.repairAttempts,
            offerFallback: true,
          };
        }
        roleAnalysis = analysisResult.data;
        setLocalModelMessage(`File-role analysis validated for ${batchSnapshot.label}. Generating parser code with the confirmed ${batchSnapshot.parseMode} mode…`);
      }

      if (activeBatchRef.current.id !== batchSnapshot.id || activeBatchRef.current.version !== versionSnapshot) {
        return { ok: false, error: "The active batch changed while the local model was working. I discarded the response." };
      }

      const request = buildLocalModelRequest(task, {
        batch: batchSnapshot,
        currentParserCode: customCode,
        parserError: customErr,
        parserSource: customCodeSource,
        userIntent,
        previewLimits,
        fileRoleAnalysis: roleAnalysis,
      });
      const result = await generateValidatedModelResponse({
        config: localModelConfig,
        request,
        expectedTask: task,
        expectedParseMode: batchSnapshot.parseMode,
        activeFileNames,
      });
      allAttempts.push(...result.attempts);
      finalRequest = result.request;
      const validationErrors = result.validation?.errors ?? [];
      setModelDebug({
        ...modelIdentity,
        task,
        batchId: batchSnapshot.id,
        batchVersion: versionSnapshot,
        promptSummary: {
          filesIncluded: request.preview.files.length,
          promptChars: finalRequest?.promptChars ?? request.promptChars,
          previewIsPartial: request.previewIsPartial,
          twoStepAnalysis: Boolean(roleAnalysis),
        },
        lastRawResponse: rawResponsePreview(result.rawResponse),
        parsedJsonPreview: result.data,
        validationErrors,
        repairAttempts: result.repairAttempts,
        attempts: allAttempts,
        roleAnalysis,
      });
      if (!result.ok) {
        recordBatchModelRun(batchSnapshot.id, {
          id: modelRunId,
          task,
          runtime: "ollama",
          model: localModelConfig.model,
          status: "failed",
          createdAt: generatedAt,
          summary: result.error,
          validationErrors,
          parserInserted: false,
        });
        setLocalModelStatus("error");
        setLocalModelMessage(result.error);
        setLastModelAssist({
          ...modelIdentity,
          task,
          batchId: batchSnapshot.id,
          batchVersion: versionSnapshot,
          userIntent,
          modelOutput: result.data,
          validationResult: { passed: false, warnings: [], errors: validationErrors },
          preview: request.preview,
          modelAttempts: allAttempts,
          parserRunResult: { passed: false, stats: null },
          userAccepted: false,
          localRuntime: { runtime: "ollama", transport: localModelConfig.activeTransport, model: localModelConfig.model },
          finalParserInserted: false,
          fallbackUsed: false,
          createdAt: generatedAt,
        });
        return {
          ok: false,
          error: result.error,
          validationErrors,
          repairAttempts: result.repairAttempts,
          offerFallback: true,
        };
      }
      if (activeBatchRef.current.id !== batchSnapshot.id || activeBatchRef.current.version !== versionSnapshot) {
        return { ok: false, error: "The active batch changed while the local model was working. I discarded the response." };
      }

      const data = result.data;
      const insertsParser = task === "generate_custom_parser" || task === "repair_custom_parser";
      const binding = modelIdentity;
      if (insertsParser) {
        setCustomFiles(batchSnapshot.files);
        updateCustomCode(data.parserCode, "model", binding);
        setCustomResult(null); setCustomResultId(null); setCustomErr(""); setCustomLogs([]);
        setFmt("custom"); setErr("");
      }
      const assist = {
        ...modelIdentity,
        task,
        batchId: batchSnapshot.id,
        batchVersion: versionSnapshot,
        userIntent,
        modelOutput: data,
        validationResult: { passed: true, warnings: data.warnings ?? [], errors: [] },
        preview: request.preview,
        promptChars: finalRequest?.promptChars ?? request.promptChars,
        previewIsPartial: request.previewIsPartial,
        roleAnalysis,
        modelAttempts: allAttempts,
        parserRunResult: { passed: false, stats: null },
        userAccepted: false,
        localRuntime: {
          runtime: "ollama",
          baseUrlType: "local",
          model: localModelConfig.model,
        },
        finalParserInserted: insertsParser,
        fallbackUsed: false,
        binding,
        createdAt: generatedAt,
      };
      setLastModelAssist(assist);
      recordBatchModelRun(batchSnapshot.id, {
        id: modelRunId,
        task,
        runtime: "ollama",
        model: localModelConfig.model,
        status: result.repairAttempts > 0 || allAttempts.some(attempt => attempt.repaired) ? "repaired" : "generated",
        createdAt: generatedAt,
        summary: data.summary,
        validationErrors: [],
        parserInserted: insertsParser,
      });
      setLocalModelStatus("connected");
      setLocalModelMessage(`Local model returned a valid ${task.replaceAll("_", " ")} response for ${batchSnapshot.label}.`);
      return {
        ok: true,
        task,
        data,
        roleAnalysis,
        batchLabel: batchSnapshot.label,
        binding,
        insertedParser: insertsParser,
        promptChars: finalRequest?.promptChars ?? request.promptChars,
        previewIsPartial: request.previewIsPartial,
        repairAttempts: allAttempts.filter(attempt => attempt.repaired).length,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      recordBatchModelRun(batchSnapshot.id, {
        id: modelRunId,
        task,
        runtime: "ollama",
        model: localModelConfig.model,
        status: "failed",
        createdAt: generatedAt,
        summary: message,
        validationErrors: [message],
        parserInserted: false,
      });
      setModelDebug({
        ...modelIdentity,
        task,
        batchId: batchSnapshot.id,
        batchVersion: versionSnapshot,
        promptSummary: finalRequest ? { promptChars: finalRequest.promptChars } : null,
        lastRawResponse: "",
        parsedJsonPreview: null,
        validationErrors: [message],
        repairAttempts: allAttempts.filter(attempt => attempt.repaired).length,
        attempts: allAttempts,
        roleAnalysis,
      });
      setLocalModelStatus("error");
      setLocalModelMessage(message);
      return { ok: false, error: message, offerFallback: true };
    } finally {
      setLocalModelBusy(false);
    }
  }

  function exportParserTrainingExample(includeFullFiles = false) {
    if (!lastModelAssist) return { ok: false, error: "Generate or analyze a valid local-model response first." };
    if (!activeAgentBatch || activeAgentBatch.id !== lastModelAssist.batchId) {
      return { ok: false, error: "Reactivate the batch used for the latest model response before exporting its training example." };
    }
    const example = buildParserTrainingExample({
      batch: activeAgentBatch,
      preview: lastModelAssist.preview,
      userIntent: lastModelAssist.userIntent,
      modelOutput: lastModelAssist.modelOutput,
      validationResult: lastModelAssist.validationResult,
      parserRunResult: lastModelAssist.parserRunResult,
      userAccepted: lastModelAssist.userAccepted,
      includeFullFiles,
      localRuntime: lastModelAssist.localRuntime,
      modelAttempts: lastModelAssist.modelAttempts ?? [],
      finalParserInserted: Boolean(lastModelAssist.finalParserInserted),
      fallbackUsed: Boolean(lastModelAssist.fallbackUsed),
    });
    downloadParserTrainingExample(example);
    return { ok: true, includeFullFiles, fileCount: example.activeBatchSummary.files.length };
  }

  async function copyModelDebug(kind) {
    if (!modelDebug) return { ok: false, error: "No model debug information is available yet." };
    const text = kind === "prompt"
      ? JSON.stringify(modelDebug.promptSummary ?? {}, null, 2)
      : String(modelDebug.lastRawResponse ?? "");
    try {
      await navigator.clipboard.writeText(text);
      return { ok: true };
    } catch {
      return { ok: false, error: "The browser could not copy that debug text." };
    }
  }

  function exportModelDebugExample() {
    if (!modelDebug) return { ok: false, error: "No model debug information is available yet." };
    const exportedAt = new Date().toISOString();
    const payload = {
      version: 1,
      setupVersion: "v6-premapping-repair",
      exportedAt,
      includesFullFiles: false,
      modelSetup: { bundledModel: false, runtimeExternal: true },
      localRuntime: {
        runtime: "ollama",
        baseUrlType: "local",
        model: localModelConfig.model,
      },
      ...modelDebug,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `hypergraph-model-debug-${exportedAt.replace(/[.:]/g, "-")}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    return { ok: true };
  }

  async function runCustom() {
    const bindingCheck = validateParserBatchBinding(customCodeBinding, activeAgentBatch, agentFileBatches);
    if (!bindingCheck.ok) return bindingCheck;
    const activeIds = new Set(agentFiles.map(file => file.id));
    const usesActiveBatch = customFiles.length > 0 && customFiles.every(file => activeIds.has(file.id));
    if (usesActiveBatch && customFiles.length > 1 && activeAgentBatch?.parseMode === "unknown") {
      return { ok: false, error: "Confirm whether the active files should be parsed together or separately before running Custom Parser." };
    }
    setCustomErr(""); setCustomResult(null); setCustomResultId(null); setCustomLogs([]); setCustomRunning(true);
    try {
      const raw = await runCustomParser(customCode, customFiles);
      setCustomLogs(raw.logs ?? []);
      const normalized = normalizeCustomParserOutput(raw.result);
      setCustomResult(normalized);
      const nextResultId = `result-${++customResultCounterRef.current}`;
      setCustomResultId(nextResultId);
      setCustomLogs(prev => [...prev, `✓ ${normalized.hyperedges.length} hyperedges parsed from ${normalized.source}.`]);
      if (normalized.warnings?.length) setCustomLogs(prev => [...prev, ...normalized.warnings.map(w => "⚠ " + w)]);
      if (normalized.hyperedges.length === 0) {
        updateBatchParserStatus(customCodeBinding?.batchId, "failed");
        return { ok: false, error: "Custom parser returned no hyperedges." };
      }
      const suspiciousWarnings = findSuspiciousOutputWarnings(normalized.hyperedges, usesActiveBatch ? activeAgentBatch : null);
      if (suspiciousWarnings.length) {
        setCustomLogs(prev => [...prev, ...suspiciousWarnings.map(warning => `⚠ ${warning}`)]);
      }
      const vertices = new Set(normalized.hyperedges.flatMap(hyperedge => hyperedge.vertices.map(String))).size;
      const incidences = normalized.hyperedges.reduce((sum, hyperedge) => sum + hyperedge.vertices.length, 0);
      let expectedOutputComparison = null;
      const expectedMapping = activeAgentBatch?.mappingSpec?.files?.find(file => file.role === "validation_expected_output" && file.useAsInput === false);
      const expectedFile = expectedMapping
        ? activeAgentBatch.files.find(file => file.name === expectedMapping.fileName)
        : null;
      if (expectedFile) {
        const expectedValue = parseExpectedOutputText(expectedFile.text, expectedFile.name);
        expectedOutputComparison = compareWithExpectedOutput(normalized.hyperedges, expectedValue);
        const comparisonLine = expectedOutputComparison.ok
          ? `Expected-output comparison: ${expectedOutputComparison.vertexSetsMatched}/${expectedOutputComparison.vertexSetsTotal} hyperedge vertex sets matched.`
          : `Expected-output comparison warning: ${expectedOutputComparison.warnings.join(" ")}`;
        setCustomLogs(prev => [...prev, comparisonLine]);
      }
      const parserReconciliation = buildParserReconciliationReport({
        batchId: customCodeBinding?.batchId ?? activeAgentBatch?.id ?? null,
        groupId: activeAgentBatch?.activeDatasetGroupId ?? activeAgentBatch?.mappingSpec?.activeGroupId ?? null,
        mappingRevision: customCodeBinding?.mappingRevision ?? activeAgentBatch?.mappingRevision ?? 0,
        planFingerprint: customCodeBinding?.transformationPlanFingerprint ?? activeAgentBatch?.transformationPlanFingerprint ?? null,
        parserResult: {
          canonicalHyperedges: normalized.hyperedges,
          diagnostics: raw.result?.diagnostics ?? {},
        },
        expectedOutputComparison,
        warnings: suspiciousWarnings,
      });
      if (parserReconciliation.status !== "clean") {
        const label = parserReconciliation.status === "failed" ? "Reconciliation failed" : "Reconciliation warnings";
        setCustomLogs(prev => [...prev, `${label}: ${[...(parserReconciliation.errors ?? []), ...(parserReconciliation.warnings ?? [])].join(" ") || "Review row-flow diagnostics before applying."}`]);
      } else {
        setCustomLogs(prev => [...prev, "Reconciliation clean: parser output is ready for preview/apply confirmation."]);
      }
      if (["model", "deterministic", "mapping"].includes(customCodeSource)) {
        setLastModelAssist(current => current ? {
          ...current,
          parserRunResult: {
            passed: true,
            stats: { vertices, hyperedges: normalized.hyperedges.length, incidences },
            warnings: [...(normalized.warnings ?? []), ...suspiciousWarnings],
          },
        } : current);
      }
      updateBatchParserStatus(customCodeBinding?.batchId, "ran", {
        vertices,
        hyperedges: normalized.hyperedges.length,
        incidences,
      });
      if (customCodeSource === "mapping" && customCodeBinding?.batchId) {
        const batch = agentFileBatches.find(item => item.id === customCodeBinding.batchId);
        updateBatchMapping(customCodeBinding.batchId, {
          expectedOutputComparison,
          parserReconciliation,
          mappingFeedback: { ...(batch?.mappingFeedback ?? {}), parserWorked: true },
        });
      }
      return { ok: true, hyperedgeCount: normalized.hyperedges.length, resultId: nextResultId, suspiciousWarnings, expectedOutputComparison, parserReconciliation };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setCustomErr(message); setCustomResultId(null); setCustomLogs(e.logs ?? []);
      if (["model", "deterministic", "mapping"].includes(customCodeSource)) {
        setLastModelAssist(current => current ? {
          ...current,
          parserRunResult: { passed: false, stats: null, error: message },
        } : current);
      }
      updateBatchParserStatus(customCodeBinding?.batchId, "failed");
      if (customCodeSource === "mapping" && customCodeBinding?.batchId) {
        const batch = agentFileBatches.find(item => item.id === customCodeBinding.batchId);
        updateBatchMapping(customCodeBinding.batchId, {
          mappingFeedback: { ...(batch?.mappingFeedback ?? {}), parserWorked: false },
        });
      }
      return { ok: false, error: message };
    }
    finally { setCustomRunning(false); }
  }

  function applyCustomResult() {
    if (!customResult?.hyperedges?.length) return { ok: false, error: "Run the custom parser and validate a non-empty preview first." };
    const bindingCheck = validateParserBatchBinding(customCodeBinding, activeAgentBatch, agentFileBatches);
    if (!bindingCheck.ok) return bindingCheck;
    if (customCodeSource === "mapping" && activeAgentBatch?.parserReconciliation && !parserReconciliationAllowsApply(activeAgentBatch.parserReconciliation)) {
      return { ok: false, error: "Parser reconciliation has fatal issues or an empty graph. Review/re-run the parser before applying." };
    }
    try {
      const commit = commitGraph(customResult.hyperedges, {
        source: "custom_parser",
        summary: `Applied custom parser result with ${customResult.hyperedges.length} hyperedge${customResult.hyperedges.length === 1 ? "" : "s"}.`,
        replacement: true,
        warnings: customResult.warnings ?? [],
      });
      setActiveSection("mappings");
      setApplyBatch(false);
      if (["model", "deterministic", "mapping"].includes(customCodeSource)) {
        setLastModelAssist(current => current ? { ...current, userAccepted: true } : current);
      }
      updateBatchParserStatus(customCodeBinding?.batchId, "applied");
      showNotice(`Custom parser applied — ${customResult.hyperedges.length} hyperedges loaded.`);
      return {
        ok: true,
        ...commit,
        hyperedgeCount: customResult.hyperedges.length,
        batchId: customCodeBinding?.batchId ?? activeAgentBatch?.id ?? null,
        batchVersion: customCodeBinding?.batchVersion ?? activeAgentBatch?.version ?? null,
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setCustomErr(message);
      return { ok: false, error: message };
    }
  }

  function clearGraph() {
    if (!hes?.length) return { ok: false, error: "No graph is currently loaded." };
    const commit = commitGraph([], {
      source: "clear",
      summary: "Cleared the committed graph.",
      clear: true,
      warnings: [],
    });
    setErr("");
    setApplyBatch(false);
    setActiveSection("mappings");
    setVizLimit(50);
    setGraphView("hypergraph");
    setGraphLayout("force");
    setGraphSearch("");
    setGraphResetNonce(nonce => nonce + 1);
    return { ok: true, ...commit };
  }

  function scrollToVisualization() {
    if (!vizRef.current) return false;
    vizRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    return true;
  }

  function navigateToDashboardSection(sectionId) {
    setActiveSection(sectionId);
    requestAnimationFrame(() => dashboardSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    return true;
  }

  function navigateToExport(exportId) {
    setExpId(exportId);
    navigateToDashboardSection("export");
    return true;
  }

  // Batch updates are first staged as an explicit preview on top of the
  // committed graph (`hes`). Commit writes the preview back to `hes`; discard
  // returns the dashboard to the committed graph.
  const batchUpdates = useMemo(() => {
    if (!batchText.trim()) return [];
    return parseBatchUpdates(batchText);
  }, [batchText]);

  const batchApplication = useMemo(() => {
    if (!hes || !applyBatch || batchUpdates.length === 0) return { hyperedges: hes, warnings: [] };
    return applyBatchUpdates(hes, batchUpdates);
  }, [hes, applyBatch, batchUpdates]);
  const finalHes = batchApplication.hyperedges;
  const batchWarnings = batchApplication.warnings;
  const batchPreviewActive = Boolean(hes?.length && applyBatch && batchUpdates.length > 0);

  useEffect(() => {
    setGraphConversationReferences(current => pruneGraphConversationReferences(current, {
      graphId: graphIdentity.graphId,
      hyperedges: finalHes ?? [],
    }));
    setSelectedGraphEntity(current => {
      if (!current?.type || current.id == null) return null;
      const currentId = String(current.id);
      if (current.type === "hyperedge") {
        return (finalHes ?? []).some(item => String(item.id) === currentId) ? current : null;
      }
      const vertices = new Set((finalHes ?? []).flatMap(item => item.vertices ?? []).map(String));
      return vertices.has(currentId) ? current : null;
    });
  }, [finalHes, graphIdentity.graphId]);

  function applyBatchUpdatesForAgent() {
    if (!hes?.length) return { ok: false, error: "Load a base graph before applying batch updates." };
    if (!batchUpdates.length) return { ok: false, error: "No batch update operations are available." };
    const parseWarnings = [];
    const operations = batchUpdatesToMutationOperations(batchUpdates, {
      warnings: parseWarnings,
      emptyHyperedgePolicy: "remove_empty",
    });
    if (!operations.length) {
      return { ok: false, error: parseWarnings.join(" ") || "No supported batch update operations are available.", warnings: parseWarnings };
    }
    const plan = createMutationPlan({
      operations: [{ type: "COMMIT_BATCH_UPDATES", operations }],
      source: "batch_updates",
      summary: `Committed ${operations.length} batch update operation${operations.length === 1 ? "" : "s"}.`,
      graphIdentity,
      metadata: {
        batchTextVersion: batchVersion,
        parsedBatchUpdateCount: batchUpdates.length,
      },
    });
    const preview = previewGraphMutation(hes, plan, graphIdentity, graphHistory);
    if (!preview.ok) {
      return { ok: false, error: preview.errors.join(" "), warnings: [...parseWarnings, ...preview.warnings], preview };
    }
    const commit = commitGraph(preview.hyperedges, {
      source: "batch_updates",
      summary: plan.summary,
      plan,
      preview,
      warnings: [...warnings, ...parseWarnings, ...preview.warnings],
    });
    setApplyBatch(false);
    setActiveSection("mappings");
    return { ok: true, ...commit, updateCount: operations.length, warningCount: parseWarnings.length + preview.warnings.length, preview };
  }

  function previewBatchUpdatesForAgent() {
    if (!hes?.length) return { ok: false, error: "Load a base graph before previewing batch updates." };
    if (!batchUpdates.length) return { ok: false, error: "No batch update operations are available to preview." };
    setApplyBatch(true);
    setActiveSection("mappings");
    return {
      ok: true,
      previewActive: true,
      updateCount: batchUpdates.length,
      warningCount: batchWarnings.length,
      message: "Batch update preview is active. Review the graph, then commit or discard it.",
    };
  }

  function discardBatchPreviewForAgent() {
    if (!applyBatch) return { ok: true, previewActive: false, message: "No batch preview is active." };
    setApplyBatch(false);
    return { ok: true, previewActive: false, message: "Batch preview discarded. The committed graph is unchanged." };
  }

  function preparedGraphMutationResult(interpretation, preview, extras = {}) {
    if (!preview.ok) {
      return {
        ok: false,
        error: preview.errors.join(" ") || "The requested graph change did not pass validation.",
        warnings: preview.warnings,
        plan: interpretation.plan,
        preview,
        ...extras,
      };
    }
    return {
      ok: true,
      actionType: "apply_graph_mutation",
      plan: interpretation.plan,
      preview,
      summary: interpretation.plan.summary,
      graphChanged: preview.beforeFingerprint !== preview.afterFingerprint,
      ...extras,
    };
  }

  function rememberVerifiedMutationReferences(plan, preview, source = "resolved_plan") {
    const refs = referencesFromMutationPlan(plan);
    setGraphConversationReferences(current => addVerifiedGraphReferences(current, {
      graphId: graphIdentity.graphId,
      vertices: refs.vertices,
      hyperedges: refs.hyperedges,
      source,
      planId: plan?.planId ?? null,
      currentHyperedges: preview?.hyperedges ?? finalHes ?? hes ?? [],
    }));
  }

  async function prepareGraphMutationForAgent(query, options = {}) {
    const rawQuery = String(query ?? "");
    const pendingAction = options.pendingAction ?? null;
    const conversation = options.conversation ?? [];
    const canUseModelPlanner = localModelConfig.enabled !== false
      && localModelStatus === "connected"
      && localModelConfig.runtime === "ollama"
      && Boolean(localModelConfig.activeBaseUrl)
      && Boolean(String(localModelConfig.model ?? "").trim())
      && isPlausibleGraphMutationText(rawQuery, { pendingAction });
    let fallbackReason = null;
    let modelAttemptCount = 0;
    const precompiledCompilation = options.precompiledCompilation ?? null;
    const precompiledPlan = options.precompiledPlan ?? precompiledCompilation?.typedValue ?? precompiledCompilation?.compiled?.plan ?? null;
    const semanticConfidence = options.semanticConfidence ?? precompiledCompilation?.semanticConfidence ?? precompiledCompilation?.diagnostics?.semanticConfidence ?? null;
    const deterministicFirst = options.deterministicFirst === true;

    if (batchPreviewActive) {
      return {
        ok: false,
        needsClarification: true,
        blockedByBatchPreview: true,
        message: "A batch-update preview is active. Commit or discard that preview before using conversational graph edits, so the assistant edits the committed graph you expect.",
        plannerDiagnostics: {
          plannerPath: "batch_preview_guard",
          modelCalled: false,
          legacyParserCalled: false,
          validatorCalls: [],
          graphCompilationCount: 0,
          graphRecompileCount: 0,
        },
      };
    }

    if (options.contextBinding) {
      const stale = bindingIsStaleForScope(options.contextBinding, "graph", pendingAction);
      if (stale.stale) {
        return {
          ok: false,
          stale: true,
          needsClarification: true,
          message: "The graph changed after I interpreted that request. Please send the edit again.",
          plannerDiagnostics: {
            plannerPath: "deterministic_nlu_precompiled",
            authoritativeCompiler: precompiledCompilation?.diagnostics?.authoritativeCompiler ?? "graph_mutation_v1",
            semanticConfidence,
            staleBinding: stale,
            modelAttemptCount: 0,
            modelCalled: false,
            modelCalls: [],
            precompiledPlanUsed: Boolean(precompiledPlan),
            deterministicFirst,
            graphCompilationCount: 0,
            graphRecompileCount: 0,
            legacyParserCalled: false,
            legacyParserCallCount: 0,
            validatorCalls: [],
            graphRecompiled: false,
          },
        };
      }
    }

    if (precompiledCompilation?.compiled?.needsClarification || precompiledCompilation?.compiled?.draft?.classification === "clarification") {
      return {
        ...precompiledCompilation.compiled,
        plannerPath: "deterministic_nlu_precompiled",
        plannerDiagnostics: {
          ...(precompiledCompilation.diagnostics ?? {}),
          plannerPath: "deterministic_nlu_precompiled",
          authoritativeCompiler: precompiledCompilation.diagnostics?.authoritativeCompiler ?? "graph_mutation_v1",
          semanticConfidence,
          modelAttemptCount: 0,
          modelCalled: false,
          modelCalls: [],
          precompiledPlanUsed: Boolean(precompiledPlan),
          deterministicFirst,
          graphCompilationCount: 0,
          graphRecompileCount: 0,
          legacyParserCalled: false,
          legacyParserCallCount: 0,
          validatorCalls: [],
          graphRecompiled: false,
        },
      };
    }

    if (precompiledPlan && semanticConfidence?.level === "high") {
      const preview = previewGraphMutation(hes ?? [], precompiledPlan, graphIdentity, graphHistory);
      if (preview.ok) rememberVerifiedMutationReferences(precompiledPlan, preview, "deterministic_nlu_precompiled_plan");
      return preparedGraphMutationResult(precompiledCompilation.compiled ?? { ok: true, plan: precompiledPlan }, preview, {
        plannerPath: "deterministic_nlu",
        plannerDiagnostics: {
          ...(precompiledCompilation?.diagnostics ?? {}),
          plannerPath: "deterministic_nlu",
          authoritativeCompiler: precompiledCompilation?.diagnostics?.authoritativeCompiler ?? "graph_mutation_v1",
          semanticConfidence,
          modelTask: null,
          modelName: null,
          modelAttemptCount: 0,
          modelCalled: false,
          modelCalls: [],
          precompiledPlanUsed: true,
          deterministicFirst,
          draftValidationStatus: "precompiled",
          resolutionStatus: preview.ok ? "resolved" : "not_resolved",
          graphVersion: graphIdentity.graphVersion ?? 0,
          pendingPlanReplaced: Boolean(precompiledPlan.metadata?.pendingPlanReplaced && pendingAction),
          graphCompilationCount: 0,
          graphRecompileCount: 0,
          legacyParserCalled: false,
          legacyParserCallCount: 0,
          validatorCalls: ["previewGraphMutation"],
          graphRecompiled: false,
        },
        pendingPlanReplaced: Boolean(precompiledPlan.metadata?.pendingPlanReplaced && pendingAction),
      });
    }

    if (deterministicFirst && precompiledCompilation?.handled && semanticConfidence?.level === "high" && !precompiledPlan) {
      return {
        ok: false,
        needsClarification: true,
        message: "I understood this as a graph edit, but the deterministic compiler did not produce a complete validated plan. Please name the exact hyperedge and vertex.",
        plannerDiagnostics: {
          plannerPath: "deterministic_nlu_precompiled",
          authoritativeCompiler: precompiledCompilation.diagnostics?.authoritativeCompiler ?? "graph_mutation_v1",
          semanticConfidence,
          precompiledPlanUsed: false,
          deterministicFirst: true,
          modelAttemptCount: 0,
          modelCalled: false,
          modelCalls: [],
          graphCompilationCount: 0,
          graphRecompileCount: 0,
          legacyParserCalled: false,
          legacyParserCallCount: 0,
          validatorCalls: [],
          graphRecompiled: false,
        },
      };
    }

    if (options.deterministicFirst && precompiledCompilation?.handled && semanticConfidence?.level === "low") {
      return {
        ok: false,
        needsClarification: true,
        message: "I recognized graph-edit language, but the deterministic semantics were not safe enough to stage a mutation. Please name the exact hyperedge and vertex.",
        plannerDiagnostics: {
          plannerPath: "deterministic_nlu_precompiled",
          authoritativeCompiler: precompiledCompilation.diagnostics?.authoritativeCompiler ?? "graph_mutation_v1",
          semanticConfidence,
          modelAttemptCount: 0,
          modelCalled: false,
          modelCalls: [],
          precompiledPlanUsed: false,
          deterministicFirst,
          graphCompilationCount: 0,
          graphRecompileCount: 0,
          legacyParserCalled: false,
          legacyParserCallCount: 0,
          validatorCalls: [],
          graphRecompiled: false,
        },
      };
    }

    if (canUseModelPlanner && !options.forceDeterministicFallback && semanticConfidence?.level !== "high") {
      const effective = effectiveLocalModelConfig();
      try {
        const planned = await runExclusiveLocalModelTask({
          task: "graph_mutation_planner",
          message: "Planning the graph edit with the local model; deterministic validation still controls execution...",
          timeoutMs: LOCAL_MODEL_TASK_TIMEOUTS.graph_mutation_planner_total,
          externalSignal: options.signal ?? null,
          run: ({ signal, timeoutMs, onMetrics }) => planGraphMutationWithModel({
            config: effective,
            userQuery: rawQuery,
            hyperedges: hes ?? [],
            graphIdentity,
            graphHistory,
            selectedEntity: selectedGraphEntity,
            pendingAction,
            conversation,
            recentReferences: recentReferenceContext(graphConversationReferences),
            signal,
            timeoutMs,
            onMetrics,
          }),
        });
        if (planned.busy) {
          return { ok: false, needsClarification: true, busy: true, message: planned.error };
        }
        if (planned.aborted) {
          setLocalModelMessage("Stopped. No graph change was prepared.");
          return { ok: false, aborted: true, needsClarification: true, message: "Stopped. No graph change was prepared." };
        }
        modelAttemptCount = planned.attempts?.length ?? 0;
        setModelDebug({
          batchId: activeAgentBatch?.id ?? null,
          batchVersion: activeAgentBatch?.version ?? null,
          task: "plan_graph_mutation",
          modelRunId: `graph-mutation-${++modelRunCounterRef.current}`,
          modelRuntime: "ollama",
          modelName: effective.model,
          promptSummary: {
            promptChars: planned.request?.promptChars ?? 0,
            graphMutationDraftSchemaAttached: true,
            graphHyperedgeSamples: planned.request?.graphContext?.entitySamples?.hyperedgeIds?.length ?? 0,
            graphVertexSamples: planned.request?.graphContext?.entitySamples?.vertexIds?.length ?? 0,
            pendingMutationSupplied: Boolean(pendingAction),
            schemaChars: planned.request?.schemaChars ?? 0,
            plannerTimeoutMs: LOCAL_MODEL_TASK_TIMEOUTS.graph_mutation_planner_total,
          },
          lastRawResponse: rawResponsePreview(planned.rawResponse ?? ""),
          parsedJsonPreview: planned.draft ?? planned.validation?.data ?? null,
          validationErrors: planned.validation?.errors ?? [],
          repairAttempts: Math.max(0, modelAttemptCount - 1),
          attempts: planned.attempts ?? [],
        });
        if (planned.ok) {
          const resolved = resolveGraphMutationDraftToPlan({
            draft: planned.draft,
            hyperedges: hes ?? [],
            graphIdentity,
            graphHistory,
            selectedEntity: selectedGraphEntity,
            pendingAction,
            recentReferences: recentReferenceContext(graphConversationReferences),
          });
          const plannerDiagnostics = {
            plannerPath: "model",
            modelTask: "plan_graph_mutation",
            modelName: effective.model,
            modelAttemptCount,
            modelCalled: true,
            modelCalls: [{ task: "plan_graph_mutation", attemptCount: modelAttemptCount }],
            precompiledPlanUsed: false,
            deterministicFirst,
            graphCompilationCount: 0,
            graphRecompileCount: 0,
            legacyParserCalled: false,
            legacyParserCallCount: 0,
            validatorCalls: ["resolveGraphMutationDraftToPlan", "previewGraphMutation"],
            draftClassification: planned.draft?.classification ?? "",
            draftValidationStatus: planned.attempts?.some(attempt => attempt.repaired) ? "repaired" : "valid",
            resolutionStatus: resolved.resolutionStatus ?? (resolved.ok ? "resolved" : "not_resolved"),
            fallbackReason: null,
            graphVersion: graphIdentity.graphVersion ?? 0,
            pendingPlanReplaced: Boolean(planned.draft?.correction?.replacePendingPlan && pendingAction),
            metrics: planned.metrics ?? [],
            elapsedMs: planned.elapsedMs ?? null,
          };
          if (resolved.noMatch) {
            setLocalModelMessage("Graph-mutation planner classified this turn as not a graph edit.");
            return { ...resolved, plannerDiagnostics };
          }
          if (!resolved.ok) {
            setLocalModelMessage("Graph-mutation planner needs clarification before staging a deterministic edit.");
            return { ...resolved, plannerDiagnostics };
          }
          const preview = previewGraphMutation(hes ?? [], resolved.plan, graphIdentity, graphHistory);
          if (preview.ok) rememberVerifiedMutationReferences(resolved.plan, preview, "resolved_model_plan");
          setLocalModelStatus("connected");
          setLocalModelMessage("GraphMutationDraft validated and resolved. The deterministic preview controls confirmation.");
          return preparedGraphMutationResult(resolved, preview, {
            plannerPath: "model",
            draft: planned.draft,
            acknowledgement: planned.draft?.acknowledgement,
            previewOnly: Boolean(planned.draft?.previewOnly),
            plannerDiagnostics,
            pendingPlanReplaced: plannerDiagnostics.pendingPlanReplaced,
          });
        }
        fallbackReason = planned.fallbackReason || "The local model did not return a usable GraphMutationDraft.";
        setLocalModelMessage(planned.classification === "model_generation_timeout"
          ? `The graph planner did not finish within ${Math.round(LOCAL_MODEL_TASK_TIMEOUTS.graph_mutation_planner_total / 1000)} seconds. I will use deterministic fallback if the request is supported.`
          : `Graph-mutation planning fell back to deterministic parsing. ${fallbackReason}`);
      } catch (error) {
        fallbackReason = error instanceof Error ? error.message : String(error);
        const classified = formatActionableRuntimeError(error, effective);
        setRuntimeDiagnostics(current => ({
          ...current,
          lastConnectionErrorClassification: classified.classification,
          suggestedFix: classified.suggestedFix,
          summary: classified.suggestedFix,
        }));
        if (conversationFailureIsConnectionFailure(classified.classification)) setLocalModelStatus("error");
        setLocalModelMessage(`Graph-mutation model planning failed; deterministic fallback is still available. ${classified.suggestedFix}`);
      }
    }

    const interpretation = compileGraphMutationGrammar(rawQuery, {
      nlu: options.deterministicNlu ?? null,
      hyperedges: hes ?? [],
      graphIdentity,
      graphHistory,
      selectedEntity: selectedGraphEntity,
      recentReferences: recentReferenceContext(graphConversationReferences),
      pendingAction,
    });
    if (interpretation.noMatch) return fallbackReason ? { ...interpretation, fallbackReason } : interpretation;
    if (!interpretation.ok) {
      return fallbackReason
        ? { ...interpretation, plannerPath: "deterministic_nlu", fallbackReason }
        : interpretation;
    }
    const preview = previewGraphMutation(hes ?? [], interpretation.plan, graphIdentity, graphHistory);
    if (preview.ok) rememberVerifiedMutationReferences(interpretation.plan, preview, "deterministic_nlu_plan");
    return preparedGraphMutationResult(interpretation, preview, {
      plannerPath: "deterministic_nlu",
      plannerDiagnostics: {
        plannerPath: "deterministic_nlu",
        authoritativeCompiler: "graph_mutation_v1",
        modelTask: null,
        modelName: canUseModelPlanner ? effectiveLocalModelConfig().model : null,
        modelAttemptCount,
        modelCalled: modelAttemptCount > 0,
        modelCalls: modelAttemptCount > 0 ? [{ task: "plan_graph_mutation", attemptCount: modelAttemptCount, outcome: "fallback" }] : [],
        precompiledPlanUsed: false,
        deterministicFirst,
        draftClassification: null,
        draftValidationStatus: fallbackReason ? "fallback" : "not_used",
        resolutionStatus: interpretation.ok ? "resolved" : "not_resolved",
        fallbackReason,
        graphVersion: graphIdentity.graphVersion ?? 0,
        pendingPlanReplaced: false,
        graphCompilationCount: 1,
        graphRecompileCount: precompiledCompilation ? 1 : 0,
        legacyParserCalled: false,
        legacyParserCallCount: 0,
        validatorCalls: ["compileGraphMutationGrammar", "previewGraphMutation"],
        graphRecompiled: Boolean(precompiledCompilation),
      },
      fallbackReason,
    });
  }

  function commitGraphMutationForAgent(plan) {
    if (!plan) return { ok: false, error: "No graph mutation plan is staged." };
    if (batchPreviewActive) {
      return { ok: false, error: "A batch-update preview is active. Commit or discard that preview before committing conversational graph edits.", blockedByBatchPreview: true };
    }
    const preview = previewGraphMutation(hes ?? [], plan, graphIdentity, graphHistory);
    if (!preview.ok) {
      return {
        ok: false,
        error: preview.errors.join(" ") || "The graph mutation plan is no longer valid.",
        warnings: preview.warnings,
        preview,
      };
    }
    if (preview.beforeFingerprint === preview.afterFingerprint) {
      return {
        ok: true,
        graphChanged: false,
        hyperedgeCount: (hes ?? []).length,
        vertexCount: new Set((hes ?? []).flatMap(hyperedge => hyperedge.vertices.map(String))).size,
        incidenceCount: (hes ?? []).reduce((sum, hyperedge) => sum + hyperedge.vertices.length, 0),
        warnings: preview.warnings,
        preview,
      };
    }
    const commit = commitGraph(preview.hyperedges, {
      source: plan.source ?? "conversation",
      summary: plan.summary ?? "Graph mutation",
      plan,
      preview,
      warnings: [...warnings, ...preview.warnings],
    });
    setApplyBatch(false);
    setActiveSection("mappings");
    const vertexCount = new Set(preview.hyperedges.flatMap(hyperedge => hyperedge.vertices.map(String))).size;
    const incidenceCount = preview.hyperedges.reduce((sum, hyperedge) => sum + hyperedge.vertices.length, 0);
    return {
      ok: true,
      ...commit,
      hyperedgeCount: preview.hyperedges.length,
      vertexCount,
      incidenceCount,
      warnings: preview.warnings,
      preview,
    };
  }

  const algo = useAlgorithms(finalHes);

  const h2v = useMemo(() => finalHes ? buildH2V(finalHes) : [], [finalHes]);
  const v2h = useMemo(() => finalHes ? buildV2H(finalHes) : [], [finalHes]);
  const h2hRequested = shouldRequestH2H({ activeSection, selectedMappingId, expId });
  const v2vRequested = shouldRequestV2V({ activeSection, selectedMappingId, expId });
  const h2hResult = useMemo(() => finalHes && h2hRequested ? buildH2HBounded(finalHes) : notRequestedDerived("h2h"), [finalHes, h2hRequested]);
  const v2vResult = useMemo(() => finalHes && v2vRequested ? buildV2VBounded(finalHes) : notRequestedDerived("v2v"), [finalHes, v2vRequested]);
  const h2h = useMemo(() => h2hResult.status === DERIVED_STATUS.COMPUTED ? h2hResult.value : [], [h2hResult]);
  const v2v = useMemo(() => v2vResult.status === DERIVED_STATUS.COMPUTED ? v2vResult.edges : [], [v2vResult]);
  const csr = useMemo(() => finalHes ? buildCSR(finalHes) : null, [finalHes]);
  const st = useMemo(() => finalHes ? computeStats(finalHes) : null, [finalHes]);
  const ht = useMemo(() => expH2V(h2v), [h2v]);
  const vt = useMemo(() => expV2H(v2h), [v2h]);
  const h2hExportResult = useMemo(
    () => h2hResult.status === DERIVED_STATUS.COMPUTED
      ? { ...expH2HResult(h2h), status: h2hResult.status }
      : expH2HAvailabilityResult(h2h, { status: h2hResult.status, reason: h2hResult.reason }),
    [h2h, h2hResult.reason, h2hResult.status],
  );
  const ht2 = h2hExportResult.text;
  const vvt = useMemo(() => v2vResult.status === DERIVED_STATUS.COMPUTED ? expV2V(v2v) : `# V2V projection not computed.\n# ${v2vResult.reason ?? "Open the Mappings tab to request it."}`, [v2v, v2vResult]);

  const h2vRows = h2v.map(r => [r.hid, r.time ?? "—", r.vertices.join(", "), r.weight != null && r.weight !== 1 ? r.weight : "1", String(r.vertices.length)]);
  const v2hRows = v2h.map(r => [String(r.vid), r.hyperedges.join(", "), String(r.hyperedges.length)]);
  const h2hRows = h2h.map(r => [r.hid, r.neighbors.length ? r.neighbors.map((n, i) => n + "[" + r.sharedVertices[i].join(",") + "]").join("  ") : "—", String(r.neighbors.length)]);
  const v2vRows = v2v.map(r => [String(r.src), String(r.dst), r.hyperedges.join(", "), String(r.weight)]);

  const graphResultSummary = useMemo(() => {
    if (!finalHes?.length || !st) return null;
    const issues = validateHes(finalHes);
    const maxDegree = st.degs?.length ? arrayMax(st.degs) : 0;
    const avgDegree = st.degs?.length ? st.degs.reduce((a, b) => a + b, 0) / Math.max(1, st.degs.length) : 0;
    const incidenceDensityPercent = (st.incidenceDensity ?? 0) * 100;
    const v2vProjectionDensityPercent = st.v2vProjectionDensity == null ? null : st.v2vProjectionDensity * 100;
    return {
      inputFormat: fmt,
      inputFormatLabel: FMTS.find(f => f.id === fmt)?.label ?? fmt,
      hyperedges: finalHes.length,
      vertices: st.V,
      incidences: finalHes.reduce((sum, hyperedge) => sum + hyperedge.vertices.length, 0),
      minCardinality: st.min,
      maxCardinality: st.max,
      averageCardinality: st.avg,
      maxDegree,
      averageDegree: avgDegree,
      incidenceDensityPercent,
      v2vProjectionDensityPercent,
      v2vEdgeCount: v2vResult.status === DERIVED_STATUS.COMPUTED ? v2v.length : null,
      v2vProjectionStatus: v2vResult.status,
      v2vProjectionReason: v2vResult.reason,
      triads: null,
      triadsStatus: "not_requested",
      validationStatus: issues.length ? `${issues.length} issue${issues.length === 1 ? "" : "s"}` : "Clean",
      duplicateStatus: issues.some(issue => issue.type === "duplicate") ? "duplicates found" : "no duplicate hyperedges",
      singletonStatus: issues.some(issue => issue.type === "singleton") ? "singleton hyperedges found" : "no singleton hyperedges",
      warningCount: warnings.length + batchWarnings.length,
    };
  }, [batchWarnings.length, finalHes, fmt, st, v2v.length, v2vResult, warnings.length]);

  function dl(name, content) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([content], { type: "text/plain" })); a.download = name; a.click(); }

  function saveCurrentParserProfile() {
    if (!customCode.trim()) {
      setParserProfileNotice("No parser code is available to save.");
      return { ok: false, error: "No parser code is available to save." };
    }
    const profile = createParserProfileFromMapping({
      name: activeAgentBatch?.mappingSpec?.datasetType || activeAgentBatch?.label || "Custom parser profile",
      mappingSpec: activeAgentBatch?.mappingSpec ?? activeAgentBatch?.repairedMapping ?? null,
      parserCode: customCode,
      activeBatch: activeAgentBatch ?? { files: customFiles, fileSummaries: [] },
    });
    const next = upsertParserProfile(profile, parserProfiles);
    setParserProfiles(next);
    setParserProfileNotice(`Saved parser profile: ${profile.name}.`);
    return { ok: true, profile };
  }

  function loadParserProfileIntoEditor(profileId) {
    const profile = parserProfiles.find(item => item.id === profileId);
    if (!profile) {
      setParserProfileNotice("Parser profile was not found.");
      return { ok: false, error: "Parser profile was not found." };
    }
    updateCustomCode(profile.parserCode, "profile", { profileId, profileName: profile.name });
    setParserProfileNotice(`Loaded parser profile: ${profile.name}.`);
    return { ok: true, profile };
  }

  function removeParserProfile(profileId) {
    const profile = parserProfiles.find(item => item.id === profileId);
    const next = deleteParserProfile(profileId, parserProfiles);
    setParserProfiles(next);
    setParserProfileNotice(profile ? `Deleted parser profile: ${profile.name}.` : "Parser profile deleted.");
    return { ok: true };
  }

  function downloadParserProfiles() {
    dl("parser-profiles-v7-2.json", exportParserProfiles(parserProfiles));
    setParserProfileNotice("Parser profiles exported locally.");
  }

  const EXPORTS = useMemo(() => [
    { id: "h2v_txt", label: "h2v text", fn: "h2v.txt", text: () => ht },
    { id: "v2h_txt", label: "v2h text", fn: "v2h.txt", text: () => vt },
    { id: "h2h_txt", label: "h2h text", fn: "h2h.txt", text: () => ht2, result: () => h2hExportResult },
    { id: "canonical", label: "Canonical JSON", fn: "canonical.json", text: () => expCanonicalJSON(finalHes ?? [], { fmt }, { v2vResult }) },
    { id: "incidence", label: "Incidence CSV", fn: "incidence.csv", text: () => expIncidence(finalHes ?? []) },
    { id: "bipartite", label: "Bipartite CSV", fn: "bipartite.csv", text: () => expBipartite(finalHes ?? []) },
    { id: "clique", label: "Clique CSV", fn: "clique.csv", text: () => expClique(finalHes ?? [], { v2vResult }) },
    { id: "matrix", label: "Matrix CSV", fn: "incidence_matrix.csv", text: () => expMatrixResult(finalHes ?? []).text },
    { id: "csr_json", label: "CSR JSON", fn: "csr.json", text: () => JSON.stringify(csr, null, 2) },
    { id: "csr_csv", label: "CSR CSV", fn: "csr.csv", text: () => expCSRCsv(csr) },
    { id: "full_json", label: "Full JSON", fn: "hypergraph.json", text: () => JSON.stringify({ metadata: { E: st?.E, V: st?.V, h2hStatus: h2hResult.status, h2hReason: h2hResult.reason }, hyperedges: finalHes, h2v, v2h, h2h: h2hResult.status === DERIVED_STATUS.COMPUTED ? h2h : null }, null, 2) },
    { id: "all_txt", label: "All mappings", fn: "all_mappings.txt", text: () => [ht, vt, ht2].join("\n\n---\n\n") },
  ], [csr, finalHes, fmt, h2h, h2hExportResult, h2hResult, h2v, ht, ht2, st, v2h, vt, v2vResult]);
  const curExp = EXPORTS.find(e => e.id === expId) ?? EXPORTS[0];
  const exportContent = useMemo(() => curExp.text(), [curExp]);

  function selectGraphViewForAgent(viewMode) {
    if (!["hypergraph", "linegraph"].includes(viewMode)) return { ok: false, error: "Unknown graph view." };
    setGraphView(viewMode);
    scrollToVisualization();
    return { ok: true, viewMode };
  }

  function selectGraphLayoutForAgent(layout) {
    if (!["force", "circular", "grid"].includes(layout)) return { ok: false, error: "Unknown graph layout." };
    setGraphLayout(layout);
    scrollToVisualization();
    return { ok: true, layout };
  }

  function searchGraphVertexForAgent(query) {
    const vertex = String(query ?? "").trim();
    if (!vertex) return { ok: false, error: "Name a vertex to search for." };
    setGraphSearch(vertex);
    scrollToVisualization();
    return { ok: true, query: vertex };
  }

  function resetGraphViewForAgent() {
    setGraphSearch("");
    setGraphResetNonce(nonce => nonce + 1);
    scrollToVisualization();
    return { ok: true };
  }

  function reheatGraphForAgent() {
    setGraphReheatNonce(nonce => nonce + 1);
    scrollToVisualization();
    return { ok: true };
  }

  function exportGraphPngForAgent() {
    if (!finalHes?.length) return { ok: false, error: "No graph preview is available." };
    setGraphPngNonce(nonce => nonce + 1);
    return { ok: true };
  }

  function downloadExportForAgent(exportId = expId) {
    if (!finalHes?.length) return { ok: false, error: "No graph is loaded yet." };
    const selected = EXPORTS.find(item => item.id === exportId);
    if (!selected) return { ok: false, error: "Unknown export preview." };
    const selectedText = selected.id === expId ? exportContent : selected.text();
    const resolved = selected.result?.() ?? { ok: true, text: selectedText, reason: null };
    if (!resolved.ok) return { ok: false, error: resolved.reason ?? "This export is unavailable.", exportId: selected.id };
    dl(selected.fn, resolved.text ?? selectedText);
    return { ok: true, exportId: selected.id, filename: selected.fn };
  }

  function downloadCurrentExport() {
    const result = downloadExportForAgent(curExp.id);
    if (!result.ok) showNotice("Download not started — " + result.error);
  }

  async function copyAiPromptForAgent(targetExportId = "canonical") {
    const safeTargetId = isAiPromptTargetId(targetExportId) ? targetExportId : "canonical";
    setAiPromptTargetId(safeTargetId);
    setFmt("ai_prompt");
    setErr("");
    const rawText = txt || "(paste your text above first)";
    const prompt = buildAiPrompt(rawText, { targetExportId: safeTargetId });
    try {
      await navigator.clipboard.writeText(prompt);
      showNotice(`AI prompt copied for ${getAiPromptTarget(safeTargetId).label}.`);
      return { ok: true, copied: true, targetExportId: safeTargetId, targetLabel: getAiPromptTarget(safeTargetId).label };
    } catch (error) {
      showNotice("Copy failed — please copy manually from the preview below.");
      return { ok: false, error: error instanceof Error ? error.message : String(error), prompt, targetExportId: safeTargetId, targetLabel: getAiPromptTarget(safeTargetId).label };
    }
  }

  const SECTIONS = [
    { id: "mappings", label: "Mappings", color: T.accent },
    { id: "stats", label: "Statistics", color: T.teal },
    { id: "export", label: "Export", color: T.amber },
  ];

  // Tools tabs — shown after the graph preview, mirrors the Mappings/Statistics/Export tab bar above it.
  const TOOLS_SECTIONS = [
    { id: "advanced", label: "Advanced Options", color: T.amber },
    { id: "algorithms", label: "Algorithms", color: T.teal },
    { id: "assistant", label: "Hypergraph Assistant", color: T.purple },
  ];
  function handleToolsTabKeyDown(event, index) {
    const key = event.key;
    if (!["ArrowLeft", "ArrowRight", "Home", "End", " ", "Enter"].includes(key)) return;
    event.preventDefault();
    if (key === " " || key === "Enter") {
      setActiveToolsSection(TOOLS_SECTIONS[index].id);
      return;
    }
    const nextIndex = key === "Home" ? 0
      : key === "End" ? TOOLS_SECTIONS.length - 1
        : key === "ArrowRight" ? (index + 1) % TOOLS_SECTIONS.length
          : (index - 1 + TOOLS_SECTIONS.length) % TOOLS_SECTIONS.length;
    setActiveToolsSection(TOOLS_SECTIONS[nextIndex].id);
    requestAnimationFrame(() => document.getElementById(`tools-tab-${TOOLS_SECTIONS[nextIndex].id}`)?.focus());
  }

  const isCornell = fmt === "cornell";
  const isCustom = fmt === "custom";
  const isFreeform = fmt === "freeform";
  const isAiPrompt = fmt === "ai_prompt";
  const isNormalInput = !isCornell && !isCustom && !isFreeform && !isAiPrompt;

  // Derived batch preview
  const batchParsedCount = batchUpdates.length;
  const batchUnknownCount = batchUpdates.filter(u => u.op === "UNKNOWN").length;

  // Generated AI prompt preview (for copy-within-UI)
  const aiPromptText = useMemo(() => buildAiPrompt(txt || "(paste your messy data above)", { targetExportId: aiPromptTargetId }), [aiPromptTargetId, txt]);
  const agentSummaryById = new Map((activeAgentBatch?.fileSummaries ?? []).map(summary => [summary.id, summary]));
  const previousBatch = previousAgentBatch();
  const parserProfileMatches = useMemo(
    () => {
      const profileByName = new Map((activeAgentBatch?.datasetProfile?.files ?? []).map(file => [file.fileName, file]));
      const candidates = (customFiles.length ? customFiles : agentFiles).map(file => {
        const profiled = profileByName.get(file.name);
        return {
          ...file,
          headers: profiled?.columns?.map(column => column.name) ?? [],
          columns: profiled?.columns ?? [],
        };
      });
      return matchParserProfiles(candidates, parserProfiles).slice(0, 5);
    },
    [activeAgentBatch?.datasetProfile, agentFiles, customFiles, parserProfiles],
  );

  const agentState = {
    fmt,
    formatLabel: FMTS.find(f => f.id === fmt)?.label ?? fmt,
    activeSection,
    expId,
    aiPromptTargetId,
    vizLimit,
    graphView,
    graphLayout,
    graphSearch,
    stats: st,
    resultSummary: graphResultSummary,
    hasGraph: Boolean(finalHes?.length),
    hyperedgeCount: finalHes?.length ?? 0,
    vertexCount: st?.V ?? 0,
    incidenceCount: finalHes?.reduce((sum, hyperedge) => sum + hyperedge.vertices.length, 0) ?? 0,
    graphId: graphIdentity.graphId,
    graphVersion,
    graphFingerprint: graphIdentity.graphFingerprint,
    committedHyperedgeCount: hes?.length ?? 0,
    batchPreviewActive,
    batchPreviewHyperedgeCount: batchPreviewActive ? finalHes?.length ?? 0 : 0,
    batchParsedCount,
    batchUnknownCount,
    graphHistoryCount: graphHistory.length,
    lastGraphMutation: graphHistory.at(-1) ?? null,
    selectedGraphEntity,
    selectionLabel: selectedGraphEntity ? `${selectedGraphEntity.type} ${selectedGraphEntity.id}` : "none",
    selectionNotice,
    recentVerifiedReferences: recentReferenceContext(graphConversationReferences),
    batchVersion,
    customResultId,
    agentFiles: agentFiles.map(({ id, name, size, type, extension }) => ({
      id, name, size, type, extension, role: agentSummaryById.get(id)?.role ?? "unknown",
    })),
    agentFileCount: agentFiles.length,
    agentDetection,
    agentBatches: agentFileBatches.map(batch => ({
      id: batch.id,
      label: batch.label,
      version: batch.version ?? 1,
      fileCount: batch.files.length,
      fileNames: batch.files.map(file => file.name),
      parseMode: batch.parseMode,
      detectedLabel: batch.detectedFormat?.label ?? "Unknown",
      rolesSummary: (batch.fileSummaries ?? []).slice(0, 4).map(file => `${file.name}: ${file.role}`),
      modelStatus: batch.modelStatus ?? "none",
      parserStatus: batch.parserStatus ?? "none",
      mappingSpecStatus: batch.mappingSpecStatus ?? "none",
      mappingDatasetType: batch.mappingSpec?.datasetType ?? null,
      mappingConfidence: batch.mappingSpec?.confidence ?? null,
      mappingRevision: batch.mappingRevision ?? 0,
      groupingRevision: batch.groupingRevision ?? 0,
      groupingStatus: batch.groupingStatus ?? "none",
      datasetGroupCount: batch.datasetGroups?.length ?? 0,
      relationshipEvidenceCount: batch.relationshipEvidence?.length ?? 0,
      mappingRepairCount: batch.mappingRepairNotes?.length ?? 0,
      mappingWarningCount: batch.mappingValidationWarnings?.length ?? 0,
      statsSnapshot: batch.statsSnapshot ?? null,
      modelRuns: (batch.modelRuns ?? []).slice(-4),
      status: batch.status,
      createdAt: batch.createdAt,
    })),
    activeBatchId,
    lastTouchedBatchId,
    previousBatchId: previousBatch?.id ?? null,
    activeBatch: activeAgentBatch ? {
      id: activeAgentBatch.id,
      label: activeAgentBatch.label,
      version: activeAgentBatch.version ?? 1,
      fileNames: activeAgentBatch.files.map(file => file.name),
      parseMode: activeAgentBatch.parseMode,
      detectedFormat: activeAgentBatch.detectedFormat,
      fileSummaries: activeAgentBatch.fileSummaries,
      metadataOnly: activeAgentBatch.metadataOnly,
      batchUpdate: activeAgentBatch.batchUpdate,
      separateGraphFiles: activeAgentBatch.separateGraphFiles,
      mixedFormats: activeAgentBatch.mixedFormats,
      datasetProfile: activeAgentBatch.datasetProfile,
      relationshipEvidence: activeAgentBatch.relationshipEvidence ?? [],
      datasetInterpretationDraft: activeAgentBatch.datasetInterpretationDraft ?? null,
      datasetGroups: activeAgentBatch.datasetGroups ?? [],
      activeDatasetGroupId: activeAgentBatch.activeDatasetGroupId ?? null,
      groupingRevision: activeAgentBatch.groupingRevision ?? 0,
      groupingHistory: activeAgentBatch.groupingHistory ?? [],
      groupingStatus: activeAgentBatch.groupingStatus ?? "none",
      groupingQuestions: activeAgentBatch.groupingQuestions ?? [],
      mappingSpec: activeAgentBatch.mappingSpec,
      mappingSource: activeAgentBatch.mappingSource ?? "none",
      mappingRevision: activeAgentBatch.mappingRevision ?? 0,
      mappingHistory: activeAgentBatch.mappingHistory ?? [],
      mappingSpecStatus: activeAgentBatch.mappingSpecStatus ?? "none",
      mappingSpecValidationErrors: activeAgentBatch.mappingSpecValidationErrors ?? [],
      mappingValidationWarnings: activeAgentBatch.mappingValidationWarnings ?? [],
      mappingRepairNotes: activeAgentBatch.mappingRepairNotes ?? [],
      mappingInformationalNotes: activeAgentBatch.mappingInformationalNotes ?? [],
      deterministicDraftMapping: activeAgentBatch.deterministicDraftMapping,
      modelRefinedMapping: activeAgentBatch.modelRefinedMapping,
      repairedMapping: activeAgentBatch.repairedMapping,
      mappingValidation: activeAgentBatch.mappingValidation,
      selectedMappingForParser: activeAgentBatch.selectedMappingForParser,
      preMappingDiagnostics: activeAgentBatch.preMappingDiagnostics,
      mappingSpecAccepted: Boolean(activeAgentBatch.mappingSpecAccepted),
      mappingFeedback: activeAgentBatch.mappingFeedback,
      mappingTurnDiagnostics: activeAgentBatch.mappingTurnDiagnostics ?? [],
      generatedParserFromMapping: activeAgentBatch.generatedParserFromMapping,
      transformationPlan: activeAgentBatch.transformationPlan,
      transformationPlanPreview: activeAgentBatch.transformationPlanPreview ?? [],
      transformationPlanStatus: activeAgentBatch.transformationPlanStatus ?? "none",
      transformationPlanFingerprint: activeAgentBatch.transformationPlanFingerprint ?? null,
      parserReconciliation: activeAgentBatch.parserReconciliation,
      expectedOutputComparison: activeAgentBatch.expectedOutputComparison,
      fineTuneExampleCount: activeAgentBatch.fineTuneExamples?.length ?? 0,
    } : null,
    customFileCount: customFiles.length,
    customCodeVersion,
    customCodeExists: Boolean(customCode.trim()),
    customCodeSource,
    customCodeBinding,
    parserProfileCount: parserProfiles.length,
    parserProfileMatches: parserProfileMatches.map(({ profile, reason, score }) => ({ id: profile.id, name: profile.name, datasetType: profile.datasetType, reason, score })),
    customResultCount: customResult?.hyperedges?.length ?? 0,
    customErr,
    customRunning,
    loading,
    warningCount: warnings.length + batchWarnings.length,
    err,
    localModel: {
      config: localModelConfig,
      status: localModelStatus,
      message: localModelMessage,
      models: localModelModels,
      busy: localModelBusy,
      request: localModelCoordinatorSnapshot,
      generation: localModelGeneration,
      requestHistory: localModelRequestHistory,
      banner: runtimeBannerText({
        model: localModelConfig.model,
        connectionStatus: localModelStatus,
        generation: localModelGeneration,
      }),
      diagnostics: runtimeDiagnostics,
      lastProbe: runtimeProbeResult,
      diagnosticsBusy: runtimeDiagnosticsBusy,
      lastConversation: localModelLastConversation,
      lastTask: lastModelAssist?.task ?? null,
      hasTrainingExample: Boolean(lastModelAssist),
      debug: modelDebug,
    },
    deterministicNlu: {
      recentTraces: deterministicTurnTraces,
      lastTrace: deterministicTurnTraces.at(-1) ?? null,
    },
  };

  function buildConversationContext(sessionContext = {}, pendingAction = null) {
    return {
      ...sessionContext,
      activeBatch: sessionContext.activeBatch ?? activeAgentBatch,
      graphSummary: sessionContext.graphSummary ?? graphResultSummary,
      pendingAction: sessionContext.pendingAction ?? pendingAction,
      selectedInputRoute: sessionContext.selectedInputRoute ?? (FMTS.find(f => f.id === fmt)?.label ?? fmt),
      activeSection: sessionContext.activeSection ?? activeSection,
      mappingStatus: sessionContext.mappingStatus ?? (activeAgentBatch?.mappingSpecStatus ?? "none"),
      customParserStatus: sessionContext.customParserStatus ?? [
        customRunning ? "running" : "",
        customErr ? `latest error: ${customErr.slice(0, 180)}` : "",
        customResult ? `validated preview: ${customResult.hyperedges?.length ?? 0} hyperedges` : "",
        customCode.trim() ? `code source: ${customCodeSource}` : "no parser code",
      ].filter(Boolean).join("; "),
      modelStatus: sessionContext.modelStatus ?? {
        runtime: "ollama",
        model: localModelConfig.model,
        status: localModelStatus,
        message: localModelMessage,
      },
    };
  }

  function deterministicAnalysisContext(pendingAction = null, pendingContinuation = null) {
    const activeBatch = activeAgentBatch ?? null;
    const headersByFile = Object.fromEntries((activeBatch?.datasetProfile?.files ?? []).map(file => [
      file.fileName,
      (file.columns ?? []).map(column => column.name),
    ]));
    return {
      datasetMapping: {
        hasActiveBatch: Boolean(activeBatch),
        activeBatchId: activeBatch?.id ?? null,
        fileNames: activeBatch?.files?.map(file => file.name) ?? [],
        headersByFile,
        mappingRevision: activeBatch?.mappingRevision ?? 0,
        mappingStatus: activeBatch?.mappingSpecStatus ?? "none",
        groupingStatus: activeBatch?.groupingStatus ?? "none",
      },
      parserWorkflow: {
        phase: activeBatch?.parserStatus ?? "none",
        mappingStatus: activeBatch?.mappingSpecStatus ?? "none",
        planStatus: activeBatch?.transformationPlanStatus ?? "none",
        parserStatus: activeBatch?.parserStatus ?? "none",
        resultStatus: customResultId ? "preview" : "none",
        reconciliationStatus: activeBatch?.parserReconciliation?.status ?? "none",
      },
      graph: {
        graphId: graphIdentity.graphId,
        graphVersion: graphIdentity.graphVersion,
        selectedEntity: selectedGraphEntity,
        recentVerifiedReferences: recentReferenceContext(graphConversationReferences),
      },
      pendingAction,
      pendingContinuation,
      recentVerifiedActions: [
        graphHistory.at(-1) ? { id: `graph:${graphHistory.at(-1).revision ?? graphIdentity.graphVersion}`, type: "graph_mutation" } : null,
        activeBatch?.mappingTurnDiagnostics?.at(-1) ? { id: activeBatch.mappingTurnDiagnostics.at(-1).requestId, type: "dataset_mapping" } : null,
      ].filter(Boolean),
    };
  }

  function deterministicCompileContext(pendingAction = null) {
    const activeBatch = activeAgentBatch ?? null;
    const mappingEnsure = activeBatch ? ensureDatasetMappingV2ForBatch({
      batch: activeBatch,
      reason: "deterministic turn compilation",
      allowDeterministicGeneration: true,
    }) : null;
    return {
      batch: activeBatch,
      mappingSpec: mappingEnsure?.ok ? mappingEnsure.spec : activeBatch?.mappingSpec,
      datasetProfile: activeBatch?.datasetProfile,
      state: {
        fmt,
        activeSection,
        expId,
        vizLimit,
        hasGraph: Boolean(finalHes?.length),
        graphId: graphIdentity.graphId,
        graphVersion: graphIdentity.graphVersion,
        graphFingerprint: graphIdentity.graphFingerprint,
        selectedGraphEntity,
        activeBatch,
        customResultId,
        customCodeExists: Boolean(customCode.trim()),
      },
      hyperedges: hes ?? [],
      graphIdentity,
      graphHistory,
      selectedEntity: selectedGraphEntity,
      recentReferences: recentReferenceContext(graphConversationReferences),
      pendingAction,
    };
  }

  function currentDeterministicBinding(pendingAction = null) {
    return createDeterministicContextBinding({
      activeBatch: activeAgentBatch,
      graphIdentity,
      selectedEntity: selectedGraphEntity,
      pendingAction,
    });
  }

  function bindingIsStaleForScope(contextBinding, scope, pendingAction = null) {
    if (!contextBinding) return { stale: false };
    return bindingMismatch(contextBinding, currentDeterministicBinding(pendingAction), scope);
  }

  function compileDeterministicTurnForAgent(query, options = {}) {
    const pendingAction = options.pendingAction ?? null;
    const prepared = prepareDeterministicTurn({
      query,
      analysisContext: deterministicAnalysisContext(pendingAction, options.pendingContinuation ?? null),
      compileContext: deterministicCompileContext(pendingAction),
      contextBinding: currentDeterministicBinding(pendingAction),
      analyze: analyzeDeterministicNlu,
      compile: compileDeterministicAction,
    });
    setDeterministicTurnTraces(history => upsertRuntimeTrace(history, prepared.runtimeTrace));
    return prepared;
  }

  function recordCompletedDeterministicTrace(trace) {
    if (!trace?.requestId) return { ok: false, error: "A completed deterministic trace requires a request ID." };
    setDeterministicTurnTraces(history => upsertRuntimeTrace(history, trace));
    return { ok: true, requestId: trace.requestId };
  }

  function conversationFailureIsConnectionFailure(classification) {
    return [
      "runtime_not_running",
      "runtime_unreachable",
      "cors_or_origin_blocked",
      "private_network_access_blocked",
      "mixed_content_or_protocol_blocked",
      "wrong_host_or_port",
      "wsl_windows_port_forwarding_issue",
      "model_not_pulled",
      "model_missing",
      "model_name_missing",
      "remote_endpoint_blocked",
      "bridge_not_running",
      "bridge_unreachable",
      "bridge_runtime_unreachable",
      "browser_cors_or_forwarding_issue",
    ].includes(classification);
  }

  function refreshLocalModelCoordinatorSnapshot() {
    const snapshot = localModelCoordinatorRef.current.getSnapshot();
    setLocalModelCoordinatorSnapshot(snapshot);
    setLocalModelBusy(snapshot.busy);
    return snapshot;
  }

  function pushLocalModelDiagnostic(diagnostic) {
    setLocalModelRequestHistory(history => appendBoundedRequestDiagnostic(history, diagnostic));
  }

  async function runExclusiveLocalModelTask({
    task,
    message,
    timeoutMs,
    externalSignal = null,
    run,
  }) {
    const abortController = new AbortController();
    const startedAt = new Date().toISOString();
    const begun = localModelCoordinatorRef.current.begin({
      task,
      abortController,
      priority: task === "summarization" ? "background" : "interactive",
      startedAt,
    });
    if (!begun.ok) {
      refreshLocalModelCoordinatorSnapshot();
      const busyMessage = begun.message || "The local assistant is already working. Wait for it to finish or press Stop.";
      setLocalModelMessage(busyMessage);
      return { ok: false, busy: true, classification: "local_model_busy", error: busyMessage };
    }
    const requestId = begun.request.requestId;
    const metrics = [];
    const startedPerf = performance.now();
    const forwardAbort = () => localModelCoordinatorRef.current.abortActive("request_aborted");
    if (externalSignal) {
      if (externalSignal.aborted) forwardAbort();
      else externalSignal.addEventListener("abort", forwardAbort, { once: true });
    }
    refreshLocalModelCoordinatorSnapshot();
    setLocalModelGeneration(generationStateForStart({ task, requestId, message }));
    setLocalModelMessage(message);
    try {
      const result = await run({
        requestId,
        signal: abortController.signal,
        timeoutMs,
        onMetrics: metric => metrics.push(metric),
      });
      const classification = result?.classification || (result?.aborted ? "request_aborted" : "");
      const fallbackUsed = Boolean(result?.fallbackUsed || ["deterministic_nlu", "deterministic_nlu_fallback"].includes(result?.plannerPath));
      const outcome = result?.aborted
        ? "aborted"
        : classification === "model_generation_timeout"
          ? "timeout"
          : fallbackUsed
            ? "fallback"
            : result?.ok === false
              ? "error"
              : "success";
      localModelCoordinatorRef.current.finish(requestId, outcome);
      refreshLocalModelCoordinatorSnapshot();
      pushLocalModelDiagnostic(createLocalModelRequestDiagnostic({
        requestId,
        task,
        model: effectiveLocalModelConfig().model,
        transport: effectiveLocalModelConfig().activeTransport,
        outcome,
        classification,
        startedAt,
        completedAt: new Date().toISOString(),
        metrics: metrics.at(-1) ?? result?.metrics?.at?.(-1) ?? null,
        promptChars: result?.request?.promptChars ?? result?.promptSummary?.promptChars ?? 0,
        schemaChars: result?.request?.schemaChars ?? 0,
        attemptCount: result?.attempts?.length ?? 1,
        fallbackUsed,
      }));
      if (outcome === "aborted") {
        setLocalModelGeneration(generationStateForOutcome({ task, requestId }, {
          outcome: "aborted",
          classification: "request_aborted",
          message: "Stopped. No graph change was prepared.",
        }));
      } else if (outcome === "timeout") {
        setLocalModelGeneration(generationStateForOutcome({ task, requestId }, {
          outcome: "timeout",
          classification,
          fallbackUsed,
          message: `The ${task.replaceAll("_", " ")} did not finish within ${Math.round(Number(timeoutMs) / 1000)} seconds.`,
        }));
      } else if (fallbackUsed || outcome === "error") {
        setLocalModelGeneration(generationStateForOutcome({ task, requestId }, {
          outcome,
          classification,
          fallbackUsed,
          message: result?.fallbackReason || result?.error || "The model request degraded; deterministic controls remain available.",
        }));
      } else {
        setLocalModelGeneration(generationStateForOutcome({ task, requestId }, {
          outcome: "success",
          message: "Local model request completed.",
        }));
      }
      return { ...result, requestId, metrics: result?.metrics ?? metrics };
    } catch (error) {
      const classification = error?.classification || formatActionableRuntimeError(error, effectiveLocalModelConfig()).classification;
      const outcome = classification === "request_aborted" ? "aborted" : classification === "model_generation_timeout" ? "timeout" : "error";
      localModelCoordinatorRef.current.finish(requestId, outcome);
      refreshLocalModelCoordinatorSnapshot();
      pushLocalModelDiagnostic(createLocalModelRequestDiagnostic({
        requestId,
        task,
        model: effectiveLocalModelConfig().model,
        transport: effectiveLocalModelConfig().activeTransport,
        outcome,
        classification,
        startedAt,
        completedAt: new Date().toISOString(),
        metrics: metrics.at(-1) ?? null,
        promptChars: 0,
        schemaChars: 0,
        attemptCount: 1,
        fallbackUsed: false,
      }));
      setLocalModelGeneration(generationStateForOutcome({ task, requestId }, {
        outcome,
        classification,
        message: error instanceof Error ? error.message : String(error),
      }));
      throw error;
    } finally {
      if (externalSignal) externalSignal.removeEventListener("abort", forwardAbort);
      if (localModelCoordinatorRef.current.getSnapshot().active?.requestId === requestId) {
        localModelCoordinatorRef.current.finish(requestId, "finally_released");
        refreshLocalModelCoordinatorSnapshot();
      }
      if (performance.now() - startedPerf > 0) {
        // Keep this branch intentional: tests assert the coordinator releases in finally paths.
      }
    }
  }

  function stopLocalModelRequest() {
    const result = localModelCoordinatorRef.current.abortActive("request_aborted");
    if (result.ok) {
      setLocalModelGeneration(current => generationStateForStopping(current));
      setLocalModelMessage("Stopping local model request…");
      refreshLocalModelCoordinatorSnapshot();
    }
    return result.ok ? { ok: true, message: "Stopping local model request…" } : { ok: false, error: "No local model request is active." };
  }

  async function runLocalConversation(userQuery, sessionContext = {}, callbacks = {}) {
    const effective = effectiveLocalModelConfig();
    if (effective.enabled === false) {
      const message = LOCAL_MODEL_DISABLED_MESSAGE;
      setLocalModelLastConversation({ status: "setup_required", message, classification: "model_disabled", updatedAt: new Date().toISOString() });
      return { ok: false, setupRequired: true, error: message };
    }
    if (!effective.model.trim()) {
      const message = "Enter or select one global local model before chatting. The recommended default is qwen3:8b.";
      setLocalModelLastConversation({ status: "setup_required", message, classification: "model_name_missing", updatedAt: new Date().toISOString() });
      return { ok: false, setupRequired: true, error: message, classification: "model_name_missing" };
    }
    if (localModelStatus !== "connected") {
      const message = "Test the local model connection successfully before using model-backed conversation. Deterministic dashboard commands still work.";
      setLocalModelLastConversation({ status: "setup_required", message, classification: "not_connected", updatedAt: new Date().toISOString() });
      return { ok: false, setupRequired: true, error: message };
    }

    const request = buildConversationPrompt({
      userQuery,
      sessionContext: buildConversationContext(sessionContext, sessionContext.pendingAction),
    });
    setLocalModelLastConversation({ status: "running", message: "Generating conversational reply…", classification: "", updatedAt: new Date().toISOString() });
    return runExclusiveLocalModelTask({
      task: "conversation",
      message: "Generating conversational reply with bounded current-session context…",
      timeoutMs: LOCAL_MODEL_TASK_TIMEOUTS.conversation,
      externalSignal: callbacks.signal,
      run: async ({ signal, timeoutMs, onMetrics }) => {
        try {
          const text = await generateConversationWithLocalModel(effective, request, { ...callbacks, signal, timeoutMs, onMetrics });
          setLocalModelStatus("connected");
          setLocalModelMessage("Last conversational reply completed. Deterministic execution remains separate.");
          setLocalModelLastConversation({ status: "ok", message: "Conversational reply completed.", classification: "", updatedAt: new Date().toISOString() });
          return {
            ok: true,
            text,
            model: effective.model,
            runtime: "ollama",
            promptSummary: {
              promptChars: request.promptChars,
              recentTurns: request.messages?.[1]?.content?.match(/recentConversation/g) ? sessionContext.conversation?.length ?? 0 : 0,
              actionSchemaAttached: false,
            },
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (error?.classification === "request_aborted" || error?.name === "AbortError") {
        setLocalModelLastConversation({ status: "interrupted", message: "Conversational reply stopped by user.", classification: "request_aborted", updatedAt: new Date().toISOString() });
        setLocalModelMessage("Conversational reply stopped. The runtime connection state was preserved.");
        return { ok: false, aborted: true, error: "Conversational reply stopped." };
      }
      const classified = formatActionableRuntimeError(error, effective);
      setRuntimeDiagnostics(current => ({
        ...current,
        lastConnectionErrorClassification: classified.classification,
        suggestedFix: classified.suggestedFix,
        summary: classified.suggestedFix,
      }));
      if (conversationFailureIsConnectionFailure(classified.classification)) {
        setLocalModelStatus("error");
        setLocalModelMessage(message);
      } else {
        setLocalModelMessage(`Last chat turn failed, but the prior connection state was preserved. ${classified.suggestedFix}`);
      }
      setLocalModelLastConversation({
        status: "error",
        message,
        classification: classified.classification,
        updatedAt: new Date().toISOString(),
      });
      return {
        ok: false,
        error: message,
        classification: classified.classification,
        suggestedFix: classified.suggestedFix,
        retryable: !conversationFailureIsConnectionFailure(classified.classification),
      };
        }
      },
    });
  }

  async function summarizeLocalConversation(conversation = [], sessionContext = {}) {
    const effective = effectiveLocalModelConfig();
    if (effective.enabled === false || localModelStatus !== "connected" || !effective.model.trim()) {
      return { ok: false, skipped: true, error: "Local model summarization is unavailable." };
    }
    const request = buildSessionSummaryPrompt({
      conversation,
      sessionContext: buildConversationContext(sessionContext, sessionContext.pendingAction),
    });
    if (localModelCoordinatorRef.current.isBusy()) {
      return { ok: false, skipped: true, error: "Skipped summary because an interactive local-model request is active." };
    }
    return runExclusiveLocalModelTask({
      task: "summarization",
      message: "Summarizing recent assistant context…",
      timeoutMs: LOCAL_MODEL_TASK_TIMEOUTS.summarization,
      run: async ({ signal, timeoutMs, onMetrics }) => {
        try {
          const raw = await generateWithLocalModel(effective, request, { signal, timeoutMs, onMetrics });
          const data = extractFirstJsonObject(raw);
          if (!data || typeof data.summary !== "string" || !Array.isArray(data.decisions)) {
            return { ok: false, error: "Conversation summary response was not valid structured JSON." };
          }
          return { ok: true, data, promptChars: request.promptChars };
        } catch (error) {
          return { ok: false, error: error instanceof Error ? error.message : String(error), classification: error?.classification };
        }
      },
    });
  }

  async function runOllamaOrchestrator(userQuery, conversation = []) {
    const effective = effectiveLocalModelConfig();
    if (effective.runtime !== "ollama") {
      return { ok: false, fallbackAllowed: true, error: "Ollama orchestration is available after the local assistant connects." };
    }
    if (!effective.model.trim()) {
      return { ok: false, fallbackAllowed: true, error: `The Ollama model name is missing; this release expects ${RECOMMENDED_OLLAMA_MODEL}.` };
    }
    if (localModelStatus !== "connected") {
      return { ok: false, fallbackAllowed: true, error: "Test the Ollama connection successfully before using Ollama orchestration." };
    }

    return runExclusiveLocalModelTask({
      task: "action_planner",
      message: "Asking local Ollama for a structured dashboard ActionPlan...",
      timeoutMs: LOCAL_MODEL_TASK_TIMEOUTS.action_planner,
      run: async ({ signal, timeoutMs, onMetrics }) => {
    try {
      const request = buildOllamaOrchestratorRequest({
        userQuery,
        state: agentState,
        activeBatch: activeAgentBatch,
        conversation,
        previewLimits: {
          maxPreviewFiles: localModelConfig.maxPreviewFiles,
          maxPreviewLinesPerFile: localModelConfig.maxPreviewLinesPerFile,
        },
        locationLike: window.location,
      });
      let rawResponse = await generateWithLocalModel(effective, request, { signal, timeoutMs, onMetrics });
      let validation = validateOrRepairActionPlan(rawResponse, {
        state: agentState,
        userQuery,
      });
      const attempts = [{ task: "ollama_action_plan", attempt: 0, status: validation.ok ? "valid" : "invalid_action_plan" }];
      let repairAttempts = 0;
      if (!validation.ok) {
        const repairRequest = {
          ...request,
          messages: [
            ...request.messages,
            {
              role: "assistant",
              content: rawResponsePreview(rawResponse),
            },
            {
              role: "user",
              content: [
                "The previous ActionPlan was rejected by deterministic validation.",
                "Return one corrected ActionPlan JSON object only. Do not add markdown.",
                "Preserve the original user request and do not add unsafe or unrelated actions.",
                "Validation errors:",
                ...validation.errors.slice(0, 10).map(error => `- ${error}`),
              ].join("\n"),
            },
          ],
          promptChars: request.promptChars + rawResponsePreview(rawResponse).length + validation.errors.join("\n").length,
        };
        const retryRawResponse = await generateWithLocalModel(effective, repairRequest, { signal, timeoutMs, onMetrics });
        const retryValidation = validateOrRepairActionPlan(retryRawResponse, {
          state: agentState,
          userQuery,
        });
        repairAttempts = 1;
        attempts.push({ task: "ollama_action_plan_repair", attempt: 1, status: retryValidation.ok ? "valid" : "invalid_action_plan" });
        rawResponse = retryRawResponse;
        validation = retryValidation;
      }
      setModelDebug({
        batchId: activeAgentBatch?.id ?? null,
        batchVersion: activeAgentBatch?.version ?? null,
        task: "ollama_action_plan",
        modelRunId: `orchestrator-${++modelRunCounterRef.current}`,
        modelRuntime: "ollama",
        modelName: effective.model,
        promptSummary: {
          promptChars: request.promptChars,
          filesIncluded: request.appContext?.boundedActiveBatchPreview?.files?.length ?? 0,
          previewIsPartial: Boolean(request.appContext?.boundedActiveBatchPreview?.previewIsPartial),
          plannerTemperature: request.temperatureOverride,
          capabilitiesOnly: true,
        },
        lastRawResponse: rawResponsePreview(rawResponse),
        parsedJsonPreview: validation.data,
        rawParsedJsonPreview: validation.rawData,
        normalizedActionPlan: validation.normalized,
        normalizationRepairs: validation.repairs,
        validationErrors: validation.errors,
        validationWarnings: validation.warnings,
        repairAttempts,
        attempts,
      });
      if (!validation.ok) {
        setLocalModelMessage("The Ollama ActionPlan was rejected by deterministic validation; no model-planned action was executed.");
        return {
          ok: false,
          fallbackAllowed: true,
          error: "The Ollama ActionPlan failed validation.",
          validationErrors: validation.errors,
          rawResponse,
        };
      }
      setLocalModelStatus("connected");
      setLocalModelMessage("Ollama ActionPlan validated. The deterministic dispatcher will execute only allowed actions.");
      return {
        ok: true,
        plan: validation.data,
        warnings: validation.warnings,
        promptSummary: {
          promptChars: request.promptChars,
          filesIncluded: request.appContext?.boundedActiveBatchPreview?.files?.length ?? 0,
          previewIsPartial: Boolean(request.appContext?.boundedActiveBatchPreview?.previewIsPartial),
        },
      };
    } catch (error) {
      const classified = formatActionableRuntimeError(error, effective);
      setRuntimeDiagnostics(current => ({
        ...current,
        lastConnectionErrorClassification: classified.classification,
        suggestedFix: classified.suggestedFix,
        summary: classified.suggestedFix,
        overallStatus: "failed",
      }));
      setLocalModelStatus("error");
      setLocalModelMessage(error instanceof Error ? error.message : String(error));
      return {
        ok: false,
        fallbackAllowed: true,
        error: error instanceof Error ? error.message : String(error),
        classification: classified.classification,
        suggestedFix: classified.suggestedFix,
      };
    }
      },
    });
  }

  const agentActions = {
    uploadAgentFiles,
    clearAgentFiles,
    clearAllAgentBatches,
    clearPreviousAgentBatch,
    viewPreviousAgentBatch,
    addActiveFilesToPreviousBatch,
    setActiveAgentBatch,
    renameAgentBatch,
    duplicateAgentBatch,
    deleteAgentBatch,
    setAgentBatchParseMode,
    removeAgentFile,
    autoDetectUploadedFiles: autoDetectAgentFiles,
    parseUploadedFiles: parseAgentFiles,
    routeUploadedFiles: routeAgentFiles,
    useUploadedFilesWithCustomParser: useAgentFilesWithCustomParser,
    prepareCustomParserForActiveBatch,
    generateDeterministicStarterParser: prepareCustomParserForActiveBatch,
    generateDeterministicMapping,
    validateActiveMappingSpec,
    applyEditedMappingSpec,
    applyMappingConversation: applyMappingConversationForAgent,
    autoRepairActiveMapping,
    useDeterministicDraftMapping,
    useRepairedMapping,
    undoLastMappingChange,
    runDatasetInterpretationAssist,
    runDatasetMappingPatchAssist,
    generateTransformationPlanFromActiveMapping,
    generateParserFromActiveMapping,
    setActiveMappingFeedback,
    exportActiveMappingSpec,
    exportMappingFineTuneExample,
    exportMappingFineTuneJsonl,
    compareActiveExpectedOutput,
    runLocalConversation,
    summarizeLocalConversation,
    runOllamaOrchestrator,
    stopLocalModelRequest,
    updateLocalModelSettings,
    testConfiguredLocalModel,
    listConfiguredLocalModels,
    runLocalRuntimeDiagnostics,
    copyRuntimeDiagnosticCommand,
    getGitHubPagesRuntimeHelp,
    runLocalModelAssist,
    compileDeterministicTurn: compileDeterministicTurnForAgent,
    recordCompletedDeterministicTrace,
    exportParserTrainingExample,
    copyModelDebug,
    exportModelDebugExample,
    switchInputFormat: sw,
    parseCurrentInput: parse,
    runCustomParser: runCustom,
    applyCustomParserResult: applyCustomResult,
    setVisualLimit: setVizLimit,
    setGraphView: selectGraphViewForAgent,
    setGraphLayout: selectGraphLayoutForAgent,
    searchGraphVertex: searchGraphVertexForAgent,
    resetGraphView: resetGraphViewForAgent,
    reheatGraph: reheatGraphForAgent,
    exportGraphPng: exportGraphPngForAgent,
    setActiveSection,
    navigateToDashboardSection,
    selectExportPreview: setExpId,
    navigateToExport,
    downloadExport: downloadExportForAgent,
    copyAiPrompt: copyAiPromptForAgent,
    previewBatchUpdates: previewBatchUpdatesForAgent,
    applyBatchUpdates: applyBatchUpdatesForAgent,
    discardBatchPreview: discardBatchPreviewForAgent,
    prepareGraphMutation: prepareGraphMutationForAgent,
    commitGraphMutation: commitGraphMutationForAgent,
    clearGraph,
    scrollToVisualization,
  };

  const handleGraphSelectionChange = useCallback((selection) => {
    const verifiedSelection = selection ? {
      ...selection,
      graphId: graphIdentity.graphId,
      graphVersion: graphIdentity.graphVersion,
      graphFingerprint: graphIdentity.graphFingerprint,
    } : null;
    setSelectedGraphEntity(verifiedSelection);
    setSelectionNotice("");
    if (verifiedSelection) {
      setGraphConversationReferences(current => addVerifiedGraphReferences(current, {
        graphId: graphIdentity.graphId,
        vertices: verifiedSelection.type === "vertex" ? [verifiedSelection.id] : [],
        hyperedges: verifiedSelection.type === "hyperedge" ? [verifiedSelection.id] : [],
        source: "visual_selection",
        currentHyperedges: finalHes ?? [],
      }));
    }
  }, [finalHes, graphIdentity.graphFingerprint, graphIdentity.graphId, graphIdentity.graphVersion]);

  return (
    <div style={{ background: T.bg, minHeight: "100vh", width: "100%", color: T.text, fontFamily: T.fontSans }}>
      <a href="#main-content" style={{ position: "absolute", left: -9999, top: "auto", zIndex: 999, padding: "10px 16px", background: T.accent, color: "#fff", borderRadius: 8, fontWeight: 700, fontSize: 13 }} onFocus={e => { e.currentTarget.style.left = "16px"; e.currentTarget.style.top = "10px"; }} onBlur={e => { e.currentTarget.style.left = "-9999px"; }}>Skip to content</a>
      {fEl}{nvEl}{svEl}{tvEl}{cfEl}

      {/* Nav */}
      <div style={{ background: T.surface, borderBottom: "1px solid " + T.border, display: "flex", alignItems: "center", gap: 16, height: 64, padding: "0 40px", boxSizing: "border-box", boxShadow: T.shadowSm, position: "sticky", top: 0, zIndex: 20 }}>
        <div style={{ width: 36, height: 36, background: "linear-gradient(135deg, " + T.accent + ", " + T.purple + ")", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 19, flexShrink: 0, boxShadow: "0 2px 8px " + T.accent + "55" }}>⬡</div>
        <span style={{ fontWeight: 800, fontSize: 20, letterSpacing: -.5, color: T.text }}>Hypergraph Converter Studio</span>
        <div style={{ flex: 1 }} />
        {notice && <span style={{ fontSize: 13, color: T.green, fontWeight: 500, padding: "4px 12px", background: T.greenLt, borderRadius: 6, border: "1px solid " + T.green + "44" }}>{notice}</span>}
        <span style={{ fontSize: 13, color: T.textFaint, fontFamily: T.fontMono }}>h2v · v2h · h2h</span>
      </div>

      <div id="main-content" style={{ padding: "24px 40px 80px", width: "100%", boxSizing: "border-box" }}>

        {/* Format pills — grouped */}
        <div style={{ marginBottom: 14, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 18 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: T.textFaint, textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 700 }}>Input Format</span>
            {FMTS.filter(f => f.group === "core").map(f => <Pill key={f.id} label={f.label} sub={f.sub} active={fmt === f.id} onClick={() => sw(f.id)} />)}
          </div>
          <div style={{ width: 1, height: 20, background: T.border }} />
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: T.textFaint, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>Advanced</span>
            {FMTS.filter(f => f.group === "advanced").map(f => {
              const colorMap = { freeform: T.purple, ai_prompt: T.purple, custom: T.teal, batch: T.amber };
              return <Pill key={f.id} label={f.label} sub={f.sub} active={fmt === f.id} onClick={() => sw(f.id)} color={colorMap[f.id]} />;
            })}
          </div>
        </div>

        {/* Input card */}
        <div style={{ background: T.surface, border: "1px solid " + T.border, borderRadius: 14, padding: 20, marginBottom: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: T.text }}>{FMTS.find(f => f.id === fmt)?.label}</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {!isCustom && !isAiPrompt && <button onClick={loadEx} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid " + T.border, background: T.card, color: T.textDim, fontSize: 13, cursor: "pointer", fontWeight: 500 }}>Load Example</button>}
              {!isCustom && !isCornell && !isAiPrompt && <button onClick={autoDetectFmt} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid " + T.teal, background: T.tealLt, color: T.teal, fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Auto-detect</button>}
            </div>
          </div>

          {/* Cornell 3-panel */}
          {isCornell && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              {[{ label: "nverts.txt", val: nv, set: setNv, ph: "3\n2\n4", go: nvGo }, { label: "simplices.txt", val: sv, set: setSv, ph: "1\n2\n3\n2\n4", go: svGo }, { label: "times.txt (opt)", val: tv, set: setTv, ph: "10\n15\n21", go: tvGo }].map(({ label, val, set, ph, go }) => (
                <div key={label}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}><span style={{ fontSize: 13, color: T.textDim, fontFamily: "monospace", fontWeight: 600 }}>{label}</span><button onClick={go} style={{ fontSize: 13, color: T.accent, background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 600 }}>↑ upload</button></div>
                  <textarea rows={6} placeholder={ph} value={val} onChange={e => set(e.target.value)} style={inputSt} />
                </div>
              ))}
            </div>
          )}

          {/* AI Prompt panel */}
          {isAiPrompt && (
            <div>
              <div style={{ fontSize: 13, color: T.purple, marginBottom: 12, padding: "10px 14px", background: T.purpleLt, borderRadius: 8, border: "1px solid " + T.purple + "33", lineHeight: 1.7 }}>
                <strong>How it works:</strong> Paste messy or natural-language graph data below, choose a target output, then click <strong>Copy AI Prompt</strong>. Paste the prompt into an external AI tool yourself. The dashboard does not call cloud APIs, and the target may be canonical JSON, CSR JSON, V2H text, H2V text, or another export-oriented format.
              </div>
              <textarea
                rows={6}
                value={txt}
                onChange={e => setTxt(e.target.value)}
                placeholder={EX.ai_prompt}
                style={inputSt}
              />
              <div style={{ display: "flex", gap: 10, marginTop: 14, alignItems: "center", flexWrap: "wrap" }}>
                <button
                  onClick={copyAiPrompt}
                  style={{ padding: "10px 24px", borderRadius: 9, background: T.purple, border: "none", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: "0 3px 10px rgba(109,40,217,0.3)" }}
                >
                  ⬡ Copy AI Prompt
                </button>
                <span style={{ fontSize: 13, color: T.textDim }}>→ paste result into the <strong>JSON</strong> tab</span>
              </div>
              {txt.trim() && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 12, color: T.textFaint, textTransform: "uppercase", letterSpacing: .7, fontWeight: 600, marginBottom: 8 }}>Generated prompt preview</div>
                  <div style={{ background: "#1E1E2E", borderRadius: 10, padding: 14, maxHeight: 200, overflowY: "auto", border: "1px solid " + T.border }}>
                    <pre style={{ margin: 0, fontSize: 11, fontFamily: "monospace", color: "#A0C0FF", whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{aiPromptText}</pre>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Custom Parser panel */}
          {isCustom && (
            <div>
              <div style={{ fontSize: 13, color: T.textDim, marginBottom: 10, padding: "8px 12px", background: T.card, borderRadius: 8, border: "1px solid " + T.border, lineHeight: 1.7 }}>
                Define <code>async function parseHypergraph(files, helpers)</code>. Return an array, <code>{"{ canonicalHyperedges }"}</code>, <code>{"{ h2v }"}</code>, or <code>{"{ incidences }"}</code>.
                <br />Helpers available: <code>splitLines</code> · <code>parseCSV</code> · <code>unique</code> · <code>groupBy</code> · <code>toCanonical</code> · <code>buildFromIncidence</code>
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
                <button onClick={cfGo} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid " + T.accent, background: T.accentLt, color: T.accent, fontSize: 13, cursor: "pointer", fontWeight: 600 }}>↑ Upload files</button>
                {customFiles.length > 0 && <span style={{ fontSize: 13, color: T.textDim }}>{customFiles.length} file(s): {customFiles.map(f => f.name).join(", ")}</span>}
                {customFiles.length > 0 && <button onClick={() => { setCustomFiles([]); setCustomResult(null); setCustomResultId(null); }} style={{ fontSize: 12, color: T.textDim, background: "none", border: "none", cursor: "pointer" }}>clear</button>}
              </div>
              <div style={{ marginBottom: 12, padding: 12, background: T.surface, border: "1px solid " + T.border, borderRadius: 10 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: parserProfiles.length ? 8 : 0 }}>
                  <strong style={{ fontSize: 13, color: T.text }}>Parser profiles</strong>
                  <span style={{ fontSize: 12, color: T.textFaint }}>Save deterministic mapping/parser choices for reuse.</span>
                  <button onClick={saveCurrentParserProfile} style={{ marginLeft: "auto", padding: "5px 10px", borderRadius: 7, border: "1px solid " + T.teal, background: T.tealLt, color: T.teal, fontSize: 12, cursor: "pointer", fontWeight: 700 }}>Save current</button>
                  <button onClick={downloadParserProfiles} disabled={!parserProfiles.length} style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid " + T.border, background: "transparent", color: parserProfiles.length ? T.textDim : T.textFaint, fontSize: 12, cursor: parserProfiles.length ? "pointer" : "not-allowed" }}>Export profiles</button>
                </div>
                {parserProfileNotice && <div style={{ fontSize: 12, color: T.teal, marginBottom: 8 }}>{parserProfileNotice}</div>}
                {parserProfileMatches.length > 0 && (
                  <div style={{ display: "grid", gap: 6 }}>
                    {parserProfileMatches.map(({ profile, reason }) => (
                      <div key={profile.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "7px 8px", background: T.card, border: "1px solid " + T.border, borderRadius: 8 }}>
                        <span style={{ fontSize: 12, color: T.text, fontWeight: 700 }}>{profile.name}</span>
                        <span style={{ fontSize: 11, color: T.textFaint }}>{reason}</span>
                        <button onClick={() => loadParserProfileIntoEditor(profile.id)} style={{ marginLeft: "auto", padding: "4px 8px", borderRadius: 6, border: "1px solid " + T.accent, background: T.accentLt, color: T.accent, fontSize: 11, cursor: "pointer", fontWeight: 700 }}>Use</button>
                        <button onClick={() => removeParserProfile(profile.id)} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid " + T.border, background: "transparent", color: T.textDim, fontSize: 11, cursor: "pointer" }}>Delete</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <textarea rows={14} value={customCode} onChange={e => updateCustomCode(e.target.value, "user")} style={{ ...inputSt, fontFamily: "monospace", fontSize: 12 }} />
              <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
                <button onClick={runCustom} disabled={customRunning} style={{ padding: "9px 24px", borderRadius: 8, background: customRunning ? T.textFaint : T.teal, border: "none", color: "#fff", fontWeight: 700, fontSize: 14, cursor: customRunning ? "not-allowed" : "pointer" }}>
                  {customRunning ? "Running…" : "▶ Run Parser"}
                </button>
                {customResult && (
                  <button onClick={applyCustomResult} style={{ padding: "9px 20px", borderRadius: 8, background: T.green, border: "none", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                    Apply to graph →
                  </button>
                )}
                {customErr && <span style={{ fontSize: 13, color: T.rose }}>⚠ {customErr}</span>}
              </div>
              {customLogs.length > 0 && (
                <div style={{ marginTop: 12, background: "#1E1E2E", borderRadius: 8, padding: 12, maxHeight: 140, overflowY: "auto" }}>
                  <div style={{ fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: .6, marginBottom: 6 }}>Console output</div>
                  {customLogs.map((l, i) => <div key={i} style={{ fontSize: 12, fontFamily: "monospace", color: l.startsWith("⚠") ? "#FFB347" : l.startsWith("✓") ? "#7CFC00" : "#A0C0FF", lineHeight: 1.6 }}>{l}</div>)}
                </div>
              )}
              {customResult && (
                <div style={{ marginTop: 12, background: T.greenLt, border: "1px solid " + T.green + "44", borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 12, color: T.green, fontWeight: 600, marginBottom: 4 }}>
                    Preview — {customResult.hyperedges.length} hyperedges · source: {customResult.source}
                  </div>
                  <pre style={{ fontSize: 11, fontFamily: "monospace", color: T.text, margin: 0, whiteSpace: "pre-wrap", maxHeight: 120, overflowY: "auto" }}>
                    {JSON.stringify(customResult.hyperedges.slice(0, 3), null, 2)}
                    {customResult.hyperedges.length > 3 ? "\n…" : ""}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Freeform panel */}
          {isFreeform && (
            <div>
              <div style={{ fontSize: 13, color: T.purple, marginBottom: 10, padding: "10px 14px", background: T.purpleLt, borderRadius: 8, border: "1px solid " + T.purple + "33", lineHeight: 1.7 }}>
                <strong>How it works:</strong> Paste natural language text. Each sentence becomes a hyperedge; capitalized proper nouns become vertices.
                <br />For better accuracy, use the <strong>AI Prompt</strong> tab instead — it prepares a copyable prompt for an external AI tool, but this dashboard does not send your text to any cloud API.
              </div>
              <textarea rows={6} value={txt} onChange={e => setTxt(e.target.value)} placeholder={EX.freeform} style={inputSt} />
            </div>
          )}

          {/* Normal single textarea */}
          {isNormalInput && (
            <div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
                <button onClick={fGo} style={{ fontSize: 13, color: T.accent, background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 600 }}>↑ upload file</button>
              </div>
              <textarea rows={fmt === "json" || fmt === "csr_json" ? 9 : 6} value={txt} onChange={e => setTxt(e.target.value)} placeholder={typeof EX[fmt] === "string" ? EX[fmt] : ""} style={inputSt} />
            </div>
          )}

          {/* Convert button — not shown for custom/ai_prompt */}
          {!isCustom && !isAiPrompt && (
            <div style={{ marginTop: 14, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <button onClick={parse} disabled={loading} style={{ padding: "12px 36px", borderRadius: 10, background: loading ? T.textFaint : T.accent, border: "none", color: "#fff", fontWeight: 700, fontSize: 16, cursor: loading ? "not-allowed" : "pointer", boxShadow: loading ? "none" : "0 3px 12px rgba(79,62,232,0.4)", transition: "all .2s" }}>
                {loading ? "Converting…" : "Convert →"}
              </button>
              {err && <span style={{ fontSize: 14, color: T.rose, fontWeight: 500 }}>⚠ {err}</span>}
              {warnings.length > 0 && <span style={{ fontSize: 13, color: T.amber }}>⚠ {warnings.length} warning{warnings.length !== 1 ? "s" : ""}: {warnings[0]}{warnings.length > 1 ? " …" : ""}</span>}
            </div>
          )}
        </div>

        {/* Stats bar */}
        {st && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 10, marginBottom: 16 }}>
            <StatCard label="Hyperedges" value={st.E} color={T.accent} />
            <StatCard label="Vertices" value={st.V} color={T.teal} />
            <StatCard label="Min card" value={st.min} color={T.textDim} />
            <StatCard label="Max card" value={st.max} color={T.amber} />
            <StatCard label="Avg card" value={st.avg} color={T.textDim} />
            <StatCard label="Timestamps" value={st.hasT ? "yes" : "no"} color={st.hasT ? T.green : T.textFaint} />
            <StatCard label="Weights" value={st.hasW ? "yes" : "no"} color={st.hasW ? T.purple : T.textFaint} />
          </div>
        )}

        {finalHes && (
          <div style={{ marginBottom: 20, background: T.surface, border: "1px solid " + T.border, borderRadius: 12, padding: 14, display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
            <div>
              <div style={{ fontSize: 10, color: T.textFaint, textTransform: "uppercase", letterSpacing: .8, fontWeight: 700 }}>Committed graph</div>
              <div style={{ fontFamily: "monospace", color: T.textDim, fontSize: 12 }}>version {graphIdentity.graphVersion} · {graphIdentity.graphFingerprint}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: T.textFaint, textTransform: "uppercase", letterSpacing: .8, fontWeight: 700 }}>Selection</div>
              <div style={{ fontFamily: "monospace", color: selectedGraphEntity ? T.accent : T.textFaint, fontSize: 12 }}>{selectedGraphEntity ? `${selectedGraphEntity.type}:${selectedGraphEntity.id}` : "none"}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: T.textFaint, textTransform: "uppercase", letterSpacing: .8, fontWeight: 700 }}>Mutation history</div>
              <div style={{ fontFamily: "monospace", color: T.textDim, fontSize: 12 }}>{graphHistory.length} committed change{graphHistory.length === 1 ? "" : "s"}</div>
            </div>
            <div style={{ marginLeft: "auto", color: T.textFaint, fontSize: 12 }}>Route switches and preview toggles do not change this version.</div>
          </div>
        )}

        {/* Section tabs */}
        {finalHes && (
          <>
            <div ref={dashboardSectionRef} style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid " + T.border, scrollMarginTop: 16 }}>
              {SECTIONS.map(sec => (
                <button key={sec.id} onClick={() => navigateToDashboardSection(sec.id)} style={{ padding: "10px 24px", border: "none", cursor: "pointer", background: "transparent", borderBottom: "3px solid " + (activeSection === sec.id ? sec.color : "transparent"), color: activeSection === sec.id ? sec.color : T.textDim, fontSize: 15, fontWeight: activeSection === sec.id ? 700 : 500, transition: "all .15s", marginBottom: -1 }}>
                  {sec.label}
                </button>
              ))}
            </div>

            {/* Mappings tab — 2x2 grid: h2v/v2h on top, h2h/v2v on bottom */}
            {activeSection === "mappings" && (
              <div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, color: T.textDim }}>Derived view:</span>
                  {[
                    ["h2v", "H2V"],
                    ["v2h", "V2H"],
                    ["h2h", "H2H projection"],
                    ["v2v", "V2V projection"],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      onClick={() => setSelectedMappingId(id)}
                      style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid " + (selectedMappingId === id ? T.accent : T.border), background: selectedMappingId === id ? T.accentLt : "transparent", color: selectedMappingId === id ? T.accent : T.textDim, fontSize: 12, fontWeight: selectedMappingId === id ? 700 : 500, cursor: "pointer" }}
                    >
                      {label}
                    </button>
                  ))}
                  <span style={{ fontSize: 11, color: T.textFaint }}>H2H/V2V are computed only when selected or exported.</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridAutoRows: "1fr", gap: 16, marginBottom: 16 }}>
                  <MappingBox title="h2v" color={T.accent} text={ht} rows={h2vRows} cols={["ID", "Time", "Vertices", "Weight", "Card."]} />
                  <MappingBox title="v2h" color={T.teal} text={vt} rows={v2hRows} cols={["Vertex", "Hyperedges", "Degree"]} />
                  <MappingBox title="h2h" color={T.amber} text={ht2} rows={h2hRows} cols={["Hyperedge", "Neighbors [shared]", "Degree"]} />
                  <MappingBox title="v2v" color={T.purple} text={vvt} rows={v2vRows} cols={["Vertex A", "Vertex B", "Shared", "Weight"]} />
                </div>
              </div>
            )}

            {/* Stats tab */}
            {activeSection === "stats" && (() => {
              const triadResult = countTriadsBounded(finalHes);
              const issues = validateHes(finalHes);
              return (
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
                    <div style={{ background: T.surface, border: "1px solid " + T.border, borderRadius: 12, padding: 18, boxShadow: "0 2px 6px rgba(0,0,0,0.05)" }}>
                      <BarChart data={st.cards} color={T.accent} label="Cardinality Distribution" />
                      <div style={{ marginTop: 8, fontSize: 12, color: T.textDim }}>Vertices per hyperedge</div>
                    </div>
                    <div style={{ background: T.surface, border: "1px solid " + T.border, borderRadius: 12, padding: 18, boxShadow: "0 2px 6px rgba(0,0,0,0.05)" }}>
                      <BarChart data={st.degs} color={T.teal} label="Degree Distribution" />
                      <div style={{ marginTop: 8, fontSize: 12, color: T.textDim }}>Hyperedges per vertex</div>
                    </div>
                    <div style={{ background: T.surface, border: "1px solid " + T.border, borderRadius: 12, padding: 18, boxShadow: "0 2px 6px rgba(0,0,0,0.05)" }}>
                      <div style={{ fontSize: 11, color: T.textFaint, textTransform: "uppercase", letterSpacing: .6, fontWeight: 600, marginBottom: 8 }}>Line-Graph Triangles</div>
                      <TriadStatistic result={triadResult} />
                      <div style={{ fontSize: 12, color: T.textDim, marginBottom: 14 }}>Triangles in the line graph</div>
                      <div style={{ fontSize: 11, color: T.textFaint, textTransform: "uppercase", letterSpacing: .6, fontWeight: 600, marginBottom: 8 }}>
                        Validation {issues.length === 0 ? <span style={{ color: T.green }}>✓ Clean</span> : <span style={{ color: T.rose }}>{issues.length} issue{issues.length !== 1 ? "s" : ""}</span>}
                      </div>
                      {issues.map((iss, i) => (<div key={i} style={{ fontSize: 12, color: T.rose, marginBottom: 4, lineHeight: 1.5 }}>⚠ {iss.msg}</div>))}
                      {issues.length === 0 && <div style={{ fontSize: 12, color: T.green }}>No duplicate, singleton, or empty hyperedge warnings found.</div>}
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
                    {[
                      { label: "Incidence Density", value: ((st.incidenceDensity ?? 0) * 100).toFixed(3) + "%", color: T.accent, desc: "Incidences / (V × H)" },
                      { label: "Max Degree", value: arrayMax(st.degs), color: T.teal, desc: "Most-connected vertex" },
                      { label: "Avg Degree", value: (st.degs.reduce((a, b) => a + b, 0) / Math.max(1, st.degs.length)).toFixed(2), color: T.amber, desc: "Average vertex degree" },
                      { label: "V2V Projection Density", value: st.v2vProjectionDensity == null ? "Not computed" : (st.v2vProjectionDensity * 100).toFixed(3) + "%", color: T.purple, desc: st.v2vProjectionDensity == null ? "Projection exceeds eager stats budget" : "Observed pairs / possible pairs" },
                    ].map(({ label, value, desc, color }) => (
                      <div key={label} style={{ background: T.surface, border: "1px solid " + T.border, borderRadius: 10, padding: "14px 16px", boxShadow: "0 2px 4px rgba(0,0,0,0.04)" }}>
                        <div style={{ fontSize: 10, color: T.textFaint, textTransform: "uppercase", letterSpacing: .8, marginBottom: 4, fontWeight: 600 }}>{label}</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color, fontFamily: "monospace", lineHeight: 1, marginBottom: 4 }}>{value}</div>
                        <div style={{ fontSize: 11, color: T.textFaint }}>{desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Export tab */}
            {activeSection === "export" && (
              <div style={{ background: T.surface, border: "1px solid " + T.border, borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                <div style={{ display: "flex", borderBottom: "1px solid " + T.border, overflowX: "auto" }}>
                  {EXPORTS.map(ex => (<button key={ex.id} onClick={() => setExpId(ex.id)} style={{ padding: "10px 16px", border: "none", cursor: "pointer", background: expId === ex.id ? T.card : "transparent", borderBottom: "2px solid " + (expId === ex.id ? T.accent : "transparent"), color: expId === ex.id ? T.accent : T.textDim, fontSize: 13, fontWeight: expId === ex.id ? 700 : 400, whiteSpace: "nowrap", transition: "all .15s" }}>{ex.label}</button>))}
                </div>
                <div style={{ padding: 20 }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                    <button onClick={downloadCurrentExport} style={{ padding: "8px 20px", borderRadius: 8, background: T.accent, border: "none", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>↓ Download {curExp.fn}</button>
                    <button onClick={() => { navigator.clipboard.writeText(exportContent); showNotice("Copied " + curExp.fn); }} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid " + T.border, background: "transparent", color: T.textDim, fontSize: 13, cursor: "pointer" }}>Copy</button>
                  </div>
                  <div style={{ background: T.card, borderRadius: 8, padding: 14, border: "1px solid " + T.border }}>
                    <div style={{ fontSize: 10, color: T.textFaint, textTransform: "uppercase", letterSpacing: .7, marginBottom: 6, fontWeight: 600 }}>Preview</div>
                    <pre style={{ margin: 0, fontSize: 12, fontFamily: "monospace", color: T.accent, whiteSpace: "pre-wrap", maxHeight: 200, overflowY: "auto", lineHeight: 1.6 }}>{exportContent.slice(0, 800)}{exportContent.length > 800 ? "\n..." : ""}</pre>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Visualization */}
        {finalHes && finalHes.length > 0 && (
          <div ref={vizRef} style={{ marginTop: 40, scrollMarginTop: 20 }}>
            <Viz
              hyperedges={finalHes}
              vizLimit={vizLimit}
              setVizLimit={setVizLimit}
              algoHighlight={algo.highlight}
              componentColors={algo.componentColors}
              controlledViewMode={graphView}
              onViewModeChange={setGraphView}
              controlledLayout={graphLayout}
              onLayoutChange={setGraphLayout}
              controlledSearch={graphSearch}
              onSearchChange={setGraphSearch}
              resetSignal={graphResetNonce}
              reheatSignal={graphReheatNonce}
              exportPngSignal={graphPngNonce}
              onSelectionChange={handleGraphSelectionChange}
            />
          </div>
        )}

        {/* Tools — Advanced Options / Algorithms / Hypergraph Assistant, tabbed like Mappings/Statistics/Export.
            All three stay mounted (hidden via display:none) so in-progress input — batch text, chat drafts —
            isn't lost when switching tabs. */}
        <div style={{ marginTop: 40 }}>
          <div role="tablist" aria-label="Tools sections" style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid " + T.border }}>
            {TOOLS_SECTIONS.map((sec, index) => (
              <button id={`tools-tab-${sec.id}`} role="tab" aria-selected={activeToolsSection === sec.id} aria-controls={`tools-panel-${sec.id}`} tabIndex={activeToolsSection === sec.id ? 0 : -1} key={sec.id} onClick={() => setActiveToolsSection(sec.id)} onKeyDown={event => handleToolsTabKeyDown(event, index)} style={{ padding: "10px 24px", border: "none", cursor: "pointer", background: "transparent", borderBottom: "3px solid " + (activeToolsSection === sec.id ? sec.color : "transparent"), color: activeToolsSection === sec.id ? sec.color : T.textDim, fontSize: 15, fontWeight: activeToolsSection === sec.id ? 700 : 500, transition: "all .15s", marginBottom: -1 }}>
                {sec.label}
              </button>
            ))}
          </div>

          {/* Advanced Options — batch updates to the graph already on screen.
              Preview is a temporary overlay, while commit writes changes back to the committed graph. */}
          <div id="tools-panel-advanced" role="tabpanel" aria-labelledby="tools-tab-advanced" hidden={activeToolsSection !== "advanced"} style={{ display: activeToolsSection === "advanced" ? "block" : "none" }}>
            <AdvancedOptionsPanel
              batchText={batchText}
              setBatchText={setBatchText}
              batchPreviewActive={batchPreviewActive}
              onPreviewBatch={previewBatchUpdatesForAgent}
              onCommitBatch={applyBatchUpdatesForAgent}
              onDiscardBatch={discardBatchPreviewForAgent}
              batchParsedCount={batchParsedCount}
              batchUnknownCount={batchUnknownCount}
              batchWarnings={batchWarnings}
              hasGraph={Boolean(hes?.length)}
              exampleText={EX.batch}
            />
          </div>

          {/* Algorithms */}
          <div id="tools-panel-algorithms" role="tabpanel" aria-labelledby="tools-tab-algorithms" hidden={activeToolsSection !== "algorithms"} style={{ display: activeToolsSection === "algorithms" ? "block" : "none" }}>
            {finalHes && finalHes.length > 0 ? (
              <AlgorithmsPanel algo={algo} />
            ) : (
              <div style={{ padding: 24, textAlign: "center", color: T.textFaint, fontSize: 13, background: T.surface, border: "1px solid " + T.border, borderRadius: 12 }}>
                Convert a dataset to run graph algorithms.
              </div>
            )}
          </div>

          {/* Hypergraph Assistant */}
          <div id="tools-panel-assistant" role="tabpanel" aria-labelledby="tools-tab-assistant" hidden={activeToolsSection !== "assistant"} style={{ display: activeToolsSection === "assistant" ? "block" : "none" }}>
            <AgentChatPanel agentState={agentState} agentActions={agentActions} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() { return <ErrorBoundary><AppCore /></ErrorBoundary>; }
