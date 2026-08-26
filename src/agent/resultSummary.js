function present(value, formatter = value => value) {
  return value === null || value === undefined || value === "" ? null : formatter(value);
}

function numberText(value) {
  return Number.isFinite(Number(value)) ? Number(value).toLocaleString() : String(value);
}

function statusText(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value ? "Detected" : "None";
  if (typeof value === "number") return value > 0 ? `${numberText(value)} detected` : "None";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    if (typeof value.count === "number") return value.count > 0 ? `${numberText(value.count)} detected` : "None";
    if (typeof value.detected === "boolean") return value.detected ? "Detected" : "None";
    if (typeof value.status === "string" && value.status.trim()) return value.status;
    if (typeof value.message === "string" && value.message.trim()) return value.message;
  }
  return null;
}

export const RESULT_SUMMARY_ACTIONS = [
  { id: "open_mappings", label: "Mappings", actionType: "OPEN_SECTION", sectionId: "mappings" },
  { id: "open_statistics", label: "Statistics", actionType: "OPEN_SECTION", sectionId: "stats" },
  { id: "open_exports", label: "Export", actionType: "OPEN_SECTION", sectionId: "export" },
  { id: "open_graph_preview", label: "Graph Preview", actionType: "OPEN_GRAPH_PREVIEW" },
];

export function planFromResultSummaryAction(action = {}, state = {}) {
  if (action.actionType === "OPEN_SECTION") {
    if (!["mappings", "stats", "export"].includes(action.sectionId)) {
      return { kind: "respond", message: "That result action is not available." };
    }
    if (!state.hasGraph) {
      return { kind: "respond", message: "No graph is loaded yet. Convert an input first, then these result sections are available." };
    }
    const labels = { mappings: "Mappings", stats: "Statistics", export: "Export" };
    return {
      kind: "switch_section",
      sectionId: action.sectionId,
      message: `${labels[action.sectionId]} opened from the conversion summary.`,
    };
  }
  if (action.actionType === "OPEN_GRAPH_PREVIEW") {
    return state.hasGraph
      ? { kind: "scroll_visualization", message: "Graph Preview opened from the conversion summary." }
      : { kind: "respond", message: "No graph preview is available yet. Convert an input first." };
  }
  return { kind: "respond", message: "That result action is not available." };
}

export function buildGraphResultSummaryMessage(state = {}, {
  title = "Conversion complete.",
} = {}) {
  if (!state.hasGraph) {
    return {
      text: "No graph is loaded yet. Upload or paste data first, then parse it.",
      actions: [],
    };
  }

  const summary = state.resultSummary ?? {};
  const fields = [
    ["Input format", state.formatLabel ?? state.fmt],
    ["Hyperedges", state.hyperedgeCount],
    ["Vertices", state.vertexCount],
    ["Incidences", state.incidenceCount],
    ["Min cardinality", summary.minCardinality],
    ["Max cardinality", summary.maxCardinality],
    ["Average cardinality", summary.averageCardinality],
    ["Max degree", summary.maxDegree],
    ["Average degree", present(summary.averageDegree, value => Number(value).toFixed(2))],
    ["Incidence density", present(summary.incidenceDensityPercent, value => `${Number(value).toFixed(3)}%`)],
    ["V2V projection density", present(summary.v2vProjectionDensityPercent, value => `${Number(value).toFixed(3)}%`)],
    ["V2V edges", summary.v2vEdgeCount],
    ["Line-graph triangles", summary.triads === null ? "too large to count in browser" : summary.triads],
    ["Duplicate hyperedges", statusText(summary.duplicateStatus)],
    ["Singleton hyperedges", statusText(summary.singletonStatus)],
    ["Validation", summary.validationStatus],
    ["Warnings", summary.warningCount ? summary.warningCount : null],
  ]
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([label, value]) => `- ${label}: ${typeof value === "number" ? numberText(value) : value}`);

  return {
    text: [
      title,
      "",
      ...fields,
      "",
      "Mappings available now: H2V, V2H, H2H, and V2V. You can also open Statistics, choose an Export preview, or view Graph Preview.",
    ].join("\n"),
    actions: RESULT_SUMMARY_ACTIONS,
  };
}
