import { extractFirstJsonObject } from "./modelResponseValidator.js";
import {
  findTargetExportPreview,
  getRouteByFormat,
  resolveExportAlias,
  resolveInputRouteAlias,
} from "./routeRegistry.js";
import {
  capabilityRequiresConfirmation,
  EXPORT_ID_SET,
  GRAPH_LAYOUT_SET,
  GRAPH_VIEW_SET,
  INPUT_ROUTE_SET,
  isAmbiguousEdgeListExport,
  isSafeVisualLimit,
  ORCHESTRATOR_ACTION_TYPE_SET,
  ORCHESTRATOR_INTENTS,
  PARSE_MODE_SET,
  SECTION_ID_SET,
} from "./capabilityRegistry.js";
import { ACTION_PLAN_SCHEMA_VERSION } from "./ollamaActionPlanSchema.js";
import {
  isBatchUpdatesRequest,
  isExternalAiPromptRequest,
  isFreeformRequest,
  resolveCanonicalIntent,
} from "./canonicalIntentResolver.js";

const INTENT_SET = new Set(ORCHESTRATOR_INTENTS);

const normalize = text => String(text ?? "")
  .toLowerCase()
  .replace(/[’]/g, "'")
  .replace(/\s+/g, " ")
  .trim();

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function compactText(value, fallback = "") {
  return String(value ?? fallback).replace(/\s+/g, " ").trim().slice(0, 800);
}

