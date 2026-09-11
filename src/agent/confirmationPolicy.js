/**
 * Canonical confirmation policy for every operation that may be staged.
 *
 * Action IDs are the only authority used by the UI and capability adapter.
 * Capability names map to these IDs through CAPABILITY_CONFIRMATION_ALIASES;
 * no caller should maintain a second confirmation list.
 */
export const CONFIRMATION_POLICY = Object.freeze({
  clear_graph: Object.freeze({
    required: true,
    title: "Clear current graph?",
    message: "This action removes the parsed graph and resets its visualization state. Your pasted or uploaded input stays in place.",
  }),
  replace_graph: Object.freeze({
    required: true,
    title: "Replace current graph?",
    message: "This action may replace the current graph. Continue?",
  }),
  run_custom_parser: Object.freeze({
    required: true,
    title: "Run trusted local parser code?",
    message: "The reviewed Custom Parser code will run locally in a disposable worker against the selected files. Run only code you trust. Continue?",
  }),
  apply_custom_parser_result: Object.freeze({
    required: true,
    title: "Apply parser result?",
    message: "This action may replace the current graph with the validated custom parser preview. Continue?",
  }),
  parse_uploaded_files: Object.freeze({
    required: true,
    title: "Parse attached file?",
    message: "Parsing this upload may replace the current graph. Continue?",
  }),
  parse_current_input: Object.freeze({
    required: true,
    title: "Parse current input?",
    message: "Parsing the current dashboard input may replace the current graph. Continue?",
  }),
  apply_batch_updates: Object.freeze({
    required: true,
    title: "Apply batch updates?",
    message: "This action may modify the current graph. Continue?",
  }),
  commit_batch_updates: Object.freeze({
    required: true,
    title: "Commit batch updates?",
    message: "This action will commit the batch-update preview into the canonical graph. Continue?",
  }),
  apply_graph_mutation: Object.freeze({
    required: true,
    title: "Apply graph mutation?",
    message: "This conversational edit will change the committed graph after deterministic validation. Continue?",
  }),
  undo_graph_mutation: Object.freeze({
    required: true,
    title: "Undo last graph mutation?",
    message: "This action restores the graph snapshot from before the previous committed mutation. Continue?",
  }),
  download_file: Object.freeze({
    required: true,
    title: "Download file?",
    message: "This action will create a local download. Continue?",
  }),
  export_training_full_files: Object.freeze({
    required: true,
    title: "Include full uploaded files?",
    message: "This training export will include the complete text of every file in the active batch. Confirm only if you intend to save that data locally.",
  }),
  export_mapping_training_full_files: Object.freeze({
    required: true,
    title: "Include full files in mapping example?",
    message: "This mapping fine-tuning export will include the complete text of every file in the active batch. Confirm only if you intend to save that data locally.",
  }),
  run_candy_expensive_compute: Object.freeze({
    required: true,
    title: "Run potentially expensive local SSSP?",
    message: "This exact CANDY request exceeds the low-cost envelope or uses COMPARE. Confirm the bound graph version, source, backend, mode, threads, and timeout.",
  }),
});

export const CAPABILITY_CONFIRMATION_ALIASES = Object.freeze({
  RUN_CUSTOM_PARSER: "run_custom_parser",
  APPLY_CUSTOM_RESULT: "apply_custom_parser_result",
  APPLY_BATCH_UPDATES: "apply_batch_updates",
  CLEAR_GRAPH: "clear_graph",
  DOWNLOAD_EXPORT: "download_file",
  EXPORT_GRAPH_PNG: "download_file",
  PARSE_ACTIVE_BATCH: "parse_uploaded_files",
  SUBMIT_CANDY_JOB: "run_candy_expensive_compute",
});

export const CONFIRMATION_REQUIRED_ACTIONS = new Set(
  Object.entries(CONFIRMATION_POLICY)
    .filter(([, policy]) => policy.required)
    .map(([actionType]) => actionType),
);

export function confirmationPolicyForAction(actionType) {
  return CONFIRMATION_POLICY[actionType] ?? null;
}

export function requiresConfirmation(actionType) {
  return confirmationPolicyForAction(actionType)?.required === true;
}

export function getConfirmationCopy(actionType) {
  const policy = confirmationPolicyForAction(actionType);
  if (!policy) {
    return {
      title: "Confirm action",
      message: "This action has no registered confirmation copy and cannot be safely staged.",
      missingPolicy: true,
    };
  }
  return { title: policy.title, message: policy.message };
}

export function confirmationActionTypeForCapability(actionType) {
  return CAPABILITY_CONFIRMATION_ALIASES[actionType] ?? null;
}

export function validateConfirmationPolicy({ stagedActionTypes = [], capabilityTypes = [] } = {}) {
  const missingStagedPolicies = [...new Set(stagedActionTypes)].filter(actionType => !requiresConfirmation(actionType));
  const missingCapabilityPolicies = [...new Set(capabilityTypes)]
    .map(capabilityType => ({ capabilityType, actionType: confirmationActionTypeForCapability(capabilityType) }))
    .filter(({ actionType }) => !actionType || !requiresConfirmation(actionType));
  return {
    ok: missingStagedPolicies.length === 0 && missingCapabilityPolicies.length === 0,
    missingStagedPolicies,
    missingCapabilityPolicies,
  };
}
