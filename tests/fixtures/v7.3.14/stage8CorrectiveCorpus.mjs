export const STAGE8_CORRECTIVE_BASELINE_SHA = "cec0e0ce33bc1a3b6b77916969787ebcdcbc0d00";
export const STAGE8_APPROVED_STAGE7_ANCESTOR = "32e4fca5ac2ca1229cceef260b2fa8827415887f";
export const STAGE8_AUTHORIZATION_LIMIT = 5_000;

function padUntil(prefix, suffix, suffixStart = 5_100) {
  const needed = Math.max(0, suffixStart - prefix.length);
  const filler = "context ".repeat(Math.ceil(needed / 8)).slice(0, needed);
  return `${prefix}${filler}${suffix}`;
}

// These cases are independently authored boundary expectations. Production
// code does not import this module and the expected outcome is not inferred
// from compiler output.
export const STAGE8_TRUNCATION_PROBES = Object.freeze([
  {
    id: "action-before-cutoff-denial-after",
    path: "authorization_contract",
    query: padUntil("Clear the graph. ", " Do not execute that. Keep the workspace unchanged."),
    sideEffectScope: "graph_edit_preview",
    expectedExecutable: false,
  },
  {
    id: "denial-before-cutoff-action-after",
    path: "authorization_contract",
    query: padUntil("Keep the workspace unchanged. Do not execute any action. ", " Clear the graph."),
    sideEffectScope: "graph_edit_preview",
    expectedExecutable: false,
  },
  {
    id: "quoted-command-crosses-cutoff",
    path: "authorization_contract",
    query: padUntil("The audit transcript says ", "`clear the graph`. Do not act.", 4_993),
    sideEffectScope: "graph_edit_preview",
    expectedExecutable: false,
  },
  {
    id: "pending-correction-denial-after-cutoff",
    path: "pending_correction",
    query: padUntil("Change the pending vertex from 6 to 7. ", " Do not execute that pending correction."),
    sideEffectScope: "graph_edit_preview",
    expectedExecutable: false,
  },
  {
    id: "direct-control-plan-denial-after-cutoff",
    path: "direct_control_plan",
    query: padUntil("Use CSR. ", " Keep the workspace unchanged. Do not execute that."),
    sideEffectScope: "navigation",
    expectedExecutable: false,
  },
  {
    id: "model-action-plan-denial-after-cutoff",
    path: "model_action_plan",
    query: padUntil("Clear the graph. ", " Do not execute that. Keep the workspace unchanged."),
    sideEffectScope: "graph_edit_preview",
    expectedExecutable: false,
  },
  {
    id: "deterministic-fallback-denial-after-cutoff",
    path: "deterministic_action_plan_fallback",
    query: padUntil("Clear the graph. ", " Do not execute that. Keep the workspace unchanged."),
    sideEffectScope: "graph_edit_preview",
    expectedExecutable: false,
  },
  {
    id: "dispatch-compiled-action-denial-after-cutoff",
    path: "dispatch_compiled_action",
    query: padUntil("Clear the graph. ", " Do not execute that. Keep the workspace unchanged."),
    sideEffectScope: "graph_edit_preview",
    expectedExecutable: false,
  },
]);

const ALL_MUTATING_SCOPES = Object.freeze([
  "reversible_mapping_edit",
  "reversible_grouping_edit",
  "workflow_preparation",
  "requires_parser_run_confirmation",
  "requires_graph_apply_confirmation",
  "graph_edit_preview",
  "navigation",
  "file_picker",
  "batch_state_edit",
  "destructive_batch_state",
  "runtime_control",
  "runtime_probe",
  "confirmation_control",
  "download_or_copy",
  "cancellation",
]);

export function forbiddenScopesExcept(expectedScope) {
  return ALL_MUTATING_SCOPES.filter(scope => scope !== expectedScope);
}

