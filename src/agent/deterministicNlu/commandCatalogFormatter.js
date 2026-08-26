import {
  COMMAND_CATALOG,
  INPUT_FORMAT_REFERENCES,
  getQuickStartEntries,
} from "./commandCatalog.js";
import { searchCommandCatalog } from "./commandCatalogSearch.js";
import {
  COMMAND_AVAILABILITY,
  COMMAND_CATEGORY_LABELS,
  COMMAND_CATEGORIES,
  CONFIRMATION,
  categoryLabel,
} from "./commandCatalogSchema.js";

export function badgeText(entry) {
  const badges = [];
  if (entry.sideEffect === "read_only") badges.push("Read only");
  if (entry.sideEffect === "graph_edit_preview") badges.push("Graph preview");
  if (entry.sideEffect === "reversible_mapping_edit") badges.push("Mapping edit");
  if (entry.sideEffect === "reversible_grouping_edit") badges.push("Grouping edit");
  if (entry.sideEffect === "file_picker") badges.push("File picker");
  if (entry.sideEffect === "batch_state_edit") badges.push("Batch state");
  if (entry.sideEffect === "destructive_batch_state") badges.push("Destructive batch state");
  if (entry.sideEffect === "runtime_control") badges.push("Runtime control");
  if (entry.sideEffect === "runtime_probe") badges.push("Runtime probe");
  if (entry.sideEffect === "confirmation_control") badges.push("Pending control");
  if (entry.sideEffect === "download_or_copy") badges.push("Download/copy");
  if (entry.confirmation === CONFIRMATION.PREVIEW_CONFIRMATION) badges.push("Confirmation required");
  if (entry.confirmation === CONFIRMATION.RUN_CONFIRMATION) badges.push("Run confirmation");
  if (entry.confirmation === CONFIRMATION.APPLY_CONFIRMATION) badges.push("Apply confirmation");
  if (entry.confirmation === CONFIRMATION.PENDING_CONTROL) badges.push("Pending action");
  if (entry.confirmation === CONFIRMATION.RUNTIME_CONTROL) badges.push("Runtime only");
  if (entry.confirmation === CONFIRMATION.DOWNLOAD_OR_COPY) badges.push("Download/copy");
  if (entry.availability === COMMAND_AVAILABILITY.PANEL_ONLY) badges.push("Panel only");
  if ((entry.requiredContext ?? []).includes("loaded_graph")) badges.push("Requires loaded graph");
  if ((entry.requiredContext ?? []).includes("uploaded_files")) badges.push("Requires uploaded files");
  if ((entry.requiredContext ?? []).includes("pending_action")) badges.push("Requires pending action");
  if ((entry.requiredContext ?? []).includes("compatible_pending_confirmation")) badges.push("Requires compatible confirmation");
  if ((entry.requiredContext ?? []).includes("active_cancellable_work")) badges.push("Requires active work");
  if ((entry.requiredContext ?? []).includes("parser_result_ready")) badges.push("Requires parser result");
  if ((entry.requiredContext ?? []).includes("existing_batch")) badges.push("Requires existing batch");
  if (entry.worksOffline) badges.push("Offline");
  return badges;
}

export function catalogExampleActions(entries, limit = 4) {
  return entries
    .flatMap(entry => (entry.examples ?? []).map(example => ({ entry, example })))
    .slice(0, limit)
    .map(({ entry, example }, index) => ({
      id: `try-${entry.id}-${index}`,
      label: example.text.length > 34 ? `${example.text.slice(0, 31)}...` : example.text,
      insert: example.text,
    }));
}

