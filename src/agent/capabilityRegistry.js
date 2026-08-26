import { EXPORT_PREVIEWS, getRouteByFormat } from "./routeRegistry.js";
import {
  isAmbiguousEdgeListTarget,
  resolveCanonicalIntent,
} from "./canonicalIntentResolver.js";
import {
  CAPABILITY_CONFIRMATION_ALIASES,
  confirmationActionTypeForCapability as confirmationActionTypeForCapabilityFromPolicy,
  requiresConfirmation,
} from "./confirmationPolicy.js";

export const INPUT_ROUTE_IDS = [
  "simple",
  "cornell",
  "incidence",
  "csv",
  "edgelist",
  "json",
  "v2h",
  "h2h",
  "csr_json",
  "csr_csv",
  "adjlist",
  "freeform",
  "ai_prompt",
  "custom",
  "batch",
];

export const SECTION_IDS = ["mappings", "stats", "export"];
export const EXPORT_IDS = Object.keys(EXPORT_PREVIEWS);
export const GRAPH_VIEW_IDS = ["hypergraph", "linegraph"];
export const GRAPH_LAYOUT_IDS = ["force", "circular", "grid"];
export const PARSE_MODE_IDS = ["together", "separate", "unknown"];

export const ORCHESTRATOR_INTENTS = [
  "explain_concept",
  "switch_tab",
  "parse_guidance",
  "custom_parser_guidance",
  "run_custom_parser_request",
  "apply_custom_parser_request",
  "visualization_guidance",
  "change_visual_limit",
  "export_guidance",
  "select_export_preview",
  "diagnose_error",
  "show_stats",
  "show_mappings",
  "show_exports",
  "show_graph_preview",
  "clear_graph_request",
  "local_runtime_diagnostics",
  "local_model_setup",
  "mapping_spec_workflow",
  "custom_parser_workflow",
  "external_ai_prompt",
  "batch_updates_placeholder",
  "freeform_placeholder",
  "help",
  "unknown",
];

export const ACTION_TYPES = [
  "EXPLAIN_FORMAT",
  "AUTO_DETECT_ACTIVE_BATCH",
  "SELECT_INPUT_ROUTE",
  "PARSE_ACTIVE_BATCH",
  "SHOW_RESULT_SUMMARY",
  "OPEN_SECTION",
  "SELECT_EXPORT_PREVIEW",
  "DOWNLOAD_EXPORT",
  "OPEN_GRAPH_PREVIEW",
  "SET_GRAPH_VIEW",
  "SET_GRAPH_LAYOUT",
  "SET_VIZ_LIMIT",
  "SEARCH_GRAPH_VERTEX",
  "RESET_GRAPH_VIEW",
  "REHEAT_GRAPH",
  "EXPORT_GRAPH_PNG",
  "OPEN_CUSTOM_PARSER",
  "REQUEST_PARSE_MODE",
  "GENERATE_MAPPING_SPEC",
  "VALIDATE_MAPPING_SPEC",
  "REPAIR_MAPPING_SPEC",
  "GENERATE_PARSER_FROM_MAPPING",
  "RUN_CUSTOM_PARSER",
  "APPLY_CUSTOM_RESULT",
  "APPLY_BATCH_UPDATES",
  "CLEAR_GRAPH",
  "GENERATE_EXTERNAL_LLM_PROMPT",
  "SHOW_PLACEHOLDER",
  "ASK_CLARIFICATION",
  "NO_OP",
];

export const ORCHESTRATOR_ACTION_TYPES = ACTION_TYPES.filter(type => type !== "APPLY_BATCH_UPDATES");

export const ACTION_TYPE_SET = new Set(ACTION_TYPES);
export const ORCHESTRATOR_ACTION_TYPE_SET = new Set(ORCHESTRATOR_ACTION_TYPES);
export const INPUT_ROUTE_SET = new Set(INPUT_ROUTE_IDS);
export const SECTION_ID_SET = new Set(SECTION_IDS);
export const EXPORT_ID_SET = new Set(EXPORT_IDS);
export const GRAPH_VIEW_SET = new Set(GRAPH_VIEW_IDS);
export const GRAPH_LAYOUT_SET = new Set(GRAPH_LAYOUT_IDS);
export const PARSE_MODE_SET = new Set(PARSE_MODE_IDS);

export const CAPABILITY_CONFIRMATION_ACTION_TYPES = CAPABILITY_CONFIRMATION_ALIASES;

