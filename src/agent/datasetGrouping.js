import { isExpectedOutputFileName } from "./datasetMappingSpec.js";

const UPDATE_FILE = /(?:^|[-_ .])(updates?|changes?|deltas?|patch|stream)(?:[-_ .]|$)/i;

function roleGuess(file) {
  const name = file.fileName.toLowerCase();
  const headers = (file.columns ?? []).map(column => column.name.toLowerCase());
  if (isExpectedOutputFileName(file.fileName)) return "validation_expected_output";
  if (UPDATE_FILE.test(name)) return "update_stream";
  if (headers.some(header => /author_id|participant_id|vertex_id|node_id/.test(header))
    && headers.some(header => /paper_id|event_id|hyperedge_id|group_id|edge_id/.test(header))) return "membership";
  if (/authorships?|membership|incidence|participants?|enrollments?|links?/.test(name)) return "membership";
  if (/authors?|users?|people|vertices|nodes/.test(name)) return "vertex_table";
  if (/papers?|events?|projects?|sessions?|groups?|hyperedges?/.test(name)) return "hyperedge_table";
  if (headers.some(header => /^source$|^target$|^from$|^to$/.test(header))) return "edge_list";
  if (file.format === "matrix_market") return "matrix_coordinate_list";
  return "unknown";
}

function mainStaticFiles(files) {
  return files.filter(file => !["validation_expected_output", "update_stream", "ignored"].includes(roleGuess(file)));
}

function groupId(index) {
  return index === 0 ? "group-main" : `group-${index + 1}`;
}

export function buildDatasetGroupingDraft(datasetProfile, relationshipEvidence = [], {
  parseMode = "unknown",
} = {}) {
  const files = datasetProfile?.files ?? [];
  const validation = files.filter(file => roleGuess(file) === "validation_expected_output");
  const updates = files.filter(file => roleGuess(file) === "update_stream");
  const active = mainStaticFiles(files);
  const strongRelationships = relationshipEvidence.filter(evidence => evidence.confidence >= 0.55);
  const hasComplementaryRoles = active.some(file => roleGuess(file) === "membership")
    && (active.some(file => roleGuess(file) === "vertex_table") || active.some(file => roleGuess(file) === "hyperedge_table"));
  const groups = [];
  if (active.length === 0) {
    groups.push({
      id: "group-main",
      label: "No static graph input detected",
      kind: "unknown",
      fileNames: [],
      confidence: 0.2,
      summary: "No graph-defining files were detected.",
      status: "needs_clarification",
      evidenceIds: [],
      warnings: ["Upload or select graph input files."],
    });
  } else if (parseMode === "separate" && active.length > 1 && !hasComplementaryRoles) {
    active.forEach((file, index) => groups.push({
      id: groupId(index),
      label: file.fileName.replace(/\.[^.]+$/, ""),
      kind: "static_graph",
      fileNames: [file.fileName],
      confidence: 0.72,
      summary: `${file.fileName} is treated as a separate static graph dataset.`,
      status: "draft",
      evidenceIds: [],
      warnings: [],
    }));
  } else {
    groups.push({
      id: "group-main",
      label: hasComplementaryRoles ? "Related multi-file hypergraph" : "Static hypergraph dataset",
      kind: "static_graph",
      fileNames: active.map(file => file.fileName),
      confidence: hasComplementaryRoles || strongRelationships.length ? 0.9 : active.length === 1 ? 0.78 : 0.55,
      summary: hasComplementaryRoles
        ? "Detected complementary vertex/hyperedge/membership roles for one logical hypergraph."
        : strongRelationships.length ? "Detected shared-key evidence for one logical dataset." : "Grouping needs review.",
      status: hasComplementaryRoles || active.length === 1 ? "draft" : "needs_clarification",
      evidenceIds: strongRelationships.slice(0, 8).map(evidence => evidence.id),
      warnings: active.length > 1 && !hasComplementaryRoles && !strongRelationships.length ? ["Multiple graph-like files have weak relationship evidence. Confirm together or separate."] : [],
    });
  }
  for (const file of validation) {
    groups.push({
      id: `validation-${file.fileId}`,
      label: `${file.fileName} validation`,
      kind: "validation_only",
      fileNames: [file.fileName],
      confidence: 0.95,
      summary: `${file.fileName} is excluded from static graph input and used for expected-output comparison.`,
      status: "validated",
      evidenceIds: [],
      warnings: [],
    });
  }
  for (const file of updates) {
    groups.push({
      id: `update-${file.fileId}`,
      label: `${file.fileName} update stream`,
      kind: "update_stream",
      fileNames: [file.fileName],
      confidence: 0.9,
      summary: "Update streams are recognized but not executed in v7.3.0.",
      status: "validated",
      evidenceIds: [],
      warnings: ["Use the existing Batch Updates route for update streams."],
    });
  }
  const nextParseMode = groups.filter(group => group.kind === "static_graph").length > 1
    ? "grouped"
    : active.length > 1 ? "grouped" : "together";
  return {
    parseMode: parseMode === "separate" ? "separate" : nextParseMode,
    groups,
    status: groups.some(group => group.status === "needs_clarification") ? "needs_clarification" : "draft",
    questions: groups.some(group => group.status === "needs_clarification")
      ? [{
        id: "clarify-grouping",
        type: "choose_grouping",
        question: "Should the graph-like files be parsed together as one hypergraph or as separate datasets?",
        reason: "The deterministic relationship evidence is not strong enough to choose safely.",
        options: [
          { id: "together", label: "Treat graph files as one dataset", deterministicPatch: { parseMode: "grouped" } },
          { id: "separate", label: "Treat each graph file separately", deterministicPatch: { parseMode: "separate" } },
        ],
        blocking: true,
      }]
      : [],
  };
}

export function roleGuessesForProfile(datasetProfile) {
  return Object.fromEntries((datasetProfile?.files ?? []).map(file => [file.fileName, roleGuess(file)]));
}
