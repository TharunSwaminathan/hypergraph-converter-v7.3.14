import { useEffect, useRef, useState } from "react";
import {
  capabilityRequiresConfirmation,
  confirmationActionTypeForCapability,
  planFromCapabilityAction,
} from "../agent/capabilityRegistry.js";
import { createConfirmationSnapshot, isConfirmationStale } from "../agent/confirmationState.js";
import {
  CONTINUATION_PHASES,
  CONTINUATION_TRANSITION_REASONS,
  activeBatchFileSignature,
  continuationMatchesActiveBatch as continuationMatchesCurrentBatch,
  createPendingConversionContinuation,
  createExpectedContinuationTransition,
  pendingCustomParserExportAction,
  rebaseContinuationForExpectedTransition,
  continuationCanResume,
} from "../agent/customParserContinuation.js";
import { buildDeterministicActionPlan } from "../agent/orchestrationPlanner.js";
import { planAgentAction } from "../agent/actionPlanner.js";
import { validatePlannedAction } from "../agent/actionContextPolicy.js";
import { executeModelSelectionPlan, executeNumberedBatchPlan } from "../agent/parameterizedCommandExecutor.js";
import { QUICK_CONTROL_COMMANDS, resolveCanonicalControlPlan, resolveDeterministicControlPlan } from "../agent/deterministicControlPlanner.js";
import {
  classifyDatasetMappingIntent,
  isPlausibleDatasetMappingText,
} from "../agent/datasetMappingIntent.js";
import { dispatchCompiledAction } from "../agent/deterministicNlu/dispatchCompiledAction.js";
import { runtimeDiagnosticsFromTrace } from "../agent/deterministicNlu/runtimeInstrumentation.js";
import { createProductionDeterministicHandlers } from "../agent/deterministicNlu/runtime/createProductionDeterministicHandlers.js";
import { analyzeRequestSemantics } from "../agent/deterministicNlu/requestSemantics.js";
import { analyzePositiveAuthorization, authorizationAllowsSideEffect } from "../agent/deterministicNlu/positiveAuthorization.js";
import { authorizeCompiledSideEffect } from "../agent/deterministicNlu/sideEffectPolicy.js";
import { PENDING_ROUTE, routePendingSubmission } from "../agent/pendingSubmissionRouter.js";
import { createSubmissionRequestCoordinator, deriveSubmissionRuntimeContext } from "../agent/submissionRequestCoordinator.js";
import {
  composeInterpretationTraceResponse,
  composeParserWorkflowStatus,
} from "../agent/deterministicNlu/responseComposer.js";
import { buildGraphResultSummaryMessage, planFromResultSummaryAction } from "../agent/resultSummary.js";
import { getConfirmationCopy } from "../agent/safetyGuards.js";
import { resolveConversationIntent } from "../agent/conversationIntentResolver.js";
import { isPlausibleGraphMutationText } from "../agent/graphMutationModelPlanner.js";
import {
  EMPTY_CONVERSATION_MEMORY,
  appendConversationTurns,
  applyConversationSummary,
  bindConversationMemoryToBatch,
  shouldSummarizeConversation,
} from "../agent/conversationMemory.js";
import {
  DEFAULT_LOCAL_MODEL_TIMEOUT_MS,
  RECOMMENDED_OLLAMA_MODEL,
} from "../agent/localModelSettings.js";
import AgentActionCard from "./AgentActionCard.jsx";
import LocalRuntimeDiagnosticsPanel from "./LocalRuntimeDiagnosticsPanel.jsx";
import DeterministicCommandHelp from "./DeterministicCommandHelp.jsx";
import AgentComposer from "./agent/AgentComposer.jsx";
import AgentMessage from "./agent/AgentMessage.jsx";
import "./AgentChatPanel.css";
import { usePersistentThread } from "../persistence/usePersistentThread.js";
import { isExplicitParserRequest, specialistConfirmationRequest } from "../agent/customParserTriggerPolicy.js";
import CustomParserSpecialistPanel from "./CustomParserSpecialistPanel.jsx";
import { buildAuthoritativeOrchestratorObservation } from "../agent/orchestratorObservation.js";
import { requestMustRemainReadOnly, runBoundedOrchestrator } from "../agent/orchestratorLoop.js";
import { START_CUSTOM_PARSER_WORKFLOW } from "../agent/orchestratorCapabilities.js";
import { reactOrchestratorEnabled } from "../agent/reactOrchestratorConfig.js";

const SUGGESTIONS = [
  "Explain H2V",
  "What can you do?",
  "Help me understand these uploaded files",
  "Convert this file to CSR JSON",
  "Generate mapping spec",
  "Add Charlie to h0",
  "Rename vertex Alice to Alicia",
];

const FILE_SUGGESTIONS = [
  "Auto-detect format",
  "Explain file roles",
  "Parse together as one dataset",
  "Parse separately",
  "Infer mapping without model",
];

const QUICK_LINKS = Object.freeze([
  { label: "Explain H2V", command: "Explain H2V" },
  { label: "Graph stats", command: "Show graph stats" },
  { label: "Diagnostics", command: "Diagnose current issue" },
  { label: "Assistant help", command: "What can you do?" },
]);

const WORKSPACE_TABS = Object.freeze([
  ["workspace", "Workspace"],
  ["mapping", "Mapping"],
  ["settings", "Assistant Settings"],
  ["advanced", "Advanced"],
  ["help", "Help"],
]);

// Model output is advisory only.  Keep a small, explicit bridge from the
// legacy capability plan vocabulary to the positive-authorization scopes used
// by the deterministic dispatcher.  Unknown plans fail closed rather than
// being treated as executable.
function sideEffectScopeForAgentPlan(plan) {
  const kind = String(plan?.kind ?? "");
  if (!kind || kind === "respond" || kind === "show_result_summary") return "read_only";
  if (kind === "confirmation" || kind === "pending_confirm") return "confirmation_control";
  if (kind === "pending_cancel") return "cancellation";
  if (kind === "runtime_stop") return "runtime_control";
  if (["configure_local_model", "set_local_model_name"].includes(kind)) return "runtime_control";
  if (["test_local_model", "list_local_models", "run_runtime_diagnostics", "run_local_model_task"].includes(kind)) {
    if (kind === "run_local_model_task") {
      const task = String(plan?.task ?? plan?.userIntent ?? "");
      return /(?:analy[sz]e|explain)\s+file\s+roles?|diagnostic|test\s+(?:the\s+)?(?:runtime|model|connection)|list\s+models?/i.test(task)
        ? "runtime_probe"
        : "workflow_preparation";
    }
    return "runtime_probe";
  }
  if (["clear_graph_confirmed", "apply_custom_parser_result_confirmed", "parse_current_input", "parse_uploaded_files", "run_custom_parser_confirmed"].includes(kind)) {
    if (kind === "run_custom_parser_confirmed") return "parser_run_confirmation";
    if (kind === "apply_custom_parser_result_confirmed") return "graph_apply_confirmation";
    return "graph_edit_preview";
  }
  if (["clear_uploaded_files", "clear_previous_batch", "clear_all_batches", "add_to_previous_batch", "set_batch_parse_mode", "activate_batch", "activate_batch_then_generate_parser", "route_uploaded_files", "use_uploaded_files_with_custom_parser", "auto_detect_uploaded_files"].includes(kind)) {
    return kind.startsWith("clear_") ? "destructive_batch_state" : "batch_state_edit";
  }
  if (["generate_deterministic_mapping", "auto_repair_mapping", "use_deterministic_draft", "use_repaired_mapping", "validate_mapping", "generate_parser_from_mapping", "focus_mapping_editor", "compare_expected_output", "export_mapping_finetune", "mapping_feedback", "prepare_custom_parser_guidance", "auto_detect_uploaded_files"].includes(kind)) {
    return "workflow_preparation";
  }
  if (kind === "open_file_picker") return "file_picker";
  if (["download_export", "export_graph_png", "copy_ai_prompt"].includes(kind)) return "download_or_copy";
  if (["switch_route", "switch_section", "select_export_preview", "set_visual_limit", "set_graph_view", "set_graph_layout", "search_graph_vertex", "reset_graph_view", "reheat_graph", "scroll_visualization", "view_previous_batch"].includes(kind)) return "navigation";
  if (["graph_edit_preview", "add_graph_edge", "remove_graph_edge", "rename_graph_vertex", "add_graph_vertex", "remove_graph_vertex", "clear_graph"].includes(kind)) return "graph_edit_preview";
  // The exact capability plan is intentionally not guessed here.  A caller
  // can only execute it after the authorization contract names this scope.
  return "unknown";
}

function workspaceTabId(id) {
  return `agent-workspace-tab-${id}`;
}

function workspacePanelId(id) {
  return `agent-workspace-panel-${id}`;
}

const MAX_CHAT_MESSAGES = 500;
const STATUS_ACTIONS = Object.freeze({
  openSettings: { id: "open-settings", label: "Open Assistant Settings", local: "settings" },
  openDiagnostics: { id: "open-diagnostics", label: "Open diagnostics", local: "diagnostics" },
  deterministicHelp: { id: "deterministic-help", label: "Use deterministic help", command: "What can you help me with?" },
});

const WELCOME_MESSAGE = {
  id: "welcome",
  role: "agent",
  text: "Hello! I’m the Hypergraph Assistant. I can explain formats, help you understand uploaded datasets, guide mapping and Custom Parser workflows, and safely carry out supported dashboard actions through the deterministic controller.",
};

function nextMessage(role, text, tone = "", actions = []) {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    text,
    tone,
    actions,
  };
}