export function composeHelpQueryResponse(query = {}) {
  const intent = query.intent ?? "SHOW_HELP_OVERVIEW";
  const searchText = query.searchText ?? "";
  if (intent === "LIST_CONFIRMATION_COMMANDS") {
    const entries = COMMAND_CATALOG.filter(entry => [
      CONFIRMATION.PREVIEW_CONFIRMATION,
      CONFIRMATION.RUN_CONFIRMATION,
      CONFIRMATION.APPLY_CONFIRMATION,
    ].includes(entry.confirmation));
    return responseForEntries("Commands that require confirmation", entries, "These commands prepare a preview or staged action first. You still have to click Confirm before graph-changing/parser-running work happens.");
  }
  if (intent === "LIST_READ_ONLY_COMMANDS") {
    const entries = COMMAND_CATALOG.filter(entry => entry.sideEffect === "read_only" && entry.availability !== COMMAND_AVAILABILITY.FORMAT_REFERENCE);
    return responseForEntries("Read-only deterministic help and questions", entries, "These requests do not change mapping, parser, dashboard, or graph state.");
  }
  if (intent === "EXPLAIN_QUOTED_IDENTIFIERS") {
    const entry = COMMAND_CATALOG.find(item => item.id === "quoted.identifiers");
    return {
      text: [
        "Quoted identifiers preserve literal graph IDs.",
        "Unquoted wording such as `a vertex 6` is normalized to `6`. Quoted wording such as `\"a vertex 6\"` is kept as the literal ID `a vertex 6`.",
        "Use quotes for IDs with spaces, punctuation, or words like vertex, node, hyperedge, edge, or group.",
      ].join("\n\n"),
      actions: catalogExampleActions([entry].filter(Boolean), 3),
    };
  }
  if (intent === "EXPLAIN_AMBIGUITY") {
    return {
      text: [
        "When a reference is ambiguous, the deterministic assistant asks for clarification instead of guessing.",
        "Nothing changes while clarification is pending. Stale corrections are rejected and you can re-issue the command with the exact file, column, hyperedge, or vertex ID.",
      ].join("\n\n"),
      actions: [
        { id: "open-help-ambiguity", label: "Open full Help", local: "help" },
      ],
    };
  }
  if (intent === "LIST_INPUT_FORMATS") {
    return {
      text: [
        "Supported input routes are documented in the command catalog:",
        INPUT_FORMAT_REFERENCES.map(format => `- ${format.name}: ${format.expectations} Related command: \`${format.relatedCommand}\`.`).join("\n"),
      ].join("\n\n"),
      actions: [
        { id: "open-help-formats", label: "Open full Help", local: "help" },
        { id: "try-h2v-input", label: "Use H2V input", insert: "Use H2V input" },
        { id: "try-csr-input", label: "Use CSR input", insert: "Use CSR input" },
      ],
    };
  }
  if (intent === "EXPLAIN_PANEL_ONLY_FEATURE") {
    const algorithmEntries = COMMAND_CATALOG.filter(entry => entry.category === COMMAND_CATEGORIES.ALGORITHMS
      && entry.availability === COMMAND_AVAILABILITY.PANEL_ONLY);
    return {
      text: [
        "Algorithms are panel-only in this build; the deterministic chatbot documents and navigates, but does not execute BFS/DFS/Dijkstra as chat commands.",
        algorithmEntries.map(entry => `- ${entry.title} - Panel only.`).join("\n"),
        "Open the Algorithms panel, choose the algorithm, select required vertices, and run it there.",
      ].join("\n\n"),
      actions: [{ id: "open-help-algorithms", label: "Open full Help", local: "help" }],
    };
  }
  if (intent === "LIST_COMMAND_CATEGORY") {
    const category = query.category ?? categoryFromSearch(searchText);
    const entries = COMMAND_CATALOG.filter(entry => entry.category === category && entry.availability !== COMMAND_AVAILABILITY.FORMAT_REFERENCE);
    return responseForEntries(`${categoryLabel(category)} commands`, entries, "These are supported command patterns, not a case-sensitive command language.");
  }
  if (intent === "EXPLAIN_COMMAND" || intent === "EXPLAIN_ACTION_COMMAND" || intent === "FIND_COMMAND") {
    const entries = searchCommandCatalog({ query: searchText, limit: 5 }).filter(entry => entry.availability !== COMMAND_AVAILABILITY.FORMAT_REFERENCE);
    return responseForEntries(entries.length ? "Matching deterministic commands" : "No exact command match", entries, entries.length
      ? "This is read-only Help. Nothing has changed, no confirmation was staged, and examples are inserted only if you choose a Try button."
      : "Try `Show graph commands`, `Which commands require confirmation?`, or open full Help.");
  }
  const quick = getQuickStartEntries();
  return {
    text: [
      "The deterministic chatbot can route dashboard navigation, dataset mapping/grouping edits, Custom Parser workflow steps, graph mutation previews, and read-only explanations without model calls.",
      "Quick starts:",
      quick.map(entry => `- ${entry.title}: ${entry.examples?.[0]?.text ? `\`${entry.examples[0].text}\`` : entry.summary}`).join("\n"),
      "Graph edits and parser run/apply requests are confirmation-gated. Help queries are always read-only.",
    ].join("\n\n"),
    actions: [
      { id: "open-full-help", label: "Open full Help", local: "help" },
      ...catalogExampleActions(quick, 3),
    ],
  };
}

function responseForEntries(title, entries, intro) {
  const visible = entries.slice(0, 8);
  return {
    text: [
      title,
      intro,
      visible.length
        ? visible.map(entry => `- ${entry.title}: ${entry.summary} ${entry.examples?.[0]?.text ? `Example: \`${entry.examples[0].text}\`.` : ""}`).join("\n")
        : "No catalog entries match that request.",
    ].join("\n\n"),
    actions: [
      { id: "open-full-help", label: "Open full Help", local: "help" },
      ...catalogExampleActions(visible, 4),
    ],
  };
}

function categoryFromSearch(searchText = "") {
  const q = searchText.toLowerCase();
  if (/\bgraph|vertex|hyperedge|incidence|mutation\b/.test(q)) return COMMAND_CATEGORIES.GRAPH_EDITING;
  if (/\bmapping|key|relationship|paper|author|column\b/.test(q)) return COMMAND_CATEGORIES.DATASET_MAPPING;
  if (/\bgroup|validation|update stream|ignore|separate|together\b/.test(q)) return COMMAND_CATEGORIES.DATASET_GROUPING;
  if (/\bparser|plan|custom\b/.test(q)) return COMMAND_CATEGORIES.CUSTOM_PARSER_WORKFLOW;
  if (/\bdashboard|route|visual|stats|export|diagnostics\b/.test(q)) return COMMAND_CATEGORIES.DASHBOARD_NAVIGATION;
  if (/\balgorithm|bfs|dfs|dijkstra|components|k-core|coreness\b/.test(q)) return COMMAND_CATEGORIES.ALGORITHMS;
  return COMMAND_CATEGORIES.QUESTIONS_EXPLANATIONS;
}

export function generateCommandReferenceMarkdown() {
  const lines = [
    "# Deterministic Command Reference",
    "",
    "Generated from `src/agent/deterministicNlu/commandCatalog.js`.",
    "Do not edit manually.",
    "",
    "These are supported command patterns and examples, not a case-sensitive command language. The deterministic assistant accepts several natural-language variations.",
    "",
  ];
  for (const [category, label] of Object.entries(COMMAND_CATEGORY_LABELS)) {
    const entries = COMMAND_CATALOG.filter(entry => entry.category === category);
    if (!entries.length) continue;
    lines.push(`## ${label}`, "");
    for (const entry of entries) {
      lines.push(`### ${entry.title}`, "");
      lines.push(entry.summary, "");
      lines.push(`- ID: \`${entry.id}\``);
      lines.push(`- Availability: \`${entry.availability}\``);
      lines.push(`- Side effect: \`${entry.sideEffect}\``);
      lines.push(`- Confirmation: \`${entry.confirmation}\``);
      lines.push(`- Required context: ${(entry.requiredContext ?? []).map(item => `\`${item}\``).join(", ") || "`none`"}`);
      lines.push(`- Works offline: ${entry.worksOffline ? "yes" : "no"}`);
      lines.push(`- Model policy: \`${entry.modelPolicy}\``);
      if (entry.operationTypes?.length) lines.push(`- Operations/intents: ${entry.operationTypes.map(item => `\`${item}\``).join(", ")}`);
      if (entry.patterns?.length) {
        lines.push("", "Patterns:");
        entry.patterns.forEach(pattern => lines.push(`- \`${pattern}\``));
      }
      if (entry.examples?.length) {
        lines.push("", "Examples:");
        entry.examples.forEach(example => lines.push(`- \`${example.text}\``));
      }
      if (entry.identifierNotes?.length) {
        lines.push("", "Identifier notes:");
        entry.identifierNotes.forEach(note => lines.push(`- ${note}`));
      }
      if (entry.ambiguityNotes?.length) {
        lines.push("", "Ambiguity/safety notes:");
        entry.ambiguityNotes.forEach(note => lines.push(`- ${note}`));
      }
      if (entry.format) {
        lines.push("", "Format example:", "", "```text", entry.format.example, "```");
      }
      lines.push("");
    }
  }
  return `${lines.join("\n").replace(/\n{4,}/g, "\n\n\n").trim()}\n`;
}
