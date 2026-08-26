export const COMMAND_CATEGORIES = Object.freeze({
  QUICK_START: "quick_start",
  GRAPH_EDITING: "graph_editing",
  DATASET_MAPPING: "dataset_mapping",
  DATASET_GROUPING: "dataset_grouping",
  CUSTOM_PARSER_WORKFLOW: "custom_parser_workflow",
  DASHBOARD_NAVIGATION: "dashboard_navigation",
  FILE_BATCH_MANAGEMENT: "file_batch_management",
  DETECTION_PARSING: "detection_parsing",
  MAPPING_VALIDATION_REPAIR: "mapping_validation_repair",
  LOCAL_MODEL_RUNTIME: "local_model_runtime",
  MAPPINGS_EXPORTS: "mappings_exports",
  CONFIRMATION_CONTROL: "confirmation_control",
  QUESTIONS_EXPLANATIONS: "questions_explanations",
  CORRECTIONS_SAFETY: "corrections_safety",
  QUOTED_IDENTIFIERS: "quoted_identifiers",
  AMBIGUITY_CLARIFICATION: "ambiguity_clarification",
  ALGORITHMS: "algorithms",
  PANEL_ONLY_FEATURES: "panel_only_features",
  INPUT_DATA_FORMATS: "input_data_formats",
});

export const COMMAND_CATEGORY_LABELS = Object.freeze({
  [COMMAND_CATEGORIES.QUICK_START]: "Quick Start",
  [COMMAND_CATEGORIES.GRAPH_EDITING]: "Graph Editing",
  [COMMAND_CATEGORIES.DATASET_MAPPING]: "Dataset Mapping",
  [COMMAND_CATEGORIES.DATASET_GROUPING]: "Dataset Grouping",
  [COMMAND_CATEGORIES.CUSTOM_PARSER_WORKFLOW]: "Custom Parser Workflow",
  [COMMAND_CATEGORIES.DASHBOARD_NAVIGATION]: "Dashboard and Navigation",
  [COMMAND_CATEGORIES.FILE_BATCH_MANAGEMENT]: "File and Batch Management",
  [COMMAND_CATEGORIES.DETECTION_PARSING]: "Detection and Parsing",
  [COMMAND_CATEGORIES.MAPPING_VALIDATION_REPAIR]: "Mapping Validation and Repair",
  [COMMAND_CATEGORIES.LOCAL_MODEL_RUNTIME]: "Local Model and Runtime",
  [COMMAND_CATEGORIES.MAPPINGS_EXPORTS]: "Mappings and Exports",
  [COMMAND_CATEGORIES.CONFIRMATION_CONTROL]: "Confirmation and Control",
  [COMMAND_CATEGORIES.QUESTIONS_EXPLANATIONS]: "Questions and Explanations",
  [COMMAND_CATEGORIES.CORRECTIONS_SAFETY]: "Corrections, Confirmation, and Safety",
  [COMMAND_CATEGORIES.QUOTED_IDENTIFIERS]: "Quoted Identifiers",
  [COMMAND_CATEGORIES.AMBIGUITY_CLARIFICATION]: "Ambiguity and Clarification",
  [COMMAND_CATEGORIES.ALGORITHMS]: "Algorithms",
  [COMMAND_CATEGORIES.PANEL_ONLY_FEATURES]: "Panel-only Features",
  [COMMAND_CATEGORIES.INPUT_DATA_FORMATS]: "Input Data Formats",
});

export const COMMAND_AVAILABILITY = Object.freeze({
  CHAT_COMMAND: "chat_command",
  READ_ONLY: "read_only",
  PANEL_ONLY: "panel_only",
  FORMAT_REFERENCE: "format_reference",
});

export const REQUIRED_CONTEXT = Object.freeze({
  NONE: "none",
  LOADED_GRAPH: "loaded_graph",
  EXISTING_HYPEREDGE: "existing_hyperedge",
  EXISTING_VERTEX: "existing_vertex",
  GRAPH_HISTORY: "graph_history",
  UPLOADED_FILES: "uploaded_files",
  ACTIVE_BATCH: "active_batch",
  VALID_MAPPING: "valid_mapping",
  PARSER_PLAN_READY: "parser_plan_ready",
  GENERATED_PARSER: "generated_parser",
  PARSER_RESULT: "parser_result",
  PARSER_RESULT_READY: "parser_result_ready",
  PENDING_ACTION: "pending_action",
  COMPATIBLE_PENDING_CONFIRMATION: "compatible_pending_confirmation",
  ACTIVE_MODEL_WORK: "active_model_work",
  ACTIVE_CANCELLABLE_WORK: "active_cancellable_work",
  REVERSIBLE_COMMITTED_HISTORY: "reversible_committed_history",
  MATCHING_PENDING_OR_RECENT_INTERPRETATION: "matching_pending_or_recent_interpretation",
  EXISTING_BATCH: "existing_batch",
  VALID_MAPPING_FOR_BATCH: "valid_mapping_for_batch",
});

