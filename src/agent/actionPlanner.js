import {
  customParserGuidance,
  diagnosticsResponse,
  explainRoute,
  EXPORT_GUIDANCE,
  graphStatsResponse,
  HELP_RESPONSE,
  routeSelected,
  UNKNOWN_RESPONSE,
  uploadGuidance,
  VISUALIZATION_GUIDANCE,
} from "./agentResponses.js";
import { RECOMMENDED_OLLAMA_MODEL, validateLocalModelName } from "./localModelSettings.js";
import { getConfirmationCopy, requiresConfirmation } from "./safetyGuards.js";

function confirmation(actionType, details = {}) {
  return {
    kind: "confirmation",
    actionType,
    requiresConfirmation: requiresConfirmation(actionType),
    ...getConfirmationCopy(actionType),
    ...details,
  };
}

function needsBatchMode(state) {
  return state.agentFileCount > 1
    && state.activeBatch?.parseMode === "unknown"
    && state.agentDetection?.formatId !== "cornell";
}

function batchModeQuestion(state) {
  if (state.activeBatch?.separateGraphFiles) {
    return "These look like separate graph files. Should I treat them as separate datasets, or combine them as one temporal dataset?";
  }
  if (state.activeBatch?.mixedFormats) {
    return "The active batch contains mixed graph formats. Should the files be parsed together as one dataset, or treated as separate datasets?";
  }
  return "Should these files be parsed together as one dataset, or treated as separate datasets?";
}

function formatRoleSummary(state) {
  const summaries = state.activeBatch?.fileSummaries ?? [];
  if (!summaries.length) return "No active upload batch is available.";
  const shown = summaries.slice(0, 10).map(file => `${file.name}: ${file.role.replaceAll("_", " ")}`);
  const remainder = summaries.length > shown.length ? `; plus ${summaries.length - shown.length} more file(s)` : "";
  return `Detected file roles — ${shown.join("; ")}${remainder}. Detection is deterministic and based on filenames, headers, and a bounded text preview.`;
}

function findBatchByNumber(state, batchNumber) {
  const batches = state.agentBatches ?? [];
  return batches.find(batch => batch.id === `batch-${batchNumber}`)
    ?? batches[batchNumber - 1]
    ?? null;
}

function localModelTaskPlan(state, task, intentText) {
  const model = state.localModel;
  if (!model || model.config?.enabled === false) {
    return { kind: "respond", message: `Local assistant is disconnected. Deterministic controls remain available; start Ollama with ${RECOMMENDED_OLLAMA_MODEL} and click Connect when you want model help.` };
  }
  if (!model.config?.model?.trim()) {
    return {
      kind: "respond",
      message: `The configured Ollama model name is missing. This release expects ${RECOMMENDED_OLLAMA_MODEL}; reconnect after restoring settings.`,
    };
  }
  if (model.status !== "connected") {
    return { kind: "respond", message: `Connect the local assistant first. I will try direct Ollama and the local bridge automatically, then verify ${model.config.model || RECOMMENDED_OLLAMA_MODEL} with a structured generation check.` };
  }
  if (!state.activeBatch) {
    return { kind: "respond", message: "Upload an active file batch first. Only that batch's limited previews will be sent to the local model." };
  }
  if (["generate_custom_parser", "repair_custom_parser"].includes(task) && needsBatchMode(state)) {
    return { kind: "respond", message: batchModeQuestion(state) };
  }
  if (task === "repair_custom_parser" && !state.customCodeExists) {
    return { kind: "respond", message: "There is no current Custom Parser code to repair." };
  }
  if (task === "repair_custom_parser" && !state.customErr) {
    return { kind: "respond", message: "There is no latest custom parser error to repair. Run the parser first or describe the intended change." };
  }
  return { kind: "run_local_model_task", task, userIntent: intentText };
}