export const STAGE8_MIXED_REPRESENTATIVE_CASES = Object.freeze([
  {
    id: "A-explain-csr-then-use-csr",
    contextFixture: "dashboard-workspace",
    query: "Explain CSR first. Then use CSR.",
    expectedAuthorizationMode: "authorized",
    expectedExecutableClause: "use CSR",
    expectedSideEffectScope: "navigation",
    forbiddenSideEffectScopes: forbiddenScopesExcept("navigation"),
    dispatchRequired: true,
    noOpPermitted: false,
    noOpReason: null,
    expectedOperationTypes: ["SET_INPUT_ROUTE"],
    expectedProtectedStateChanges: ["navigationCalls"],
  },
  {
    id: "B-deny-clear-then-show-statistics",
    contextFixture: "dashboard-workspace",
    query: "Do not clear the graph. Then show Statistics.",
    expectedAuthorizationMode: "authorized",
    expectedExecutableClause: "show Statistics",
    expectedSideEffectScope: "navigation",
    forbiddenSideEffectScopes: forbiddenScopesExcept("navigation"),
    dispatchRequired: true,
    noOpPermitted: false,
    noOpReason: null,
    expectedOperationTypes: ["NAVIGATE_STATS"],
    expectedProtectedStateChanges: ["navigationCalls"],
  },
  {
    id: "C-explain-parser-then-run",
    contextFixture: "parser-generated",
    query: "Explain what running the parser does. Then run the parser.",
    expectedAuthorizationMode: "authorized",
    expectedExecutableClause: "run the parser",
    expectedSideEffectScope: "requires_parser_run_confirmation",
    forbiddenSideEffectScopes: forbiddenScopesExcept("requires_parser_run_confirmation"),
    dispatchRequired: true,
    noOpPermitted: false,
    noOpReason: null,
    expectedOperationTypes: ["RUN_CUSTOM_PARSER_CONFIRMATION"],
    expectedProtectedStateChanges: ["parserCalls"],
    directExecutionForbidden: true,
  },
  {
    id: "D-quoted-clear-then-show-statistics",
    contextFixture: "dashboard-workspace",
    query: "Quote `clear the graph`; then show Statistics.",
    expectedAuthorizationMode: "authorized",
    expectedExecutableClause: "show Statistics",
    expectedSideEffectScope: "navigation",
    forbiddenSideEffectScopes: forbiddenScopesExcept("navigation"),
    dispatchRequired: true,
    noOpPermitted: false,
    noOpReason: null,
    expectedOperationTypes: ["NAVIGATE_STATS"],
    expectedProtectedStateChanges: ["navigationCalls"],
  },
  {
    id: "E-explain-remove-then-remove-other-vertex",
    contextFixture: "stage8-corrective-graph",
    query: "Tell me what removing vertex 6 would do; then actually remove vertex 7 from h2.",
    expectedAuthorizationMode: "authorized",
    expectedExecutableClause: "actually remove vertex 7 from h2",
    expectedSideEffectScope: "graph_edit_preview",
    forbiddenSideEffectScopes: forbiddenScopesExcept("graph_edit_preview"),
    dispatchRequired: true,
    noOpPermitted: false,
    noOpReason: null,
    expectedOperationTypes: ["REMOVE_INCIDENCE"],
    expectedOperationSubset: [{ type: "REMOVE_INCIDENCE", hyperedgeId: "h2", vertexId: "7" }],
    expectedProtectedStateChanges: ["graphCalls", "graphVersion"],
  },
  {
    id: "F-preview-without-apply",
    contextFixture: "stage8-corrective-graph",
    query: "Create a preview to add vertex 9 to h2, but do not apply it.",
    expectedAuthorizationMode: "authorized",
    expectedExecutableClause: "Create a preview to add vertex 9 to h2",
    expectedSideEffectScope: "graph_edit_preview",
    forbiddenSideEffectScopes: forbiddenScopesExcept("graph_edit_preview"),
    dispatchRequired: true,
    noOpPermitted: false,
    noOpReason: null,
    expectedOperationTypes: ["ADD_INCIDENCE"],
    expectedOperationSubset: [{ type: "ADD_INCIDENCE", hyperedgeId: "h2", vertexId: "9" }],
    expectedProtectedStateChanges: ["graphCalls", "graphVersion"],
    applicationCommitForbidden: true,
  },
  {
    id: "G-deny-h1-create-h2",
    contextFixture: "stage8-corrective-graph",
    query: "Do not create h1; create h2 with vertices 8 and 9.",
    expectedAuthorizationMode: "authorized",
    expectedExecutableClause: "create h2 with vertices 8 and 9",
    expectedSideEffectScope: "graph_edit_preview",
    forbiddenSideEffectScopes: forbiddenScopesExcept("graph_edit_preview"),
    dispatchRequired: false,
    noOpPermitted: true,
    noOpReason: "The current graph grammar does not unambiguously parse the abbreviated create-hyperedge form; explicit clarification is required.",
    clarificationRequired: true,
    forbiddenOperationTargets: ["h1"],
    expectedProtectedStateChanges: [],
  },
  {
    id: "H-context-then-set-weight",
    contextFixture: "stage8-corrective-graph",
    query: "For context, no action is requested by this sentence. Separately, set h2's weight to 3.5.",
    expectedAuthorizationMode: "authorized",
    expectedExecutableClause: "set h2's weight to 3.5",
    expectedSideEffectScope: "graph_edit_preview",
    forbiddenSideEffectScopes: forbiddenScopesExcept("graph_edit_preview"),
    dispatchRequired: true,
    noOpPermitted: false,
    noOpReason: null,
    expectedOperationTypes: ["SET_HYPEREDGE_WEIGHT"],
    expectedOperationSubset: [{ type: "SET_HYPEREDGE_WEIGHT", hyperedgeId: "h2", weight: 3.5 }],
    expectedProtectedStateChanges: ["graphCalls", "graphVersion"],
  },
]);