export const CONFIRMATION_REQUIRED_CAPABILITIES = new Set(
  Object.keys(CAPABILITY_CONFIRMATION_ACTION_TYPES).filter(type => type !== "PARSE_ACTIVE_BATCH"),
);

const unusedNormalizeRemoved = value => String(value ?? "")
  .toLowerCase()
  .replace(/[’]/g, "'")
  .replace(/\s+/g, " ")
  .trim();
void unusedNormalizeRemoved;

function firstString(...values) {
  return values.map(value => String(value ?? "").trim()).find(Boolean) ?? "";
}

export function isSafeVisualLimit(value) {
  return Number.isInteger(value) && value >= 1 && value <= 10000;
}

export function capabilityRequiresConfirmation(actionType, state = {}) {
  const confirmationType = confirmationActionTypeForCapability(actionType);
  if (!confirmationType) return false;
  if (actionType === "PARSE_ACTIVE_BATCH" && !state.hasGraph) return false;
  return requiresConfirmation(confirmationType);
}

export function confirmationActionTypeForCapability(actionType) {
  return confirmationActionTypeForCapabilityFromPolicy(actionType);
}

export function inferExplicitInputRoute(userText) {
  const resolved = resolveCanonicalIntent(userText);
  return resolved.sourceExplicit || resolved.explanationRequested ? (resolved.sourceFormat ?? resolved.explainFormat) : null;
}

export function isAmbiguousEdgeListExport(userText) {
  return isAmbiguousEdgeListTarget(userText, resolveCanonicalIntent(userText));
}

export function routeLabelForFormat(formatId) {
  const route = getRouteByFormat(formatId);
  return route?.label ?? formatId;
}

export function routeGuidanceForFormat(formatId) {
  const route = getRouteByFormat(formatId);
  if (!route) return `I do not have a built-in explanation for ${formatId || "that format"}.`;
  return route.guidance;
}