export function planAgentAction(classification, state) {
  const { intent, route, exportPreview, value, useCurrentRoute, modelName, normalized, batchNumber } = classification;

  switch (intent) {
    case "ambiguous_clear":
      return { kind: "respond", message: "What should I clear: the current graph, the active upload batch, the previous batch, all upload batches, or only this chat?" };
    case "ambiguous_action":
      return { kind: "respond", message: "What should I run or apply: parse the active batch, run Custom Parser, or apply the validated parser result?" };
    case "pending_cancel":
      return { kind: "pending_cancel", message: "Pending action cancelled. No changes were made." };
    case "pending_confirm":
      return { kind: "pending_confirm", message: "Confirming the pending action." };
    case "runtime_stop":
      return { kind: "runtime_stop", message: "Stop requested for active model/runtime work." };
    case "activate_batch_number":
    case "generate_parser_for_batch": {
      const batch = findBatchByNumber(state, batchNumber);
      if (!batch) return { kind: "respond", message: `Batch ${batchNumber} does not exist. Upload or duplicate a batch first.` };
      if (batch.id === state.activeBatchId) {
        return intent === "generate_parser_for_batch"
          ? { kind: "generate_parser_from_mapping" }
          : { kind: "respond", message: `${batch.label} is already active.` };
      }
      return {
        kind: intent === "generate_parser_for_batch" ? "activate_batch_then_generate_parser" : "activate_batch",
        batchId: batch.id,
        message: `Active batch changed to ${batch.label}: ${batch.fileNames.join(", ")}.`,
      };
    }
    case "use_active_batch":
      return state.activeBatch
        ? { kind: "respond", message: `${state.activeBatch.label} is already active. All file, model, and parser actions are bound to it.` }
        : { kind: "respond", message: "No batch is active. Upload files or activate an existing batch first." };

    case "generate_mapping_spec":
      return state.localModel?.config?.enabled === false
        ? { kind: "generate_deterministic_mapping", message: "I created a deterministic draft mapping. The local assistant is disconnected, so no model refinement will be attempted." }
        : localModelTaskPlan(state, "generate_mapping_spec", normalized);
    case "repair_mapping_spec":
      return localModelTaskPlan(state, "repair_mapping_spec", normalized);
    case "generate_deterministic_mapping":
      return state.activeBatch
        ? { kind: "generate_deterministic_mapping", message: "Building, auto-repairing, and validating a deterministic draft mapping." }
        : { kind: "respond", message: "Upload an active file batch first." };
    case "auto_repair_mapping":
      return state.activeBatch?.mappingSpec
        ? { kind: "auto_repair_mapping" }
        : { kind: "respond", message: "There is no active mapping to auto-repair." };
    case "use_deterministic_draft":
      return state.activeBatch?.deterministicDraftMapping
        ? { kind: "use_deterministic_draft" }
        : { kind: "respond", message: "No deterministic draft is stored for the active batch yet." };
    case "use_repaired_mapping":
      return state.activeBatch?.repairedMapping
        ? { kind: "use_repaired_mapping" }
        : { kind: "respond", message: "No repaired mapping is stored for the active batch yet." };
    case "show_repair_notes":
      return state.activeBatch?.mappingRepairNotes?.length
        ? { kind: "respond", message: `Mapping auto-repair notes:\n- ${state.activeBatch.mappingRepairNotes.join("\n- ")}` }
        : { kind: "respond", message: "The active mapping has no auto-repair notes." };
    case "generate_parser_from_mapping":
      return state.activeBatch?.mappingSpec
        ? { kind: "generate_parser_from_mapping" }
        : { kind: "respond", message: "Generate and validate a mapping spec for the active batch first." };
    case "validate_mapping":
      return state.activeBatch?.mappingSpec
        ? { kind: "validate_mapping" }
        : { kind: "respond", message: "There is no active mapping spec to validate." };
    case "edit_mapping":
      return state.activeBatch?.mappingSpec
        ? { kind: "focus_mapping_editor", message: "The mapping editor is open below the active batch. Edit the JSON, then choose Apply edited mapping." }
        : { kind: "respond", message: "Generate a mapping spec first, then you can edit its JSON." };
    case "explain_mapping": {
      const spec = state.activeBatch?.mappingSpec;
      if (!spec) return { kind: "respond", message: "There is no active mapping spec yet. Ask me to generate one from the active file previews." };
      const roles = spec.files?.map(file => `${file.fileName}: ${file.role}${file.useAsInput ? "" : " (not parser input)"}`).join("; ");
      return { kind: "respond", message: `${spec.summary} Dataset type: ${spec.datasetType}; mode: ${spec.parseMode}; confidence: ${Math.round((spec.confidence ?? 0) * 100)}%. File roles — ${roles}.` };
    }
    case "compare_expected_output":
      return { kind: "compare_expected_output" };
    case "export_mapping_finetune":
      return state.activeBatch?.mappingSpec
        ? { kind: "export_mapping_finetune" }
        : { kind: "respond", message: "Generate and validate a mapping spec before exporting a fine-tuning example." };
    case "accept_mapping":
      return state.activeBatch?.mappingSpec
        ? { kind: "mapping_feedback", patch: { accepted: true, rejected: false } }
        : { kind: "respond", message: "There is no mapping to accept." };
    case "reject_mapping":
      return state.activeBatch?.mappingSpec
        ? { kind: "mapping_feedback", patch: { accepted: false, rejected: true } }
        : { kind: "respond", message: "There is no mapping to reject." };
    case "use_mapping_workflow":
      return state.activeBatch
        ? { kind: "generate_deterministic_mapping" }
        : { kind: "respond", message: "Upload an active file batch first. Then I can infer a mapping locally without a model." };

    case "local_model_enable":
      return { kind: "configure_local_model", patch: { enabled: true }, message: `Local assistant enabled for Ollama with ${RECOMMENDED_OLLAMA_MODEL}. Start Ollama, then click Connect or ask me to reconnect.` };
    case "local_model_connect":
      return { kind: "test_local_model" };
    case "local_model_reconnect_bridge":
      return { kind: "test_local_model", configOverride: { preferTransport: "bridge" } };
    case "local_model_disable":
      return { kind: "configure_local_model", patch: { enabled: false, activeTransport: null, activeBaseUrl: "" }, message: "Local assistant disconnected. Deterministic dashboard controls remain fully available." };
    case "local_model_status": {
      const local = state.localModel;
      const transport = local?.config?.activeTransport === "bridge"
        ? "Local Bridge"
        : local?.config?.activeTransport === "direct"
          ? "Direct Ollama"
          : "Automatic";
      return { kind: "respond", message: `Local assistant: runtime Ollama, model ${local?.config?.model || RECOMMENDED_OLLAMA_MODEL}, status ${local?.status ?? "disconnected"}, connection ${transport}. ${local?.message ?? ""}` };
    }
    case "local_model_test":
      return state.localModel?.config?.enabled === false
        ? { kind: "respond", message: `Local assistant is disconnected. Ask me to connect it after starting Ollama with ${RECOMMENDED_OLLAMA_MODEL}.` }
        : { kind: "test_local_model" };
    case "local_model_list":
      return { kind: "list_local_models" };
    case "local_runtime_diagnostics":
      return { kind: "run_runtime_diagnostics", mode: "current" };
    case "local_runtime_test_direct_ollama":
      return { kind: "run_runtime_diagnostics", mode: "direct-ollama" };
    case "local_runtime_test_bridge":
      return { kind: "run_runtime_diagnostics", mode: "bridge" };
    case "local_runtime_test_generation":
      return state.localModel?.config?.enabled === false
        ? { kind: "respond", message: `Local assistant is disconnected. Start Ollama with ${RECOMMENDED_OLLAMA_MODEL}, then reconnect before testing generation.` }
        : { kind: "run_runtime_diagnostics", mode: "generation" };
    case "local_runtime_setup_help":
      return { kind: "show_runtime_setup_help" };
    case "local_model_select": {
      if (!modelName) return { kind: "respond", message: `Name the Ollama model to use. For example: Use model ${RECOMMENDED_OLLAMA_MODEL}.` };
      const validation = validateLocalModelName(modelName);
      return validation.ok
        ? {
          kind: "set_local_model_name",
          modelName: validation.model,
          message: `Configured the local assistant to use ${validation.model}. Reconnect or run a connection test to verify that Ollama has this model installed.`,
        }
        : { kind: "respond", message: validation.error };
    }
    case "local_model_generate_parser":
      return ["valid", "valid_with_warnings", "repaired", "repaired_with_warnings"].includes(state.activeBatch?.mappingSpecStatus) && state.activeBatch?.mappingSpec
        ? { kind: "generate_parser_from_mapping" }
        : state.localModel?.config?.enabled === false
          ? { kind: "generate_deterministic_mapping", message: "The local model is unavailable, so I created a deterministic draft mapping first." }
          : localModelTaskPlan(state, "generate_mapping_spec", normalized);
    case "local_model_analyze_roles":
      return localModelTaskPlan(state, "analyze_file_roles", normalized);
    case "local_model_repair_parser":
      return localModelTaskPlan(state, "repair_custom_parser", normalized);
    case "local_model_explain_strategy":
      return localModelTaskPlan(state, "explain_parser_strategy", normalized);

    case "upload_files":
      return { kind: "open_file_picker" };
    case "clear_uploaded_files":
      return state.activeBatch
        ? { kind: "clear_uploaded_files", message: "Active upload batch cleared. The parsed graph and dashboard inputs were not changed." }
        : { kind: "respond", message: "There is no active upload batch to clear." };
    case "clear_all_batches":
      return state.agentBatches?.length
        ? { kind: "clear_all_batches" }
        : { kind: "respond", message: "There are no upload batches to clear." };
    case "clear_previous_batch":
      return state.previousBatchId
        ? { kind: "clear_previous_batch" }
        : { kind: "respond", message: "There is no previous upload batch." };
    case "view_previous_batch":
      return state.previousBatchId
        ? { kind: "view_previous_batch" }
        : { kind: "respond", message: "There is no previous upload batch." };
    case "add_to_previous_batch":
      return state.activeBatch && state.previousBatchId
        ? { kind: "add_to_previous_batch" }
        : { kind: "respond", message: "Both an active batch and a previous batch are required before files can be merged." };
    case "use_as_new_dataset":
      return state.activeBatch
        ? { kind: "respond", message: `${state.activeBatch.label} is already the active new dataset. Parsing and routing actions will use only this batch.` }
        : { kind: "respond", message: "Upload files first; each upload event automatically creates a new active dataset batch." };
    case "parse_together":
      return state.activeBatch
        ? { kind: "set_batch_parse_mode", mode: "together", message: `${state.activeBatch.label} is now set to parse together as one dataset.` }
        : { kind: "respond", message: "Upload two or more related files first." };
    case "parse_separately":
      return state.activeBatch
        ? { kind: "set_batch_parse_mode", mode: "separate", message: `${state.activeBatch.label} is now set to parse files separately. The dashboard visualizes one active graph at a time.` }
        : { kind: "respond", message: "Upload two or more graph files first." };
    case "explain_file_roles":
      return { kind: "respond", message: formatRoleSummary(state) };
    case "compare_datasets": {
      const batches = state.agentBatches ?? [];
      if (batches.length < 2) return { kind: "respond", message: "I need at least two upload batches to compare. A new upload creates a new batch without silently merging it into the current one." };
      const summary = batches.slice(-2).map(batch => `${batch.label}: ${batch.fileCount} file(s), ${batch.detectedLabel}, mode ${batch.parseMode}`).join("; ");
      return { kind: "respond", message: `I can compare the available upload structure, not graph-level differences unless both datasets have been parsed and retained externally. Latest batches — ${summary}.` };
    }
    case "compare_formats":
      return { kind: "respond", message: "Choose the format that matches the data you actually have: H2V lists vertices by hyperedge, V2H lists hyperedges by vertex, incidence stores one membership per row, CSR/CSC are compact sparse encodings, and JSON is the most explicit interchange format. Tell me the filenames or columns and I can narrow that choice deterministically." };

    case "batch_updates_placeholder":
      return {
        kind: "respond",
        message: "Batch Updates conversational support is reserved for a future integration. The existing Batch Updates interface remains available for manual use.",
      };

    case "freeform_placeholder":
      return {
        kind: "respond",
        message: "Conversational Freeform/NLP conversion is reserved for a future integration. The existing manual Freeform route remains available.",
      };

    case "external_ai_prompt":
      if (/\b(export|convert|download|save|output|make)\b.*\bedge list\b/.test(normalized)
        && !/\b(incidence|bipartite|clique|pairwise|graph edge list|size[- ]?two)\b/.test(normalized)) {
        return {
          kind: "respond",
          message: "For the external prompt, should the model produce incidence memberships, a vertex-hyperedge bipartite edge list, or a clique/pairwise vertex projection?",
        };
      }
      return {
        kind: "copy_ai_prompt",
        targetExportId: exportPreview?.id ?? "canonical",
        message: exportPreview
          ? `Prepared an external AI prompt for ${exportPreview.label}. Nothing was sent to an external service.`
          : "Prepared the default canonical-JSON external AI prompt. Nothing was sent to an external service.",
      };

    case "auto_detect_uploaded_files":
      return state.agentFileCount
        ? { kind: "auto_detect_uploaded_files" }
        : { kind: "respond", message: "Upload one or more files in the agent panel first, then ask me to detect them." };

    case "parse_uploaded_files": {
      if (!state.agentFileCount) return { kind: "respond", message: "What should I parse? Upload a file batch, paste data into an input route, or name the current route." };
      if (state.activeBatch?.metadataOnly) {
        return { kind: "respond", message: "This looks like metadata only. I need an edge, incidence, or hyperedge membership file to build a graph." };
      }
      if (state.activeBatch?.batchUpdate) {
        return { kind: "respond", message: "This looks like update operations. Is it a Batch Updates file for an existing graph, or a new graph dataset?" };
      }
      if (needsBatchMode(state)) {
        return {
          kind: "respond",
          message: batchModeQuestion(state),
          continuation: {
            originalQuery: normalized,
            requestedExportId: exportPreview?.id ?? null,
          },
        };
      }
      if (state.activeBatch?.parseMode === "separate") {
        return { kind: "respond", message: "These files are marked as separate datasets. Select one file or change the batch to “parse together” before building the dashboard's single active graph." };
      }
      const formatId = useCurrentRoute ? state.fmt : state.agentDetection?.formatId;
      if (!formatId) {
        return {
          kind: "auto_detect_uploaded_files",
          continuation: {
            originalQuery: normalized,
            requestedExportId: exportPreview?.id ?? null,
          },
        };
      }
      if (formatId === "custom") {
        return {
          kind: "use_uploaded_files_with_custom_parser",
          requestedExportId: exportPreview?.id ?? null,
          originalQuery: normalized,
          message: exportPreview
            ? `These files need Custom Parser before ${exportPreview.label} can be prepared. I will keep that requested export target pending for this active batch.`
            : "These files need Custom Parser. Generate parser guidance, review the local code, then run it with confirmation.",
        };
      }
      return state.hasGraph
        ? confirmation("parse_uploaded_files", { formatId, requestedExportId: exportPreview?.id ?? null })
        : { kind: "parse_uploaded_files", formatId, requestedExportId: exportPreview?.id ?? null };
    }

    case "explain_uploaded_files": {
      if (!state.agentFileCount) return { kind: "respond", message: "Upload files first and I’ll explain the detected structure." };
      const detection = state.agentDetection;
      const mode = needsBatchMode(state) ? ` ${batchModeQuestion(state)}` : "";
      return { kind: "respond", message: detection
        ? `${detection.label} (${detection.confidence} confidence). ${detection.reason}${mode}`
        : "The active batch has not been detected yet. Try “Auto-detect format”." };
    }

    case "route_uploaded_files":
      if (!state.agentFileCount) return { kind: "respond", message: "Upload files first, then tell me which route to use." };
      if (!route?.formatId) return { kind: "respond", message: "Name a supported input route such as H2V, Incidence, CSR, JSON, Cornell/SNAP, or Custom Parser." };
      return route.formatId === "custom"
        ? { kind: "use_uploaded_files_with_custom_parser", message: needsBatchMode(state) ? batchModeQuestion(state) : "The active batch is available in Custom Parser Studio. Review or generate parser code before running it." }
        : { kind: "route_uploaded_files", formatId: route.formatId, message: `The active batch was routed to ${route.label}.` };

    case "use_uploaded_files_with_custom_parser":
      if (!state.agentFileCount) return { kind: "respond", message: "Upload files first, then I can send the active batch to Custom Parser." };
      return needsBatchMode(state)
        ? { kind: "respond", message: batchModeQuestion(state) }
        : { kind: "use_uploaded_files_with_custom_parser", message: "The active batch is now available in Custom Parser Studio. Review or generate parser code before running it." };

    case "explain_concept":
      return { kind: "respond", message: explainRoute(route?.id) };

    case "switch_tab": {
      if (!route) return { kind: "respond", message: UNKNOWN_RESPONSE };
      if (route.formatId) {
        if (route.formatId === "batch") {
          return { kind: "respond", message: "Batch Updates conversational support is reserved for a future integration. The existing Batch Updates interface remains available for manual use." };
        }
        if (route.formatId === "freeform") {
          return { kind: "respond", message: "Conversational Freeform/NLP conversion is reserved for a future integration. The existing manual Freeform route remains available." };
        }
        if (state.agentFileCount && route.formatId === "custom" && needsBatchMode(state)) {
          return { kind: "respond", message: batchModeQuestion(state) };
        }
        if (state.agentFileCount) {
          return route.formatId === "custom"
            ? { kind: "use_uploaded_files_with_custom_parser", message: "The active batch is available in Custom Parser Studio." }
            : { kind: "route_uploaded_files", formatId: route.formatId, message: `The active batch was routed to ${route.label}.` };
        }
        const alreadySelected = state.fmt === route.formatId;
        return { kind: alreadySelected ? "respond" : "switch_route", routeId: route.id, formatId: route.formatId, message: routeSelected(route.id, alreadySelected) };
      }
      if (route.sectionId) {
        if (!state.hasGraph) return { kind: "respond", message: `No graph is loaded yet, so ${route.label} is not available. Upload or paste data and parse it first.` };
        return { kind: "switch_section", sectionId: route.sectionId, message: `${route.label} opened. ${route.guidance}` };
      }
      if (route.id === "visualization") {
        return state.hasGraph
          ? { kind: "scroll_visualization", message: VISUALIZATION_GUIDANCE }
          : { kind: "respond", message: "No graph is loaded yet. Convert an input first, then I can take you to the graph preview." };
      }
      return { kind: "respond", message: route.guidance };
    }

    case "parse_guidance":
      return route?.formatId && state.fmt !== route.formatId
        ? { kind: "switch_route", routeId: route.id, formatId: route.formatId, message: uploadGuidance(state, route) }
        : { kind: "respond", message: uploadGuidance(state, route) };

    case "custom_parser_guidance":
      if (state.agentFileCount && needsBatchMode(state)) return { kind: "respond", message: batchModeQuestion(state) };
      if (state.agentFileCount) return { kind: "prepare_custom_parser_guidance", message: customParserGuidance() };
      return state.fmt === "custom"
        ? { kind: "respond", message: customParserGuidance() }
        : { kind: "switch_route", routeId: "custom_parser", formatId: "custom", message: customParserGuidance() };

    case "run_custom_parser_request":
      if (needsBatchMode(state)) return { kind: "respond", message: batchModeQuestion(state) };
      return confirmation("run_custom_parser");
    case "apply_custom_parser_request":
      return state.customResultId
        ? confirmation("apply_custom_parser_result")
        : { kind: "respond", message: "No validated custom parser result is available. Run the parser first, review its preview, then ask me to apply it." };

    case "visualization_guidance":
      return state.hasGraph
        ? { kind: "scroll_visualization", message: VISUALIZATION_GUIDANCE }
        : { kind: "respond", message: `No graph is loaded yet. ${VISUALIZATION_GUIDANCE}` };
    case "change_visual_limit":
      if (!Number.isInteger(value) || value < 1 || value > 10000) return { kind: "respond", message: "Choose a visualization limit between 1 and 10,000 hyperedges." };
      if (state.vizLimit === value) return { kind: "respond", message: `Visualization limit is already set to the first ${value.toLocaleString()} hyperedges.` };
      return { kind: "set_visual_limit", value, message: `Visualization limit updated to the first ${value.toLocaleString()} hyperedges.` };

    case "export_guidance":
      if (!state.hasGraph) return { kind: "respond", message: "No graph is loaded yet. Load and convert a graph before selecting or downloading an export." };
      return state.activeSection !== "export"
        ? { kind: "switch_section", sectionId: "export", message: EXPORT_GUIDANCE }
        : { kind: "respond", message: EXPORT_GUIDANCE };
    case "show_mappings":
      return state.hasGraph
        ? { kind: "switch_section", sectionId: "mappings", message: "Mappings opened. H2V, V2H, H2H, and V2V views are available for the current graph." }
        : { kind: "respond", message: "No graph is loaded yet. Convert an input first, then I can open Mappings." };
    case "show_exports":
      return state.hasGraph
        ? { kind: "switch_section", sectionId: "export", message: EXPORT_GUIDANCE }
        : { kind: "respond", message: "No graph is loaded yet. Load and convert a graph before opening export options." };
    case "show_graph_preview":
      return state.hasGraph
        ? { kind: "scroll_visualization", message: VISUALIZATION_GUIDANCE }
        : { kind: "respond", message: "No graph preview is available yet. Convert an input first." };
    case "select_export_preview":
      if (!state.hasGraph) return { kind: "respond", message: "No graph is loaded yet. Load and convert a graph before selecting an export preview." };
      if (!exportPreview) return { kind: "respond", message: EXPORT_GUIDANCE };
      return { kind: "select_export_preview", exportId: exportPreview.id, message: `Selected ${exportPreview.label} export preview. You can review it before downloading.` };

    case "diagnose_error":
      return { kind: "respond", message: diagnosticsResponse(state) };
    case "show_stats":
      return state.hasGraph
        ? { kind: "show_stats", sectionId: "stats", message: graphStatsResponse(state) }
        : { kind: "respond", message: graphStatsResponse(state) };
    case "clear_graph_request":
      return state.hasGraph ? confirmation("clear_graph") : { kind: "respond", message: "No graph is currently loaded, so there is nothing to clear." };
    case "ambiguous_edge_list_export":
      return {
        kind: "respond",
        message: "Hypergraph edge-list export is ambiguous. Do you want incidence CSV, bipartite CSV, or clique/pairwise CSV?",
      };
    case "help":
      return { kind: "respond", message: HELP_RESPONSE };
    default:
      return { kind: "respond", message: UNKNOWN_RESPONSE };
  }
}