function executionOutcome({
  ok = true,
  outcome = "responded",
  changedState = false,
  stateMutationCommitted = changedState,
  mutationKind = null,
  confirmationStaged = false,
  cancelledPending = false,
  navigationChanged = false,
  filePickerOpened = false,
  error = null,
  details = null,
} = {}) {
  return {
    ok,
    outcome,
    changedState: Boolean(changedState || stateMutationCommitted),
    stateMutationCommitted: Boolean(stateMutationCommitted),
    mutationKind,
    confirmationStaged,
    cancelledPending,
    navigationChanged,
    filePickerOpened,
    error,
    details,
  };
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function warningsText(warnings) {
  return warnings?.length ? ` Warning: ${warnings.join(" ")}` : "";
}

function modelResultText(result) {
  const data = result.data ?? {};
  if (result.mappingOnly) {
    const roles = (data.files ?? []).slice(0, 10)
      .map(item => `${item.fileName}: ${item.role}${item.useAsInput ? "" : " (validation/ignored)"}`)
      .join("; ");
    const repaired = result.repairAttempts ? ` It required ${result.repairAttempts} repair attempt${result.repairAttempts === 1 ? "" : "s"}.` : "";
    return `${result.message} Dataset type: ${data.datasetType}; confidence: ${Math.round((data.confidence ?? 0) * 100)}%. ${roles ? `Roles: ${roles}.` : ""}${repaired}`;
  }
  const roles = (data.fileRoles ?? []).slice(0, 10)
    .map(item => `${item.fileName}: ${item.role}`)
    .join("; ");
  const assumptions = data.assumptions?.length ? ` Assumptions: ${data.assumptions.join(" ")}` : "";
  const warnings = data.warnings?.length ? ` Warnings: ${data.warnings.join(" ")}` : "";
  const repaired = result.repairAttempts ? ` The structured response required ${result.repairAttempts} repair attempt${result.repairAttempts === 1 ? "" : "s"}.` : "";
  const partial = result.previewIsPartial ? " The model received partial previews, not full files." : " The model received bounded previews only.";
  if (result.insertedParser) {
    return `Parser generated for ${result.batchLabel ?? "the active batch"} and inserted into Custom Parser Studio. It has not been run yet; running requires confirmation. ${data.summary} ${roles ? `Roles: ${roles}.` : ""}${assumptions}${warnings}${repaired}${partial}`;
  }
  return `${data.summary}${roles ? ` Roles: ${roles}.` : ""}${warnings}${repaired}${partial}`;
}

export default function AgentChatPanel({ agentState, agentActions }) {
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [pendingAction, setPendingAction] = useState(null);
  const [pendingContinuation, setPendingContinuation] = useState(null);
  const [reactContinuation, setReactContinuationState] = useState(null);
  const [busy, setBusyState] = useState(false);
  const [includeFullTrainingFiles, setIncludeFullTrainingFiles] = useState(false);
  const [renamingBatchId, setRenamingBatchId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [mappingNotes, setMappingNotes] = useState("");
  const [conversationMemory, setConversationMemory] = useState(EMPTY_CONVERSATION_MEMORY);
  const persistence = usePersistentThread({ messages, setMessages, memory: conversationMemory, setMemory: setConversationMemory, agentState });
  const [workspacePanel, setWorkspacePanel] = useState("workspace");
  const [lastNluDiagnostic, setLastNluDiagnostic] = useState(null);
  const [streaming, setStreamingState] = useState(false);
  const [transientStatus, setTransientStatus] = useState("");
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const historyRef = useRef(null);
  const mappingEditorRef = useRef(null);
  const abortControllerRef = useRef(null);
  const submissionCoordinatorRef = useRef(null);
  if (!submissionCoordinatorRef.current) submissionCoordinatorRef.current = createSubmissionRequestCoordinator();
  const streamingRef = useRef(false);
  const streamingMessageIdRef = useRef(null);
  const forceScrollRef = useRef(false);
  const latestStateRef = useRef(agentState);
  const previousGraphRef = useRef({ version: agentState.graphVersion, hasGraph: agentState.hasGraph });
  const previousActiveBatchRef = useRef(agentState.activeBatchId);
  const pendingContinuationRef = useRef(null);
  const expectedContinuationTransitionRef = useRef(null);
  const resumingContinuationRef = useRef(false);
  const reactContinuationRef = useRef(null);
  const activeBatchSignature = activeBatchFileSignature(agentState);
  const hasSpecialist = Boolean(agentState.specialist);
  // The model coordinator may settle before its React props reach submit's
  // finally block. Reconcile from committed state so reviewed drafts unlock.
  useEffect(() => {
    if (hasSpecialist && !agentState.specialist?.working && !agentState.localModel?.request?.busy && !streaming && !submissionCoordinatorRef.current.isBusy()) setBusyState(false);
  }, [hasSpecialist, agentState.specialist?.working, agentState.localModel?.request?.busy, streaming]);

  function setStreaming(value) {
    streamingRef.current = Boolean(value);
    setStreamingState(Boolean(value));
  }

  function setBusy(value) {
    if (value) {
      setBusyState(true);
      return;
    }
    const stillBusy = submissionCoordinatorRef.current?.isBusy()
      || streamingRef.current
      || Boolean(latestStateRef.current?.localModel?.request?.busy);
    setBusyState(Boolean(stillBusy));
  }

  function deterministicRoutingState(baseState = latestStateRef.current) {
    return deriveSubmissionRuntimeContext(baseState, {
      coordinatorCount: submissionCoordinatorRef.current?.count?.() ?? 0,
      currentSubmissionCount: 1,
      streaming: streamingRef.current,
    });
  }

  function selectWorkspaceTab(id, { focus = false } = {}) {
    setWorkspacePanel(id);
    if (focus && typeof document !== "undefined") {
      window.requestAnimationFrame?.(() => document.getElementById(workspaceTabId(id))?.focus());
    }
  }

  function handleWorkspaceTabKeyDown(event, currentId) {
    const currentIndex = WORKSPACE_TABS.findIndex(([id]) => id === currentId);
    if (currentIndex < 0) return;
    let targetIndex;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") targetIndex = (currentIndex + 1) % WORKSPACE_TABS.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") targetIndex = (currentIndex - 1 + WORKSPACE_TABS.length) % WORKSPACE_TABS.length;
    else if (event.key === "Home") targetIndex = 0;
    else if (event.key === "End") targetIndex = WORKSPACE_TABS.length - 1;
    else return;
    event.preventDefault();
    selectWorkspaceTab(WORKSPACE_TABS[targetIndex][0], { focus: true });
  }

  useEffect(() => {
    function openHelpFromHash() {
      if (typeof window !== "undefined" && window.location.hash.startsWith("#help")) {
        setWorkspacePanel("help");
      }
    }
    openHelpFromHash();
    window.addEventListener?.("hashchange", openHelpFromHash);
    return () => window.removeEventListener?.("hashchange", openHelpFromHash);
  }, []);

  const append = (role, text, tone = "", actions = []) => {
    const message = nextMessage(role, text, tone, actions);
    setMessages(previous => [...previous, message].slice(-MAX_CHAT_MESSAGES));
    return message;
  };

  const updateMessage = (id, updater) => {
    setMessages(previous => previous.map(message => {
      if (message.id !== id) return message;
      return typeof updater === "function" ? updater(message) : { ...message, ...updater };
    }));
  };

  useEffect(() => {
    const node = historyRef.current;
    if (!node) return;
    const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
    const shouldScroll = forceScrollRef.current || distanceFromBottom < 120;
    if (shouldScroll) {
      node.scrollTop = node.scrollHeight;
      setShowJumpToLatest(false);
      forceScrollRef.current = false;
    } else {
      setShowJumpToLatest(true);
    }
  }, [messages, pendingAction, busy]);

  useEffect(() => {
    latestStateRef.current = agentState;
  }, [agentState]);

  useEffect(() => {
    pendingContinuationRef.current = pendingContinuation;
  }, [pendingContinuation]);

  useEffect(() => {
    reactContinuationRef.current = reactContinuation;
  }, [reactContinuation]);

  useEffect(() => {
    const currentState = latestStateRef.current;
    const previous = previousActiveBatchRef.current;
    previousActiveBatchRef.current = currentState.activeBatchId;
    if (pendingContinuationRef.current && !continuationMatchesCurrentBatch(pendingContinuationRef.current, currentState)) {
      const transition = expectedContinuationTransitionRef.current;
      const rebased = rebaseContinuationForExpectedTransition(transition, currentState);
      if (!rebased) {
        expectedContinuationTransitionRef.current = null;
        setContinuation(null);
        setMessages(current => [...current, nextMessage(
          "agent",
          "Pending conversion target discarded because the active dataset changed.",
          "warning",
        )]);
      } else {
        pendingContinuationRef.current = rebased;
        setPendingContinuation(rebased);
        if (expectedContinuationTransitionRef.current === transition) {
          expectedContinuationTransitionRef.current = null;
        }
      }
    }
    if (!currentState.activeBatchId || currentState.activeBatchId === previous) return undefined;
    const activeId = currentState.activeBatchId;
    setConversationMemory(memory => bindConversationMemoryToBatch(memory, currentState.activeBatch));
    const timer = setTimeout(() => {
      const batch = latestStateRef.current.agentBatches.find(item => item.id === activeId);
      if (batch) {
        setMessages(current => [...current, nextMessage(
          "agent",
          `Active batch changed to ${batch.label}: ${batch.fileNames.join(", ")}.`,
          "status",
        )]);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [activeBatchSignature, agentState.activeBatch?.version, agentState.activeBatchId]);

  useEffect(() => {
    const currentState = latestStateRef.current;
    const previous = previousGraphRef.current;
    if (currentState.graphVersion !== previous.version) {
      if (currentState.hasGraph) {
        const summary = buildGraphResultSummaryMessage(currentState, {
          title: previous.hasGraph ? "Graph updated." : "Conversion complete.",
        });
        setMessages(current => [...current, nextMessage("agent", summary.text, "status", summary.actions)]);
      } else {
        setMessages(current => [...current, nextMessage("agent", "Graph cleared. Earlier graph statistics in this chat are now outdated.", "status")]);
      }
      previousGraphRef.current = { version: currentState.graphVersion, hasGraph: currentState.hasGraph };
    }
  }, [agentState.graphVersion, agentState.hasGraph]);

  async function verify(check) {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    let current = latestStateRef.current;
    if (check.type === "custom_result_id") {
      for (let attempt = 0; attempt < 8 && (current.customRunning || current.customResultId !== check.expected); attempt += 1) {
        await new Promise(resolve => setTimeout(resolve, 25));
        current = latestStateRef.current;
      }
    }
    if (check.type === "fmt") return current.fmt === check.expected;
    if (check.type === "section") return current.activeSection === check.expected;
    if (check.type === "visual_limit") return current.vizLimit === check.expected;
    if (check.type === "graph_view") return current.graphView === check.expected;
    if (check.type === "graph_layout") return current.graphLayout === check.expected;
    if (check.type === "graph_search") return current.graphSearch === check.expected;
    if (check.type === "export") return current.activeSection === "export" && current.expId === check.expected;
    if (check.type === "custom_result_id") return !current.customRunning && current.customResultId === check.expected;
    if (check.type === "custom_code_version") return current.customCodeVersion > check.previous && current.fmt === "custom";
    if (check.type === "graph_count") return current.hasGraph && current.hyperedgeCount === check.expected;
    if (check.type === "graph_version") return current.graphVersion > check.previous && (check.hasGraph === undefined || current.hasGraph === check.hasGraph);
    if (check.type === "batch_version") return current.batchVersion > check.previous;
    if (check.type === "batch_active") return current.activeBatchId === check.expected && current.batchVersion > check.previous;
    if (check.type === "agent_file_count") return current.agentFileCount === check.expected;
    if (check.type === "no_graph") return !current.hasGraph;
    return false;
  }

  async function executeUploadedParse(formatId, requestedExportId = null) {
    const previousGraphVersion = latestStateRef.current.graphVersion;
    const result = await agentActions.parseUploadedFiles(formatId);
    if (!result.ok) {
      append("agent", `I could not parse the active batch. The current graph was not replaced. ${result.error || "Try Auto-detect or use Custom Parser."}`, "error");
      return executionOutcome({ ok: false, outcome: "failed", details: result });
    }
    const graphChanged = await verify({ type: "graph_version", previous: previousGraphVersion, hasGraph: true });
    const countMatches = graphChanged && await verify({ type: "graph_count", expected: result.hyperedgeCount });
    if (!countMatches) {
      append("agent", "Parsing returned successfully, but I could not verify both the graph version and resulting counts.", "error");
      return executionOutcome({ ok: false, outcome: "verification_failed", details: result });
    }
    if (result.suspiciousWarnings?.length) append("agent", warningsText(result.suspiciousWarnings).trim(), "warning");
    if (requestedExportId) {
      agentActions.setActiveSection("export");
      agentActions.selectExportPreview(requestedExportId);
      const exportVerified = await verify({ type: "export", expected: requestedExportId });
      append("agent", exportVerified
        ? "Requested export preview selected after parsing."
        : "The graph parsed, but I could not verify the requested export preview selection.", exportVerified ? "status" : "warning");
    }
    return executionOutcome({ ok: true, outcome: "graph_parsed", stateMutationCommitted: true, details: result });
  }

  async function removeAttachedFile(file) {
    if (busy) return;
    const previousVersion = latestStateRef.current.batchVersion;
    const result = agentActions.removeAgentFile(file.id);
    const verified = result.ok && await verify({ type: "batch_version", previous: previousVersion });
    append(
      "agent",
      verified
        ? `Removed ${file.name}. ${result.remaining ? `${result.remaining} file${result.remaining === 1 ? "" : "s"} remain in the active batch.` : "The active batch was removed."}`
        : `I could not verify removal of ${file.name}.`,
      verified ? "status" : "error",
    );
  }

  async function activateBatch(batchId) {
    if (busy || batchId === agentState.activeBatchId) return;
    const previousVersion = latestStateRef.current.batchVersion;
    const result = agentActions.setActiveAgentBatch(batchId);
    const verified = result.ok && await verify({ type: "batch_active", expected: batchId, previous: previousVersion });
    if (!verified) append("agent", `I could not activate that upload batch. ${result.error ?? ""}`, "error");
  }

  function beginRename(batch) {
    setRenamingBatchId(batch.id);
    setRenameValue(batch.label);
  }

  function saveRename(batchId) {
    const result = agentActions.renameAgentBatch(batchId, renameValue);
    append("agent", result.ok ? `Renamed batch to ${result.batch.label}.` : result.error, result.ok ? "status" : "error");
    if (result.ok) {
      setRenamingBatchId(null);
      setRenameValue("");
    }
  }

  function duplicateBatch(batchId) {
    const result = agentActions.duplicateAgentBatch(batchId);
    append("agent", result.ok ? `Created ${result.batch.label} as a separate active workspace.` : result.error, result.ok ? "status" : "error");
  }

  function deleteBatch(batchId) {
    const result = agentActions.deleteAgentBatch(batchId);
    append("agent", result.ok ? `Deleted ${result.removedBatch?.label ?? "the batch"}.` : result.error, result.ok ? "status" : "error");
  }

  function generateStarterParser() {
    const result = agentActions.generateDeterministicStarterParser();
    append("agent", result.ok
      ? `${result.message} It is bound to ${agentState.activeBatch?.label} and has not been run.`
      : result.error, result.ok ? "status" : "error");
  }

  function buildPendingContinuation({ originalQuery, requestedExportId = null, phase = CONTINUATION_PHASES.AUTO_DETECT } = {}) {
    return createPendingConversionContinuation({
      state: latestStateRef.current,
      originalQuery,
      requestedExportId,
      phase,
    });
  }

  function setContinuation(next) {
    pendingContinuationRef.current = next;
    setPendingContinuation(next);
  }

  function authorizeContinuationTransition(reason, continuation = pendingContinuationRef.current) {
    const transition = createExpectedContinuationTransition({
      continuation,
      state: latestStateRef.current,
      reason,
    });
    expectedContinuationTransitionRef.current = transition;
    return transition;
  }

  function clearExpectedContinuationTransition(transition = expectedContinuationTransitionRef.current) {
    if (!transition || expectedContinuationTransitionRef.current === transition) {
      expectedContinuationTransitionRef.current = null;
    }
  }

  function rebaseContinuationFromTransition(transition, state = latestStateRef.current) {
    return rebaseContinuationForExpectedTransition(transition, state);
  }

  function continuationMatchesActiveBatch(continuation, state = latestStateRef.current) {
    return continuationMatchesCurrentBatch(continuation, state);
  }

  async function completeCustomParserPendingExport(applyResult) {
    const continuation = pendingContinuationRef.current;
    const pendingExport = pendingCustomParserExportAction(continuation, latestStateRef.current, applyResult);
    if (!pendingExport.ok) {
      if (pendingExport.invalidate) {
        setContinuation(null);
        append("agent", "The pending Custom Parser export target was discarded because it no longer matches the active batch.", "warning");
      }
      return false;
    }
    agentActions.setActiveSection("export");
    agentActions.selectExportPreview(pendingExport.requestedExportId);
    const verified = await verify({ type: "export", expected: pendingExport.requestedExportId });
    if (verified) {
      setContinuation(null);
      append("agent", `Prepared the requested ${pendingExport.requestedExportId} export preview after the Custom Parser graph was applied. No download was started.`, "status");
      return true;
    }
    append("agent", "The Custom Parser graph was applied, but I could not verify the pending requested export preview selection.", "warning");
    return false;
  }

  async function resumePendingContinuation(reason = "detected") {
    if (resumingContinuationRef.current) return false;
    const continuation = pendingContinuationRef.current;
    if (!continuation) return false;
    const state = latestStateRef.current;
    if (!continuationMatchesActiveBatch(continuation, state)) {
      setContinuation(null);
      append("agent", "I discarded the pending conversion continuation because the active upload batch changed.", "warning");
      return false;
    }
    if (!continuationCanResume(continuation)) {
      setContinuation(null);
      return false;
    }
    if (state.agentFileCount > 1 && state.activeBatch?.parseMode === "unknown" && state.agentDetection?.formatId !== "cornell") {
      append("agent", "Should these files be parsed together as one dataset or separately? I’ll keep the original conversion target after you choose.", "warning");
      return false;
    }
    if (state.agentDetection?.formatId === "custom") {
      const customPhaseContinuation = {
        ...continuation,
        phase: CONTINUATION_PHASES.CUSTOM_PARSER_COMPLETION,
      };
      const transition = authorizeContinuationTransition(
        CONTINUATION_TRANSITION_REASONS.ROUTE_TO_CUSTOM_PARSER,
        customPhaseContinuation,
      );
      const result = agentActions.useUploadedFilesWithCustomParser();
      const verified = result.ok && await verify({ type: "fmt", expected: "custom" });
      const transitioned = verified
        ? rebaseContinuationFromTransition(transition)
        : null;
      if (transitioned) setContinuation(transitioned);
      else setContinuation(null);
      clearExpectedContinuationTransition(transition);
      const exportNote = transitioned?.requestedExportId ? " The requested export target is still pinned to this batch; after the parser result is applied I will select that export preview without downloading anything." : "";
      append("agent", verified
        ? `Auto Detect found a custom/unknown format, so I opened Custom Parser instead of guessing a built-in parser.${exportNote}`
        : `Auto Detect found a custom/unknown format, but I could not verify the Custom Parser route. ${result.error ?? ""}`, verified ? "warning" : "error");
      return verified;
    }
    if (!state.agentDetection?.formatId) return false;

    // Consume before dispatch. A resumed query must never recreate or re-enter
    // the same AUTO_DETECT continuation in the same lifecycle.
    resumingContinuationRef.current = true;
    const originalQuery = continuation.originalQuery;
    setContinuation(null);
    append("agent", reason === "parse_mode_resolved"
      ? "Parse mode is resolved. Resuming the original conversion request now."
      : "Format detected. Resuming the original conversion request now.", "status");
    try {
      await dispatchOllamaActionPlan(
        buildDeterministicActionPlan(originalQuery, latestStateRef.current),
        originalQuery,
      );
      return true;
    } finally {
      resumingContinuationRef.current = false;
    }
  }

  async function dispatchPlan(plan) {
    if (plan.kind === "confirmation") {
      setPendingAction({ ...plan, confirmationToken: createConfirmationSnapshot(plan.actionType, latestStateRef.current) });
      append("agent", "I’ve staged this action but have not executed it.", "warning");
      return executionOutcome({ outcome: "staged_confirmation", confirmationStaged: true });
    }
    if (plan.kind === "respond") {
      if (plan.continuation) {
        const continuation = buildPendingContinuation(plan.continuation);
        if (continuation) setContinuation(continuation);
      }
      append("agent", plan.message);
      return executionOutcome({ outcome: "responded" });
    }
    if (plan.kind === "pending_cancel") {
      if (!pendingAction) {
        append("agent", "No pending action is currently staged.", "warning");
        return executionOutcome({ ok: false, outcome: "no_pending_action" });
      }
      setPendingAction(null);
      append("agent", plan.message ?? "Pending action cancelled. No changes were made.", "status");
      return executionOutcome({ outcome: "pending_cancelled" });
    }
    if (plan.kind === "pending_confirm") {
      if (!pendingAction) {
        append("agent", "No pending action is currently staged.", "warning");
        return executionOutcome({ ok: false, outcome: "no_pending_action" });
      }
      return await confirmPending({ allowWhileRouting: true });
    }
    if (plan.kind === "runtime_stop") {
      stopStreaming();
      append("agent", plan.message ?? "Stop requested for active model/runtime work.", "status");
      return executionOutcome({ outcome: "runtime_stop_requested" });
    }
    if (plan.kind === "activate_batch" || plan.kind === "activate_batch_then_generate_parser") {
      const previousVersion = latestStateRef.current.batchVersion;
      const result = await executeNumberedBatchPlan({
        plan,
        getState: () => latestStateRef.current,
        setActiveBatch: batchId => agentActions.setActiveAgentBatch(batchId),
        verifyActiveBatch: batchId => verify({ type: "batch_active", expected: batchId, previous: previousVersion }),
        dispatchPlan,
      });
      if (!result.ok) {
        append("agent", `I could not complete that batch command. ${result.error ?? ""}`, "error");
        return executionOutcome({
          ok: false,
          outcome: result.outcome,
          changedState: result.changedState,
          stateMutationCommitted: result.stateMutationCommitted,
          error: result.error,
          details: result,
        });
      }
      return executionOutcome({
        outcome: result.outcome,
        changedState: result.changedState,
        stateMutationCommitted: result.stateMutationCommitted,
        details: result,
      });
    }
    if (plan.kind === "configure_local_model") {
      const result = agentActions.updateLocalModelSettings(plan.patch);
      append("agent", result.ok ? plan.message : `Local model settings were not updated: ${result.error}`, result.ok ? "status" : "error");
      return executionOutcome({ ok: result.ok, outcome: result.ok ? "settings_updated" : "failed", stateMutationCommitted: Boolean(result.changedState), details: result });
    }
    if (plan.kind === "set_local_model_name") {
      const result = executeModelSelectionPlan({ plan, updateLocalModelSettings: agentActions.updateLocalModelSettings });
      append("agent", result.ok ? plan.message : `The local model name was not updated: ${result.error}`, result.ok ? "status" : "error");
      return executionOutcome({ ok: result.ok, outcome: result.outcome, stateMutationCommitted: result.changedState, details: result });
    }
    if (plan.kind === "test_local_model") {
      setBusy(true);
      try {
        const result = await agentActions.testConfiguredLocalModel(plan.configOverride);
        append("agent", result.ok ? result.message : `Local connection failed: ${result.error}`, result.ok ? "status" : "error");
        return executionOutcome({ ok: Boolean(result.ok), outcome: result.ok ? "connection_tested" : "failed", error: result.ok ? null : result.error, details: result });
      } finally {
        setBusy(false);
      }
    }
    if (plan.kind === "list_local_models") {
      setBusy(true);
      try {
        const result = await agentActions.listConfiguredLocalModels(plan.configOverride);
        const list = result.models?.length ? result.models.slice(0, 20).join(", ") : "No local models were reported.";
        const message = result.ok
          ? (result.listingAvailable === false ? result.message : `Local models: ${list}`)
          : `Could not list local models: ${result.error}`;
        append("agent", message, result.ok ? (result.listingAvailable === false ? "warning" : "status") : "error");
        return executionOutcome({ ok: Boolean(result.ok), outcome: result.ok ? "models_listed" : "failed", error: result.ok ? null : result.error, details: result });
      } finally {
        setBusy(false);
      }
    }
    if (plan.kind === "run_runtime_diagnostics") {
      setBusy(true);
      try {
        const result = await agentActions.runLocalRuntimeDiagnostics(plan.mode ?? "current");
        append("agent", result.ok ? result.message : (result.suggestedFix || result.error || result.message), result.ok ? "status" : "error");
        return executionOutcome({ ok: Boolean(result.ok), outcome: result.ok ? "runtime_diagnostics_completed" : "failed", error: result.ok ? null : result.error, details: result });
      } finally {
        setBusy(false);
      }
    }
    if (plan.kind === "show_runtime_setup_help") {
      const result = agentActions.getGitHubPagesRuntimeHelp();
      append("agent", result.message, "status");
      return executionOutcome({ ok: true, outcome: "responded", details: result });
    }
    if (plan.kind === "run_local_model_task") {
      const previousCodeVersion = latestStateRef.current.customCodeVersion;
      if (plan.task === "generate_mapping_spec") {
        append("agent", "I created a deterministic draft mapping first. I will use the local model only to refine it.", "status");
      }
      setBusy(true);
      try {
        const result = await agentActions.runLocalModelAssist(plan.task, plan.userIntent);
        if (!result.ok) {
          const validationDetails = result.validationErrors?.length ? ` ${result.validationErrors.join(" ")}` : "";
          const options = result.offerFallback
            ? " Options: retry with the stricter schema, use the deterministic starter parser, show Model Debug, try a larger local code model, or export a debug/training example."
            : "";
          append("agent", `${result.error}${validationDetails}${options}`, "error");
          return executionOutcome({ ok: false, outcome: "failed", error: result.error, details: result });
        }
        const verified = !result.insertedParser || await verify({ type: "custom_code_version", previous: previousCodeVersion });
        append("agent", verified ? modelResultText(result) : "The local model response validated, but I could not verify parser insertion.", verified ? (result.data?.warnings?.length ? "warning" : "status") : "error");
        return executionOutcome({
          ok: Boolean(verified),
          outcome: verified ? "local_model_task_completed" : "verification_failed",
          changedState: Boolean(verified && result.insertedParser),
          mutationKind: verified && result.insertedParser ? "parser_code" : null,
          error: verified ? null : "Parser insertion could not be verified.",
          details: result,
        });
      } finally {
        setBusy(false);
      }
    }
    if (plan.kind === "generate_deterministic_mapping") {
      const previousVersion = latestStateRef.current.batchVersion;
      const result = agentActions.generateDeterministicMapping(plan.userIntent);
      const verified = result.ok && await verify({ type: "batch_version", previous: previousVersion });
      append("agent", verified ? `${plan.message ?? ""} ${result.message}`.trim() : (result.error ?? "I could not validate the deterministic mapping."), verified ? (result.validation?.warnings?.length ? "warning" : "status") : "error");
      return executionOutcome({ ok: Boolean(verified), outcome: verified ? "mapping_generated" : "failed", stateMutationCommitted: Boolean(verified), details: result });
    }
    if (plan.kind === "auto_repair_mapping") {
      const result = agentActions.autoRepairActiveMapping();
      append("agent", result.ok ? result.message : result.error, result.ok ? (result.validation?.warnings?.length ? "warning" : "status") : "error");
      return executionOutcome({ ok: Boolean(result.ok), outcome: result.ok ? "mapping_repaired" : "failed", stateMutationCommitted: Boolean(result.ok), details: result });
    }
    if (plan.kind === "use_deterministic_draft") {
      const result = agentActions.useDeterministicDraftMapping();
      append("agent", result.ok ? result.message : result.error, result.ok ? "status" : "error");
      return executionOutcome({ ok: Boolean(result.ok), outcome: result.ok ? "mapping_draft_accepted" : "failed", stateMutationCommitted: Boolean(result.ok), details: result });
    }
    if (plan.kind === "use_repaired_mapping") {
      const result = agentActions.useRepairedMapping();
      append("agent", result.ok ? result.message : result.error, result.ok ? "status" : "error");
      return executionOutcome({ ok: Boolean(result.ok), outcome: result.ok ? "mapping_repair_accepted" : "failed", stateMutationCommitted: Boolean(result.ok), details: result });
    }
    if (plan.kind === "validate_mapping") {
      const result = agentActions.validateActiveMappingSpec();
      append("agent", result.ok ? result.message : result.error, result.ok ? "status" : "error");
      return executionOutcome({ ok: Boolean(result.ok), outcome: result.ok ? "mapping_validated" : "failed", stateMutationCommitted: Boolean(result.ok), details: result });
    }
    if (plan.kind === "generate_parser_from_mapping") {
      const previousCodeVersion = latestStateRef.current.customCodeVersion;
      const result = agentActions.generateParserFromActiveMapping();
      const verified = result.ok && await verify({ type: "custom_code_version", previous: previousCodeVersion });
      append("agent", verified ? result.message : (result.error ?? "I could not verify deterministic parser insertion."), verified ? "status" : "error");
      return executionOutcome({ ok: Boolean(verified), outcome: verified ? "parser_generated" : "failed", stateMutationCommitted: Boolean(verified), details: result });
    }
    if (plan.kind === "focus_mapping_editor") {
      mappingEditorRef.current?.focus();
      append("agent", plan.message);
      return executionOutcome({ outcome: "navigation_updated", navigationChanged: true });
    }
    if (plan.kind === "compare_expected_output") {
      const result = agentActions.compareActiveExpectedOutput();
      append("agent", result.ok ? result.message : result.error, result.ok ? (result.comparison?.warnings?.length ? "warning" : "status") : "error");
      return executionOutcome({ ok: Boolean(result.ok), outcome: result.ok ? "expected_output_compared" : "failed", error: result.ok ? null : result.error, details: result });
    }
    if (plan.kind === "export_mapping_finetune") {
      const result = agentActions.exportMappingFineTuneExample(false);
      append("agent", result.ok ? "Exported a preview-only mapping fine-tuning example." : result.error, result.ok ? "status" : "error");
      return executionOutcome({ ok: Boolean(result.ok), outcome: result.ok ? "mapping_training_exported" : "failed", error: result.ok ? null : result.error, details: result });
    }
    if (plan.kind === "mapping_feedback") {
      const result = agentActions.setActiveMappingFeedback(plan.patch);
      append("agent", result.ok
        ? (plan.patch.accepted ? "Mapping accepted and recorded for local fine-tuning export." : "Mapping rejected and recorded for local fine-tuning export.")
        : result.error, result.ok ? "status" : "error");
      return executionOutcome({ ok: Boolean(result.ok), outcome: result.ok ? "mapping_feedback_recorded" : "failed", stateMutationCommitted: Boolean(result.ok), details: result });
    }
    if (plan.kind === "open_file_picker") {
      const result = agentActions.openBatchUpdates?.();
      append("agent", result?.ok
        ? "Batch Updates is open. Choose files or drop them onto its upload target."
        : "Open Batch Updates to choose or drop local files.", result?.ok ? "status" : "warning");
      return executionOutcome({ ok: Boolean(result?.ok), outcome: result?.ok ? "navigation_updated" : "failed", navigationChanged: Boolean(result?.ok) });
    }
    if (plan.kind === "clear_uploaded_files" || plan.kind === "clear_all_batches" || plan.kind === "clear_previous_batch") {
      const previousVersion = latestStateRef.current.batchVersion;
      const result = plan.kind === "clear_all_batches"
        ? agentActions.clearAllAgentBatches()
        : plan.kind === "clear_previous_batch"
          ? agentActions.clearPreviousAgentBatch()
          : agentActions.clearAgentFiles();
      const verified = result.ok && await verify({ type: "batch_version", previous: previousVersion });
      const message = plan.kind === "clear_all_batches"
        ? "All upload batches cleared. The parsed graph and dashboard inputs were not changed."
        : plan.kind === "clear_previous_batch"
          ? `Removed ${result.removedBatch?.label ?? "the previous batch"}.`
          : plan.message;
      append("agent", verified ? message : `I could not verify the batch change. ${result.error ?? ""}`, verified ? "status" : "error");
      return executionOutcome({ ok: Boolean(verified), outcome: verified ? "batch_state_updated" : "failed", stateMutationCommitted: Boolean(verified), details: result });
    }
    if (plan.kind === "view_previous_batch") {
      const previousVersion = latestStateRef.current.batchVersion;
      const result = agentActions.viewPreviousAgentBatch();
      const verified = result.ok && await verify({ type: "batch_active", expected: result.batch?.id, previous: previousVersion });
      append("agent", verified
        ? `${result.batch.label} is now active. File actions will use only this batch.`
        : `I could not switch to the previous batch. ${result.error ?? ""}`, verified ? "status" : "error");
      return executionOutcome({ ok: Boolean(verified), outcome: verified ? "batch_activated" : "failed", stateMutationCommitted: Boolean(verified), details: result });
    }
    if (plan.kind === "add_to_previous_batch") {
      const previousVersion = latestStateRef.current.batchVersion;
      const result = agentActions.addActiveFilesToPreviousBatch();
      const verified = result.ok && await verify({ type: "batch_active", expected: result.batch?.id, previous: previousVersion });
      append("agent", verified
        ? `Merged the files into ${result.batch.label}. Its parse mode is unresolved; choose whether the combined files belong together or are separate datasets.`
        : `I could not merge the batches. ${result.error ?? ""}`, verified ? "warning" : "error");
      return executionOutcome({ ok: Boolean(verified), outcome: verified ? "batches_merged" : "failed", stateMutationCommitted: Boolean(verified), details: result });
    }
    if (plan.kind === "set_batch_parse_mode") {
      const previousVersion = latestStateRef.current.batchVersion;
      const continuationBeforeTransition = pendingContinuationRef.current;
      const transition = authorizeContinuationTransition(
        plan.mode === "separate"
          ? CONTINUATION_TRANSITION_REASONS.PARSE_MODE_SEPARATE
          : CONTINUATION_TRANSITION_REASONS.PARSE_MODE_TOGETHER,
        continuationBeforeTransition,
      );
      const result = agentActions.setAgentBatchParseMode(plan.mode);
      const verified = result.ok && await verify({ type: "batch_version", previous: previousVersion });
      append("agent", verified ? plan.message : `I could not update the active batch mode. ${result.error ?? ""}`, verified ? "status" : "error");
      if (verified) {
        const rebased = rebaseContinuationFromTransition(transition);
        if (rebased) {
          setContinuation(rebased);
        }
        clearExpectedContinuationTransition(transition);
        await resumePendingContinuation("parse_mode_resolved");
      } else {
        clearExpectedContinuationTransition(transition);
      }
      return executionOutcome({ ok: Boolean(verified), outcome: verified ? "parse_mode_updated" : "failed", stateMutationCommitted: Boolean(verified), details: result });
    }
    if (plan.kind === "prepare_custom_parser_guidance") {
      const result = agentActions.prepareCustomParserForActiveBatch();
      if (!result.ok) {
        append("agent", result.error, "warning");
        return executionOutcome({ ok: false, outcome: "failed", details: result });
      }
      const verified = await verify({ type: "fmt", expected: "custom" });
      append("agent", verified ? `${result.message} ${plan.message}` : "I generated parser guidance but could not verify the Custom Parser route.", verified ? "status" : "error");
      return executionOutcome({ ok: Boolean(verified), outcome: verified ? "parser_guidance_prepared" : "failed", stateMutationCommitted: Boolean(verified), details: result });
    }
    if (plan.kind === "auto_detect_uploaded_files") {
      const continuationRequest = plan.continuation ?? null;
      const continuationBeforeTransition = continuationRequest
        ? buildPendingContinuation(continuationRequest)
        : pendingContinuationRef.current;
      const transition = authorizeContinuationTransition(
        CONTINUATION_TRANSITION_REASONS.AUTO_DETECT_METADATA_UPDATE,
        continuationBeforeTransition,
      );
      const result = agentActions.autoDetectUploadedFiles();
      if (!result.ok) {
        clearExpectedContinuationTransition(transition);
        setContinuation(null);
        append("agent", `I could not confidently match this to a built-in route. ${result.error}`, "warning");
        return executionOutcome({ ok: false, outcome: "detection_failed", error: result.error, details: result });
      }
      const verified = await verify({ type: "fmt", expected: result.formatId });
      const continuation = verified && continuationRequest
        ? rebaseContinuationFromTransition(transition) ?? buildPendingContinuation(continuationRequest)
        : null;
      if (continuation) setContinuation(continuation);
      clearExpectedContinuationTransition(transition);
      append("agent", verified
        ? `This looks like ${result.detection.label} because ${result.detection.reason.charAt(0).toLowerCase()}${result.detection.reason.slice(1)} I switched to that route.`
        : "I detected a format but could not verify the route change.", verified ? "status" : "error");
      const active = latestStateRef.current.activeBatch;
      if (verified && active?.parseMode === "unknown" && latestStateRef.current.agentFileCount > 1) {
        append("agent", active.separateGraphFiles
          ? "These look like separate graph files. Treat them as separate datasets, or combine them as one temporal dataset?"
          : "Should these files be parsed together as one dataset, or treated as separate datasets?", "warning");
        return executionOutcome({ ok: true, outcome: "parse_mode_clarification", changedState: true, mutationKind: "route", details: result });
      }
      if (verified && continuation) await resumePendingContinuation("detected");
      return executionOutcome({ ok: Boolean(verified), outcome: verified ? "format_detected" : "verification_failed", changedState: Boolean(verified), mutationKind: verified ? "route" : null, details: result });
    }
    if (plan.kind === "route_uploaded_files") {
      const result = agentActions.routeUploadedFiles(plan.formatId);
      if (!result.ok) {
        append("agent", `I could not route the active batch: ${result.error}`, "error");
        return executionOutcome({ ok: false, outcome: "failed", details: result });
      }
      const verified = await verify({ type: "fmt", expected: result.formatId });
      append("agent", verified ? plan.message : "I could not verify the requested active-batch route.", verified ? "status" : "error");
      return executionOutcome({ ok: Boolean(verified), outcome: verified ? "batch_route_updated" : "failed", stateMutationCommitted: Boolean(verified), details: result });
    }
    if (plan.kind === "use_uploaded_files_with_custom_parser") {
      const continuationBeforeTransition = plan.requestedExportId
        ? buildPendingContinuation({
          originalQuery: plan.originalQuery ?? plan.message,
          requestedExportId: plan.requestedExportId,
          phase: CONTINUATION_PHASES.CUSTOM_PARSER_COMPLETION,
        })
        : pendingContinuationRef.current
          ? { ...pendingContinuationRef.current, phase: CONTINUATION_PHASES.CUSTOM_PARSER_COMPLETION }
          : null;
      const transition = authorizeContinuationTransition(
        CONTINUATION_TRANSITION_REASONS.ROUTE_TO_CUSTOM_PARSER,
        continuationBeforeTransition,
      );
      const result = agentActions.useUploadedFilesWithCustomParser();
      if (!result.ok) {
        clearExpectedContinuationTransition(transition);
        append("agent", `I could not open the active batch in Custom Parser: ${result.error}`, "error");
        return executionOutcome({ ok: false, outcome: "failed", details: result });
      }
      const verified = await verify({ type: "fmt", expected: "custom" });
      if (verified && plan.requestedExportId) {
        const continuation = rebaseContinuationFromTransition(transition)
          ?? buildPendingContinuation({
            originalQuery: plan.originalQuery ?? plan.message,
            requestedExportId: plan.requestedExportId,
            phase: CONTINUATION_PHASES.CUSTOM_PARSER_COMPLETION,
          });
        if (continuation) setContinuation(continuation);
      }
      clearExpectedContinuationTransition(transition);
      append("agent", verified ? plan.message : "I could not verify the Custom Parser route.", verified ? "status" : "error");
      return executionOutcome({ ok: Boolean(verified), outcome: verified ? "custom_parser_route_opened" : "failed", stateMutationCommitted: Boolean(verified), details: result });
    }
    if (plan.kind === "parse_uploaded_files") {
      setBusy(true);
      try {
        return await executeUploadedParse(plan.formatId, plan.requestedExportId);
      } finally {
        setBusy(false);
      }
    }
    if (plan.kind === "parse_current_input") {
      if (latestStateRef.current.hasGraph) {
        setPendingAction({
          ...getConfirmationCopy("parse_uploaded_files"),
          kind: "confirmation",
          actionType: "parse_current_input",
          formatId: plan.formatId,
          confirmationToken: createConfirmationSnapshot("parse_current_input", latestStateRef.current),
        });
        append("agent", "Parsing the current input may replace the current graph, so I staged it for confirmation.", "warning");
        return executionOutcome({ outcome: "staged_confirmation", confirmationStaged: true });
      }
      const previousGraphVersion = latestStateRef.current.graphVersion;
      setBusy(true);
      try {
        const result = await agentActions.parseCurrentInput();
        if (!result.ok) {
          append("agent", `I could not parse the current input. ${result.error ?? ""}`, "error");
          return executionOutcome({ ok: false, outcome: "failed", error: result.error, details: result });
        }
        const changed = await verify({ type: "graph_version", previous: previousGraphVersion, hasGraph: true });
        append("agent", changed
          ? `Parsed the current ${latestStateRef.current.formatLabel} input. Current graph: ${result.vertexCount.toLocaleString()} vertices, ${result.hyperedgeCount.toLocaleString()} hyperedges, ${result.incidenceCount.toLocaleString()} incidences.`
          : "Parsing returned successfully, but I could not verify a new graph version.", changed ? "status" : "error");
        return executionOutcome({
          ok: Boolean(changed),
          outcome: changed ? "graph_parsed" : "verification_failed",
          changedState: Boolean(changed),
          mutationKind: changed ? "graph" : null,
          error: changed ? null : "The new graph version could not be verified.",
          details: result,
        });
      } finally {
        setBusy(false);
      }
    }
    if (plan.kind === "switch_route") {
      agentActions.switchInputFormat(plan.formatId);
      const verified = await verify({ type: "fmt", expected: plan.formatId });
      append("agent", verified ? plan.message : "I could not verify that the requested input route became active.", verified ? "status" : "error");
      return executionOutcome({ ok: Boolean(verified), outcome: verified ? "navigation_updated" : "failed", navigationChanged: Boolean(verified) });
    }
    if (plan.kind === "switch_section" || plan.kind === "show_stats") {
      (agentActions.navigateToDashboardSection ?? agentActions.setActiveSection)(plan.sectionId);
      const verified = await verify({ type: "section", expected: plan.sectionId });
      append("agent", verified ? plan.message : "I could not verify that the requested dashboard section became active.", verified ? "status" : "error");
      return executionOutcome({ ok: Boolean(verified), outcome: verified ? "navigation_updated" : "failed", navigationChanged: Boolean(verified) });
    }
    if (plan.kind === "set_visual_limit") {
      agentActions.setVisualLimit(plan.value);
      const verified = await verify({ type: "visual_limit", expected: plan.value });
      append("agent", verified ? plan.message : "I could not verify the visualization limit change.", verified ? "status" : "error");
      return executionOutcome({ ok: Boolean(verified), outcome: verified ? "navigation_updated" : "failed", navigationChanged: Boolean(verified) });
    }
    if (plan.kind === "select_export_preview") {
      if (agentActions.navigateToExport) agentActions.navigateToExport(plan.exportId);
      else {
        agentActions.selectExportPreview(plan.exportId);
        agentActions.setActiveSection("export");
      }
      const verified = await verify({ type: "export", expected: plan.exportId });
      append("agent", verified ? plan.message : "I could not verify the requested export preview selection.", verified ? "status" : "error");
      return executionOutcome({ ok: Boolean(verified), outcome: verified ? "navigation_updated" : "failed", navigationChanged: Boolean(verified) });
    }
    if (plan.kind === "set_graph_view") {
      const result = agentActions.setGraphView(plan.viewMode);
      const verified = result.ok && await verify({ type: "graph_view", expected: plan.viewMode });
      append("agent", verified ? plan.message : `I could not verify the graph view change. ${result.error ?? ""}`, verified ? "status" : "error");
      return executionOutcome({ ok: Boolean(verified), outcome: verified ? "navigation_updated" : "failed", navigationChanged: Boolean(verified) });
    }
    if (plan.kind === "set_graph_layout") {
      const result = agentActions.setGraphLayout(plan.layout);
      const verified = result.ok && await verify({ type: "graph_layout", expected: plan.layout });
      append("agent", verified ? plan.message : `I could not verify the graph layout change. ${result.error ?? ""}`, verified ? "status" : "error");
      return executionOutcome({ ok: Boolean(verified), outcome: verified ? "navigation_updated" : "failed", navigationChanged: Boolean(verified) });
    }
    if (plan.kind === "search_graph_vertex") {
      const result = agentActions.searchGraphVertex(plan.query);
      const verified = result.ok && await verify({ type: "graph_search", expected: plan.query });
      append("agent", verified ? plan.message : `I could not verify the graph search update. ${result.error ?? ""}`, verified ? "status" : "error");
      return executionOutcome({ ok: Boolean(verified), outcome: verified ? "navigation_updated" : "failed", navigationChanged: Boolean(verified) });
    }
    if (plan.kind === "reset_graph_view") {
      const result = agentActions.resetGraphView();
      append("agent", result.ok ? plan.message : `I could not reset the graph view. ${result.error ?? ""}`, result.ok ? "status" : "error");
      return executionOutcome({ ok: Boolean(result.ok), outcome: result.ok ? "navigation_updated" : "failed", navigationChanged: Boolean(result.ok) });
    }
    if (plan.kind === "reheat_graph") {
      const result = agentActions.reheatGraph();
      append("agent", result.ok ? plan.message : `I could not reheat the graph layout. ${result.error ?? ""}`, result.ok ? "status" : "error");
      return executionOutcome({ ok: Boolean(result.ok), outcome: result.ok ? "navigation_updated" : "failed", navigationChanged: Boolean(result.ok) });
    }
    if (plan.kind === "copy_ai_prompt") {
      const result = await agentActions.copyAiPrompt(plan.targetExportId ?? "canonical");
      append("agent", result.ok ? plan.message : `I could not copy the prompt automatically. ${result.error ?? "Open the AI Prompt route and copy it manually."}`, result.ok ? "status" : "warning");
      return executionOutcome({ ok: Boolean(result.ok), outcome: "copied" });
    }
    if (plan.kind === "show_result_summary") {
      const summary = buildGraphResultSummaryMessage(latestStateRef.current);
      append("agent", summary.text, latestStateRef.current.hasGraph ? "status" : "warning", summary.actions);
      return executionOutcome({ ok: true, outcome: "responded" });
    }
    if (plan.kind === "scroll_visualization") {
      const didScroll = agentActions.scrollToVisualization();
      append("agent", didScroll ? plan.message : "The graph preview is not available yet. Convert an input first.");
      return executionOutcome({ ok: Boolean(didScroll), outcome: didScroll ? "navigation_updated" : "failed", navigationChanged: Boolean(didScroll) });
    }
    return executionOutcome({ ok: false, outcome: "unhandled_plan" });
  }

  async function dispatchOllamaActionPlan(actionPlan, originalQuery = "") {
    const actions = actionPlan.actions ?? [];
    if (actionPlan.needsClarification) {
      const question = actionPlan.clarifyingQuestion
        ?? actions.find(action => action.type === "ASK_CLARIFICATION")?.question
        ?? "Could you clarify what you want me to do next?";
      append("agent", question, "warning");
      return executionOutcome({ ok: false, outcome: "clarification" });
    }

    // A model ActionPlan is never an authorization source. Every non-response
    // action must be backed by a positive executable clause in the original
    // user request before any legacy capability handler is reached.
    const requestAuthorization = analyzePositiveAuthorization(originalQuery);
    const actionPlans = actions.map(action => planFromCapabilityAction(action, latestStateRef.current));
    const unauthorizedModelAction = actionPlans.find(plan => plan?.kind && plan.kind !== "respond"
      && !authorizationAllowsSideEffect(requestAuthorization, sideEffectScopeForAgentPlan(plan)).allowed);
    if (unauthorizedModelAction) {
      append("agent", "I treated the local model plan as read-only because the request did not positively authorize that state-changing action. No model-planned action was executed.", "status");
      return executionOutcome({
        ok: false,
        outcome: "authorization_blocked",
        stateMutationCommitted: false,
        details: { authorizationDecision: requestAuthorization.mode === "clarify" ? "clarification_required" : "read_only_blocked" },
      });
    }

    const childOutcomes = [];
    let changedState = false;
    let stateMutationCommitted = false;
    let navigationChanged = false;
    let filePickerOpened = false;
    for (const action of actions) {
      const current = latestStateRef.current;
      let enrichedAction = action;
      if (action.type === "AUTO_DETECT_ACTIVE_BATCH") {
        enrichedAction = { ...action, exportId: action.exportId ?? actionPlan.target?.exportId ?? null };
      } else if (action.type === "OPEN_CUSTOM_PARSER" && !action.exportId && actionPlan.target?.exportId) {
        enrichedAction = { ...action, exportId: actionPlan.target.exportId, userIntent: originalQuery };
      }
      const legacyPlan = planFromCapabilityAction(enrichedAction, current);
      if (capabilityRequiresConfirmation(enrichedAction.type, current)) {
        if (legacyPlan.kind === "respond") {
          const child = await dispatchPlan(legacyPlan);
          childOutcomes.push(child);
          return executionOutcome({ ...child, details: { actionPlan, childOutcomes } });
        }
        const actionType = legacyPlan.kind === "parse_current_input"
          ? "parse_current_input"
          : confirmationActionTypeForCapability(enrichedAction.type);
        const copy = getConfirmationCopy(actionType);
        setPendingAction({
          ...copy,
          ...legacyPlan,
          kind: "confirmation",
          actionType,
          exportId: legacyPlan.exportId ?? enrichedAction.exportId ?? enrichedAction.exportPreview ?? current.expId,
          graphPng: enrichedAction.type === "EXPORT_GRAPH_PNG",
          formatId: legacyPlan.formatId ?? enrichedAction.inputRoute ?? enrichedAction.route ?? enrichedAction.formatId ?? current.agentDetection?.formatId,
          confirmationToken: createConfirmationSnapshot(actionType, current),
        });
        append("agent", "I staged the next ActionPlan step for confirmation and stopped before making that change.", "warning");
        return executionOutcome({
          outcome: "staged_confirmation",
          confirmationStaged: true,
          changedState,
          stateMutationCommitted,
          navigationChanged,
          filePickerOpened,
          details: { actionPlan, childOutcomes, stagedAction: enrichedAction },
        });
      }
      const child = await dispatchPlan(legacyPlan);
      childOutcomes.push(child);
      changedState ||= Boolean(child?.changedState);
      stateMutationCommitted ||= Boolean(child?.stateMutationCommitted);
      navigationChanged ||= Boolean(child?.navigationChanged);
      filePickerOpened ||= Boolean(child?.filePickerOpened);
      if (child?.ok === false) {
        return executionOutcome({
          ok: false,
          outcome: child.outcome ?? "failed",
          changedState,
          stateMutationCommitted,
          navigationChanged,
          filePickerOpened,
          error: child.error,
          details: { actionPlan, childOutcomes },
        });
      }
      if (legacyPlan.kind === "respond" && action.type === "ASK_CLARIFICATION") {
        return executionOutcome({
          ok: false,
          outcome: "clarification",
          changedState,
          stateMutationCommitted,
          navigationChanged,
          filePickerOpened,
          details: { actionPlan, childOutcomes },
        });
      }
    }
    return executionOutcome({
      ok: true,
      outcome: actions.length ? "action_plan_completed" : "no_action",
      changedState,
      stateMutationCommitted,
      navigationChanged,
      filePickerOpened,
      details: { actionPlan, childOutcomes },
    });
  }

  function buildPanelSessionContext(query, pending = pendingAction) {
    const current = latestStateRef.current;
    return {
      conversation: [
        ...conversationMemory.recentTurns,
        { role: "user", text: query },
      ],
      sessionSummary: conversationMemory.summary,
      activeBatch: current.activeBatch,
      graphSummary: current.resultSummary ?? (current.hasGraph ? {
        hyperedges: current.hyperedgeCount,
        vertices: current.vertexCount,
        incidences: current.incidenceCount,
      } : null),
      pendingAction: pending,
      selectedInputRoute: current.formatLabel,
      activeSection: current.activeSection,
      mappingStatus: current.activeBatch?.mappingSpecStatus ?? "none",
      customParserStatus: [
        current.customRunning ? "running" : "",
        current.customErr ? `error: ${current.customErr}` : "",
        current.customResultCount ? `validated preview: ${current.customResultCount} hyperedges` : "",
        current.customCodeExists ? `code source: ${current.customCodeSource}` : "no parser code",
      ].filter(Boolean).join("; "),
      modelStatus: {
        runtime: "ollama",
        transport: current.localModel?.config?.activeTransport ?? null,
        model: current.localModel?.config?.model ?? "",
        status: current.localModel?.status ?? "disconnected",
        message: current.localModel?.message ?? "",
      },
    };
  }

  async function maybeSummarizeConversation(nextMemory) {
    if (!shouldSummarizeConversation(nextMemory) || typeof agentActions.summarizeLocalConversation !== "function") return nextMemory;
    const current = latestStateRef.current;
    const result = await agentActions.summarizeLocalConversation(nextMemory.recentTurns, {
      sessionSummary: nextMemory.summary,
      activeBatch: current.activeBatch,
      graphSummary: current.resultSummary,
      selectedInputRoute: current.formatLabel,
      activeSection: current.activeSection,
      mappingStatus: current.activeBatch?.mappingSpecStatus ?? "none",
      modelStatus: {
        runtime: "ollama",
        transport: current.localModel?.config?.activeTransport ?? null,
        model: current.localModel?.config?.model ?? "",
        status: current.localModel?.status ?? "disconnected",
        message: current.localModel?.message ?? "",
      },
    });
    if (!result.ok) return nextMemory;
    const summarized = applyConversationSummary(nextMemory, result.data, current.activeBatch);
    setConversationMemory(summarized);
    return summarized;
  }

  async function rememberConversationExchange(userText, assistantText) {
    const current = latestStateRef.current;
    const nextMemory = appendConversationTurns(conversationMemory, [
      { role: "user", text: userText },
      { role: "agent", text: assistantText },
    ], current.activeBatch);
    setConversationMemory(nextMemory);
    await maybeSummarizeConversation(nextMemory);
  }

  function conversationSetupMessage(current) {
    if (current.localModel?.config?.enabled === false) {
      return "I can still run deterministic dashboard commands, but natural conversation needs the local Ollama assistant. Open Assistant Settings and click Connect when Ollama is running.";
    }
    if (!current.localModel?.config?.model?.trim()) {
      return `Select one global local model before natural chat. Recommended: ${RECOMMENDED_OLLAMA_MODEL}.`;
    }
    return "Natural conversation is available after the local assistant connects. Deterministic commands like “Use CSR route,” “Show graph stats,” and “Export as CSR CSV” still work.";
  }

  async function runConversationPath(query, pending = null) {
    const current = latestStateRef.current;
    const canUseConversation = current.localModel?.status === "connected"
      && current.localModel?.config?.enabled !== false
      && current.localModel?.config?.runtime === "ollama"
      && Boolean(current.localModel?.config?.activeBaseUrl)
      && Boolean(current.localModel?.config?.model?.trim())
      && typeof agentActions.runLocalConversation === "function";
    if (!canUseConversation) {
      append("agent", conversationSetupMessage(current), "warning", [STATUS_ACTIONS.openSettings, STATUS_ACTIONS.deterministicHelp]);
      return;
    }

    const assistant = append("agent", "", "streaming");
    streamingMessageIdRef.current = assistant.id;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    let streamedText = "";
    setBusy(true);
    setStreaming(true);
    setTransientStatus("Generating conversational reply…");
    try {
      const result = await agentActions.runLocalConversation(query, buildPanelSessionContext(query, pending), {
        signal: controller.signal,
        onToken: chunk => {
          streamedText += chunk;
          updateMessage(assistant.id, message => ({ ...message, text: streamedText, tone: "streaming" }));
        },
      });
      if (result.ok) {
        const finalText = (result.text || streamedText || "I generated a response, but no text was returned.").trim();
        updateMessage(assistant.id, { text: finalText, tone: "" });
        await rememberConversationExchange(query, finalText);
        return;
      }
      if (result.aborted) {
        const partial = streamedText.trim()
          ? `${streamedText.trim()}\n\n[Interrupted — partial answer kept.]`
          : "Stopped before the model returned a visible answer.";
        updateMessage(assistant.id, { text: partial, tone: "warning" });
        await rememberConversationExchange(query, partial);
        return;
      }
      updateMessage(assistant.id, {
        text: `${result.error || "The conversational reply failed."}${result.suggestedFix ? `\n\n${result.suggestedFix}` : ""}`,
        tone: "error",
        actions: [
          { id: `retry-${assistant.id}`, label: "Retry", command: query },
          STATUS_ACTIONS.openDiagnostics,
          STATUS_ACTIONS.deterministicHelp,
        ],
      });
    } catch (error) {
      const stopped = controller.signal.aborted;
      const text = stopped
        ? `${streamedText.trim() || "Stopped before the model returned a visible answer."}\n\n[Interrupted — partial answer kept.]`
        : `The conversational reply failed. ${error instanceof Error ? error.message : String(error)}`;
      updateMessage(assistant.id, {
        text,
        tone: stopped ? "warning" : "error",
        actions: stopped ? [] : [
          { id: `retry-${assistant.id}`, label: "Retry", command: query },
          STATUS_ACTIONS.openDiagnostics,
          STATUS_ACTIONS.deterministicHelp,
        ],
      });
      if (stopped) await rememberConversationExchange(query, text);
    } finally {
      setBusy(false);
      setStreaming(false);
      setTransientStatus("");
      abortControllerRef.current = null;
      streamingMessageIdRef.current = null;
    }
  }

  function currentReactObservation(lastToolResult = null) {
    return buildAuthoritativeOrchestratorObservation({
      state: latestStateRef.current,
      threadId: "main",
      threadSummary: conversationMemory.summary,
      pendingConfirmation: pendingAction,
      lastToolResult,
      restoredWorkspace: persistence.restoredWorkspace,
    });
  }

  function capabilityActionPlan(action, argumentsValue, query) {
    return {
      actions: [{
        type: action,
        ...argumentsValue,
        requiresConfirmation: capabilityRequiresConfirmation(action, latestStateRef.current),
        reason: "One validated ReAct proposal delegated to the existing typed dispatcher.",
        userIntent: query,
      }],
      needsClarification: false,
      clarifyingQuestion: null,
    };
  }

  function authorizeReactAction({ action, arguments: argumentsValue, userQuery }) {
    const semantics = analyzeRequestSemantics(userQuery);
    if (requestMustRemainReadOnly(userQuery, semantics)) {
      return { allowed: false, reason: "The request is read-only, quoted, hypothetical, or negated." };
    }
    if (action === START_CUSTOM_PARSER_WORKFLOW) {
      const isWorkflowClause = text => /\b(convert|parse|process|generate|create|write|build)\b/i.test(text)
        && /\b(file|files|upload|dataset|data|parser|graph|these|this)\b/i.test(text);
      const deniedWorkflowClause = semantics.authorization?.deniedClauses?.some(clause => clause.scopes?.denied && isWorkflowClause(clause.text));
      const explicitWorkflowRequest = isWorkflowClause(userQuery) && !deniedWorkflowClause;
      return semantics.safeWorkflowPreparation || explicitWorkflowRequest
        ? { allowed: true }
        : { allowed: false, reason: "The request did not positively authorize parser workflow preparation." };
    }
    const plan = planFromCapabilityAction({ type: action, ...argumentsValue }, latestStateRef.current);
    const decision = authorizationAllowsSideEffect(analyzePositiveAuthorization(userQuery), sideEffectScopeForAgentPlan(plan));
    return decision.allowed ? { allowed: true } : { allowed: false, reason: "The exact positive request did not authorize the proposed capability." };
  }

  async function executeReactCapability({ action, arguments: argumentsValue }, query) {
    if (action === START_CUSTOM_PARSER_WORKFLOW) {
      const result = await agentActions.requestParserSpecialist("Generate custom parser");
      append("agent", result.message ?? result.error ?? "The Custom Parser Specialist stopped without a result.", result.ok ? "status" : "error");
      return executionOutcome({
        ok: Boolean(result.ok),
        outcome: result.ok ? "custom_parser_ready_for_review" : "custom_parser_generation_failed",
        changedState: Boolean(result.ok),
        mutationKind: result.ok ? "parser_draft" : null,
        error: result.ok ? null : result.error,
        details: result,
        stop: true,
      });
    }
    const result = await dispatchOllamaActionPlan(capabilityActionPlan(action, argumentsValue, query), query);
    // Typed dispatch may commit through App state before the new props reach
    // latestStateRef. Let that authoritative render settle before ReAct observes
    // the next step; confirmation actions stop at this boundary regardless.
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return result;
  }

  async function runReactActionPath(query) {
    const result = await runBoundedOrchestrator({
      userQuery: query,
      getObservation: lastToolResult => currentReactObservation(lastToolResult),
      callModel: request => agentActions.runReactOrchestratorStep({
        ...request,
        threadContext: {
          summary: conversationMemory.summary,
          recentTurns: messages.slice(-8),
        },
      }),
      authorizeAction: authorizeReactAction,
      executeAction: step => executeReactCapability(step, query),
      stageConfirmation: step => executeReactCapability(step, query),
      fallback: async ({ reason }) => {
        append("agent", `The bounded ReAct proposal was unavailable or invalid, so I used the existing deterministic planner. No unvalidated model action was executed. ${reason}`, "warning");
        return dispatchOllamaActionPlan(buildDeterministicActionPlan(query, latestStateRef.current), query);
      },
    });
    if (result.continuation) {
      reactContinuationRef.current = result.continuation;
      setReactContinuationState(result.continuation);
    }
    if (result.outcome === "request_user_input" && result.userMessage) append("agent", result.userMessage, "warning");
    else if (result.outcome === "final_response" && result.userMessage) append("agent", result.userMessage);
    else if (["max_steps_reached", "repeated_action_blocked", "authorization_blocked", "invalid_step", "model_unavailable"].includes(result.outcome)) {
      append("agent", result.error ?? "The bounded assistant stopped safely without performing another action.", result.outcome === "authorization_blocked" ? "status" : "warning");
    }
    return result;
  }

  async function resumeReactContinuationIfReady() {
    const continuation = reactContinuationRef.current;
    if (!continuation) return false;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const current = latestStateRef.current;
    if (continuation.datasetId !== current.activeBatchId) {
      reactContinuationRef.current = null;
      setReactContinuationState(null);
      append("agent", "I discarded the prior ReAct continuation because the active dataset changed.", "warning");
      return false;
    }
    if (!["together", "separate"].includes(current.activeBatch?.parseMode)) return false;
    reactContinuationRef.current = null;
    setReactContinuationState(null);
    return Boolean(await runReactActionPath(continuation.originalQuery));
  }

  function shouldEnterReactBeforeBroadRouting(query, state = latestStateRef.current) {
    if (!(state.reactOrchestratorEnabled ?? reactOrchestratorEnabled())) return false;
    if (typeof agentActions.runReactOrchestratorStep !== "function") return false;
    if (!state.agentFileCount || state.agentDetection?.formatId !== "custom") return false;
    const semantics = analyzeRequestSemantics(query);
    if (requestMustRemainReadOnly(query, semantics)) return false;
    return /\b(convert|parse|process|analy[sz]e)\b/i.test(query)
      && /\b(this|these|file|files|upload|uploads|dataset|data|graph)\b/i.test(query);
  }

  function reactGroupingDecision(query) {
    const value = String(query ?? "").trim();
    if (/^(?:yes[, ]+)?(?:they (?:are|belong)|these files (?:are|belong))?\s*(?:all\s+)?(?:one|the same)\s+(?:graph|dataset)[.!]?$/i.test(value)
      || /^(?:parse|treat|use|keep) (?:them|these files|all files) together(?: as (?:one|a single) (?:graph|dataset))?[.!]?$/i.test(value)) return "together";
    if (/^(?:no[, ]+)?(?:they (?:are|belong))?\s*(?:separate|different)\s+(?:graphs|datasets)[.!]?$/i.test(value)
      || /^(?:parse|treat|use|keep) (?:them|these files|each file) separately?[.!]?$/i.test(value)) return "separate";
    return null;
  }

  async function executeActionPath(query, controlPlan = null) {
    const current = latestStateRef.current;
    const requestAuthorization = analyzePositiveAuthorization(query);
    if (controlPlan) {
      if (controlPlan.kind !== "respond"
        && !authorizationAllowsSideEffect(requestAuthorization, sideEffectScopeForAgentPlan(controlPlan)).allowed) {
        append("agent", "I treated that request as read-only and did not execute the state-changing dashboard action. Please give one clear executable instruction if you want it performed.", "status");
        return executionOutcome({ ok: false, outcome: "authorization_blocked", stateMutationCommitted: false });
      }
      return await dispatchPlan(controlPlan);
    }
    const canUseOllamaOrchestrator = current.localModel?.config?.enabled !== false
      && current.localModel?.config?.runtime === "ollama"
      && current.localModel?.status === "connected"
      && Boolean(current.localModel?.config?.activeBaseUrl)
      && Boolean(current.localModel?.config?.model?.trim())
      && typeof agentActions.runOllamaOrchestrator === "function";
    const useReact = (current.reactOrchestratorEnabled ?? reactOrchestratorEnabled())
      && typeof agentActions.runReactOrchestratorStep === "function";
    if (useReact && canUseOllamaOrchestrator) return runReactActionPath(query);
    if (useReact && !canUseOllamaOrchestrator) {
      return dispatchOllamaActionPlan(buildDeterministicActionPlan(query, latestStateRef.current), query);
    }
    if (canUseOllamaOrchestrator) {
      setBusy(true);
      try {
        const result = await agentActions.runOllamaOrchestrator(query, messages.slice(-8));
        if (result.ok) {
          setBusy(false);
          return await dispatchOllamaActionPlan(result.plan, query);
        }
        append("agent", "The local model ActionPlan was invalid, so I used the deterministic route planner instead. No model-planned action was executed.", "warning");
      } catch (error) {
        append("agent", `Ollama action planning failed before dispatch, so I used the deterministic route planner instead. ${error instanceof Error ? error.message : String(error)}`, "warning");
      } finally {
        setBusy(false);
      }
    }
    return await dispatchOllamaActionPlan(
      buildDeterministicActionPlan(query, latestStateRef.current),
      query,
    );
  }

  function describeMutationPreview(result) {
    const preview = result.preview;
    if (!preview) return result.summary ?? "Graph mutation preview is ready.";
    const delta = preview.delta ?? {};
    const signed = value => Number(value) >= 0 ? `+${value}` : String(value);
    const ops = result.plan?.operations?.length ?? preview.operationCount ?? 0;
    const changed = preview.beforeFingerprint !== preview.afterFingerprint;
    const leading = result.pendingPlanReplaced
      ? "Understood — I discarded the earlier plan and prepared the revised change instead."
      : (result.acknowledgement || result.summary || preview.summary || "Graph mutation preview");
    return [
      `${leading} ${changed ? "Nothing has changed yet." : "The deterministic preview found no graph-content change."}`,
      `Preview: ${ops} operation${ops === 1 ? "" : "s"}; ${signed(delta.hyperedges ?? 0)} hyperedges, ${signed(delta.vertices ?? 0)} vertices, ${signed(delta.incidences ?? 0)} incidences.`,
      preview.warnings?.length ? `Warnings: ${preview.warnings.join(" ")}` : "",
      result.fallbackReason ? `I used the deterministic fallback because model planning failed: ${result.fallbackReason}` : "",
    ].filter(Boolean).join(" ");
  }

  function describeMutationNoop(result) {
    const warning = result.preview?.warnings?.[0] ?? "";
    const duplicate = warning.match(/Vertex "(.+?)" is already in hyperedge "(.+?)"/);
    if (duplicate) return `Vertex ${duplicate[1]} is already in ${duplicate[2]}, so there’s nothing to change.`;
    return [
      result.acknowledgement || "I checked that graph edit.",
      "The deterministic preview found no graph-content change, so I did not ask for confirmation.",
      warning ? `Warning: ${warning}` : "",
    ].filter(Boolean).join(" ");
  }

  function describePendingMutationImpact(action) {
    const preview = action?.preview;
    if (!preview) return "There is a pending graph edit, but no preview details are available. Confirm to apply it or cancel to leave the graph unchanged.";
    const delta = preview.delta ?? {};
    const signed = value => Number(value) >= 0 ? `+${value}` : String(value);
    return [
      `${action.plan?.summary ?? "Pending graph edit"} Nothing has changed yet.`,
      `If confirmed, this would change ${signed(delta.hyperedges ?? 0)} hyperedges, ${signed(delta.vertices ?? 0)} vertices, and ${signed(delta.incidences ?? 0)} incidences.`,
      preview.affected?.hyperedges?.length ? `Affected hyperedges: ${preview.affected.hyperedges.slice(0, 8).join(", ")}${preview.affected.hyperedges.length > 8 ? "…" : ""}.` : "",
      preview.affected?.vertices?.length ? `Affected vertices: ${preview.affected.vertices.slice(0, 10).join(", ")}${preview.affected.vertices.length > 10 ? "…" : ""}.` : "",
      preview.warnings?.length ? `Warnings: ${preview.warnings.join(" ")}` : "",
    ].filter(Boolean).join(" ");
  }

  function isPendingImpactQuestion(query) {
    return /\b(what will|what would|affect|impact|preview|show|explain|before i confirm)\b/i.test(query)
      && !/\b(add|remove|delete|rename|clear|undo|set|change|include|put|insert|detach|connect)\b/i.test(query);
  }

  function datasetMappingIntentContext(state = latestStateRef.current, pending = null) {
    const activeBatch = state.activeBatch ?? null;
    return {
      hasActiveBatch: Boolean(activeBatch),
      activeBatchId: activeBatch?.id ?? null,
      route: state.fmt,
      parseMode: activeBatch?.parseMode ?? "unknown",
      fileNames: activeBatch?.fileNames ?? [],
      profiledColumnsByFile: Object.fromEntries((activeBatch?.datasetProfile?.files ?? []).map(file => [
        file.fileName,
        (file.columns ?? []).map(column => column.name),
      ])),
      hasMappingSpec: Boolean(activeBatch?.mappingSpec),
      mappingSpecVersion: activeBatch?.mappingSpec?.version ?? null,
      mappingRevision: activeBatch?.mappingRevision ?? 0,
      groupingStatus: activeBatch?.groupingStatus ?? "none",
      pendingActionType: pending?.actionType ?? null,
    };
  }

  function rememberNluDiagnostic(nlu, diagnostics = {}) {
    const diagnostic = {
      plannerPath: diagnostics.plannerPath ?? "deterministic_nlu",
      authoritativeCompiler: diagnostics.authoritativeCompiler ?? "unknown",
      nluDomain: diagnostics.nluDomain ?? nlu?.primaryDomain ?? "unknown",
      nluIntent: diagnostics.nluIntent ?? nlu?.primaryIntent ?? "unknown",
      nluConfidence: diagnostics.semanticConfidence ?? diagnostics.nluConfidence ?? nlu?.confidence ?? null,
      nluTrace: diagnostics.nluTrace ?? nlu?.trace ?? null,
      analysisCount: diagnostics.analysisCount ?? null,
      compilationCount: diagnostics.compilationCount ?? null,
      modelCallCount: diagnostics.modelCallCount ?? null,
      genericActionPlannerCallCount: diagnostics.genericActionPlannerCallCount ?? null,
      legacyRawParserCallCount: diagnostics.legacyRawParserCallCount ?? null,
      rawControlClassifierCallCount: diagnostics.rawControlClassifierCallCount ?? null,
      mappingRecompileCount: diagnostics.mappingRecompileCount ?? null,
      graphRecompileCount: diagnostics.graphRecompileCount ?? null,
      dispatchPath: diagnostics.dispatchPath ?? diagnostics.plannerPath ?? "deterministic_nlu",
    };
    setLastNluDiagnostic(diagnostic);
    return diagnostic;
  }

  function mappingWorkflowIsAvailable(state = latestStateRef.current) {
    const activeBatch = state.activeBatch;
    if (!activeBatch) return false;
    return state.fmt === "custom"
      || activeBatch.detectedFormat?.formatId === "custom"
      || state.agentDetection?.formatId === "custom"
      || (activeBatch.fileNames?.length > 1 && ["together", "grouped", "unknown"].includes(activeBatch.parseMode));
  }

  function groundedMappingExplanation(query, state = latestStateRef.current) {
    const batch = state.activeBatch;
    const spec = batch?.mappingSpec ?? batch?.repairedMapping ?? batch?.deterministicDraftMapping ?? null;
    const q = String(query ?? "").toLowerCase();
    if (/\bempty hyperedge|empty hyperedges|no membership rows|unmatched\b/.test(q)) {
      return "Preserving empty hyperedges means rows in the hyperedge table remain in the output even when no membership rows point to them. For example, a paper in papers.csv with no authorship rows can still become an empty hyperedge instead of being dropped.";
    }
    if (/\bkey|paper_id|author_id\b/.test(q)) {
      const keyLines = (spec?.files ?? []).filter(file => file.keyColumns?.length)
        .map(file => `${file.fileName}: ${file.keyColumns.join(" + ")}`)
        .join("; ");
      return keyLines
        ? `A key is the column set used to identify records deterministically. In the active mapping: ${keyLines}. Candidate keys come from bounded profiling: exact headers, non-null coverage, uniqueness, and ID-like names.`
        : "A key is the column set used to identify records deterministically. I do not have an active mapping key yet, but I can infer one from the active file profiles.";
    }
    if (/\brelationship|join|infer|membership\b/.test(q)) {
      const relationships = (spec?.relationships ?? []).map(rel => `${rel.sourceFile}.${(rel.sourceColumns ?? []).join("+")} -> ${rel.targetFile}.${(rel.targetColumns ?? []).join("+")}; vertices from ${rel.vertexSourceFile}.${(rel.vertexColumns ?? []).join("+")}`);
      return relationships.length
        ? `The active mapping has ${relationships.length} relationship${relationships.length === 1 ? "" : "s"}: ${relationships.join("; ")}.`
        : `I have not stored a membership relationship yet. Active files are ${(batch?.fileNames ?? []).join(", ") || "none"}, and I can create one through a validated mapping patch.`;
    }
    return `I can explain the active DatasetMappingSpec without changing it. Active files: ${(batch?.fileNames ?? []).join(", ") || "none"}. Mapping revision: ${batch?.mappingRevision ?? 0}.`;
  }

  function groundedInterpretationSummary(state = latestStateRef.current) {
    const batch = state.activeBatch;
    const roles = (batch?.mappingSpec?.files ?? batch?.deterministicDraftMapping?.files ?? [])
      .filter(file => ["vertex_table", "hyperedge_table", "membership"].includes(file.role))
      .map(file => `${file.fileName}: ${file.role}${file.keyColumns?.length ? ` using ${file.keyColumns.join(" + ")}` : ""}`);
    if (roles.length) {
      return `Using the active profile evidence, the current grounded proposal is: ${roles.join("; ")}. This is only a reviewable mapping proposal until you apply a validated mapping patch; no parser code was run and the graph was not changed.`;
    }
    const files = (batch?.datasetProfile?.files ?? []).map(file => `${file.fileName} (${(file.columns ?? []).map(column => column.name).join(", ") || "no profiled headers"})`);
    return `I can use the active files without asking you to re-upload: ${files.join("; ") || "none"}. Tell me which file is vertices, which is hyperedges, and which contains memberships, or ask me to infer roles.`;
  }

  async function maybeHandleDatasetMapping(query, options = {}) {
    const state = latestStateRef.current;
    const context = datasetMappingIntentContext(state, options.pendingAction ?? null);
    if (!context.hasActiveBatch || !mappingWorkflowIsAvailable(state)) return false;
    const intent = classifyDatasetMappingIntent(query, context);
    if (intent.kind === "not_mapping") return false;
    if (options.pendingAction && intent.kind !== "mapping_question") {
      append("agent", "Cancel or complete the pending parser action before changing the mapping.", "warning");
      return true;
    }
    setWorkspacePanel("mapping");
    if (intent.kind === "mapping_question") {
      append("agent", groundedMappingExplanation(query, state), "status");
      return true;
    }
    if (intent.kind === "interpretation") {
      if (typeof agentActions.runDatasetInterpretationAssist === "function"
        && state.localModel?.status === "connected"
        && state.localModel?.config?.enabled !== false) {
        const result = await agentActions.runDatasetInterpretationAssist(query, { source: "chat" });
        append("agent", result.ok
          ? `${result.message} ${groundedInterpretationSummary(latestStateRef.current)}`
          : `${result.error ?? "The local interpretation planner did not finish."} ${groundedInterpretationSummary(state)}`, result.ok ? "status" : "warning");
      } else {
        append("agent", groundedInterpretationSummary(state), "status");
      }
      return true;
    }
    if (intent.kind === "explicit_patch" || intent.kind === "clarification_answer") {
      if (typeof agentActions.runDatasetMappingPatchAssist !== "function") return false;
      const previousVersion = state.batchVersion;
      const previousGraphVersion = state.graphVersion;
      const result = await agentActions.runDatasetMappingPatchAssist(query, {
        allowBootstrap: true,
        source: "chat",
      });
      const latestDiagnostic = latestStateRef.current.activeBatch?.mappingTurnDiagnostics?.at(-1) ?? result.diagnostics ?? null;
      if (latestDiagnostic?.selectedPlanner === "deterministic_nlu" || latestDiagnostic?.nluTrace) {
        rememberNluDiagnostic(options.nlu ?? null, latestDiagnostic);
      }
      if (!result.ok) {
        append("agent", `I could not safely apply that mapping request. ${result.error ?? "The typed patch validator rejected it."}`, "error");
        return true;
      }
      if (result.applied && !result.noChange) {
        const verified = await verify({ type: "batch_version", previous: previousVersion });
        const graphUnchanged = latestStateRef.current.graphVersion === previousGraphVersion;
        append("agent", verified && graphUnchanged
          ? result.message
          : "The mapping action returned, but I could not verify a fresh mapping revision with unchanged graph state.", verified && graphUnchanged ? "status" : "error");
        return true;
      }
      append("agent", result.message ?? result.clarification ?? "No mapping change was applied.", result.clarification ? "warning" : "status");
      return true;
    }
    return false;
  }

  async function handleCompiledDatasetMapping(prepared, query, options = {}) {
    const state = latestStateRef.current;
    const draft = prepared.compilation?.typedValue ?? prepared.compilation?.compiled?.draft ?? null;
    if (!draft) return { handled: false, outcome: "not_handled" };
    if (options.pendingAction && draft.classification !== "clarification") {
      append("agent", "Cancel or complete the pending parser action before changing the mapping.", "warning");
      return { handled: true, outcome: "clarification" };
    }
    if (!state.activeBatch || !mappingWorkflowIsAvailable(state)) {
      return { handled: false, outcome: "not_handled" };
    }
    if (typeof agentActions.runDatasetMappingPatchAssist !== "function") return { handled: false, outcome: "not_handled" };
    setWorkspacePanel("mapping");
    const previousVersion = state.batchVersion;
    const previousGraphVersion = state.graphVersion;
    const result = await agentActions.runDatasetMappingPatchAssist(query, {
      allowBootstrap: true,
      source: "chat",
      precompiledDraft: draft,
      precompiledDiagnostics: prepared.compilation?.diagnostics ?? {},
      semanticConfidence: prepared.compilation?.semanticConfidence,
      contextBinding: prepared.contextBinding,
      pendingAction: options.pendingAction ?? null,
      skipDeterministicRecompile: true,
    });
    const latestDiagnostic = latestStateRef.current.activeBatch?.mappingTurnDiagnostics?.at(-1) ?? result.diagnostics ?? null;
    rememberNluDiagnostic(prepared.nlu, {
      ...(latestDiagnostic ?? {}),
      ...runtimeDiagnosticsFromTrace(prepared.runtimeTrace),
      semanticConfidence: prepared.compilation?.semanticConfidence,
    });
    if (!result.ok) {
      append("agent", `I could not safely apply that mapping request. ${result.error ?? "The typed patch validator rejected it."}`, result.stale ? "warning" : "error");
      return { handled: true, outcome: result.stale ? "clarification" : "responded" };
    }
    if (result.applied && !result.noChange) {
      const verified = await verify({ type: "batch_version", previous: previousVersion });
      const graphUnchanged = latestStateRef.current.graphVersion === previousGraphVersion;
      append("agent", verified && graphUnchanged
        ? result.message
        : "The mapping action returned, but I could not verify a fresh mapping revision with unchanged graph state.", verified && graphUnchanged ? "status" : "error");
      return {
        handled: true,
        outcome: "applied_reversible_edit",
        stateMutationCommitted: verified && graphUnchanged,
        tracePatch: { mappingRecompileCount: 0, modelCalls: [] },
      };
    }
    append("agent", result.message ?? result.clarification ?? "No mapping change was applied.", result.clarification ? "warning" : "status");
    return { handled: true, outcome: result.clarification ? "clarification" : "responded", tracePatch: { mappingRecompileCount: 0, modelCalls: [] } };
  }

  async function handleCompiledGroundedQuestion(prepared) {
    const compiled = prepared.compilation?.compiled ?? {};
    const typed = prepared.compilation?.typedValue ?? {};
    rememberNluDiagnostic(prepared.nlu, {
      ...(compiled.diagnostics ?? {}),
      ...runtimeDiagnosticsFromTrace(prepared.runtimeTrace),
      semanticConfidence: prepared.compilation?.semanticConfidence,
    });
    if (compiled.intent === "explain_last_interpretation") {
      const latestMappingDiagnostic = latestStateRef.current.activeBatch?.mappingTurnDiagnostics?.at(-1) ?? null;
      append("agent", composeInterpretationTraceResponse(prepared.nlu, latestMappingDiagnostic ?? lastNluDiagnostic), "status");
      return { handled: true, outcome: "responded" };
    }
    if (compiled.intent === "workflow_status" || typed.intent === "workflow_status") {
      append("agent", composeParserWorkflowStatus(latestStateRef.current), "status");
      return { handled: true, outcome: "responded" };
    }
    if (compiled.blockedCompilation || typed.blockedSideEffect) {
      const topic = typed.topicDomain ?? compiled.diagnostics?.sourceDomain ?? prepared.compilation?.domain;
      const speechAct = prepared.compilation?.speechAct ?? prepared.nlu?.speechAct;
      const message = groundedSafetyAnswer(topic, prepared.nlu?.rawText, speechAct);
      append("agent", `${message}\n\nI treated this as a read-only question, so no mapping, parser, dashboard, or graph state was changed.`, "status");
      return {
        handled: true,
        outcome: "responded",
        tracePatch: { blockedSideEffect: typed.blockedSideEffect ?? compiled.blockedSideEffect ?? null },
      };
    }
    append("agent", composeParserWorkflowStatus(latestStateRef.current), "status");
    return { handled: true, outcome: "responded" };
  }

  async function handleCompiledHelpQuery(prepared, response) {
    rememberNluDiagnostic(prepared.nlu, {
      ...(prepared.compilation?.diagnostics ?? {}),
      ...runtimeDiagnosticsFromTrace(prepared.runtimeTrace),
      plannerPath: "typed_help_query",
      modelCallCount: 0,
      genericActionPlannerCallCount: 0,
      legacyRawParserCallCount: 0,
      semanticConfidence: prepared.compilation?.semanticConfidence,
    });
    append("agent", response?.text ?? "I found deterministic command help.", "status", response?.actions ?? []);
    return {
      handled: true,
      outcome: "responded",
      tracePatch: {
        modelCalls: [],
        genericActionPlannerCallCount: 0,
        legacyRawParserCallCount: 0,
        stateMutationCommitted: false,
      },
    };
  }

  function groundedSafetyAnswer(topic, query, speechAct) {
    const state = latestStateRef.current;
    if (topic === "dataset_mapping" || topic === "dataset_grouping") {
      const mapping = state.activeBatch?.mappingSpec;
      const relationships = mapping?.relationships ?? [];
      if (/authorship/i.test(query) && relationships.length) {
        const rel = relationships.find(item => item.type === "membership") ?? relationships[0];
        return `The active mapping uses ${rel.sourceFile ?? "the membership file"} to connect vertex identifiers in ${(rel.vertexColumns ?? []).join(", ") || "its vertex column"} with hyperedges referenced by ${(rel.sourceColumns ?? []).join(", ") || "its hyperedge column"}.`;
      }
      if (/validation/i.test(query)) {
        const validationFiles = (mapping?.files ?? []).filter(file => file.role === "validation_expected_output" || file.useAsInput === false).map(file => file.fileName);
        return validationFiles.length
          ? `${validationFiles.join(", ")} ${validationFiles.length === 1 ? "is" : "are"} currently marked as validation-only and excluded from parser input.`
          : "No active file is currently verified as validation-only.";
      }
      return mapping
        ? `The active mapping is revision ${state.activeBatch?.mappingRevision ?? 0}. I can explain its file roles, keys, relationships, and policies without changing it.`
        : "There is no accepted active mapping yet. I can explain the profiled files, but I will not create a mapping from an informational question.";
    }
    if (topic === "graph_mutation") {
      return speechAct === "hypothetical_question"
        ? "That change would be previewed against the current graph and would require confirmation before any committed graph update."
        : "I can explain the requested graph edit, but I will not stage or commit it from a read-only question.";
    }
    if (topic === "parser_workflow") {
      return "Parser generation, execution, and graph application are separate phases. Execution and application retain their confirmation boundaries.";
    }
    if (topic === "dashboard_control") {
      return `The current dashboard section is ${state.activeSection ?? "unknown"}. I did not navigate because the message was informational.`;
    }
    return "I interpreted the message as informational rather than as an instruction.";
  }

  async function handleCompiledDashboardControl(prepared, query) {
    const typed = prepared.compilation?.typedValue ?? {};
    const plan = resolveCanonicalControlPlan(typed.canonicalIntent ?? prepared.compilation?.compiled?.canonicalIntent, typed.slots ?? {}, latestStateRef.current);
    if (!plan) return { handled: false, outcome: "not_handled" };
    rememberNluDiagnostic(prepared.nlu, {
      ...(prepared.compilation?.diagnostics ?? {}),
      ...runtimeDiagnosticsFromTrace(prepared.runtimeTrace),
      plannerPath: "typed_dashboard_control",
      rawControlClassifierCallCount: 0,
      semanticConfidence: prepared.compilation?.semanticConfidence,
    });
    const execution = await executeActionPath(query, plan);
    return {
      handled: true,
      outcome: execution?.outcome ?? (plan.kind === "respond" ? "responded" : "completed"),
      confirmationStaged: Boolean(execution?.confirmationStaged),
      stateMutationCommitted: Boolean(execution?.stateMutationCommitted),
      tracePatch: { rawControlClassifierCallCount: 0 },
    };
  }

  async function handleCompiledLegacyAction(prepared, query) {
    const action = prepared.compilation?.typedValue ?? prepared.compilation?.compiled?.action ?? {};
    if (!action.intent) return { handled: false, outcome: "not_handled" };
    const plan = planAgentAction({
      intent: action.intent,
      normalized: String(query ?? "").toLowerCase(),
      batchNumber: action.batchNumber,
      modelName: action.modelName,
    }, deterministicRoutingState());
    const authority = validatePlannedAction(action, plan);
    if (!authority.ok) {
      append("agent", authority.message, "error");
      return {
        handled: true,
        outcome: "registry_authority_rejected",
        stateMutationCommitted: false,
        tracePatch: {
          registryAuthorityRejected: true,
          expectedHandlerKind: action.handlerKind,
          plannedHandlerKind: plan?.kind ?? null,
        },
      };
    }
    plan.registryAuthority = {
      registryId: action.registryId,
      handlerKind: action.handlerKind,
      sideEffect: action.sideEffect,
      confirmation: action.confirmation,
      requiredContext: action.requiredContext,
    };
    rememberNluDiagnostic(prepared.nlu, {
      ...(prepared.compilation?.diagnostics ?? {}),
      ...runtimeDiagnosticsFromTrace(prepared.runtimeTrace),
      plannerPath: "typed_legacy_action",
      rawControlClassifierCallCount: 0,
      genericActionPlannerCallCount: 0,
      semanticConfidence: prepared.compilation?.semanticConfidence,
    });
    const execution = await executeActionPath(query, plan);
    return {
      handled: true,
      outcome: execution?.outcome ?? (plan.kind === "confirmation" ? "staged_confirmation" : "responded"),
      confirmationStaged: Boolean(execution?.confirmationStaged),
      stateMutationCommitted: Boolean(execution?.stateMutationCommitted),
      tracePatch: {
        rawControlClassifierCallCount: 0,
        genericActionPlannerCallCount: 0,
        stateMutationCommitted: Boolean(execution?.stateMutationCommitted),
        navigationChanged: Boolean(execution?.navigationChanged),
        filePickerOpened: Boolean(execution?.filePickerOpened),
      },
    };
  }

  async function handleParserWorkflowOperation(operation, nlu) {
    const previousBatchVersion = latestStateRef.current.batchVersion;
    if (operation.type === "SHOW_WORKFLOW_STATUS") {
      append("agent", composeParserWorkflowStatus(latestStateRef.current), "status");
      return true;
    }
    if (operation.type === "GENERATE_TRANSFORMATION_PLAN") {
      if (typeof agentActions.generateTransformationPlanFromActiveMapping !== "function") {
        append("agent", "This build does not expose a plan-only generator yet.", "error");
        return true;
      }
      const result = agentActions.generateTransformationPlanFromActiveMapping();
      if (!result.ok) {
        append("agent", `I could not generate the transformation plan. ${result.error ?? ""}`, "error");
        return true;
      }
      const verified = await verify({ type: "batch_version", previous: previousBatchVersion });
      rememberNluDiagnostic(nlu, {
        plannerPath: "deterministic_nlu",
        nluDomain: "parser_workflow",
        nluIntent: "generate_transformation_plan",
        nluTrace: nlu.trace,
        nluConfidence: nlu.confidence,
      });
      append("agent", verified ? result.message : "The plan generator returned, but I could not verify updated batch state.", verified ? "status" : "error");
      return true;
    }
    if (operation.type === "GENERATE_PARSER_FROM_MAPPING") {
      if (typeof agentActions.generateParserFromActiveMapping !== "function") return false;
      const previousCodeVersion = latestStateRef.current.customCodeVersion;
      const result = agentActions.generateParserFromActiveMapping();
      if (!result.ok) {
        append("agent", `I could not generate the parser. ${result.error ?? ""}`, "error");
        return true;
      }
      const verified = await verify({ type: "custom_code_version", previous: previousCodeVersion });
      rememberNluDiagnostic(nlu, {
        plannerPath: "deterministic_nlu",
        nluDomain: "parser_workflow",
        nluIntent: "generate_parser",
        nluTrace: nlu.trace,
        nluConfidence: nlu.confidence,
      });
      append("agent", verified
        ? `${result.message ?? "Generated parser from the validated mapping."} It has not been run.`
        : "The parser generator returned, but I could not verify fresh parser code in Custom Parser Studio.", verified ? "status" : "error");
      return true;
    }
    if (operation.type === "RUN_CUSTOM_PARSER_CONFIRMATION") {
      const current = latestStateRef.current;
      if (!current.customCodeExists) {
        append("agent", "There is no parser code to run yet. Generate or paste parser code first.", "warning");
        return true;
      }
      const copy = getConfirmationCopy("run_custom_parser");
      setPendingAction({
        ...copy,
        kind: "confirmation",
        actionType: "run_custom_parser",
        confirmationToken: createConfirmationSnapshot("run_custom_parser", current),
      });
      rememberNluDiagnostic(nlu, {
        plannerPath: "deterministic_nlu",
        nluDomain: "parser_workflow",
        nluIntent: "run_parser_confirmation",
        nluTrace: nlu.trace,
        nluConfidence: nlu.confidence,
      });
      append("agent", "I staged parser execution for confirmation. No parser code has run yet.", "warning");
      return true;
    }
    if (operation.type === "APPLY_CUSTOM_PARSER_RESULT_CONFIRMATION") {
      const current = latestStateRef.current;
      if (!current.customResultId) {
        append("agent", "No validated parser result is available yet. Run the parser first, review its preview, then ask me to apply it.", "warning");
        return true;
      }
      const copy = getConfirmationCopy("apply_custom_parser_result");
      setPendingAction({
        ...copy,
        kind: "confirmation",
        actionType: "apply_custom_parser_result",
        confirmationToken: createConfirmationSnapshot("apply_custom_parser_result", current),
      });
      rememberNluDiagnostic(nlu, {
        plannerPath: "deterministic_nlu",
        nluDomain: "parser_workflow",
        nluIntent: "apply_parser_result_confirmation",
        nluTrace: nlu.trace,
        nluConfidence: nlu.confidence,
      });
      append("agent", "I staged parser-result application for confirmation. The graph has not changed.", "warning");
      return true;
    }
    return false;
  }

  async function handleCompiledParserWorkflow(prepared) {
    const compiled = prepared.compilation?.compiled ?? {};
    const nlu = prepared.nlu;
    if (!compiled.ok || compiled.noMatch) return { handled: false, outcome: "not_handled" };
    rememberNluDiagnostic(nlu, {
      ...compiled.diagnostics,
      ...runtimeDiagnosticsFromTrace(prepared.runtimeTrace),
    });
    setWorkspacePanel("mapping");
    for (const operation of compiled.operations) {
      const handled = await handleParserWorkflowOperation(operation, nlu);
      if (!handled) return { handled: false, outcome: "not_handled" };
      if (operation.type.endsWith("_CONFIRMATION")) return { handled: true, outcome: "staged_confirmation", confirmationStaged: true };
    }
    if (compiled.negatedRun && !compiled.operations.some(operation => operation.type === "RUN_CUSTOM_PARSER_CONFIRMATION")) {
      append("agent", "Noted — I did not run the parser.", "status");
    }
    return { handled: true, outcome: "responded" };
  }

  async function maybeHandleDeterministicNlu(query, options = {}) {
    if (typeof agentActions.compileDeterministicTurn !== "function") return false;
    const state = deterministicRoutingState();
    const prepared = agentActions.compileDeterministicTurn(query, {
      pendingAction: options.pendingAction ?? null,
      pendingContinuation,
    });
    const handlers = createProductionDeterministicHandlers({
      prepared,
      query,
      options,
      callbacks: {
        truncated: async () => {
          rememberNluDiagnostic(prepared.nlu, runtimeDiagnosticsFromTrace(prepared.runtimeTrace));
          append("agent", "That request is too large for one deterministic turn. Please split it into fewer than 5,000 characters or a smaller set of clauses.", "warning");
          return { handled: true, outcome: "responded" };
        },
        clarification: async (_prepared, _query, ambiguity) => {
          rememberNluDiagnostic(prepared.nlu, runtimeDiagnosticsFromTrace(prepared.runtimeTrace));
          const question = typeof ambiguity === "string" ? ambiguity : ambiguity?.question;
          append("agent", question ?? "I need one more verified detail before I can route that safely.", "warning");
          return { handled: true, outcome: "clarification" };
        },
        stale: async (_prepared, message) => {
          rememberNluDiagnostic(prepared.nlu, {
            ...runtimeDiagnosticsFromTrace(prepared.runtimeTrace),
            semanticConfidence: prepared.compilation?.semanticConfidence,
          });
          append("agent", message, "warning");
          return { handled: true, outcome: "clarification" };
        },
        contextMissing: async (_prepared, _query, context) => {
          rememberNluDiagnostic(prepared.nlu, {
            ...runtimeDiagnosticsFromTrace(prepared.runtimeTrace),
            semanticConfidence: prepared.compilation?.semanticConfidence,
            missingContext: context?.requirement ?? null,
          });
          append("agent", context?.message ?? "Required context is missing for that command.", "warning");
          return { handled: true, outcome: "clarification" };
        },
        blockedSideEffect: async (_prepared, _query, reason) => {
          append("agent", `I treated that as read-only and did not execute the blocked action${reason ? ` (${reason})` : ""}.`, "status");
          return { handled: true, outcome: "responded" };
        },
        groundedQuestion: handleCompiledGroundedQuestion,
        helpQuery: handleCompiledHelpQuery,
        datasetMapping: handleCompiledDatasetMapping,
        parserWorkflow: handleCompiledParserWorkflow,
        graphMutation: maybeStageGraphMutation,
        dashboardControl: handleCompiledDashboardControl,
        legacyAction: handleCompiledLegacyAction,
      },
    });
    const dispatch = await dispatchCompiledAction({
      prepared,
      query,
      state,
      pendingAction: options.pendingAction ?? null,
      handlers,
    });
    if (typeof agentActions.recordCompletedDeterministicTrace === "function") {
      agentActions.recordCompletedDeterministicTrace(dispatch.runtimeTrace);
    }
    if (dispatch.handled) {
      rememberNluDiagnostic(prepared.nlu, {
        ...(prepared.compilation?.diagnostics ?? {}),
        ...runtimeDiagnosticsFromTrace(dispatch.runtimeTrace),
        semanticConfidence: prepared.compilation?.semanticConfidence,
      });
      return true;
    }
    return false;
  }

  function graphTracePatchFromResult(result = {}) {
    const diagnostics = result.plannerDiagnostics ?? {};
    const modelCalls = Array.isArray(diagnostics.modelCalls)
      ? diagnostics.modelCalls
      : diagnostics.modelCalled
        ? [{ task: diagnostics.modelTask ?? "plan_graph_mutation", attemptCount: diagnostics.modelAttemptCount ?? 1 }]
        : [];
    return {
      modelCalls,
      graphRecompileCount: diagnostics.graphRecompileCount ?? (diagnostics.graphRecompiled ? 1 : 0),
      legacyRawParserCallCount: diagnostics.legacyParserCallCount ?? (diagnostics.legacyParserCalled ? 1 : 0),
      validatorCalls: diagnostics.validatorCalls ?? [],
      staleDispatchRejected: Boolean(diagnostics.staleBindingRejected || result.stale),
    };
  }

  async function maybeStageGraphMutation(query, options = {}) {
    const detailed = await stageGraphMutationDetailed(query, options);
    return options.returnDetails ? detailed : detailed.handled;
  }

  async function stageGraphMutationDetailed(query, options = {}) {
    if (typeof agentActions.prepareGraphMutation !== "function") {
      return { handled: false, outcome: "not_handled", tracePatch: {} };
    }
    const pending = options.pendingAction ?? null;
    const result = await agentActions.prepareGraphMutation(query, {
      pendingAction: pending,
      deterministicNlu: options.deterministicNlu ?? null,
      precompiledPlan: options.precompiledPlan ?? null,
      precompiledCompilation: options.precompiledCompilation ?? null,
      semanticConfidence: options.semanticConfidence ?? null,
      contextBinding: options.contextBinding ?? null,
      deterministicFirst: options.deterministicFirst === true,
      conversation: buildPanelSessionContext(query, pending).conversation,
    });
    const tracePatch = graphTracePatchFromResult(result);
    if (result.noMatch) return { handled: false, outcome: "not_handled", result, tracePatch };
    if (result.needsClarification) {
      if (pending && result.draft?.correction?.replacePendingPlan) {
        setPendingAction(null);
        append("agent", `I discarded the earlier pending graph edit. ${result.message}`, "warning");
      } else {
        append("agent", result.message, "warning");
      }
      return { handled: true, outcome: "clarification", result, tracePatch };
    }
    if (!result.ok) {
      if (pending && result.draft?.correction?.replacePendingPlan) setPendingAction(null);
      append("agent", `I could not stage that graph change. ${result.error ?? "The deterministic validator rejected it."}`, "error");
      return { handled: true, outcome: "responded", result, tracePatch };
    }
    if (result.graphChanged === false) {
      if (pending && (options.replacePending || result.pendingPlanReplaced)) setPendingAction(null);
      append("agent", describeMutationNoop(result), result.preview?.warnings?.length ? "warning" : "status");
      return { handled: true, outcome: "responded", result, tracePatch };
    }
    if (result.previewOnly) {
      if (pending && result.pendingPlanReplaced) setPendingAction(null);
      append("agent", describeMutationPreview(result), "status");
      return { handled: true, outcome: "responded", result, tracePatch };
    }
    // Prepared/model-assisted plans are proposals, never authorization. Bind
    // the exact staged operations back to the user's original positive clause
    // at the last UI boundary before a confirmation can be created.
    const preparedAuthorization = authorizeCompiledSideEffect({
      semantics: analyzeRequestSemantics(query),
      sideEffectClass: "graph_edit_preview",
      plan: result.plan,
      context: {
        domain: "graph_mutation",
        typedKind: "GraphMutationPlan",
        pendingOperations: pending?.plan?.operations ?? [],
        selectedEntity: latestStateRef.current.selectedGraphEntity ?? null,
        graphHyperedges: latestStateRef.current.graphHyperedges ?? [],
      },
    });
    if (!preparedAuthorization.allowed) {
      append("agent", "I treated that request as read-only because the prepared graph operations were not authorized by the exact positive instruction. No graph change was staged.", "status");
      return {
        handled: true,
        outcome: "authorization_blocked",
        result,
        tracePatch,
        stateMutationCommitted: false,
      };
    }
    const copy = getConfirmationCopy(result.plan?.operations?.[0]?.type === "UNDO_LAST_MUTATION" ? "undo_graph_mutation" : "apply_graph_mutation");
    setPendingAction({
      ...copy,
      kind: "confirmation",
      actionType: "apply_graph_mutation",
      plan: result.plan,
      preview: result.preview,
      plannerDiagnostics: result.plannerDiagnostics,
      confirmationToken: createConfirmationSnapshot("apply_graph_mutation", latestStateRef.current, {
        mutationPlan: result.plan,
        selectionFingerprint: result.plan?.metadata?.selectionFingerprint,
      }),
    });
    append("agent", describeMutationPreview(result), "warning");
    return { handled: true, outcome: "staged_confirmation", confirmationStaged: true, result, tracePatch };
  }

  async function maybeApplyMappingConversation(query) {
    if (typeof agentActions.applyMappingConversation !== "function") return false;
    const previousVersion = latestStateRef.current.batchVersion;
    const result = agentActions.applyMappingConversation(query);
    if (result.noMatch) return false;
    if (result.needsClarification) {
      append("agent", result.message, "warning");
      return true;
    }
    const verified = result.ok && await verify({ type: "batch_version", previous: previousVersion });
    append("agent", verified
      ? result.message
      : (result.error ?? "I could not safely apply that mapping guidance."), verified ? "status" : "error");
    return true;
  }

  async function submit(text = input) {
    if (persistence.status === "loading") return;
    const query = text.trim();
    if (!query) return;
    const semantics = analyzeRequestSemantics(query);
    const mayInterruptRuntime = semantics.readOnlyScope || semantics.directRuntimeStop;
    const coordinator = submissionCoordinatorRef.current;
    const started = coordinator.begin({
      kind: semantics.directRuntimeStop ? "runtime_stop" : (semantics.readOnlyScope ? "read_only" : "action"),
      allowConcurrent: mayInterruptRuntime,
      metadata: { queryLength: query.length },
    });
    if (!started.ok) {
      setTransientStatus(started.message);
      return;
    }
    if (latestStateRef.current.localModel?.request?.busy && !mayInterruptRuntime) {
      coordinator.finish(started.requestId);
      setTransientStatus("The local assistant is already working. Wait for it to finish or press Stop.");
      setBusy(false);
      return;
    }
    setBusy(true);
    try {
      await submitUnlocked(query);
    } finally {
      coordinator.finish(started.requestId);
      setBusy(false);
    }
  }

  async function submitUnlocked(query) {
    forceScrollRef.current = true;
    append("user", query);
    setInput("");
    const current = latestStateRef.current;

    if (pendingAction) {
      const mappingCandidate = isPlausibleDatasetMappingText(query, datasetMappingIntentContext(current, pendingAction));
      const graphMutationCandidate = pendingAction.actionType === "apply_graph_mutation"
        && isPlausibleGraphMutationText(query, { pendingAction });
      const pendingRoute = routePendingSubmission({
        query,
        pendingAction,
        mappingCandidate,
        graphMutationCandidate,
        impactQuestion: isPendingImpactQuestion(query),
      });

      if (pendingRoute.route === PENDING_ROUTE.DETERMINISTIC_CONTROL_OR_HELP) {
        if (await maybeHandleDeterministicNlu(query, { pendingAction })) return;
        append("agent", "I treated that as read-only and preserved the pending action, but I could not find a matching Help entry.", "warning");
        return;
      }
      if (pendingRoute.route === PENDING_ROUTE.DATASET_MAPPING) {
        if (await maybeHandleDeterministicNlu(query, { pendingAction })) return;
        await maybeHandleDatasetMapping(query, { pendingAction });
        return;
      }
      if (pendingRoute.route === PENDING_ROUTE.GRAPH_IMPACT) {
        append("agent", describePendingMutationImpact(pendingAction), "status");
        return;
      }
      if (pendingRoute.route === PENDING_ROUTE.GRAPH_REPLACEMENT) {
        if (await maybeHandleDeterministicNlu(query, { pendingAction, replacePending: true })) return;
      }
      const pendingGate = resolveConversationIntent(query, current, { pendingAction });
      if (pendingGate.mode === "conversation") {
        await runConversationPath(query, pendingAction);
        return;
      }
      append("agent", "Confirm or cancel the pending action before starting another operation.", "warning");
      return;
    }

    const continuation = reactContinuationRef.current;
    if (continuation && continuation.datasetId !== current.activeBatchId) {
      reactContinuationRef.current = null;
      setReactContinuationState(null);
      append("agent", "I discarded the prior ReAct continuation because the active dataset changed. No grouping or parser action was applied to the new dataset.", "warning");
      return;
    }
    const continuationGrouping = continuation ? reactGroupingDecision(query) : null;
    if (continuationGrouping) {
      if (currentReactObservation().stateVersionToken !== continuation.stateVersionToken) {
        reactContinuationRef.current = null;
        setReactContinuationState(null);
        append("agent", "I discarded the prior ReAct continuation because the dataset changed while grouping was unresolved. No grouping or parser action was applied.", "warning");
        return;
      }
      const result = await dispatchPlan({
        kind: "set_batch_parse_mode",
        mode: continuationGrouping,
        message: continuationGrouping === "together"
          ? "The active files are grouped as one graph dataset."
          : "The active files will use independent parser workflows as separate graph datasets.",
      });
      if (result.ok) await resumeReactContinuationIfReady();
      return;
    }

    if (isExplicitParserRequest(query) && agentActions.requestParserSpecialist) {
      const result = await agentActions.requestParserSpecialist(query);
      append("agent", result.message ?? result.error, result.ok ? "status" : "warning");
      return;
    }

    const specialistRequest = specialistConfirmationRequest(query, current);
    if (specialistRequest) {
      if (!specialistRequest.ready) append("agent", "Review a current parser draft or validated result before requesting this action.", "warning");
      else await dispatchPlan({ ...getConfirmationCopy(specialistRequest.actionType), kind: "confirmation", actionType: specialistRequest.actionType });
      return;
    }

    if (shouldEnterReactBeforeBroadRouting(query, current)) {
      await runReactActionPath(query);
      return;
    }

    if (await maybeHandleDeterministicNlu(query)) {
      await resumeReactContinuationIfReady();
      return;
    }

    if (await maybeHandleDatasetMapping(query)) {
      return;
    }

    if (await maybeApplyMappingConversation(query)) {
      return;
    }

    if (await maybeStageGraphMutation(query)) {
      return;
    }

    const controlPlan = resolveDeterministicControlPlan(query, current);
    if (controlPlan) {
      await executeActionPath(query, controlPlan);
      return;
    }

    const gate = resolveConversationIntent(query, current, { controlPlan });
    if (gate.mode === "conversation") {
      await runConversationPath(query);
      return;
    }
    if (gate.mode === "mixed") {
      append("agent", "I’ll answer the explanatory part briefly, then route only the actionable part through the validated dashboard controller. No action will bypass confirmation or verification.", "status");
      await executeActionPath(query);
      return;
    }
    await executeActionPath(query);
  }

  async function confirmPending({ allowWhileRouting = false } = {}) {
    if (!pendingAction || (busy && !allowWhileRouting)) return executionOutcome({ ok: false, outcome: "not_confirmed" });
    const action = pendingAction;
    let confirmed = false;
    let stateMutationCommitted = false;
    let confirmationOutcome = "failed";
    if (isConfirmationStale(action.confirmationToken, latestStateRef.current)) {
      setPendingAction(null);
      append("agent", "This confirmation is outdated because the active batch, mapping revision, parser code, parser result, graph identity, graph version, graph fingerprint, or selected entity changed. Please request the action again.", "warning");
      return executionOutcome({ ok: false, outcome: "stale_confirmation" });
    }
    if (action.plan && action.confirmationToken?.mutationPlanHash && action.plan.planHash !== action.confirmationToken.mutationPlanHash) {
      setPendingAction(null);
      append("agent", "This confirmation is outdated because the staged mutation plan changed. Please request the action again.", "warning");
      return executionOutcome({ ok: false, outcome: "stale_confirmation" });
    }
    setBusy(true);
    try {
      if (action.actionType === "run_custom_parser") {
        const result = await agentActions.runCustomParser();
        if (result.ok) {
          const verified = await verify({ type: "custom_result_id", expected: result.resultId });
          confirmed = Boolean(verified);
          stateMutationCommitted = Boolean(verified);
          confirmationOutcome = verified ? "parser_run_completed" : "verification_failed";
          append("agent", verified
            ? `Custom parser finished successfully. Verified a preview with ${result.hyperedgeCount.toLocaleString()} hyperedges; it has not been applied to the graph.${warningsText(result.suspiciousWarnings)}`
            : "The parser returned, but I could not verify a fresh normalized result ID in app state.", verified ? (result.suspiciousWarnings?.length ? "warning" : "status") : "error");
        } else {
          append("agent", `Custom parser failed: ${result.error || "No parser result was produced."}`, "error");
        }
      } else if (action.actionType === "apply_custom_parser_result") {
        const previousGraphVersion = latestStateRef.current.graphVersion;
        const result = agentActions.applyCustomParserResult();
        if (result.ok) {
          const changed = await verify({ type: "graph_version", previous: previousGraphVersion, hasGraph: true });
          const counted = changed && await verify({ type: "graph_count", expected: result.hyperedgeCount });
          append("agent", counted
            ? `Custom parser result applied. Verified that the graph now has ${result.hyperedgeCount.toLocaleString()} hyperedges.`
            : "The apply action returned, but I could not verify a new graph version with the expected count.", counted ? "status" : "error");
          confirmed = Boolean(counted);
          stateMutationCommitted = Boolean(counted);
          confirmationOutcome = counted ? "parser_result_applied" : "verification_failed";
          if (counted) await completeCustomParserPendingExport(result);
        } else {
          append("agent", `Parser result was not applied: ${result.error || "No validated parser preview is available."}`, "error");
        }
      } else if (action.actionType === "clear_graph") {
        const previousGraphVersion = latestStateRef.current.graphVersion;
        const result = agentActions.clearGraph();
        if (result.ok) {
          const verified = await verify({ type: "graph_version", previous: previousGraphVersion, hasGraph: false });
          confirmed = Boolean(verified);
          stateMutationCommitted = Boolean(verified);
          confirmationOutcome = verified ? "graph_cleared" : "verification_failed";
          append("agent", verified
            ? "Graph cleared. Verified that no parsed graph remains; input text, files, and upload batches were left in place."
            : "The clear action returned, but I could not verify a newer empty graph state.", verified ? "status" : "error");
        } else {
          append("agent", `The graph could not be cleared. ${result.error ?? ""}`, "error");
        }
      } else if (action.actionType === "parse_uploaded_files") {
        const parseOutcome = await executeUploadedParse(action.formatId, action.requestedExportId);
        confirmed = Boolean(parseOutcome?.ok);
        stateMutationCommitted = Boolean(parseOutcome?.stateMutationCommitted);
        confirmationOutcome = parseOutcome?.outcome ?? "failed";
      } else if (action.actionType === "parse_current_input") {
        const previousGraphVersion = latestStateRef.current.graphVersion;
        const result = await agentActions.parseCurrentInput();
        if (result.ok) {
          const changed = await verify({ type: "graph_version", previous: previousGraphVersion, hasGraph: true });
          confirmed = Boolean(changed);
          stateMutationCommitted = Boolean(changed);
          confirmationOutcome = changed ? "graph_parsed" : "verification_failed";
          append("agent", changed
            ? `Current input parsed after confirmation. Verified ${result.hyperedgeCount.toLocaleString()} hyperedges.`
            : "The parse action returned, but I could not verify a new graph version.", changed ? "status" : "error");
        } else {
          append("agent", `The current input could not be parsed. ${result.error ?? ""}`, "error");
        }
      } else if (action.actionType === "apply_batch_updates") {
        const previousGraphVersion = latestStateRef.current.graphVersion;
        const result = agentActions.applyBatchUpdates();
        if (result.ok) {
          const changed = result.graphChanged === false ? true : await verify({ type: "graph_version", previous: previousGraphVersion, hasGraph: true });
          confirmed = Boolean(changed);
          stateMutationCommitted = Boolean(changed && result.graphChanged !== false);
          confirmationOutcome = changed ? "batch_updates_applied" : "verification_failed";
          append("agent", changed
            ? `Batch updates committed to the canonical graph. ${result.updateCount.toLocaleString()} operation${result.updateCount === 1 ? "" : "s"} applied.`
            : "Batch updates returned successfully, but I could not verify the committed graph update.", changed ? "status" : "error");
        } else {
          append("agent", `Batch updates were not applied. ${result.error ?? ""}`, "error");
        }
      } else if (action.actionType === "apply_graph_mutation") {
        const previousGraphVersion = latestStateRef.current.graphVersion;
        const result = agentActions.commitGraphMutation(action.plan);
        if (result.ok) {
          if (result.graphChanged === false) {
            confirmed = true;
            stateMutationCommitted = false;
            confirmationOutcome = "graph_mutation_noop";
            append("agent", `The mutation was valid but did not change graph content. ${warningsText(result.warnings).trim()}`, result.warnings?.length ? "warning" : "status");
          } else {
            const changed = await verify({ type: "graph_version", previous: previousGraphVersion, hasGraph: result.hyperedgeCount > 0 });
            confirmed = Boolean(changed);
            stateMutationCommitted = Boolean(changed);
            confirmationOutcome = changed ? "graph_mutation_applied" : "verification_failed";
            append("agent", changed
              ? `Done — graph mutation applied and verified. Current graph: ${result.hyperedgeCount.toLocaleString()} hyperedges, ${result.vertexCount.toLocaleString()} vertices, ${result.incidenceCount.toLocaleString()} incidences.${warningsText(result.warnings)}`
              : "The graph mutation returned successfully, but I could not verify a newer graph version.", changed ? (result.warnings?.length ? "warning" : "status") : "error");
          }
        } else {
          append("agent", `Graph mutation was not applied. ${result.error ?? ""}`, "error");
        }
      } else if (action.actionType === "download_file") {
        const result = action.graphPng
          ? agentActions.exportGraphPng()
          : agentActions.downloadExport(action.exportId);
        confirmed = Boolean(result.ok);
        confirmationOutcome = result.ok ? "download_started" : "failed";
        append("agent", result.ok
          ? (action.graphPng ? "Graph PNG download started." : `Download started for ${result.filename ?? action.exportId}.`)
          : `Download was not started. ${result.error ?? ""}`, result.ok ? "status" : "error");
      } else if (action.actionType === "export_training_full_files") {
        const result = agentActions.exportParserTrainingExample(true);
        confirmed = Boolean(result.ok);
        confirmationOutcome = result.ok ? "training_exported" : "failed";
        append("agent", result.ok
          ? `Exported a local training example with full text from ${result.fileCount} active-batch file${result.fileCount === 1 ? "" : "s"}.`
          : `Training export failed: ${result.error}`, result.ok ? "status" : "error");
      } else if (action.actionType === "export_mapping_training_full_files") {
        const result = agentActions.exportMappingFineTuneExample(true);
        confirmed = Boolean(result.ok);
        confirmationOutcome = result.ok ? "mapping_training_exported" : "failed";
        append("agent", result.ok
          ? `Exported a mapping fine-tuning example with full text from ${result.fileCount} active-batch file${result.fileCount === 1 ? "" : "s"}.`
          : `Mapping fine-tuning export failed: ${result.error}`, result.ok ? "status" : "error");
      }
    } catch (error) {
      confirmationOutcome = "failed";
      append("agent", `Action failed: ${error instanceof Error ? error.message : String(error)}`, "error");
    } finally {
      setBusy(false);
      setPendingAction(null);
    }
    return executionOutcome({
      ok: confirmed,
      outcome: confirmationOutcome,
      stateMutationCommitted,
      details: { actionType: action.actionType },
    });
  }

  function cancelPending() {
    if (busy) return;
    setPendingAction(null);
    append("agent", "Action cancelled. No changes were made.", "status");
  }

  function clearChat() {
    if (busy) return;
    setMessages([WELCOME_MESSAGE]);
    setConversationMemory(bindConversationMemoryToBatch(EMPTY_CONVERSATION_MEMORY, latestStateRef.current.activeBatch));
    setPendingAction(null);
    setContinuation(null);
    expectedContinuationTransitionRef.current = null;
    resumingContinuationRef.current = false;
    setInput("");
    setTransientStatus("");
  }

  function exportTrainingExample() {
    if (busy || pendingAction) return;
    if (includeFullTrainingFiles) {
      setPendingAction({
        kind: "confirmation",
        actionType: "export_training_full_files",
        title: "Include full uploaded files?",
        message: "This training export will include the complete text of every file in the active batch. Confirm only if you intend to save that data locally.",
        confirmationToken: createConfirmationSnapshot("export_training_full_files", latestStateRef.current),
      });
      append("agent", "Full-file training export is staged but has not been created.", "warning");
      return;
    }
    const result = agentActions.exportParserTrainingExample(false);
    append("agent", result.ok
      ? `Exported a preview-only parser training example for ${result.fileCount} active-batch file${result.fileCount === 1 ? "" : "s"}.`
      : `Training export failed: ${result.error}`, result.ok ? "status" : "error");
  }

  function exportMappingTrainingExample() {
    if (busy || pendingAction) return;
    if (includeFullTrainingFiles) {
      setPendingAction({
        kind: "confirmation",
        actionType: "export_mapping_training_full_files",
        title: "Include full files in mapping example?",
        message: "This mapping fine-tuning export will include complete active-batch file text. Confirm only if you intend to save that data locally.",
        confirmationToken: createConfirmationSnapshot("export_mapping_training_full_files", latestStateRef.current),
      });
      append("agent", "Full-file mapping fine-tuning export is staged but has not been created.", "warning");
      return;
    }
    const result = agentActions.exportMappingFineTuneExample(false);
    append("agent", result.ok ? "Exported a preview-only mapping fine-tuning example." : result.error, result.ok ? "status" : "error");
  }

  async function copyDebug(kind) {
    const result = await agentActions.copyModelDebug(kind);
    append("agent", result.ok ? `Copied ${kind === "prompt" ? "the prompt summary" : "the raw model response"}.` : result.error, result.ok ? "status" : "error");
  }

  function exportDebug() {
    const result = agentActions.exportModelDebugExample();
    append("agent", result.ok ? "Exported a preview-only model debug example." : result.error, result.ok ? "status" : "error");
  }

  function applyMappingEditor() {
    const result = agentActions.applyEditedMappingSpec(mappingEditorRef.current?.value ?? "");
    append("agent", result.ok ? result.message : result.error, result.ok ? "status" : "error");
  }

  async function mappingAction(action, successMessage) {
    if (busy) return;
    setBusy(true);
    try {
      const result = await action();
      append("agent", result.ok ? (result.message ?? successMessage) : result.error, result.ok ? "status" : "error");
    } finally {
      setBusy(false);
    }
  }

  function saveMappingNotes() {
    const result = agentActions.setActiveMappingFeedback({ notes: mappingNotes });
    append("agent", result.ok ? "Mapping review notes saved with the active batch." : result.error, result.ok ? "status" : "error");
  }

  function insertCommandExample(text) {
    const next = String(text ?? "");
    if (!next.trim()) return false;
    if (input.trim() && input !== next) {
      const shouldReplace = typeof window === "undefined"
        ? false
        : window.confirm("Replace the unsent composer text with this example command?");
      if (!shouldReplace) return false;
    }
    setInput(next);
    window.requestAnimationFrame?.(() => {
      const composer = document.getElementById("hypergraph-agent-composer");
      composer?.focus();
      composer?.setSelectionRange?.(next.length, next.length);
    });
    setTransientStatus("Example inserted into the composer. It has not been sent.");
    return true;
  }

  async function handleMessageAction(action) {
    if (action.local === "settings" || action.local === "diagnostics" || action.local === "workspace" || action.local === "mapping" || action.local === "advanced" || action.local === "help") {
      setWorkspacePanel(action.local === "diagnostics" ? "advanced" : action.local);
      return;
    }
    if (action.insert) {
      insertCommandExample(action.insert);
      return;
    }
    if (busy || pendingAction) return;
    if (action.actionType) {
      await dispatchPlan(planFromResultSummaryAction(action, latestStateRef.current));
      return;
    }
    if (action.command) await submit(action.command);
  }

  function stopStreaming() {
    abortControllerRef.current?.abort();
    agentActions.stopLocalModelRequest?.();
    setTransientStatus("Stopping…");
  }

  const displayedFiles = agentState.agentFiles.slice(0, 10);
  const hiddenFileCount = Math.max(0, agentState.agentFileCount - displayedFiles.length);
  const activeTransport = agentState.localModel?.config?.activeTransport ?? null;
  const localModelConnected = agentState.localModel?.status === "connected";
  const localModelRequestActive = Boolean(agentState.localModel?.request?.busy);
  const runtimeBanner = agentState.localModel?.banner
    ?? (localModelConnected ? `${agentState.localModel?.config?.model || RECOMMENDED_OLLAMA_MODEL} connected · deterministic execution` : "Local assistant disconnected · deterministic controls available");

  return (
    <section className="agent-panel" aria-label="Hypergraph Assistant">
      <div className="agent-panel__header">
        <div>
          <div className="agent-panel__eyebrow agent-panel__eyebrow--current"><span className="agent-panel__dot" /> {runtimeBanner}</div>
          <h2>Hypergraph Assistant</h2>
          <p>Conversational guidance with deterministic execution.</p>
        </div>
        <button type="button" className="agent-clear" onClick={clearChat} disabled={busy}>Clear chat</button>
      </div>

      <div className="agent-panel__body">
        <div className="agent-conversation-layout">
          <div className="agent-chat-main">
            <div
              className="agent-history"
              ref={historyRef}
              role="log"
              aria-live="polite"
              aria-relevant="additions text"
              aria-label="Hypergraph Assistant conversation"
              onScroll={event => {
                const node = event.currentTarget;
                setShowJumpToLatest(node.scrollHeight - node.scrollTop - node.clientHeight > 160);
              }}
            >
              {messages.map(message => (
                <AgentMessage
                  key={message.id}
                  message={message}
                  busy={busy}
                  pendingAction={pendingAction}
                  onAction={handleMessageAction}
                />
              ))}
              {pendingAction && <AgentActionCard action={pendingAction} busy={busy} onConfirm={confirmPending} onCancel={cancelPending} />}
            </div>
            {showJumpToLatest && (
              <button
                type="button"
                className="agent-jump-latest"
                onClick={() => {
                  const node = historyRef.current;
                  if (node) node.scrollTop = node.scrollHeight;
                  setShowJumpToLatest(false);
                }}
              >
                Jump to latest
              </button>
            )}
            <div className="agent-status" role="status" aria-live="polite">
              {transientStatus || (busy ? "Working…" : "")}
            </div>
            <div className="agent-context-bar" aria-label="Current assistant context">
              <span>Route <strong>{agentState.formatLabel}</strong></span>
              <span>Section <strong>{agentState.activeSection}</strong></span>
              <span>Graph <strong>{agentState.hasGraph ? `${agentState.hyperedgeCount} H · ${agentState.vertexCount} V` : "none"}</strong></span>
              <span>Selection <strong>{agentState.selectionLabel || "none"}</strong></span>
              <span>Mapping <strong>{agentState.activeBatch?.mappingSpecStatus ?? "none"}</strong></span>
            </div>
            {agentState.selectionNotice && <div className="agent-selection-notice">{agentState.selectionNotice}</div>}
            <div role="status" className="agent-status">
              {persistence.error || (persistence.status === "loading" ? "Restoring saved thread…" : "Chat saved on this browser. Workspace references never grant execution permission.")}
            </div>
            {persistence.restoredWorkspace?.requiresReupload && !agentState.agentFileCount && <details className="agent-upload">
              <summary>Saved workspace requires re-upload</summary>
              <p>Re-upload {persistence.restoredWorkspace.files.map(file => file.name).join(", ")}. Saved parser and graph references are historical; no files or approvals were restored.</p>
              <p>Previous grouping: {persistence.restoredWorkspace.parseMode}</p>
              <button type="button" onClick={persistence.forgetWorkspace}>Forget saved workspace references</button>
              {persistence.restoredWorkspace.parser?.code && <pre style={{ maxHeight: 200, overflow: "auto" }}>{persistence.restoredWorkspace.parser.code}</pre>}
              {persistence.restoredWorkspace.workflow?.drafts?.map(draft => <details key={draft.id}><summary>Saved draft: {draft.fileNames.join(", ")}</summary><pre style={{ maxHeight: 200, overflow: "auto" }}>{draft.code}</pre></details>)}
            </details>}
            <CustomParserSpecialistPanel specialist={agentState.specialist} actions={agentActions} submit={submit} blocked={busy || Boolean(pendingAction) || persistence.status === "loading"} />
            {agentState.specialistReviewRequired && <div className="agent-file-actions">
              <button type="button" disabled={busy || Boolean(pendingAction)} onClick={() => submit("Run custom parser")}>Request parser run</button>
              <button type="button" disabled={busy || Boolean(pendingAction) || !agentState.customResultId} onClick={() => submit("Apply parser result")}>Request apply result</button>
            </div>}
            <AgentComposer
              disabled={persistence.status === "loading"}
              value={input}
              onChange={setInput}
              onSubmit={() => submit()}
              onStop={stopStreaming}
              busy={busy}
              streaming={streaming || localModelRequestActive}
              activeBatch={agentState.activeBatch}
              fileCount={agentState.agentFileCount}
            />
            {messages.length <= 1 && (
              <div className="agent-suggestions agent-suggestions--empty" aria-label="Conversation examples">
                {SUGGESTIONS.map(suggestion => (
                  <button key={suggestion} type="button" onClick={() => submit(suggestion)} disabled={busy || Boolean(pendingAction)}>
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
            <nav className="agent-quick-links" aria-label="Quick Links">
              <span className="agent-quick-links__label">Quick Links</span>
              <div className="agent-quick-links__items">
                {QUICK_LINKS.map(link => (
                  <button
                    key={link.label}
                    type="button"
                    onClick={() => submit(link.command)}
                    disabled={busy || Boolean(pendingAction)}
                  >
                    {link.label}
                  </button>
                ))}
              </div>
            </nav>
          </div>

          <aside className="agent-workspace-panel" aria-label="Assistant workspace and advanced tools">
            <div className="agent-workspace-tabs" role="tablist" aria-label="Assistant secondary panels">
              {WORKSPACE_TABS.map(([id, label]) => (
                <button
                  key={id}
                  id={workspaceTabId(id)}
                  type="button"
                  role="tab"
                  aria-selected={workspacePanel === id}
                  aria-controls={workspacePanelId(id)}
                  tabIndex={workspacePanel === id ? 0 : -1}
                  className={workspacePanel === id ? "agent-workspace-tabs__tab agent-workspace-tabs__tab--active" : "agent-workspace-tabs__tab"}
                  onClick={() => selectWorkspaceTab(id)}
                  onKeyDown={event => handleWorkspaceTabKeyDown(event, id)}
                >
                  {label}
                </button>
              ))}
            </div>

            {workspacePanel === "workspace" && (
        <div
          id={workspacePanelId("workspace")}
          className="agent-upload"
          role="tabpanel"
          aria-labelledby={workspaceTabId("workspace")}
          tabIndex={0}
        >
          <div className="agent-upload__header">
            <div>
              <span className="agent-upload__title">{agentState.activeBatch?.label ? `Active batch: ${agentState.activeBatch.label}` : "Upload batches"}</span>
              <span className="agent-upload__count">{agentState.agentFileCount || "none"}</span>
            </div>
            <div className="agent-upload__buttons">
              {agentState.activeBatch && (
                <button type="button" className="agent-upload__clear" onClick={() => submit("Clear active batch")} disabled={busy || Boolean(pendingAction)}>
                  Clear active
                </button>
              )}
            </div>
          </div>

          {agentState.agentBatches?.length > 0 && (
            <div className="agent-batch-list" aria-label="Batch Workspace">
              {agentState.agentBatches.map(batch => (
                <div
                  key={batch.id}
                  className={batch.id === agentState.activeBatchId ? "agent-batch agent-batch--active" : "agent-batch"}
                >
                  <div className="agent-batch__heading">
                    {renamingBatchId === batch.id ? (
                      <div className="agent-batch__rename">
                        <input value={renameValue} onChange={event => setRenameValue(event.target.value)} aria-label={`Rename ${batch.label}`} />
                        <button type="button" onClick={() => saveRename(batch.id)}>Save</button>
                        <button type="button" onClick={() => setRenamingBatchId(null)}>Cancel</button>
                      </div>
                    ) : (
                      <>
                        <strong>{batch.label}</strong>
                        {batch.id === agentState.activeBatchId && <span className="agent-batch__active-label">active</span>}
                      </>
                    )}
                  </div>
                  <div className="agent-batch__identity">{batch.id} · v{batch.version} · {batch.fileCount} file{batch.fileCount === 1 ? "" : "s"}</div>
                  <div className="agent-batch__files" title={batch.fileNames.join(", ")}>{batch.fileNames.join(", ")}</div>
                  <div className="agent-batch__facts">
                    <span>Mode <strong>{batch.parseMode}</strong></span>
                    <span>Route <strong>{batch.detectedLabel}</strong></span>
                    <span>Model <strong>{batch.modelStatus}</strong></span>
                    <span>Mapping <strong>{batch.mappingSpecStatus}</strong></span>
                    <span>Parser <strong>{batch.parserStatus}</strong></span>
                  </div>
                  {batch.rolesSummary?.length > 0 && <div className="agent-batch__roles">{batch.rolesSummary.join(" · ")}</div>}
                  {batch.statsSnapshot && (
                    <div className="agent-batch__stats">
                      {batch.statsSnapshot.hyperedges} hyperedges · {batch.statsSnapshot.vertices} vertices · {batch.statsSnapshot.incidences} incidences
                    </div>
                  )}
                  <div className="agent-batch__time">Created {new Date(batch.createdAt).toLocaleString()}</div>
                  {batch.modelRuns?.length > 0 && (
                    <div className="agent-batch__runs">
                      {batch.modelRuns.map(run => (
                        <span key={run.id} title={run.summary}>{run.task.replaceAll("_", " ")}: {run.status}</span>
                      ))}
                    </div>
                  )}
                  <div className="agent-batch__actions">
                    <button type="button" onClick={() => activateBatch(batch.id)} disabled={busy || Boolean(pendingAction) || batch.id === agentState.activeBatchId}>Activate</button>
                    <button type="button" onClick={() => beginRename(batch)} disabled={busy || Boolean(pendingAction)}>Rename</button>
                    <button type="button" onClick={() => duplicateBatch(batch.id)} disabled={busy || Boolean(pendingAction)}>Duplicate</button>
                    <button type="button" onClick={() => deleteBatch(batch.id)} disabled={busy || Boolean(pendingAction)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {agentState.agentFileCount === 0 ? (
            <div className="agent-upload__empty">Use Batch Updates to choose or drop local data files. Each accepted upload creates a new active batch, and nothing leaves your browser.</div>
          ) : (
            <>
              <div className="agent-batch-summary">
                <span>Mode: <strong>{agentState.activeBatch?.parseMode ?? "unknown"}</strong></span>
                <span>Likely route: <strong>{agentState.agentDetection?.label ?? "Unknown"}</strong></span>
                {agentState.activeBatch?.metadataOnly && <span className="agent-batch-summary__warning">metadata only</span>}
                {agentState.activeBatch?.batchUpdate && <span className="agent-batch-summary__warning">update operations</span>}
              </div>
              <div className="agent-file-list">
                {displayedFiles.map(file => (
                  <div className="agent-file" key={file.id}>
                    <span className="agent-file__icon">{(file.extension || "file").slice(0, 4).toUpperCase()}</span>
                    <span className="agent-file__name" title={file.name}>{file.name}</span>
                    <span className="agent-file__role">{file.role.replaceAll("_", " ")}</span>
                    <span className="agent-file__meta">{formatFileSize(file.size)}</span>
                    <button type="button" onClick={() => removeAttachedFile(file)} disabled={busy || Boolean(pendingAction)} aria-label={`Remove ${file.name}`}>×</button>
                  </div>
                ))}
                {hiddenFileCount > 0 && <div className="agent-file-list__more">…and {hiddenFileCount} more files</div>}
              </div>
              <div className="agent-file-actions" aria-label="Active batch actions">
                {FILE_SUGGESTIONS.map(suggestion => (
                  <button key={suggestion} type="button" onClick={() => submit(suggestion)} disabled={busy || Boolean(pendingAction)}>
                    {suggestion}
                  </button>
                ))}
                <button type="button" onClick={() => submit(QUICK_CONTROL_COMMANDS.generateMappingSpec)} disabled={busy || Boolean(pendingAction)}>Generate mapping with local model</button>
                <button type="button" onClick={() => submit("Use mapping workflow")} disabled={busy || Boolean(pendingAction)}>Infer mapping without model</button>
                <button type="button" onClick={generateStarterParser} disabled={busy || Boolean(pendingAction)}>Generate deterministic starter parser</button>
                <button type="button" onClick={exportTrainingExample} disabled={busy || Boolean(pendingAction) || !agentState.localModel?.hasTrainingExample}>Export training example</button>
                {agentState.previousBatchId && (
                  <>
                    <button type="button" onClick={() => submit("Add to previous batch")} disabled={busy || Boolean(pendingAction)}>Add to previous</button>
                    <button type="button" onClick={() => submit("View previous batch")} disabled={busy || Boolean(pendingAction)}>View previous</button>
                    <button type="button" onClick={() => submit("Clear previous batch")} disabled={busy || Boolean(pendingAction)}>Clear previous</button>
                  </>
                )}
                <button type="button" onClick={() => submit("Clear all upload batches")} disabled={busy || Boolean(pendingAction)}>Clear all batches</button>
              </div>
            </>
          )}
        </div>
            )}

            {workspacePanel === "mapping" && (
        <div
          id={workspacePanelId("mapping")}
          className="agent-mapping"
          role="tabpanel"
          aria-labelledby={workspaceTabId("mapping")}
          aria-label="Dataset mapping workflow"
          tabIndex={0}
        >
          <div className="agent-mapping__header">
            <div>
              <span className="agent-mapping__title">Dataset Mapping Spec</span>
              <span className={`agent-mapping__status agent-mapping__status--${agentState.activeBatch?.mappingSpecStatus ?? "none"}`}>
                {(agentState.activeBatch?.mappingSpecStatus ?? "none").replaceAll("_", " ")}
              </span>
            </div>
            <span className="agent-mapping__badge">
              {agentState.activeBatch?.mappingSource ?? "mapping-first"}
            </span>
          </div>
          <p className="agent-mapping__intro">
            The app creates a deterministic draft first. A local model may refine it, then auto-repair and severity-aware validation select the mapping used for parser generation.
          </p>
          {!agentState.activeBatch ? (
            <div className="agent-mapping__empty">Upload and activate a file batch to begin.</div>
          ) : (
            <>
              <div className="agent-mapping__actions">
                <button type="button" onClick={() => submit(QUICK_CONTROL_COMMANDS.generateMappingSpec)} disabled={busy || Boolean(pendingAction)}>Generate with local model</button>
                <button type="button" onClick={() => mappingAction(() => agentActions.runDatasetInterpretationAssist("Interpret this upload and propose file roles/groups"), "Dataset interpretation draft stored.")} disabled={busy || Boolean(pendingAction)}>Interpret dataset meaning</button>
                <button type="button" onClick={() => mappingAction(
                  () => agentActions.generateDeterministicMapping("Infer mapping from filenames, headers, and previews"),
                  "Generated a deterministic mapping.",
                )} disabled={busy || Boolean(pendingAction)}>Infer without model</button>
                <button type="button" onClick={() => mappingAction(() => agentActions.runDatasetMappingPatchAssist(mappingNotes || "Refine the active mapping from my latest correction", { allowBootstrap: true, source: "button" }), "Validated mapping patch applied.")} disabled={busy || Boolean(pendingAction)}>Apply mapping patch</button>
                <button type="button" onClick={() => mappingAction(agentActions.validateActiveMappingSpec, "Mapping is valid.")} disabled={busy || Boolean(pendingAction) || !agentState.activeBatch.mappingSpec}>Validate mapping</button>
                <button type="button" onClick={() => mappingAction(agentActions.autoRepairActiveMapping, "Mapping auto-repaired.")} disabled={busy || Boolean(pendingAction) || !agentState.activeBatch.mappingSpec}>Auto-repair mapping</button>
                <button type="button" onClick={() => mappingAction(agentActions.useDeterministicDraftMapping, "Using deterministic draft.")} disabled={busy || Boolean(pendingAction) || !agentState.activeBatch.deterministicDraftMapping}>Use deterministic draft</button>
                <button type="button" onClick={() => mappingAction(agentActions.useRepairedMapping, "Using repaired mapping.")} disabled={busy || Boolean(pendingAction) || !agentState.activeBatch.repairedMapping}>Use repaired mapping</button>
                <button type="button" onClick={() => mappingAction(agentActions.undoLastMappingChange, "Restored previous mapping revision.")} disabled={busy || Boolean(pendingAction) || !(agentState.activeBatch.mappingHistory ?? []).length}>Undo mapping change</button>
                <button type="button" onClick={() => mappingAction(agentActions.generateParserFromActiveMapping, "Generated parser from repaired mapping.")} disabled={busy || Boolean(pendingAction) || !["valid", "valid_with_warnings", "repaired", "repaired_with_warnings"].includes(agentState.activeBatch.mappingSpecStatus)}>Generate parser from repaired mapping</button>
              </div>
              <div className="agent-mapping__phase" aria-label="v7.3 mapping workflow phases">
                {["Profile", "Group", "Map", "Clarify", "Plan", "Generate", "Run", "Reconcile", "Preview", "Apply"].map(label => (
                  <span key={label}>{label}</span>
                ))}
              </div>
              <details className="agent-mapping__details" open>
                <summary>Dataset profile and grouping evidence</summary>
                <div className="agent-mapping__file-groups">
                  <div>
                    <strong>Grouping status</strong>
                    <span>{agentState.activeBatch.groupingStatus ?? "none"} · revision {agentState.activeBatch.groupingRevision ?? 0}</span>
                  </div>
                  <div>
                    <strong>Active group</strong>
                    <span>{agentState.activeBatch.activeDatasetGroupId ?? "none"}</span>
                  </div>
                </div>
                <div className="agent-mapping__roles">
                  {(agentState.activeBatch.datasetGroups ?? []).map(group => (
                    <div key={group.id}>
                      <strong>{group.label}</strong>
                      <span>{group.kind.replaceAll("_", " ")}</span>
                      <span>{(group.fileNames ?? []).join(", ") || "no files"}</span>
                    </div>
                  ))}
                </div>
                <div className="agent-mapping__roles">
                  {(agentState.activeBatch.datasetProfile?.files ?? []).slice(0, 8).map(file => (
                    <div key={file.fileName}>
                      <strong>{file.fileName}</strong>
                      <span>{file.format}{file.delimiter ? ` · delimiter ${JSON.stringify(file.delimiter)}` : ""}</span>
                      <span>{file.rowCountExact ? "exact" : "sampled"} rows: {file.rowCount}</span>
                      <span>candidate key: {(file.candidateKeys?.[0]?.columns ?? []).join(" + ") || "none"}</span>
                    </div>
                  ))}
                </div>
                {(agentState.activeBatch.relationshipEvidence ?? []).length > 0 && (
                  <div className="agent-mapping__prompts">
                    {(agentState.activeBatch.relationshipEvidence ?? []).slice(0, 5).map(evidence => (
                      <div key={evidence.id}>{evidence.id}: {evidence.leftFile}.{(evidence.leftColumns ?? []).join("+")} ↔ {evidence.rightFile}.{(evidence.rightColumns ?? []).join("+")} · {Math.round((evidence.confidence ?? 0) * 100)}%</div>
                    ))}
                  </div>
                )}
                {agentState.activeBatch.datasetInterpretationDraft && (
                  <div className="agent-mapping__info">
                    <strong>Local-model interpretation draft</strong>
                    <div>{agentState.activeBatch.datasetInterpretationDraft.summary}</div>
                    {(agentState.activeBatch.datasetInterpretationDraft.clarifications ?? []).slice(0, 3).map((question, index) => <div key={`interpret-question-${index}`}>Question: {question}</div>)}
                  </div>
                )}
              </details>
              {agentState.activeBatch.mappingSpec && (
                <details className="agent-mapping__details" open>
                  <summary>
                    {agentState.activeBatch.mappingSpec.datasetType.replaceAll("_", " ")}
                    {" · "}{Math.round((agentState.activeBatch.mappingSpec.confidence ?? 0) * 100)}% confidence
                  </summary>
                  <div className="agent-mapping__summary">{agentState.activeBatch.mappingSpec.summary}</div>
                  <div className="agent-mapping__file-groups">
                    <div>
                      <strong>Graph input files</strong>
                      <span>{(agentState.activeBatch.mappingSpec.files ?? []).filter(file => file.useAsInput).map(file => file.fileName).join(", ") || "none"}</span>
                    </div>
                    <div>
                      <strong>Validation expected-output files</strong>
                      <span>{(agentState.activeBatch.mappingSpec.files ?? []).filter(file => file.role === "validation_expected_output").map(file => file.fileName).join(", ") || "none"}</span>
                    </div>
                  </div>
                  <div className="agent-mapping__roles">
                    {(agentState.activeBatch.mappingSpec.files ?? []).map(file => (
                      <div key={file.fileName}>
                        <strong>{file.fileName}</strong>
                        <span>{file.role.replaceAll("_", " ")}</span>
                        <span>{file.useAsInput ? "parser input" : "validation / ignored"}</span>
                        {file.join && <span>join {file.join.leftKey} → {file.join.rightFile}.{file.join.rightKey}</span>}
                      </div>
                    ))}
                  </div>
                  <div className="agent-mapping__output">
                    Output: <strong>{agentState.activeBatch.mappingSpec.output?.format}</strong>
                    {agentState.activeBatch.mappingSpec.output?.hyperedgeMode && <> · {agentState.activeBatch.mappingSpec.output.hyperedgeMode.replaceAll("_", " ")}</>}
                    {agentState.activeBatch.generatedParserFromMapping && <> · <strong>Parser generated from mapping</strong></>}
                  </div>
                  {(agentState.activeBatch.transformationPlanPreview ?? []).length > 0 && (
                    <div className="agent-mapping__repairs">
                      <strong>Transformation plan ({agentState.activeBatch.transformationPlanStatus})</strong>
                      <ol>{agentState.activeBatch.transformationPlanPreview.map((step, index) => <li key={`${index}-${step}`}>{step}</li>)}</ol>
                    </div>
                  )}
                  {agentState.activeBatch.parserReconciliation && (
                    <div className="agent-mapping__info">
                      <strong>Parser reconciliation: {agentState.activeBatch.parserReconciliation.status}</strong>
                      <div>
                        Emitted {agentState.activeBatch.parserReconciliation.emitted?.hyperedges ?? 0} hyperedges,
                        {" "}{agentState.activeBatch.parserReconciliation.emitted?.vertices ?? 0} vertices,
                        {" "}{agentState.activeBatch.parserReconciliation.emitted?.incidences ?? 0} incidences.
                      </div>
                      {(agentState.activeBatch.parserReconciliation.warnings ?? []).slice(0, 4).map((warning, index) => <div key={`recon-warning-${index}`}>Warning: {warning}</div>)}
                      {(agentState.activeBatch.parserReconciliation.errors ?? []).slice(0, 4).map((error, index) => <div key={`recon-error-${index}`}>Error: {error}</div>)}
                    </div>
                  )}
                  {(agentState.activeBatch.mappingSpec.warnings?.length > 0 || agentState.activeBatch.mappingSpec.questionsForUser?.length > 0) && (
                    <div className="agent-mapping__prompts">
                      {agentState.activeBatch.mappingSpec.warnings?.map((warning, index) => <div key={`warning-${index}`}>Warning: {warning}</div>)}
                      {agentState.activeBatch.mappingSpec.questionsForUser?.map((question, index) => <div key={`question-${index}`}>Question: {question}</div>)}
                    </div>
                  )}
                  {(agentState.activeBatch.mappingRepairNotes ?? []).length > 0 && (
                    <div className="agent-mapping__repairs">
                      <strong>Mapping auto-repaired</strong>
                      <ul>{agentState.activeBatch.mappingRepairNotes.map((note, index) => <li key={`${index}-${note}`}>{note}</li>)}</ul>
                    </div>
                  )}
                  {(agentState.activeBatch.mappingValidationWarnings ?? []).length > 0 && (
                    <div className="agent-mapping__warnings">
                      <strong>Validation warnings</strong>
                      <ul>{agentState.activeBatch.mappingValidationWarnings.map((warning, index) => <li key={`${index}-${warning}`}>{warning}</li>)}</ul>
                    </div>
                  )}
                  {(agentState.activeBatch.mappingInformationalNotes ?? []).length > 0 && (
                    <div className="agent-mapping__info">
                      {agentState.activeBatch.mappingInformationalNotes.map((note, index) => <div key={`${index}-${note}`}>{note}</div>)}
                    </div>
                  )}
                  {(agentState.activeBatch.mappingSpecValidationErrors ?? []).length > 0 && (
                    <ul className="agent-mapping__errors">
                      <strong>Fatal validation errors</strong>
                      {agentState.activeBatch.mappingSpecValidationErrors.map((error, index) => <li key={`${index}-${error}`}>{error}</li>)}
                    </ul>
                  )}
                  <label className="agent-mapping__editor">
                    <span>Editable JSON</span>
                    <textarea
                      key={`${agentState.activeBatchId}-${agentState.batchVersion}`}
                      ref={mappingEditorRef}
                      defaultValue={JSON.stringify(agentState.activeBatch.mappingSpec, null, 2)}
                      spellCheck="false"
                    />
                  </label>
                  <div className="agent-mapping__actions">
                    <button type="button" onClick={applyMappingEditor} disabled={busy || Boolean(pendingAction)}>Apply edited mapping</button>
                    <button type="button" onClick={() => mappingAction(agentActions.exportActiveMappingSpec, "Exported mapping spec.")} disabled={busy || Boolean(pendingAction)}>Export mapping JSON</button>
                    <button type="button" onClick={exportMappingTrainingExample} disabled={busy || Boolean(pendingAction)}>Export fine-tuning example</button>
                    <button type="button" onClick={() => mappingAction(agentActions.exportMappingFineTuneJsonl, "Exported mapping examples as JSONL.")} disabled={busy || Boolean(pendingAction) || !agentState.activeBatch.fineTuneExampleCount}>Export collected JSONL</button>
                    <button type="button" onClick={() => mappingAction(agentActions.compareActiveExpectedOutput, "Compared expected output.")} disabled={busy || Boolean(pendingAction)}>Compare expected output</button>
                  </div>
                  <label className="agent-mapping__full-export">
                    <input
                      type="checkbox"
                      checked={includeFullTrainingFiles}
                      onChange={event => setIncludeFullTrainingFiles(event.target.checked)}
                      disabled={busy || Boolean(pendingAction)}
                    />
                    Include full files in fine-tuning export (confirmation required)
                  </label>
                  <div className="agent-mapping__review">
                    <button type="button" onClick={() => mappingAction(() => agentActions.setActiveMappingFeedback({ accepted: true, rejected: false }), "Mapping accepted.")}>Accept</button>
                    <button type="button" onClick={() => mappingAction(() => agentActions.setActiveMappingFeedback({ accepted: false, rejected: true }), "Mapping rejected.")}>Reject</button>
                    <button type="button" onClick={() => mappingAction(() => agentActions.setActiveMappingFeedback({ corrected: true }), "Mapping marked corrected.")}>Mark corrected</button>
                    <button type="button" onClick={() => mappingAction(() => agentActions.setActiveMappingFeedback({ parserWorked: true }), "Parser marked as working.")}>Parser worked</button>
                    <button type="button" onClick={() => mappingAction(() => agentActions.setActiveMappingFeedback({ parserWorked: false }), "Parser marked as failed.")}>Parser failed</button>
                    <input value={mappingNotes} onChange={event => setMappingNotes(event.target.value)} placeholder="Optional review notes" />
                    <button type="button" onClick={saveMappingNotes}>Save notes</button>
                  </div>
                  {agentState.activeBatch.expectedOutputComparison && (
                    <pre className="agent-mapping__comparison">{JSON.stringify(agentState.activeBatch.expectedOutputComparison, null, 2)}</pre>
                  )}
                </details>
              )}
            </>
          )}
        </div>
            )}

            {workspacePanel === "settings" && (
        <div
          id={workspacePanelId("settings")}
          className="agent-model"
          role="tabpanel"
          aria-labelledby={workspaceTabId("settings")}
          aria-label="Assistant Settings"
          tabIndex={0}
        >
          <div className="agent-model__header">
            <div>
              <span className="agent-model__title">Local model</span>
              <span className={`agent-model__status agent-model__status--${agentState.localModel?.status ?? "disconnected"}`}>
                {agentState.localModel?.status ?? "disconnected"}
              </span>
            </div>
            <span className="agent-model__future">{RECOMMENDED_OLLAMA_MODEL}</span>
          </div>
          <div className="agent-model__connection-card">
            <div>
              <span>Model</span>
              <strong>{agentState.localModel?.config?.model || RECOMMENDED_OLLAMA_MODEL}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>{agentState.localModel?.status ?? "disconnected"}</strong>
            </div>
            <div>
              <span>Connection</span>
              <strong>
                {localModelConnected
                  ? activeTransport === "bridge"
                    ? "Connected via Local Bridge"
                    : "Connected via Direct Ollama"
                  : "Automatic"}
              </strong>
            </div>
            <div>
              <span>Generation</span>
              <strong>{agentState.localModel?.generation?.status ?? "idle"}</strong>
            </div>
            <div>
              <span>Last task</span>
              <strong>{agentState.localModel?.generation?.task ?? agentState.localModel?.lastTask ?? "none"}</strong>
            </div>
          </div>
          <div className="agent-model__message">{agentState.localModel?.message}</div>
          {agentState.localModel?.requestHistory?.length > 0 && (
            <div className="agent-model__runtime-note">
              Last request: {agentState.localModel.requestHistory.at(-1).task} · {agentState.localModel.requestHistory.at(-1).outcome}
              {agentState.localModel.requestHistory.at(-1).metrics?.evalTokensPerSecond ? ` · ${agentState.localModel.requestHistory.at(-1).metrics.evalTokensPerSecond} tok/s` : ""}
            </div>
          )}
          <div className="agent-model__runtime-note">
            The project uses one local runtime: Ollama. The app automatically tries direct Ollama and the local bridge; these are automatic connection methods, not separate runtimes.
          </div>
          <div className="agent-model__actions">
            <button type="button" onClick={() => submit(QUICK_CONTROL_COMMANDS.testConnection)} disabled={busy || Boolean(pendingAction) || agentState.localModel?.busy}>Connect</button>
            <button type="button" onClick={() => submit(QUICK_CONTROL_COMMANDS.testConnection)} disabled={busy || Boolean(pendingAction) || agentState.localModel?.busy}>Reconnect</button>
            <button type="button" onClick={() => agentActions.updateLocalModelSettings({ enabled: false })} disabled={busy || Boolean(pendingAction)}>Disconnect local assistant</button>
            <button type="button" onClick={() => setWorkspacePanel("advanced")} disabled={busy || Boolean(pendingAction)}>Open diagnostics</button>
            <button type="button" onClick={() => submit(QUICK_CONTROL_COMMANDS.listModels)} disabled={busy || Boolean(pendingAction) || agentState.localModel?.busy}>Is qwen3:8b installed?</button>
            <button type="button" onClick={() => submit(QUICK_CONTROL_COMMANDS.explainFileRolesWithModel)} disabled={busy || Boolean(pendingAction)}>Explain file roles</button>
            <button type="button" onClick={() => submit(QUICK_CONTROL_COMMANDS.generateMappingSpec)} disabled={busy || Boolean(pendingAction)}>Generate mapping spec</button>
            <button type="button" onClick={() => submit(QUICK_CONTROL_COMMANDS.repairMappingWithModel)} disabled={busy || Boolean(pendingAction)}>Refine/repair mapping with model</button>
          </div>
          <details className="agent-model__help">
            <summary>Advanced connection details</summary>
            <dl className="agent-model__details">
              <div><dt>Direct endpoint</dt><dd>http://localhost:11434</dd></div>
              <div><dt>Bridge endpoint</dt><dd>http://127.0.0.1:8787/ollama</dd></div>
              <div><dt>Active endpoint</dt><dd>{agentState.localModel?.config?.activeBaseUrl || "None"}</dd></div>
              <div><dt>Last successful method</dt><dd>{agentState.localModel?.config?.lastSuccessfulTransport || "None"}</dd></div>
              <div><dt>Timeout</dt><dd>{agentState.localModel?.config?.timeoutMs ?? DEFAULT_LOCAL_MODEL_TIMEOUT_MS} ms</dd></div>
              <div><dt>Temperature</dt><dd>{agentState.localModel?.config?.temperature ?? 0.1}</dd></div>
            </dl>
          </details>
          <div className="agent-model__privacy">Only bounded previews from the active batch are used by default. No cloud or API key support is included. Remote model endpoints are blocked by default to avoid sending uploaded file previews outside your machine/private network.</div>
        </div>
            )}

            {workspacePanel === "advanced" && (
        <div
          id={workspacePanelId("advanced")}
          className="agent-model agent-advanced"
          role="tabpanel"
          aria-labelledby={workspaceTabId("advanced")}
          aria-label="Advanced diagnostics and developer tools"
          tabIndex={0}
        >
          <div className="agent-model__header">
            <div>
              <span className="agent-model__title">Advanced diagnostics</span>
              <span className={`agent-model__status agent-model__status--${agentState.localModel?.status ?? "disconnected"}`}>
                {agentState.localModel?.status ?? "disconnected"}
              </span>
            </div>
            <span className="agent-model__future">developer tools</span>
          </div>
          <LocalRuntimeDiagnosticsPanel
            localModel={agentState.localModel}
            agentActions={agentActions}
            busy={busy}
            pendingAction={pendingAction}
            onNotice={(text, tone) => append("agent", text, tone)}
          />
          {lastNluDiagnostic && (
            <details className="agent-nlu-diagnostics" open>
              <summary>Deterministic understanding</summary>
              <dl className="agent-model__details">
                <div><dt>Understanding path</dt><dd>{lastNluDiagnostic.plannerPath}</dd></div>
                <div><dt>Authoritative compiler</dt><dd>{lastNluDiagnostic.authoritativeCompiler || "unknown"}</dd></div>
                <div><dt>Domain</dt><dd>{lastNluDiagnostic.nluDomain || "unknown"}</dd></div>
                <div><dt>Intent</dt><dd>{lastNluDiagnostic.nluIntent || "unknown"}</dd></div>
                <div><dt>Semantic confidence</dt><dd>{lastNluDiagnostic.nluConfidence?.level ?? "unknown"}{Number.isFinite(lastNluDiagnostic.nluConfidence?.score) ? ` (${lastNluDiagnostic.nluConfidence.score})` : ""}</dd></div>
                <div><dt>Analysis count</dt><dd>{lastNluDiagnostic.analysisCount ?? "n/a"}</dd></div>
                <div><dt>Compilation count</dt><dd>{lastNluDiagnostic.compilationCount ?? "n/a"}</dd></div>
                <div><dt>Model calls</dt><dd>{lastNluDiagnostic.modelCallCount ?? "n/a"}</dd></div>
                <div><dt>Generic ActionPlan calls</dt><dd>{lastNluDiagnostic.genericActionPlannerCallCount ?? "n/a"}</dd></div>
                <div><dt>Legacy parser calls</dt><dd>{lastNluDiagnostic.legacyRawParserCallCount ?? "n/a"}</dd></div>
                <div><dt>Raw control classifier calls</dt><dd>{lastNluDiagnostic.rawControlClassifierCallCount ?? "n/a"}</dd></div>
                <div><dt>Mapping recompiles</dt><dd>{lastNluDiagnostic.mappingRecompileCount ?? "n/a"}</dd></div>
                <div><dt>Graph recompiles</dt><dd>{lastNluDiagnostic.graphRecompileCount ?? "n/a"}</dd></div>
              </dl>
            </details>
          )}
          {agentState.activeBatch?.mappingTurnDiagnostics?.length > 0 && (
            <details className="agent-mapping-diagnostics" open>
              <summary>Dataset mapping routing diagnostics</summary>
              {(() => {
                const diagnostic = agentState.activeBatch.mappingTurnDiagnostics.at(-1);
                return (
                  <dl className="agent-model__details">
                    <div><dt>Detected intent</dt><dd>{diagnostic.detectedIntent}</dd></div>
                    <div><dt>Selected planner</dt><dd>{diagnostic.selectedPlanner}</dd></div>
                    <div><dt>Generic ActionPlan called</dt><dd>{String(Boolean(diagnostic.genericActionPlannerCalled))}</dd></div>
                    <div><dt>Route planner called</dt><dd>{String(Boolean(diagnostic.routePlannerCalled))}</dd></div>
                    <div><dt>Mapping revision</dt><dd>{diagnostic.mappingRevisionBefore} → {diagnostic.mappingRevisionAfter}</dd></div>
                    <div><dt>Model outcome</dt><dd>{diagnostic.modelOutcome || "not_attempted"}</dd></div>
                    <div><dt>Fallback used</dt><dd>{String(Boolean(diagnostic.fallbackUsed))}</dd></div>
                    {diagnostic.nluDomain && <div><dt>NLU domain</dt><dd>{diagnostic.nluDomain}</dd></div>}
                    {diagnostic.nluIntent && <div><dt>NLU intent</dt><dd>{diagnostic.nluIntent}</dd></div>}
                    {diagnostic.nluConfidence && <div><dt>NLU confidence</dt><dd>{diagnostic.nluConfidence.level} ({diagnostic.nluConfidence.score})</dd></div>}
                    <div><dt>Operations</dt><dd>{(diagnostic.patchOperationTypes ?? []).join(", ") || "none"}</dd></div>
                    <div><dt>Files resolved</dt><dd>{(diagnostic.filesResolved ?? []).join(", ") || "none"}</dd></div>
                    <div><dt>Columns resolved</dt><dd>{(diagnostic.columnsResolved ?? []).join(", ") || "none"}</dd></div>
                  </dl>
                );
              })()}
            </details>
          )}
          <div className="agent-model__training">
            <label>
              <input
                type="checkbox"
                checked={includeFullTrainingFiles}
                onChange={event => setIncludeFullTrainingFiles(event.target.checked)}
                disabled={busy || Boolean(pendingAction)}
              />
              Include full files in training export
            </label>
            <button
              type="button"
              onClick={exportTrainingExample}
              disabled={busy || Boolean(pendingAction) || !agentState.localModel?.hasTrainingExample}
            >
              Export parser training example
            </button>
          </div>
          <div className="agent-model__privacy">Structured tasks remain non-streaming and schema-validated. Conversational chat may stream, but only deterministic app code can execute actions.</div>
          {agentState.localModel?.debug && (
            <details className="agent-model-debug">
              <summary>Show model debug</summary>
              <div className="agent-model-debug__grid">
                <div>
                  <strong>Last prompt summary</strong>
                  <pre>{JSON.stringify(agentState.localModel.debug.promptSummary ?? {}, null, 2)}</pre>
                </div>
                <div>
                  <strong>Validation errors</strong>
                  <ul>
                    {(agentState.localModel.debug.validationErrors ?? []).map((error, index) => <li key={`${index}-${error}`}>{error}</li>)}
                    {!(agentState.localModel.debug.validationErrors ?? []).length && <li>None</li>}
                  </ul>
                </div>
                <div>
                  <strong>Last raw response</strong>
                  <pre>{String(agentState.localModel.debug.lastRawResponse ?? "").slice(0, 2400) || "(no response body)"}</pre>
                </div>
                <div>
                  <strong>Parsed JSON preview</strong>
                  <pre>{JSON.stringify(agentState.localModel.debug.parsedJsonPreview ?? null, null, 2).slice(0, 2400)}</pre>
                </div>
              </div>
              <div className="agent-model-debug__attempts">
                Repair attempts: {agentState.localModel.debug.repairAttempts ?? 0}
                {(agentState.localModel.debug.attempts ?? []).map(attempt => (
                  <span key={`${attempt.task}-${attempt.attempt}`}>{attempt.task} #{attempt.attempt}: {attempt.status}</span>
                ))}
              </div>
              <div className="agent-model-debug__actions">
                <button type="button" onClick={() => copyDebug("raw")}>Copy raw response</button>
                <button type="button" onClick={() => copyDebug("prompt")}>Copy prompt summary</button>
                <button type="button" onClick={exportDebug}>Export debug example</button>
              </div>
            </details>
          )}
          {agentState.localModel?.status === "error" && agentState.activeBatch && (
            <div className="agent-model-recovery">
              <strong>Recovery options</strong>
              <div>
                <button type="button" onClick={() => submit(QUICK_CONTROL_COMMANDS.generateMappingSpec)} disabled={busy}>Retry mapping with stricter schema</button>
                <button type="button" onClick={() => submit(QUICK_CONTROL_COMMANDS.repairMappingWithModel)} disabled={busy}>Repair mapping response</button>
                <button type="button" onClick={generateStarterParser} disabled={busy}>Use deterministic starter parser</button>
                <button type="button" onClick={exportDebug} disabled={busy || !agentState.localModel?.debug}>Export debug example</button>
              </div>
              <span>Small 0.5B“1.5B models may struggle with complex JSON/code. Try a 3B or 7B local coder model if your hardware supports it.</span>
            </div>
          )}
        </div>

            )}

            {workspacePanel === "help" && (
              <div
                id={workspacePanelId("help")}
                role="tabpanel"
                aria-labelledby={workspaceTabId("help")}
                tabIndex={0}
              >
                <DeterministicCommandHelp
                  onTryExample={insertCommandExample}
                  onOpenPanel={selectWorkspaceTab}
                />
              </div>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
}
