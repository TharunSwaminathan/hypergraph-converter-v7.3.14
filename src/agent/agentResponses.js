import { getRouteById } from "./routeRegistry.js";

export const UNKNOWN_RESPONSE = "I can route H2V, V2H, CSR, CSC, JSON, Cornell/SNAP, Custom Parser, visualizations, and exports. For file batches, try \"Infer mapping without model\", \"Auto-repair mapping\", \"Show repair notes\", or \"Generate parser from repaired mapping\". Optional Ollama commands include \"Connect local assistant\", \"Run diagnostics\", and \"Is qwen3:8b installed?\".";

export const HELP_RESPONSE = "I use deterministic rules to control this dashboard. I can explain formats, switch routes, show graph stats, guide active upload batches, and—with confirmation—run or apply a custom parser or clear the graph. Optional Ollama assistance can analyze bounded active-batch previews and draft parser code, but it never runs or changes the graph automatically.";

export function explainRoute(routeId) {
  return getRouteById(routeId)?.guidance ?? UNKNOWN_RESPONSE;
}

export function routeSelected(routeId, alreadySelected = false) {
  const route = getRouteById(routeId);
  if (!route) return UNKNOWN_RESPONSE;
  const prefix = alreadySelected ? `${route.label} is already selected.` : `Switched to ${route.label}.`;
  return `${prefix} ${route.guidance}`;
}

export function graphStatsResponse(state) {
  if (!state.hasGraph || !state.stats) {
    return "No graph is loaded yet. Upload or paste data first, then parse it.";
  }
  return `Current graph: ${state.hyperedgeCount.toLocaleString()} hyperedges, ${state.vertexCount.toLocaleString()} vertices, ${state.incidenceCount.toLocaleString()} incidences. Visualization limit: first ${state.vizLimit.toLocaleString()} hyperedges.`;
}

export function customParserGuidance() {
  return "Custom Parser workflow: upload one or more files → edit parseHypergraph(files, helpers) → run the parser → inspect its logs and normalized preview → apply the result to the graph. Running code and applying its result each require confirmation in chat.";
}

export function uploadGuidance(state, route) {
  const selected = route?.label ?? state.formatLabel ?? "the selected input";
  if (route?.id === "custom_parser") return customParserGuidance();
  if (route?.id === "cornell") {
    return "For Cornell / SNAP data, upload nverts.txt and simplices.txt in their separate fields; times.txt is optional. Then click Convert and compare the graph counts.";
  }
  return `For ${selected}, choose the matching route, use "upload file" above its text area, then click Convert. Auto-detect can help for a pasted single-file format. After a second upload, re-run Convert and verify that the graph counts changed.`;
}

export function diagnosticsResponse(state) {
  const parts = [
    "Upload diagnostics:",
    "a new file replaces the text in the selected input route; confirm that the route matches the file, use Auto-detect when appropriate, and re-run Convert.",
    "Then compare graph statistics to verify the replacement. A second conversion rebuilds the graph preview from the new graph.",
  ];
  if (state.err) parts.push(`Current parse error: ${state.err}`);
  if (state.customErr) parts.push(`Current custom parser error: ${state.customErr}`);
  if (state.warningCount) parts.push(`Current graph warnings: ${state.warningCount}.`);
  if (!state.hasGraph) parts.push("No parsed graph is currently available.");
  return parts.join(" ");
}

export const EXPORT_GUIDANCE = "Load and convert a graph first, then open Export to preview H2V, V2H, H2H, canonical JSON, incidence CSV, CSR JSON/CSV, and other generated formats. Selecting a preview is safe; starting a download remains a separate manual action.";

export const VISUALIZATION_GUIDANCE = "The graph preview appears after a successful conversion. Use the limit controls to cap visible hyperedges, choose force/circular/grid layout, search vertices, scroll to zoom, and drag to pan.";

