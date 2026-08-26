import { classifyIntent } from "./intentClassifier.js";
import { planAgentAction } from "./actionPlanner.js";
import { EXPORT_PREVIEWS, getRouteByFormat } from "./routeRegistry.js";
import { LEGACY_CONTROL_INTENT_SET } from "./actionIntentRegistry.js";

// Control-plane commands are deterministic dashboard operations that must never
// depend on Ollama planning. Source/target conversion still uses the canonical
// intent resolver and ActionPlan pipeline.
const CONTROL_INTENTS = LEGACY_CONTROL_INTENT_SET;

export const QUICK_CONTROL_COMMANDS = Object.freeze({
  testConnection: "Test local model connection",
  listModels: "List local models",
  explainFileRolesWithModel: "Explain file roles with local model",
  generateMappingSpec: "Generate mapping spec",
  repairMappingWithModel: "Repair mapping spec with local model",
  repairParserWithModel: "Repair parser with local model",
});

export function resolveDeterministicControlPlan(userQuery, state = {}) {
  const classified = classifyIntent(userQuery);
  if (!CONTROL_INTENTS.has(classified.intent)) return null;
  return planAgentAction(classified, state);
}

export function isDeterministicControlCommand(userQuery) {
  return CONTROL_INTENTS.has(classifyIntent(userQuery).intent);
}

export function resolveCanonicalControlPlan(canonicalIntent, slots = {}, state = {}) {
  const classification = classificationFromCanonicalIntent(canonicalIntent, slots);
  if (!classification) return null;
  return {
    ...planAgentAction(classification, state),
    canonicalIntent,
    canonicalSlots: slots,
    canonicalPlanner: "dashboard_control_v1",
  };
}

export function classificationFromCanonicalIntent(canonicalIntent, slots = {}) {
  const normalized = `canonical:${canonicalIntent}`;
  if (canonicalIntent === "NAVIGATE_STATS") {
    return { intent: "show_stats", normalized };
  }
  if (canonicalIntent === "NAVIGATE_VISUALIZATION") {
    return { intent: "show_graph_preview", normalized };
  }
  if (canonicalIntent === "OPEN_RUNTIME_DIAGNOSTICS") {
    return { intent: "local_runtime_diagnostics", normalized };
  }
  if (canonicalIntent === "SET_VISUAL_LIMIT") {
    return { intent: "change_visual_limit", value: Number(slots.visualLimit), normalized };
  }
  if (canonicalIntent === "SET_INPUT_ROUTE") {
    const route = routeFromCanonicalSlot(slots.route);
    return route ? { intent: "switch_tab", route, normalized } : null;
  }
  if (canonicalIntent === "SET_EXPORT_FORMAT") {
    const exportPreview = exportPreviewFromCanonicalSlot(slots.exportFormat);
    return { intent: exportPreview ? "select_export_preview" : "export_guidance", exportPreview, normalized };
  }
  return null;
}

function routeFromCanonicalSlot(routeName = "") {
  const key = String(routeName).toLowerCase();
  const formatId = {
    "h2v": "simple",
    "h2v / simple": "simple",
    "v2h": "v2h",
    "h2h": "h2h",
    "csr": "csr_json",
    "csr json": "csr_json",
    "csc": "csr_csv",
    "csc csv": "csr_csv",
    "csr / csc csv": "csr_csv",
    "json": "json",
    "cornell/snap": "cornell",
    "cornell": "cornell",
    "snap": "cornell",
    "custom parser": "custom",
    "ai prompt": "ai_prompt",
  }[key] ?? null;
  return formatId ? getRouteByFormat(formatId) : null;
}

function exportPreviewFromCanonicalSlot(format = "") {
  const key = String(format).toLowerCase();
  if (key.includes("csr") && key.includes("csv")) return EXPORT_PREVIEWS.csr_csv;
  if (key.includes("csc") && key.includes("csv")) return EXPORT_PREVIEWS.csr_csv;
  if (key.includes("csr") && key.includes("json")) return EXPORT_PREVIEWS.csr_json;
  if (key === "json" || key.includes("canonical")) return EXPORT_PREVIEWS.canonical;
  if (key.includes("h2v")) return EXPORT_PREVIEWS.h2v_txt;
  if (key.includes("v2h")) return EXPORT_PREVIEWS.v2h_txt;
  if (key.includes("h2h")) return EXPORT_PREVIEWS.h2h_txt;
  return null;
}