// Seven independently specified templates x the 164 reviewed state-changing
// catalog examples produce 1,148 mixed cases. The catalog's expectedSideEffect
// is fixture metadata, not an observation of the current compiler.
export const STAGE8_MIXED_MATRIX_TEMPLATES = Object.freeze([
  {
    id: "explain-then-authorized",
    buildQuery: command => `Explain what this operation means. Then ${command}`,
    expectedScope: base => base.expectedSideEffect,
    expectedExecutableClause: base => base.text,
  },
  {
    id: "quoted-then-authorized",
    buildQuery: command => `Quote \`${command}\` as inert text. Then ${command}`,
    expectedScope: base => base.expectedSideEffect,
    expectedExecutableClause: base => base.text,
  },
  {
    id: "reported-then-authorized",
    buildQuery: command => `The manual mentions \`${command}\` only as an example. Separately, ${command}`,
    expectedScope: base => base.expectedSideEffect,
    expectedExecutableClause: base => base.text,
  },
  {
    id: "context-then-authorized",
    buildQuery: command => `For context, no action is requested by this sentence. Separately, ${command}`,
    expectedScope: base => base.expectedSideEffect,
    expectedExecutableClause: base => base.text,
  },
  {
    id: "explain-format-then-authorized",
    buildQuery: command => `Explain H2V without acting. Then ${command}`,
    expectedScope: base => base.expectedSideEffect,
    expectedExecutableClause: base => base.text,
  },
  {
    id: "denied-unrelated-then-authorized",
    buildQuery: command => `Do not clear the graph. Then ${command}`,
    expectedScope: base => base.expectedSideEffect,
    expectedExecutableClause: base => base.text,
  },
  {
    id: "denied-command-then-statistics",
    buildQuery: command => `Do not ${String(command).replace(/[.!?]+$/, "").replace(/^./, value => value.toLowerCase())}. Then show Statistics.`,
    expectedScope: () => "navigation",
    expectedExecutableClause: () => "show Statistics",
    expectedOperationTypes: ["NAVIGATE_STATS"],
  },
]);