export const SIDE_EFFECT = Object.freeze({
  READ_ONLY: "read_only",
  REVERSIBLE_MAPPING_EDIT: "reversible_mapping_edit",
  REVERSIBLE_GROUPING_EDIT: "reversible_grouping_edit",
  WORKFLOW_PREPARATION: "workflow_preparation",
  PARSER_RUN_CONFIRMATION: "requires_parser_run_confirmation",
  GRAPH_APPLY_CONFIRMATION: "requires_graph_apply_confirmation",
  GRAPH_EDIT_PREVIEW: "graph_edit_preview",
  NAVIGATION: "navigation",
  FILE_PICKER: "file_picker",
  BATCH_STATE_EDIT: "batch_state_edit",
  DESTRUCTIVE_BATCH_STATE: "destructive_batch_state",
  RUNTIME_CONTROL: "runtime_control",
  RUNTIME_PROBE: "runtime_probe",
  CONFIRMATION_CONTROL: "confirmation_control",
  DOWNLOAD_OR_COPY: "download_or_copy",
  PANEL_ONLY: "panel_only",
});

export const CONFIRMATION = Object.freeze({
  NONE: "none",
  PREVIEW_CONFIRMATION: "preview_confirmation",
  RUN_CONFIRMATION: "run_confirmation",
  APPLY_CONFIRMATION: "apply_confirmation",
  IMMEDIATE_REVERSIBLE_MAPPING_EDIT: "immediate_reversible_mapping_edit",
  NAVIGATION_ONLY: "navigation_only",
  PANEL_ONLY: "panel_only",
  CLARIFICATION_ONLY: "clarification_only",
  NO_CONFIRMATION_ACTION: "no_confirmation_action",
  IMMEDIATE_BATCH_STATE: "immediate_batch_state",
  RUNTIME_CONTROL: "runtime_control",
  PENDING_CONTROL: "pending_control",
  DOWNLOAD_OR_COPY: "download_or_copy",
  DEPENDS_ON_REPLACEMENT: "depends_on_replacement",
});

export const MODEL_POLICY = Object.freeze({
  ALWAYS_DETERMINISTIC: "always_deterministic",
  DETERMINISTIC_WITH_LOCAL_ASSIST: "deterministic_when_unambiguous_local_model_may_assist",
  PANEL_ONLY: "panel_only",
});

export const TYPED_KINDS = Object.freeze({
  GRAPH_MUTATION_PLAN: "GraphMutationPlan",
  DATASET_MAPPING_PATCH: "DatasetMappingPatch",
  PARSER_WORKFLOW_OPERATION: "ParserWorkflowOperation",
  DASHBOARD_CONTROL_INTENT: "DashboardControlIntent",
  LEGACY_ACTION_INTENT: "LegacyActionIntent",
  GROUNDED_QUESTION: "GroundedQuestion",
  HELP_QUERY: "DeterministicHelpQuery",
  PANEL_ONLY: "PanelOnlyFeature",
  FORMAT_REFERENCE: "InputFormatReference",
});

export const HELP_QUERY_INTENTS = Object.freeze([
  "SHOW_HELP_OVERVIEW",
  "LIST_COMMAND_CATEGORY",
  "FIND_COMMAND",
  "EXPLAIN_COMMAND",
  "LIST_CONFIRMATION_COMMANDS",
  "LIST_READ_ONLY_COMMANDS",
  "EXPLAIN_QUOTED_IDENTIFIERS",
  "EXPLAIN_AMBIGUITY",
  "LIST_INPUT_FORMATS",
  "EXPLAIN_PANEL_ONLY_FEATURE",
  "EXPLAIN_ACTION_COMMAND",
]);

export function categoryLabel(category) {
  return COMMAND_CATEGORY_LABELS[category] ?? category;
}

export function validateCommandCatalogEntry(entry, allIds = new Set()) {
  const errors = [];
  if (!entry || typeof entry !== "object") return ["entry is not an object"];
  if (!entry.id) errors.push("missing id");
  if (!entry.title) errors.push(`${entry.id}: missing title`);
  if (!entry.summary) errors.push(`${entry.id}: missing summary`);
  if (!Object.values(COMMAND_CATEGORIES).includes(entry.category)) errors.push(`${entry.id}: invalid category ${entry.category}`);
  if (!Object.values(COMMAND_AVAILABILITY).includes(entry.availability)) errors.push(`${entry.id}: invalid availability ${entry.availability}`);
  if (!Object.values(SIDE_EFFECT).includes(entry.sideEffect)) errors.push(`${entry.id}: invalid side effect ${entry.sideEffect}`);
  if (!Object.values(CONFIRMATION).includes(entry.confirmation)) errors.push(`${entry.id}: invalid confirmation ${entry.confirmation}`);
  if (!Object.values(MODEL_POLICY).includes(entry.modelPolicy)) errors.push(`${entry.id}: invalid model policy ${entry.modelPolicy}`);
  if (entry.availability === COMMAND_AVAILABILITY.CHAT_COMMAND && !(entry.examples ?? []).length) errors.push(`${entry.id}: chat command needs examples`);
  if (entry.availability === COMMAND_AVAILABILITY.PANEL_ONLY && (entry.patterns ?? []).length) errors.push(`${entry.id}: panel-only entries must not expose chat patterns`);
  for (const relatedId of entry.relatedCommandIds ?? []) {
    if (!allIds.has(relatedId)) errors.push(`${entry.id}: unknown related command ${relatedId}`);
  }
  if (containsFunction(entry)) errors.push(`${entry.id}: catalog entries must be serializable and contain no functions`);
  return errors;
}

function containsFunction(value) {
  if (typeof value === "function") return true;
  if (!value || typeof value !== "object") return false;
  return Object.values(value).some(containsFunction);
}