export function planFromCapabilityAction(action, state = {}) {
  const type = action?.type;
  const message = firstString(action?.message);

  if (type === "ASK_CLARIFICATION") {
    return {
      kind: "respond",
      message: firstString(
        action?.question,
        action?.clarifyingQuestion,
        message,
        "Could you clarify the route, export, or graph operation you want?",
      ),
    };
  }

  if (type === "NO_OP") {
    return {
      kind: "respond",
      message: firstString(message, "No dashboard action is needed for that request."),
    };
  }

  if (type === "EXPLAIN_FORMAT") {
    const formatId = firstString(action.inputRoute, action.route, action.formatId, action.target);
    return {
      kind: "respond",
      message: firstString(message, routeGuidanceForFormat(formatId)),
    };
  }

  if (type === "AUTO_DETECT_ACTIVE_BATCH") {
    return state.agentFileCount
      ? {
        kind: "auto_detect_uploaded_files",
        continuation: action.userIntent || action.exportId || action.exportPreview
          ? {
            originalQuery: firstString(action.userIntent, message),
            requestedExportId: firstString(action.exportId, action.exportPreview, action.target) || null,
          }
          : null,
      }
      : { kind: "respond", message: "Upload an active file batch first, then I can auto-detect its route." };
  }

  if (type === "SELECT_INPUT_ROUTE") {
    const formatId = firstString(action.inputRoute, action.route, action.formatId);
    if (!INPUT_ROUTE_SET.has(formatId)) {
      return { kind: "respond", message: `The requested input route is not available: ${formatId || "(missing)"}.` };
    }
    if (formatId === "batch") {
      return {
        kind: "respond",
        message: "Batch Updates conversational support is reserved for a future integration. The existing Batch Updates interface remains available for manual use.",
      };
    }
    if (formatId === "freeform") {
      return {
        kind: "respond",
        message: "Conversational Freeform/NLP conversion is reserved for a future integration. The existing manual Freeform route remains available.",
      };
    }
    if (formatId === "custom") {
      return state.agentFileCount
        ? { kind: "use_uploaded_files_with_custom_parser", message: firstString(message, "The active batch is available in Custom Parser Studio.") }
        : { kind: "switch_route", formatId, routeId: "custom_parser", message: firstString(message, "Custom Parser Studio opened. Review or generate local parser code before running it.") };
    }
    if (formatId === "ai_prompt") {
      return {
        kind: "switch_route",
        formatId,
        routeId: "ai_prompt",
        message: firstString(message, "AI Prompt route opened. It only prepares a prompt for manual copy/paste."),
      };
    }
    if (state.agentFileCount) {
      return { kind: "route_uploaded_files", formatId, message: firstString(message, `The active batch was routed to ${routeLabelForFormat(formatId)}.`) };
    }
    return {
      kind: "switch_route",
      formatId,
      routeId: getRouteByFormat(formatId)?.id,
      message: firstString(message, `${routeLabelForFormat(formatId)} opened.`),
    };
  }

  if (type === "PARSE_ACTIVE_BATCH") {
    const formatId = firstString(action.inputRoute, action.route, action.formatId, state.agentDetection?.formatId, state.fmt);
    if (formatId === "batch") {
      return {
        kind: "respond",
        message: "Batch Updates conversational support is reserved for a future integration. Use the manual Batch Updates interface to review and apply update operations.",
      };
    }
    if (formatId === "freeform") {
      return {
        kind: "respond",
        message: "Conversational Freeform/NLP conversion is reserved for a future integration. Use the manual Freeform route if you want the deterministic extractor.",
      };
    }
    if (state.agentFileCount) {
      return {
        kind: "parse_uploaded_files",
        formatId,
        requestedExportId: firstString(action.exportId, action.exportPreview, action.target) || null,
      };
    }
    return { kind: "parse_current_input", formatId: INPUT_ROUTE_SET.has(formatId) ? formatId : state.fmt };
  }

  if (type === "SHOW_RESULT_SUMMARY") {
    return state.hasGraph
      ? { kind: "show_result_summary", message: firstString(message, "Current graph summary prepared from verified application state.") }
      : { kind: "respond", message: firstString(message, "No graph is loaded yet. Upload or paste data first, then parse it.") };
  }

  if (type === "OPEN_SECTION") {
    const sectionId = firstString(action.sectionId, action.section, action.target);
    if (!SECTION_ID_SET.has(sectionId)) return { kind: "respond", message: `Unknown dashboard section: ${sectionId || "(missing)"}.` };
    return { kind: "switch_section", sectionId, message: firstString(message, `${sectionId} section opened.`) };
  }

  if (type === "SELECT_EXPORT_PREVIEW") {
    const exportId = firstString(action.exportId, action.exportPreview, action.target);
    if (!EXPORT_ID_SET.has(exportId)) return { kind: "respond", message: `Unknown export preview: ${exportId || "(missing)"}.` };
    return {
      kind: "select_export_preview",
      exportId,
      message: firstString(message, `Selected ${EXPORT_PREVIEWS[exportId]?.label ?? exportId} export preview. You can review it before downloading.`),
    };
  }

  if (type === "DOWNLOAD_EXPORT") {
    const exportId = firstString(action.exportId, action.exportPreview, action.target, state.expId);
    if (!state.hasGraph) return { kind: "respond", message: "Load or convert a graph before starting an export download." };
    if (!EXPORT_ID_SET.has(exportId)) return { kind: "respond", message: `Unknown export download target: ${exportId || "(missing)"}.` };
    return { kind: "download_export", exportId, message: firstString(message, `Download ${EXPORT_PREVIEWS[exportId]?.label ?? exportId}?`) };
  }

  if (type === "OPEN_GRAPH_PREVIEW") {
    return { kind: "scroll_visualization", message: firstString(message, "Graph preview opened.") };
  }

  if (type === "SET_GRAPH_VIEW") {
    const viewMode = firstString(action.viewMode, action.view, action.target);
    return GRAPH_VIEW_SET.has(viewMode)
      ? { kind: "set_graph_view", viewMode, message: firstString(message, `Graph preview switched to ${viewMode === "linegraph" ? "Line Graph" : "Hypergraph"} view.`) }
      : { kind: "respond", message: `Unknown graph view: ${viewMode || "(missing)"}.` };
  }

  if (type === "SET_GRAPH_LAYOUT") {
    const layout = firstString(action.layout, action.target);
    return GRAPH_LAYOUT_SET.has(layout)
      ? { kind: "set_graph_layout", layout, message: firstString(message, `Graph layout switched to ${layout}.`) }
      : { kind: "respond", message: `Unknown graph layout: ${layout || "(missing)"}.` };
  }

  if (type === "SET_VIZ_LIMIT") {
    const value = Number(action.limit ?? action.value);
    return isSafeVisualLimit(value)
      ? { kind: "set_visual_limit", value, message: firstString(message, `Visualization limit updated to the first ${value.toLocaleString()} hyperedges.`) }
      : { kind: "respond", message: "Choose a visualization limit between 1 and 10,000 hyperedges." };
  }

  if (type === "SEARCH_GRAPH_VERTEX") {
    const query = firstString(action.vertexId, action.query, action.target);
    return query
      ? { kind: "search_graph_vertex", query, message: firstString(message, `Searching graph preview for vertex ${query}.`) }
      : { kind: "respond", message: "Name the vertex to search for." };
  }

  if (type === "RESET_GRAPH_VIEW") {
    return { kind: "reset_graph_view", message: firstString(message, "Graph view reset.") };
  }

  if (type === "REHEAT_GRAPH") {
    return { kind: "reheat_graph", message: firstString(message, "Force layout reheated.") };
  }

  if (type === "EXPORT_GRAPH_PNG") {
    if (!state.hasGraph) return { kind: "respond", message: "The graph preview is not available yet. Convert an input first." };
    return { kind: "export_graph_png", message: firstString(message, "Download the graph preview as PNG?") };
  }

  if (type === "OPEN_CUSTOM_PARSER") {
    const requestedExportId = firstString(action.exportId, action.exportPreview, action.target) || null;
    return state.agentFileCount
      ? {
        kind: "use_uploaded_files_with_custom_parser",
        requestedExportId,
        originalQuery: firstString(action.userIntent, message),
        message: requestedExportId
          ? firstString(message, "The active batch is available in Custom Parser Studio. I will keep the requested export target pending until a validated parser result is applied.")
          : firstString(message, "The active batch is available in Custom Parser Studio."),
      }
      : { kind: "switch_route", formatId: "custom", routeId: "custom_parser", message: firstString(message, "Custom Parser Studio opened.") };
  }

  if (type === "REQUEST_PARSE_MODE") {
    const mode = firstString(action.mode, action.parseMode);
    if (mode === "together" || mode === "separate") {
      return {
        kind: "set_batch_parse_mode",
        mode,
        message: firstString(message, mode === "together" ? "The active batch is now set to parse together as one dataset." : "The active batch is now set to parse files separately."),
      };
    }
    return { kind: "respond", message: firstString(action.question, "Should these files be parsed together as one dataset, or treated as separate datasets?") };
  }

  if (type === "GENERATE_MAPPING_SPEC") {
    if (!state.activeBatch) return { kind: "respond", message: "Upload an active file batch first." };
    return state.localModel?.config?.enabled === false
      ? { kind: "generate_deterministic_mapping", message: firstString(message, "The local assistant is disconnected, so I generated a deterministic mapping draft without model refinement.") }
      : { kind: "run_local_model_task", task: "generate_mapping_spec", userIntent: firstString(action.userIntent, message) };
  }

  if (type === "VALIDATE_MAPPING_SPEC") return { kind: "validate_mapping" };
  if (type === "REPAIR_MAPPING_SPEC") return { kind: "auto_repair_mapping" };
  if (type === "GENERATE_PARSER_FROM_MAPPING") return { kind: "generate_parser_from_mapping" };
  if (type === "RUN_CUSTOM_PARSER") return { kind: "run_custom_parser_confirmed" };
  if (type === "APPLY_CUSTOM_RESULT") return { kind: "apply_custom_parser_result_confirmed" };
  if (type === "APPLY_BATCH_UPDATES") {
    return {
      kind: "respond",
      message: "Batch Updates conversational support is reserved for a future integration. The manual Batch Updates interface remains available.",
    };
  }
  if (type === "CLEAR_GRAPH") return { kind: "clear_graph_confirmed" };
  if (type === "GENERATE_EXTERNAL_LLM_PROMPT") {
    return {
      kind: "copy_ai_prompt",
      targetExportId: firstString(action.exportId, action.exportPreview, action.target) || null,
      message: firstString(message, "External AI prompt copied or prepared for manual use."),
    };
  }

  if (type === "SHOW_PLACEHOLDER") {
    return {
      kind: "respond",
      message: firstString(
        message,
        action.placeholder === "batch"
          ? "Batch Updates conversational support is reserved for a future integration. The existing Batch Updates interface remains available for manual use."
          : action.placeholder === "freeform"
            ? "Conversational Freeform/NLP conversion is reserved for a future integration. The existing manual Freeform route remains available."
            : "That dashboard capability is not available through the conversational assistant yet. Use the matching manual dashboard control when available.",
      ),
    };
  }

  return { kind: "respond", message: `Unsupported capability: ${type || "(missing)"}.` };
}

