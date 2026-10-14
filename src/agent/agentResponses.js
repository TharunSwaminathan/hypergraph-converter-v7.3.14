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
  const staticMotifsReady = Boolean(state.candy?.authorized && state.candy?.capabilities?.some(capability => capability.backend === "CUDA_STATIC" && capability.modes?.includes("STATIC")));
  const motifAvailability = staticMotifsReady
    ? "The optional Hypergraph 3-Edge Motifs section can compute 30 structural classes with the qualified CUDA_STATIC Runtime after explicit confirmation."
    : "The optional Hypergraph 3-Edge Motifs section will explain why qualified CUDA_STATIC computation is unavailable; it never selects CPU fallback or projects the graph.";
  return `Current graph: ${state.hyperedgeCount.toLocaleString()} hyperedges, ${state.vertexCount.toLocaleString()} vertices, ${state.incidenceCount.toLocaleString()} incidences. Browser-computed Statistics include cardinality and degree distributions, validation, incidence density, maximum and average degree, and V2V projection density. Line-Graph Triangles counts triangles in the line graph; it is not the 30-class hypergraph motif product. ${motifAvailability} Visualization limit: first ${state.vizLimit.toLocaleString()} hyperedges.`;
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

export const EXPORT_GUIDANCE = "Open Export to preview H2V, V2H, H2H, canonical JSON, incidence CSV, CSR JSON/CSV, and other generated formats for the current graph. Selecting a preview is safe; starting a download remains a separate manual action.";

export const VISUALIZATION_GUIDANCE = "The graph preview appears after a successful conversion. Use fixed or bounded custom limit controls to cap visible hyperedges, choose force/circular/grid layout, search vertices, filter hyperedges in Hypergraph view, scroll to zoom, and drag to pan.";