function clonePlain(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

function routeAlias(value) {
  const text = compactText(value);
  if (!text) return null;
  if (INPUT_ROUTE_SET.has(text)) return text;
  return resolveInputRouteAlias(text);
}

function exportAlias(value) {
  const text = compactText(value);
  if (!text) return null;
  if (EXPORT_ID_SET.has(text)) return { id: text };
  return resolveExportAlias(text);
}

function firstRoute(action) {
  return compactText(action?.inputRoute || action?.route || action?.formatId);
}

function hasPriorAutoDetect(actions, index) {
  return actions.slice(0, index).some(action => action.type === "AUTO_DETECT_ACTIVE_BATCH");
}

function hasClarification(actions) {
  return actions.some(action => action.type === "ASK_CLARIFICATION");
}

function validateRouteAction(action, errors, index) {
  const route = firstRoute(action);
  if (!route) errors.push(`actions[${index}] ${action.type} is missing inputRoute.`);
  else if (!INPUT_ROUTE_SET.has(route)) errors.push(`actions[${index}] uses unsupported inputRoute: ${route}.`);
}

function validateExportAction(action, errors, index) {
  const exportId = compactText(action.exportId || action.exportPreview || action.target);
  if (!exportId) errors.push(`actions[${index}] ${action.type} is missing exportId.`);
  else if (!EXPORT_ID_SET.has(exportId)) errors.push(`actions[${index}] uses unsupported export preview: ${exportId}.`);
}

function isBatchUpdatesQuery(text) {
  return isBatchUpdatesRequest(text);
}

function isFreeformQuery(text) {
  return isFreeformRequest(text);
}

function isExternalAiPromptQuery(text) {
  return isExternalAiPromptRequest(text);
}

function routeDependentAction(type) {
  return [
    "SELECT_INPUT_ROUTE",
    "PARSE_ACTIVE_BATCH",
    "SELECT_EXPORT_PREVIEW",
    "OPEN_SECTION",
    "OPEN_GRAPH_PREVIEW",
  ].includes(type);
}

function onlyPlaceholderOrNoop(actions) {
  return actions.length > 0 && actions.every(action => action.type === "SHOW_PLACEHOLDER" || action.type === "NO_OP");
}

const AI_PROMPT_ACTION_TYPES = new Set([
  "GENERATE_EXTERNAL_LLM_PROMPT",
  "ASK_CLARIFICATION",
  "NO_OP",
]);

function onlyAiPromptActions(actions) {
  return actions.length > 0 && actions.every(action => AI_PROMPT_ACTION_TYPES.has(action.type));
}

function normalizeGraphView(value) {
  const text = normalize(value);
  if (text === "line" || text === "line graph" || text === "linegraph") return "linegraph";
  if (text === "hypergraph" || text === "hypergraph view") return "hypergraph";
  return GRAPH_VIEW_SET.has(text) ? text : null;
}

function normalizeGraphLayout(value) {
  const text = normalize(value);
  if (["force", "circular", "grid"].includes(text)) return text;
  return null;
}

function normalizeSection(value) {
  const text = normalize(value);
  if (text === "statistics") return "stats";
  if (text === "downloads" || text === "download" || text === "exports") return "export";
  if (SECTION_ID_SET.has(text)) return text;
  return null;
}

function normalizeActionPlan(plan, { state = {}, userQuery = "" } = {}) {
  const repaired = clonePlain(plan);
  const repairs = [];
  if (!asObject(repaired)) return { plan, repairs };

  if (!repaired.schemaVersion) {
    repaired.schemaVersion = ACTION_PLAN_SCHEMA_VERSION;
    repairs.push("Added missing schemaVersion.");
  }
  if (!repaired.task) {
    repaired.task = "route_user_query";
    repairs.push("Added missing task=route_user_query.");
  }
  if (!asObject(repaired.target)) {
    repaired.target = {};
    repairs.push("Added missing target object.");
  }
  repaired.target = {
    kind: "none",
    routeExplicit: Boolean(repaired.inputRoute),
    exportId: null,
    sectionId: null,
    graphView: null,
    graphLayout: null,
    ...repaired.target,
  };
  if (repaired.inputRoute) {
    const route = routeAlias(repaired.inputRoute);
    if (route && route !== repaired.inputRoute) {
      repaired.inputRoute = route;
      repairs.push("Normalized top-level inputRoute alias.");
    }
  }
  if (repaired.target.exportId) {
    const preview = exportAlias(repaired.target.exportId);
    if (preview && preview.id !== repaired.target.exportId) {
      repaired.target.exportId = preview.id;
      repairs.push("Normalized target export alias.");
    }
  }
  if (repaired.target.sectionId) {
    const section = normalizeSection(repaired.target.sectionId);
    if (section && section !== repaired.target.sectionId) {
      repaired.target.sectionId = section;
      repairs.push("Normalized target section alias.");
    }
  }
  if (repaired.target.graphView) {
    const view = normalizeGraphView(repaired.target.graphView);
    if (view && view !== repaired.target.graphView) {
      repaired.target.graphView = view;
      repairs.push("Normalized target graph view alias.");
    }
  }
  if (repaired.target.graphLayout) {
    const layout = normalizeGraphLayout(repaired.target.graphLayout);
    if (layout && layout !== repaired.target.graphLayout) {
      repaired.target.graphLayout = layout;
      repairs.push("Normalized target graph layout alias.");
    }
  }
  if (typeof repaired.needsClarification !== "boolean") {
    repaired.needsClarification = Boolean((repaired.actions ?? []).some(action => action?.type === "ASK_CLARIFICATION"));
    repairs.push("Defaulted needsClarification from actions.");
  }
  if (repaired.clarifyingQuestion === undefined) repaired.clarifyingQuestion = null;
  if (typeof repaired.reason !== "string") repaired.reason = "Validated deterministic dashboard action plan.";
  if (typeof repaired.userMessage !== "string") repaired.userMessage = "";

  const resolvedIntent = resolveCanonicalIntent(userQuery, state);
  const explicitRoute = resolvedIntent.sourceExplicit || resolvedIntent.explanationRequested
    ? (resolvedIntent.sourceFormat ?? resolvedIntent.explainFormat)
    : null;
  const explicitPreview = resolvedIntent.targetExportPreview;
  const detectedRoute = state.agentDetection?.formatId ?? state.activeBatch?.detectedFormat?.formatId ?? null;
  const actions = Array.isArray(repaired.actions) ? repaired.actions : [];
  repaired.actions = actions.map((candidate, index) => {
    if (!asObject(candidate)) return candidate;
    const action = { ...candidate };
    if (typeof action.requiresConfirmation !== "boolean") {
      action.requiresConfirmation = capabilityRequiresConfirmation(action.type, state);
      repairs.push(`Defaulted requiresConfirmation on actions[${index}].`);
    }
    if (typeof action.reason !== "string" || !action.reason.trim()) {
      action.reason = "Model action normalized before deterministic validation.";
      repairs.push(`Defaulted reason on actions[${index}].`);
    }

    const route = routeAlias(action.inputRoute ?? action.route ?? action.formatId ?? action.target);
    if (route && ["EXPLAIN_FORMAT", "SELECT_INPUT_ROUTE", "PARSE_ACTIVE_BATCH"].includes(action.type)) {
      action.inputRoute = route;
      delete action.route;
      delete action.formatId;
    }
    if (!action.inputRoute && ["SELECT_INPUT_ROUTE", "PARSE_ACTIVE_BATCH", "EXPLAIN_FORMAT"].includes(action.type)) {
      const fallbackRoute = explicitRoute || (action.type === "PARSE_ACTIVE_BATCH" ? detectedRoute : null);
      if (fallbackRoute && INPUT_ROUTE_SET.has(fallbackRoute)) {
        action.inputRoute = fallbackRoute;
        repairs.push(`Repaired missing inputRoute on actions[${index}] from deterministic context.`);
      }
    }

    const exportId = exportAlias(action.exportId ?? action.exportPreview ?? action.target);
    if (exportId && ["SELECT_EXPORT_PREVIEW", "DOWNLOAD_EXPORT", "GENERATE_EXTERNAL_LLM_PROMPT", "PARSE_ACTIVE_BATCH", "OPEN_CUSTOM_PARSER", "AUTO_DETECT_ACTIVE_BATCH"].includes(action.type)) {
      action.exportId = exportId.id;
      delete action.exportPreview;
      if (action.target === exportId.id) delete action.target;
    }
    if (!action.exportId && ["SELECT_EXPORT_PREVIEW", "DOWNLOAD_EXPORT", "GENERATE_EXTERNAL_LLM_PROMPT"].includes(action.type) && explicitPreview) {
      action.exportId = explicitPreview.id;
      repairs.push(`Repaired missing exportId on actions[${index}] from deterministic target phrase.`);
    }
    if (action.type === "AUTO_DETECT_ACTIVE_BATCH"
      && !action.userIntent
      && !resolvedIntent.autoDetectRequested
      && resolvedIntent.wantsParseOrConvert) {
      action.userIntent = String(userQuery ?? "").trim();
      repairs.push(`Repaired missing userIntent on actions[${index}] for post-detection continuation.`);
    }

    if (action.type === "OPEN_SECTION") {
      const section = normalizeSection(action.sectionId ?? action.section ?? action.target);
      if (section) {
        action.sectionId = section;
        delete action.section;
      }
    }
    if (action.type === "SET_GRAPH_VIEW") {
      const view = normalizeGraphView(action.viewMode ?? action.graphView ?? action.target);
      if (view) {
        action.viewMode = view;
        delete action.graphView;
      }
    }
    if (action.type === "SET_GRAPH_LAYOUT") {
      const layout = normalizeGraphLayout(action.layout ?? action.target);
      if (layout) action.layout = layout;
    }
    if (action.type === "SET_VIZ_LIMIT" && action.limit == null && action.value != null) {
      action.limit = Number(action.value);
      delete action.value;
    }
    if (action.type === "REQUEST_PARSE_MODE" && !action.mode && action.parseMode) {
      action.mode = action.parseMode;
      delete action.parseMode;
    }
    if (action.type === "SEARCH_GRAPH_VERTEX" && !action.query && action.vertexId) {
      action.query = action.vertexId;
    }
    return action;
  });
  if (repaired.target?.kind === "export_preview" && !repaired.target.exportId && explicitPreview) {
    repaired.target.exportId = explicitPreview.id;
    repairs.push("Repaired top-level target exportId from deterministic target phrase.");
  }
  return { plan: repaired, repairs };
}

function deriveSemanticExpectation(userQuery, state = {}) {
  const query = normalize(userQuery);
  const resolved = resolveCanonicalIntent(userQuery, state);
  const explicitRoute = resolved.sourceExplicit || resolved.explanationRequested
    ? (resolved.sourceFormat ?? resolved.explainFormat)
    : null;
  const exportPreview = resolved.targetExportPreview;
  const hasGraph = Boolean(state.hasGraph);
  const wantsParseOrConvert = resolved.wantsParseOrConvert || Boolean(resolved.sourceExplicit && resolved.targetExport);
  if (!query) return { kind: "help" };
  if (resolved.ambiguousResetGraph) return { kind: "ambiguous_reset" };
  if (resolved.graphPngExport) return hasGraph ? { kind: "graph_png" } : { kind: "graph_png_unavailable" };
  if (resolved.explanationRequested && explicitRoute) return { kind: "explain_format", inputRoute: explicitRoute };
  if (resolved.autoDetectRequested) return { kind: "auto_detect" };
  if (resolved.batchUpdates) return { kind: "placeholder" };
  if (resolved.freeform) return { kind: "placeholder" };
  if (resolved.ambiguity && !resolved.externalAiPrompt) return { kind: "ask_clarification" };
  if (resolved.currentGraphExport) {
    return { kind: "current_graph_export", exportId: exportPreview.id };
  }
  if (state.agentFileCount && wantsParseOrConvert && /\b(this|these|file|upload|uploaded|batch|dataset|data|content|input)\b/.test(query) && !explicitRoute && !resolved.externalAiPrompt) {
    const detectedRoute = state.agentDetection?.formatId ?? state.activeBatch?.detectedFormat?.formatId ?? null;
    if (detectedRoute && INPUT_ROUTE_SET.has(detectedRoute) && detectedRoute !== "custom") {
      return exportPreview
        ? { kind: "source_to_target", inputRoute: detectedRoute, exportId: exportPreview.id }
        : { kind: "parse_route", inputRoute: detectedRoute };
    }
    return { kind: "auto_detect" };
  }
  if (explicitRoute && wantsParseOrConvert && exportPreview) return { kind: "source_to_target", inputRoute: explicitRoute, exportId: exportPreview.id };
  if (explicitRoute && wantsParseOrConvert) return { kind: "parse_route", inputRoute: explicitRoute };
  if (explicitRoute) return { kind: "route", inputRoute: explicitRoute };
  if (exportPreview) return { kind: "export", exportId: exportPreview.id };
  if (resolved.statsRequested) return { kind: "stats" };
  if (resolved.clearGraphRequested) return { kind: "clear_graph" };
  if (resolved.visualization.resetView) return { kind: "reset_view" };
  if (resolved.visualization.hasControls || resolved.visualization.openPreview) {
    return { kind: "graph_controls", visualization: resolved.visualization };
  }
  return { kind: "unknown" };
}

function hasAction(actions, type, predicate = () => true) {
  return actions.some(action => action?.type === type && predicate(action));
}

function validateSemanticExpectation({ expectation, actions, errors, state = {} }) {
  if (!Array.isArray(actions) || !actions.length) return;
  const noOpOnly = actions.every(action => action.type === "NO_OP" || action.type === "SHOW_PLACEHOLDER");
  switch (expectation.kind) {
    case "auto_detect":
      if (state.agentFileCount && !hasAction(actions, "AUTO_DETECT_ACTIVE_BATCH")) {
        errors.push("Semantic mismatch: auto-detect requests must run AUTO_DETECT_ACTIVE_BATCH when files are uploaded.");
      }
      break;
    case "explain_format":
      if (!hasAction(actions, "EXPLAIN_FORMAT", action => firstRoute(action) === expectation.inputRoute)) {
        errors.push("Semantic mismatch: explain-format requests must use EXPLAIN_FORMAT for the named route.");
      }
      break;
    case "ambiguous_reset":
      if (!hasAction(actions, "ASK_CLARIFICATION")) {
        errors.push("Semantic mismatch: bare \"reset graph\" is ambiguous and must ask whether to reset the view or clear the graph.");
      }
      break;
    case "graph_png":
      if (!hasAction(actions, "EXPORT_GRAPH_PNG")) {
        errors.push("Semantic mismatch: graph PNG export requests must use EXPORT_GRAPH_PNG, not data export previews.");
      }
      break;
    case "current_graph_export":
      if (hasAction(actions, "PARSE_ACTIVE_BATCH")) {
        errors.push("Semantic mismatch: exporting a loaded graph must not reparse the active batch unless the user explicitly asked to reparse.");
      }
      if (!hasAction(actions, "SELECT_EXPORT_PREVIEW", action => compactText(action.exportId) === expectation.exportId)) {
        errors.push(`Semantic mismatch: current graph export target must be ${expectation.exportId}.`);
      }
      break;
    case "source_to_target":
      if (!hasAction(actions, "SELECT_INPUT_ROUTE", action => firstRoute(action) === expectation.inputRoute)) {
        errors.push(`Semantic mismatch: source route must be ${expectation.inputRoute}.`);
      }
      if (state.agentFileCount && !hasAction(actions, "PARSE_ACTIVE_BATCH", action => firstRoute(action) === expectation.inputRoute)) {
        errors.push(`Semantic mismatch: uploaded source conversion must parse using ${expectation.inputRoute}.`);
      }
      if (!hasAction(actions, "SELECT_EXPORT_PREVIEW", action => compactText(action.exportId) === expectation.exportId)) {
        errors.push(`Semantic mismatch: export target must be ${expectation.exportId}.`);
      }
      break;
    case "parse_route":
      if (!hasAction(actions, "SELECT_INPUT_ROUTE", action => firstRoute(action) === expectation.inputRoute)
        && !hasAction(actions, "PARSE_ACTIVE_BATCH", action => firstRoute(action) === expectation.inputRoute)
        && !(expectation.inputRoute === "custom" && hasAction(actions, "OPEN_CUSTOM_PARSER"))) {
        errors.push(`Semantic mismatch: parse requests must use ${expectation.inputRoute}.`);
      }
      break;
    case "route":
      if (!hasAction(actions, "SELECT_INPUT_ROUTE", action => firstRoute(action) === expectation.inputRoute)
        && !(expectation.inputRoute === "custom" && hasAction(actions, "OPEN_CUSTOM_PARSER"))
        && !(expectation.inputRoute === "ai_prompt" && hasAction(actions, "GENERATE_EXTERNAL_LLM_PROMPT"))) {
        errors.push(`Semantic mismatch: route requests must select ${expectation.inputRoute}.`);
      }
      break;
    case "export":
      if (!hasAction(actions, "SELECT_EXPORT_PREVIEW", action => compactText(action.exportId) === expectation.exportId)
        && !hasAction(actions, "GENERATE_EXTERNAL_LLM_PROMPT")) {
        errors.push(`Semantic mismatch: export preview requests must select ${expectation.exportId}.`);
      }
      break;
    case "stats":
      if (!hasAction(actions, "SHOW_RESULT_SUMMARY") && !hasAction(actions, "OPEN_SECTION", action => compactText(action.sectionId) === "stats")) {
        errors.push("Semantic mismatch: stats requests must open stats or show a result summary.");
      }
      break;
    case "clear_graph":
      if (!hasAction(actions, "CLEAR_GRAPH")) errors.push("Semantic mismatch: clear/delete graph requests must use CLEAR_GRAPH with confirmation.");
      break;
    case "reset_view":
      if (!hasAction(actions, "RESET_GRAPH_VIEW")) errors.push("Semantic mismatch: reset view requests must use RESET_GRAPH_VIEW, not CLEAR_GRAPH.");
      break;
    case "graph_controls":
      if (noOpOnly) errors.push("Semantic mismatch: graph control requests cannot be answered with only NO_OP.");
      if (expectation.visualization?.viewMode
        && !hasAction(actions, "SET_GRAPH_VIEW", action => compactText(action.viewMode) === expectation.visualization.viewMode)) {
        errors.push(`Semantic mismatch: graph view must be ${expectation.visualization.viewMode}.`);
      }
      if (expectation.visualization?.layout
        && !hasAction(actions, "SET_GRAPH_LAYOUT", action => compactText(action.layout) === expectation.visualization.layout)) {
        errors.push(`Semantic mismatch: graph layout must be ${expectation.visualization.layout}.`);
      }
      if (expectation.visualization?.limit
        && !hasAction(actions, "SET_VIZ_LIMIT", action => Number(action.limit ?? action.value) === expectation.visualization.limit)) {
        errors.push(`Semantic mismatch: visualization limit must be ${expectation.visualization.limit}.`);
      }
      if (expectation.visualization?.searchVertex
        && !hasAction(actions, "SEARCH_GRAPH_VERTEX", action => compactText(action.query ?? action.vertexId) === expectation.visualization.searchVertex)) {
        errors.push(`Semantic mismatch: graph search query must be ${expectation.visualization.searchVertex}.`);
      }
      if (expectation.visualization?.reheat && !hasAction(actions, "REHEAT_GRAPH")) {
        errors.push("Semantic mismatch: reheat requests must use REHEAT_GRAPH.");
      }
      break;
    default:
      break;
  }
}

export function validateOllamaActionPlan(rawResponse, {
  state = {},
  userQuery = "",
} = {}) {
  const errors = [];
  const warnings = [];
  const extracted = extractFirstJsonObject(rawResponse);
  if (!extracted) {
    return {
      ok: false,
      data: null,
      extracted: false,
      errors: ["The local orchestrator response did not contain a JSON object."],
      warnings,
    };
  }
  const rawPlan = extracted.data ?? extracted;
  if (!asObject(rawPlan)) {
    return {
      ok: false,
      data: null,
      extracted: Boolean(extracted.extracted),
      errors: ["The local orchestrator response was not a JSON object."],
      warnings,
    };
  }
  const normalization = normalizeActionPlan(rawPlan, { state, userQuery });
  const plan = normalization.plan;
  if (normalization.repairs.length) {
    warnings.push(...normalization.repairs.map(note => `ActionPlan normalized: ${note}`));
  }

  if (plan.schemaVersion !== ACTION_PLAN_SCHEMA_VERSION) errors.push(`schemaVersion must be ${ACTION_PLAN_SCHEMA_VERSION}.`);
  if (plan.task !== "route_user_query") errors.push("task must be route_user_query.");
  if (!INTENT_SET.has(plan.intent)) errors.push(`Unsupported intent: ${plan.intent ?? "(missing)"}.`);
  if (plan.inputRoute != null && !INPUT_ROUTE_SET.has(plan.inputRoute)) errors.push(`Unsupported top-level inputRoute: ${plan.inputRoute}.`);
  if (!asObject(plan.target)) errors.push("target must be an object.");
  if (!Array.isArray(plan.actions) || !plan.actions.length) errors.push("actions must contain at least one action.");
  if (Array.isArray(plan.actions) && plan.actions.length > 8) errors.push("actions may contain at most 8 actions.");
  if (typeof plan.needsClarification !== "boolean") errors.push("needsClarification must be boolean.");
  if (plan.needsClarification && !plan.clarifyingQuestion && !hasClarification(plan.actions ?? [])) {
    errors.push("needsClarification=true requires clarifyingQuestion or ASK_CLARIFICATION.");
  }
  if (typeof plan.reason !== "string" || !plan.reason.trim()) errors.push("reason must be a non-empty string.");
  if (typeof plan.userMessage !== "string") errors.push("userMessage must be a string.");

  if (asObject(plan.target)) {
    if (plan.target.exportId != null && !EXPORT_ID_SET.has(plan.target.exportId)) errors.push(`Unsupported target.exportId: ${plan.target.exportId}.`);
    if (plan.target.sectionId != null && !SECTION_ID_SET.has(plan.target.sectionId)) errors.push(`Unsupported target.sectionId: ${plan.target.sectionId}.`);
    if (plan.target.graphView != null && !GRAPH_VIEW_SET.has(plan.target.graphView)) errors.push(`Unsupported target.graphView: ${plan.target.graphView}.`);
    if (plan.target.graphLayout != null && !GRAPH_LAYOUT_SET.has(plan.target.graphLayout)) errors.push(`Unsupported target.graphLayout: ${plan.target.graphLayout}.`);
  }

  const actions = Array.isArray(plan.actions) ? plan.actions : [];
  const resolvedIntent = resolveCanonicalIntent(userQuery, state);
  const explicitRoute = resolvedIntent.sourceExplicit || resolvedIntent.explanationRequested
    ? (resolvedIntent.sourceFormat ?? resolvedIntent.explainFormat)
    : null;
  const topRoute = plan.inputRoute ?? null;
  const hasAutoDetect = actions.some(action => action?.type === "AUTO_DETECT_ACTIVE_BATCH");
  const hasRealDetection = Boolean(state.agentDetection?.formatId || state.activeBatch?.detectedFormat?.formatId);
  const userExplicitlyRequestedDetection = resolvedIntent.autoDetectRequested;

  if (isAmbiguousEdgeListExport(userQuery) && !hasClarification(actions)) {
    errors.push("The user asked for an ambiguous hypergraph edge-list export; the plan must ask whether they want incidence, bipartite, or clique/pairwise output.");
  }

  if ((plan.intent === "batch_updates_placeholder" || isBatchUpdatesQuery(userQuery)) && !onlyPlaceholderOrNoop(actions)) {
    errors.push("Batch Updates chatbot requests are placeholder-only; only SHOW_PLACEHOLDER or NO_OP is allowed.");
  }
  if ((plan.intent === "batch_updates_placeholder" || isBatchUpdatesQuery(userQuery)) && topRoute === "batch") {
    errors.push("Batch Updates placeholder plans must not set inputRoute=batch.");
  }

  if ((plan.intent === "freeform_placeholder" || isFreeformQuery(userQuery)) && !onlyPlaceholderOrNoop(actions)) {
    errors.push("Freeform/NLP chatbot requests are placeholder-only; only SHOW_PLACEHOLDER or NO_OP is allowed.");
  }
  if ((plan.intent === "freeform_placeholder" || isFreeformQuery(userQuery)) && topRoute === "freeform") {
    errors.push("Freeform/NLP placeholder plans must not set inputRoute=freeform.");
  }

  if (plan.intent === "external_ai_prompt" || isExternalAiPromptQuery(userQuery)) {
    if (!onlyAiPromptActions(actions)) {
      errors.push("AI Prompt chatbot requests may only use GENERATE_EXTERNAL_LLM_PROMPT, ASK_CLARIFICATION, or NO_OP actions.");
    }
    if (topRoute && topRoute !== "ai_prompt") {
      errors.push("AI Prompt chatbot requests must not set an unrelated inputRoute.");
    }
  }

  if (hasAutoDetect && actions.some(action => routeDependentAction(action?.type) && action.type !== "AUTO_DETECT_ACTIVE_BATCH")) {
    errors.push("AUTO_DETECT_ACTIVE_BATCH must not be combined with route-dependent parsing, export, or graph-preview actions in the same initial plan.");
  }

  if (hasAutoDetect && hasRealDetection && !userExplicitlyRequestedDetection) {
    errors.push("A valid detection result already exists for the active batch; replan with that detected format instead of running Auto Detect again.");
  }

  actions.forEach((action, index) => {
    if (!asObject(action)) {
      errors.push(`actions[${index}] must be an object.`);
      return;
    }
    if (!ORCHESTRATOR_ACTION_TYPE_SET.has(action.type)) {
      errors.push(`actions[${index}] uses unsupported capability: ${action.type ?? "(missing)"}.`);
      return;
    }
    if (typeof action.requiresConfirmation !== "boolean") {
      errors.push(`actions[${index}].requiresConfirmation must be boolean.`);
    }
    if (capabilityRequiresConfirmation(action.type, state) && action.requiresConfirmation !== true) {
      errors.push(`actions[${index}] ${action.type} requires confirmation in the current state.`);
    }
    if (typeof action.reason !== "string" || !action.reason.trim()) {
      errors.push(`actions[${index}].reason must be non-empty.`);
    }

    if (action.type === "SELECT_INPUT_ROUTE") {
      validateRouteAction(action, errors, index);
      const actionRoute = firstRoute(action);
      if (actionRoute === "batch") {
        errors.push("Batch Updates cannot be selected by chatbot ActionPlans; return SHOW_PLACEHOLDER instead.");
      }
      if (actionRoute === "freeform") {
        errors.push("Freeform/NLP cannot be selected by chatbot ActionPlans; return SHOW_PLACEHOLDER instead.");
      }
      if (explicitRoute && actionRoute && actionRoute !== explicitRoute && !hasClarification(actions)) {
        errors.push(`actions[${index}] conflicts with explicitly requested route ${explicitRoute}.`);
      }
    }
    if (action.type === "EXPLAIN_FORMAT") {
      validateRouteAction(action, errors, index);
    }
    if (action.type === "PARSE_ACTIVE_BATCH") {
      if (state.hasGraph && resolvedIntent.currentGraphExport) {
        errors.push("A canonical graph is already loaded. Export requests should derive from the current graph rather than reparsing the active batch.");
      }
      const actionRoute = firstRoute(action);
      if (actionRoute === "batch" || topRoute === "batch" || state.agentDetection?.formatId === "batch") {
        errors.push("Batch Updates cannot be parsed by chatbot ActionPlans; use SHOW_PLACEHOLDER.");
      }
      if (actionRoute === "freeform" || topRoute === "freeform" || state.agentDetection?.formatId === "freeform") {
        errors.push("Freeform/NLP cannot be parsed by chatbot ActionPlans; use SHOW_PLACEHOLDER.");
      }
      const routeBefore = actions.slice(0, index).find(item => item.type === "SELECT_INPUT_ROUTE");
      const selectedBefore = routeBefore ? firstRoute(routeBefore) : null;
      if (state.agentFileCount && !explicitRoute && !topRoute && !actionRoute && !state.agentDetection?.formatId && !hasPriorAutoDetect(actions, index)) {
        errors.push("PARSE_ACTIVE_BATCH without an explicit route or prior detection must be preceded by AUTO_DETECT_ACTIVE_BATCH.");
      }
      if (explicitRoute && actionRoute && actionRoute !== explicitRoute) {
        errors.push(`PARSE_ACTIVE_BATCH uses ${actionRoute}, but user explicitly requested ${explicitRoute}.`);
      }
      if (explicitRoute && selectedBefore && selectedBefore !== explicitRoute) {
        errors.push(`The selected route ${selectedBefore} conflicts with explicit user route ${explicitRoute}.`);
      }
    }
    if (action.type === "OPEN_SECTION") {
      const section = compactText(action.sectionId || action.section || action.target);
      if (!SECTION_ID_SET.has(section)) errors.push(`actions[${index}] uses unsupported section: ${section || "(missing)"}.`);
    }
    if (action.type === "SELECT_EXPORT_PREVIEW" || action.type === "DOWNLOAD_EXPORT") {
      validateExportAction(action, errors, index);
    }
    if (action.type === "SET_GRAPH_VIEW") {
      const view = compactText(action.viewMode || action.graphView || action.target);
      if (!GRAPH_VIEW_SET.has(view)) errors.push(`actions[${index}] uses unsupported graph view: ${view || "(missing)"}.`);
    }
    if (action.type === "SET_GRAPH_LAYOUT") {
      const layout = compactText(action.layout || action.target);
      if (!GRAPH_LAYOUT_SET.has(layout)) errors.push(`actions[${index}] uses unsupported graph layout: ${layout || "(missing)"}.`);
    }
    if (action.type === "SET_VIZ_LIMIT") {
      const limit = Number(action.limit ?? action.value);
      if (!isSafeVisualLimit(limit)) errors.push(`actions[${index}] uses invalid visualization limit: ${action.limit ?? action.value}.`);
    }
    if (action.type === "REQUEST_PARSE_MODE") {
      const mode = compactText(action.mode || action.parseMode);
      if (mode && !PARSE_MODE_SET.has(mode)) errors.push(`actions[${index}] uses unsupported parse mode: ${mode}.`);
    }
    if (["SELECT_EXPORT_PREVIEW", "DOWNLOAD_EXPORT", "OPEN_GRAPH_PREVIEW", "SET_GRAPH_VIEW", "SET_GRAPH_LAYOUT", "SEARCH_GRAPH_VERTEX", "RESET_GRAPH_VIEW", "REHEAT_GRAPH", "EXPORT_GRAPH_PNG"].includes(action.type) && !state.hasGraph) {
      warnings.push(`${action.type} needs a loaded graph; the dispatcher will respond with guidance if no graph is available.`);
    }
  });

  validateSemanticExpectation({
    expectation: deriveSemanticExpectation(userQuery, state),
    actions,
    errors,
    state,
  });

  return {
    ok: errors.length === 0,
    data: plan,
    rawData: rawPlan,
    normalized: normalization.repairs.length > 0,
    repairs: normalization.repairs,
    extracted: Boolean(extracted.extracted),
    errors,
    warnings,
  };
}

function action(type, params = {}) {
  return {
    type,
    requiresConfirmation: false,
    reason: params.reason ?? `Plan ${type}.`,
    ...params,
  };
}

function actionPlan({ intent, inputRoute = null, target = {}, actions, reason, userMessage }) {
  return {
    schemaVersion: ACTION_PLAN_SCHEMA_VERSION,
    task: "route_user_query",
    intent,
    inputRoute,
    target: {
      kind: "none",
      routeExplicit: Boolean(inputRoute),
      exportId: null,
      sectionId: null,
      graphView: null,
      graphLayout: null,
      ...target,
    },
    actions,
    needsClarification: actions.some(item => item.type === "ASK_CLARIFICATION"),
    clarifyingQuestion: actions.find(item => item.type === "ASK_CLARIFICATION")?.question ?? null,
    reason,
    userMessage,
  };
}

export function buildRuleBasedActionPlan(userQuery, state = {}) {
  const query = normalize(userQuery);
  const resolvedIntent = resolveCanonicalIntent(userQuery, state);
  const explicitRoute = resolvedIntent.sourceExplicit || resolvedIntent.explanationRequested
    ? (resolvedIntent.sourceFormat ?? resolvedIntent.explainFormat)
    : null;
  const exportPreview = resolvedIntent.targetExportPreview;
  const wantsParseOrConvert = resolvedIntent.wantsParseOrConvert || Boolean(resolvedIntent.sourceExplicit && resolvedIntent.targetExport);
  const currentGraphExport = resolvedIntent.currentGraphExport;

  if (!query) {
    return actionPlan({
      intent: "help",
      actions: [action("NO_OP", { reason: "Empty user query.", message: "Ask me to use a route, parse a batch, show stats, change the graph view, or select an export." })],
      reason: "No query text was provided.",
      userMessage: "Ask me to use a route, parse a batch, show stats, change the graph view, or select an export.",
    });
  }

  if (resolvedIntent.explanationRequested && explicitRoute) {
    const route = getRouteByFormat(explicitRoute);
    const message = route?.guidance ?? `I can explain and switch to the ${explicitRoute} route.`;
    return actionPlan({
      intent: "explain_concept",
      inputRoute: explicitRoute,
      target: { kind: "input_route", routeExplicit: true },
      actions: [action("EXPLAIN_FORMAT", { inputRoute: explicitRoute, reason: "User asked for a format explanation.", message })],
      reason: "The user asked for a concept explanation rather than route execution.",
      userMessage: message,
    });
  }

  if (resolvedIntent.autoDetectRequested) {
    return actionPlan({
      intent: "parse_guidance",
      target: { kind: "input_route", routeExplicit: false, exportId: exportPreview?.id ?? null },
      actions: state.agentFileCount
        ? [action("AUTO_DETECT_ACTIVE_BATCH", {
          exportId: exportPreview?.id ?? null,
          reason: "User explicitly requested deterministic format detection.",
        })]
        : [action("NO_OP", {
          reason: "Auto-detection needs an active uploaded file batch.",
          message: "Upload one or more files first, then I can auto-detect the input route.",
        })],
      reason: "Auto-detect requests should be handled by the deterministic file detector before route-dependent work.",
      userMessage: state.agentFileCount
        ? "I will auto-detect the active upload format before choosing a parser."
        : "Upload files first, then I can auto-detect their format.",
    });
  }

  if (resolvedIntent.ambiguity && !resolvedIntent.externalAiPrompt) {
    const question = resolvedIntent.ambiguity.slot === "source"
      ? "Which input format should I use for the uploaded data?"
      : resolvedIntent.ambiguity.type === "JSON_EXPORT"
      ? "Do you want canonical JSON, full JSON, or CSR JSON?"
      : "Do you want an incidence edge list, a bipartite edge list, or a clique/pairwise graph edge list export?";
    return actionPlan({
      intent: resolvedIntent.ambiguity.slot === "source" ? "parse_guidance" : "select_export_preview",
      target: { kind: resolvedIntent.ambiguity.slot === "source" ? "input_route" : "export_preview" },
      actions: [action("ASK_CLARIFICATION", { question, reason: resolvedIntent.ambiguity.message ?? "The requested conversion target is ambiguous." })],
      reason: "The requested conversion has multiple valid meanings.",
      userMessage: question,
    });
  }

  if (resolvedIntent.graphPngExport) {
    if (!state.hasGraph) {
      return actionPlan({
        intent: "visualization_guidance",
        target: { kind: "graph_preview" },
        actions: [action("NO_OP", { reason: "Graph PNG export requires a loaded graph.", message: "The graph preview is not available yet. Convert an input first." })],
        reason: "Graph PNG export cannot run until a graph is loaded.",
        userMessage: "The graph preview is not available yet. Convert an input first.",
      });
    }
    return actionPlan({
      intent: "select_export_preview",
      target: { kind: "graph_preview" },
      actions: [
        action("OPEN_GRAPH_PREVIEW", { reason: "User asked for the graph preview image export." }),
        action("EXPORT_GRAPH_PNG", { requiresConfirmation: true, reason: "Downloading a generated graph PNG requires confirmation." }),
      ],
      reason: "The user requested a visualization/image PNG export, not a data-format export preview.",
      userMessage: "I can export the graph preview as a PNG after confirmation.",
    });
  }

  if (currentGraphExport) {
    return actionPlan({
      intent: "select_export_preview",
      target: { kind: "export_preview", exportId: exportPreview.id, sectionId: "export" },
      actions: [action("SELECT_EXPORT_PREVIEW", { exportId: exportPreview.id, reason: `Derive and display ${exportPreview.label} from the loaded canonical graph.` })],
      reason: "A canonical graph is already loaded, so this export is derived without reparsing source files.",
      userMessage: `Selected ${exportPreview.label} from the current graph.`,
    });
  }

  if (resolvedIntent.batchUpdates) {
    const message = "Batch Updates conversational support is reserved for a future integration. The existing Batch Updates interface remains available for manual use.";
    return actionPlan({
      intent: "batch_updates_placeholder",
      target: { kind: "placeholder" },
      actions: [action("SHOW_PLACEHOLDER", { placeholder: "batch", reason: "Batch Updates is chatbot-placeholder-only in this release.", message })],
      reason: "Batch Updates cannot be executed or opened by chatbot orchestration in this release.",
      userMessage: message,
    });
  }

  if (resolvedIntent.freeform) {
    const message = "Conversational Freeform/NLP conversion is reserved for a future integration. The existing manual Freeform route remains available.";
    return actionPlan({
      intent: "freeform_placeholder",
      target: { kind: "placeholder" },
      actions: [action("SHOW_PLACEHOLDER", { placeholder: "freeform", reason: "Freeform/NLP is chatbot-placeholder-only in this release.", message })],
      reason: "Freeform/NLP cannot be activated or parsed by chatbot orchestration in this release.",
      userMessage: message,
    });
  }

  if (resolvedIntent.runtimeDiagnosticsRequested) {
    return actionPlan({
      intent: "local_runtime_diagnostics",
      target: { kind: "runtime_diagnostics" },
      actions: [action("NO_OP", { reason: "Runtime diagnostics are handled by deterministic local-runtime buttons.", message: "Use the Local Runtime Diagnostics buttons to test direct Ollama, the local bridge, and generation reachability." })],
      reason: "The diagnostics panel is already deterministic and local-only.",
      userMessage: "Use the Local Runtime Diagnostics buttons to test direct Ollama, the local bridge, and generation reachability.",
    });
  }

  if (resolvedIntent.mappingsRequested && !exportPreview) {
    return actionPlan({
      intent: "show_mappings",
      target: { kind: "dashboard_section", sectionId: "mappings" },
      actions: [action("OPEN_SECTION", { sectionId: "mappings", reason: "User requested the graph mappings section." })],
      reason: "The request maps directly to the Mappings section.",
      userMessage: "Mappings opened.",
    });
  }

  if (/\b(show|open|display|view)\b.*\bgraph preview\b|\bvisuali[sz]e\b.*\bgraph\b/.test(query)) {
    return actionPlan({
      intent: "show_graph_preview",
      target: { kind: "graph_preview" },
      actions: [action("OPEN_GRAPH_PREVIEW", { reason: "User requested the graph preview." })],
      reason: "The request maps directly to Graph Preview.",
      userMessage: "Graph Preview opened.",
    });
  }

  if (resolvedIntent.exportsRequested) {
    return actionPlan({
      intent: "show_exports",
      target: { kind: "dashboard_section", sectionId: "export" },
      actions: [action("OPEN_SECTION", { sectionId: "export", reason: "User requested export options." })],
      reason: "The request maps directly to the Export section.",
      userMessage: "Export options opened.",
    });
  }

  if (resolvedIntent.ambiguousResetGraph) {
    const question = "Do you want to reset only the graph view/zoom, or clear the parsed graph data?";
    return actionPlan({
      intent: "visualization_guidance",
      target: { kind: "graph_preview" },
      actions: [action("ASK_CLARIFICATION", { question, reason: "Bare reset graph is ambiguous between a safe view reset and destructive graph clearing." })],
      reason: "The phrase reset graph is ambiguous.",
      userMessage: question,
    });
  }

  const graphActions = [];
  if (resolvedIntent.visualization.viewMode) graphActions.push(action("SET_GRAPH_VIEW", { viewMode: resolvedIntent.visualization.viewMode, reason: "User asked for graph view mode." }));
  if (resolvedIntent.visualization.layout) graphActions.push(action("SET_GRAPH_LAYOUT", { layout: resolvedIntent.visualization.layout, reason: "User asked for graph layout." }));
  if (resolvedIntent.visualization.limit) {
    graphActions.push(action("SET_VIZ_LIMIT", { limit: resolvedIntent.visualization.limit, reason: "User requested a visualization hyperedge limit." }));
  }
  if (resolvedIntent.visualization.searchVertex) graphActions.push(action("SEARCH_GRAPH_VERTEX", { query: resolvedIntent.visualization.searchVertex, reason: "User asked to search/highlight a vertex." }));
  if (resolvedIntent.visualization.resetView) graphActions.push(action("RESET_GRAPH_VIEW", { reason: "User asked to reset graph view." }));
  if (resolvedIntent.visualization.reheat) graphActions.push(action("REHEAT_GRAPH", { reason: "User asked to reheat the force layout." }));
  if (graphActions.length) {
    return actionPlan({
      intent: "visualization_guidance",
      target: { kind: "graph_preview", graphView: graphActions.find(item => item.viewMode)?.viewMode ?? null, graphLayout: graphActions.find(item => item.layout)?.layout ?? null },
      actions: [action("OPEN_GRAPH_PREVIEW", { reason: "Graph preview controls were requested." }), ...graphActions],
      reason: "The request maps to graph preview controls.",
      userMessage: "Graph preview updated.",
    });
  }

  if (/\b(stats?|statistics|how many vertices|how many hyperedges|how many incidences)\b/.test(query)) {
    return actionPlan({
      intent: "show_stats",
      target: { kind: "dashboard_section", sectionId: "stats" },
      actions: [action("OPEN_SECTION", { sectionId: "stats", reason: "User requested graph statistics." }), action("SHOW_RESULT_SUMMARY", { reason: "Summarize current graph state." })],
      reason: "The request maps to the Statistics section and graph summary.",
      userMessage: state.hasGraph ? "Showing current graph statistics." : "No graph is loaded yet. Upload or paste data first, then parse it.",
    });
  }

  if (/\b(clear|delete|remove)\b.*\b(graph|hypergraph|current graph)\b|\bclear graph\b/.test(query)) {
    return actionPlan({
      intent: "clear_graph_request",
      target: { kind: "none" },
      actions: [action("CLEAR_GRAPH", { requiresConfirmation: true, reason: "Clearing the graph is destructive." })],
      reason: "User requested clearing the parsed graph.",
      userMessage: "This will clear the current graph after confirmation.",
    });
  }

  if (/\b(run|execute|start|test)\b.*\bcustom parser\b|\brun my parser\b/.test(query)) {
    return actionPlan({
      intent: "run_custom_parser_request",
      target: { kind: "custom_parser" },
      actions: [action("RUN_CUSTOM_PARSER", { requiresConfirmation: true, reason: "Running local parser code requires user confirmation." })],
      reason: "User asked to run Custom Parser code.",
      userMessage: "Running the custom parser requires confirmation.",
    });
  }

  if (/\bapply\b.*\b(parser result|custom result|custom parser)\b|\bapply result\b/.test(query)) {
    return actionPlan({
      intent: "apply_custom_parser_request",
      target: { kind: "custom_parser" },
      actions: [action("APPLY_CUSTOM_RESULT", { requiresConfirmation: true, reason: "Applying a custom parser result may replace the graph." })],
      reason: "User asked to apply the parser result.",
      userMessage: "Applying the custom parser result requires confirmation.",
    });
  }

  if (/\b(custom parser|multiple files|parser code)\b/.test(query)) {
    return actionPlan({
      intent: "custom_parser_guidance",
      inputRoute: "custom",
      target: { kind: "custom_parser", routeExplicit: true },
      actions: [action("OPEN_CUSTOM_PARSER", { reason: "User asked for Custom Parser workflow." })],
      reason: "Custom Parser handles unusual or multi-file datasets.",
      userMessage: "Custom Parser Studio opened.",
    });
  }

  if (/\b(generate|create|infer)\b.*\bmapping(?: spec)?\b|\bmap these files\b/.test(query)) {
    return actionPlan({
      intent: "mapping_spec_workflow",
      target: { kind: "mapping_workflow" },
      actions: [action("GENERATE_MAPPING_SPEC", { reason: "User asked for a DatasetMappingSpec workflow." })],
      reason: "Mapping spec generation uses deterministic pre-mapping plus optional local model refinement.",
      userMessage: "Starting the mapping workflow.",
    });
  }

  if (/\b(ai prompt|llm prompt|external ai prompt|claude prompt|chatgpt prompt|gemini prompt|prompt for (?:claude|chatgpt|gemini)|generate (?:a )?prompt)\b/.test(query)) {
    if (isAmbiguousEdgeListExport(query)) {
      const question = "For the external prompt, should the model produce incidence memberships, a vertex-hyperedge bipartite edge list, or a clique/pairwise vertex projection?";
      return actionPlan({
        intent: "external_ai_prompt",
        target: { kind: "placeholder" },
        actions: [action("ASK_CLARIFICATION", { question, reason: "The requested edge-list target is ambiguous." })],
        reason: "AI Prompt target is ambiguous.",
        userMessage: question,
      });
    }
    const targetExport = exportPreview ?? findTargetExportPreview(query);
    return actionPlan({
      intent: "external_ai_prompt",
      inputRoute: "ai_prompt",
      target: { kind: targetExport ? "export_preview" : "input_route", routeExplicit: true, exportId: targetExport?.id ?? null },
      actions: [
        action("GENERATE_EXTERNAL_LLM_PROMPT", {
          exportId: targetExport?.id ?? "canonical",
          reason: targetExport ? `Prepare a target-specific external prompt for ${targetExport.label}.` : "Prepare the default canonical-JSON external prompt without sending it anywhere.",
          message: targetExport
            ? `Prepared an external AI prompt for ${targetExport.label}. Nothing was sent to an external service.`
            : "Prepared the default canonical-JSON external AI prompt. Nothing was sent to an external service.",
        }),
      ],
      reason: "The AI Prompt route is prompt-only and manual-copy.",
      userMessage: targetExport
        ? `Prepared an external AI prompt for ${targetExport.label}.`
        : "Prepared the default canonical-JSON external AI prompt.",
    });
  }

  const outputConversionWithoutInputRoute = state.agentFileCount && wantsParseOrConvert && /\b(this|these|file|upload|uploaded|batch|dataset|data|content|input)\b/.test(query) && !explicitRoute;
  if (outputConversionWithoutInputRoute) {
    const detectedRoute = state.agentDetection?.formatId ?? state.activeBatch?.detectedFormat?.formatId ?? null;
    if (detectedRoute === "custom") {
      return actionPlan({
        intent: "custom_parser_guidance",
        inputRoute: "custom",
        target: { kind: exportPreview ? "export_preview" : "custom_parser", routeExplicit: false, exportId: exportPreview?.id ?? null },
        actions: [action("OPEN_CUSTOM_PARSER", { exportId: exportPreview?.id ?? null, reason: "Auto Detect found a custom/unknown format; Custom Parser is the safe next route." })],
        reason: "The deterministic detector did not match a built-in parser; do not guess the nearest route.",
        userMessage: exportPreview
          ? `This upload needs Custom Parser before ${exportPreview.label} can be prepared.`
          : "This upload needs Custom Parser before it can be converted.",
      });
    }
    if (detectedRoute && INPUT_ROUTE_SET.has(detectedRoute)) {
      const actions = [
        action("SELECT_INPUT_ROUTE", { inputRoute: detectedRoute, reason: "Use the deterministic detector result for the active batch." }),
        action("PARSE_ACTIVE_BATCH", {
          inputRoute: detectedRoute,
          requiresConfirmation: Boolean(state.hasGraph),
          reason: "Parse the active batch using the real detector result.",
        }),
      ];
      if (exportPreview) {
        actions.push(action("SELECT_EXPORT_PREVIEW", { exportId: exportPreview.id, reason: `User requested ${exportPreview.label}.` }));
      }
      return actionPlan({
        intent: "parse_guidance",
        inputRoute: detectedRoute,
        target: { kind: exportPreview ? "export_preview" : "input_route", routeExplicit: false, exportId: exportPreview?.id ?? null, sectionId: exportPreview ? "export" : null },
        actions,
        reason: "A deterministic detection result already exists, so the workflow can resume without another Auto Detect action.",
        userMessage: exportPreview
          ? `Using detected ${detectedRoute} input, then preparing ${exportPreview.label}.`
          : `Using detected ${detectedRoute} input.`,
      });
    }
    return actionPlan({
      intent: "parse_guidance",
      target: { kind: exportPreview ? "export_preview" : "input_route", routeExplicit: false, exportId: exportPreview?.id ?? null },
      actions: [action("AUTO_DETECT_ACTIVE_BATCH", {
        userIntent: userQuery,
        exportId: exportPreview?.id ?? null,
        reason: "User asked to convert an upload without specifying its input format.",
      })],
      reason: "The first safe step for implicit input routing is deterministic auto-detection.",
      userMessage: "I need to auto-detect the active upload format before parsing or exporting it.",
    });
  }

  if (explicitRoute) {
    const actions = [action("SELECT_INPUT_ROUTE", { inputRoute: explicitRoute, reason: "User explicitly named an input route." })];
    if (state.agentFileCount && wantsParseOrConvert) {
      actions.push(action("PARSE_ACTIVE_BATCH", {
        inputRoute: explicitRoute,
        requiresConfirmation: Boolean(state.hasGraph),
        reason: "User asked to parse/convert the active upload using the explicit route.",
      }));
      if (exportPreview) {
        actions.push(action("SELECT_EXPORT_PREVIEW", { exportId: exportPreview.id, reason: `User requested ${exportPreview.label}.` }));
      }
    }
    return actionPlan({
      intent: /\b(what is|explain|how does)\b/.test(query) ? "explain_concept" : "switch_tab",
      inputRoute: explicitRoute,
      target: { kind: exportPreview ? "export_preview" : "input_route", routeExplicit: true, exportId: exportPreview?.id ?? null, sectionId: exportPreview ? "export" : null },
      actions,
      reason: "The user explicitly named a supported input route.",
      userMessage: exportPreview ? `Selected ${explicitRoute} route and planned ${exportPreview.label} preview after parsing.` : `Selected ${explicitRoute} route.`,
    });
  }

  if (exportPreview) {
    return actionPlan({
      intent: "select_export_preview",
      target: { kind: "export_preview", exportId: exportPreview.id, sectionId: "export" },
      actions: [action("SELECT_EXPORT_PREVIEW", { exportId: exportPreview.id, reason: `Select and display the requested ${exportPreview.label}.` })],
      reason: "The request maps to an export preview.",
      userMessage: `Selected ${exportPreview.label} export preview.`,
    });
  }

  return actionPlan({
    intent: "unknown",
    target: { kind: "none" },
    actions: [action("NO_OP", { reason: "No supported route or capability was confidently identified.", message: "I can route H2V, V2H, CSR, CSC, JSON, Cornell/SNAP, Custom Parser, visualizations, mapping workflow, diagnostics, and exports. Try “Use CSR”, “Show stats”, or “Help me parse multiple files.”" })],
    reason: "No deterministic capability matched the query.",
    userMessage: "I can route H2V, V2H, CSR, CSC, JSON, Cornell/SNAP, Custom Parser, visualizations, mapping workflow, diagnostics, and exports.",
  });
}

