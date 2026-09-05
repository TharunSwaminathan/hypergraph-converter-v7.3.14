import { analyzePositiveAuthorization } from "../src/agent/deterministicNlu/positiveAuthorization.js";
import { analyzeRequestSemantics } from "../src/agent/deterministicNlu/requestSemantics.js";
import { dispatchCompiledAction } from "../src/agent/deterministicNlu/dispatchCompiledAction.js";
import { createRuntimeTrace } from "../src/agent/deterministicNlu/runtimeInstrumentation.js";
import { graphFingerprint } from "../src/graph/graphFingerprint.js";
import { GRAPH_MUTATION_OPS } from "../src/graph/graphMutationSchema.js";
import { runStage10Corrective1Corpus } from "./stage10Corrective1Harness.mjs";

export const ORIGINAL_S10_N01 = "I did not ask you to delete anything; tell me whether h1 exists.";

const HELD_OUT_EXACT = Object.freeze([
  "I wasn't asking you to delete h1; tell me whether h1 exists.",
  "I am asking you not to delete h1; tell me whether h1 exists.",
  "I am not giving you permission to delete h1; tell me whether it exists.",
  "I withdraw permission to delete h1; tell me whether it exists.",
  "I need to know whether h1 exists before I decide whether to delete it.",
]);

const MUTATIONS = Object.freeze([
  { text: "delete hyperedge h1", operation: { type: GRAPH_MUTATION_OPS.REMOVE_HYPEREDGE, hyperedgeId: "h1" } },
  { text: "clear the graph", operation: { type: GRAPH_MUTATION_OPS.CLEAR_GRAPH } },
  { text: "create hyperedge h3 with vertices 8 and 9", operation: { type: GRAPH_MUTATION_OPS.ADD_HYPEREDGE, hyperedgeId: "h3", vertices: ["8", "9"] } },
  { text: "remove vertex A from hyperedge h1", operation: { type: GRAPH_MUTATION_OPS.REMOVE_INCIDENCE, hyperedgeId: "h1", vertexId: "A" } },
  { text: "rename hyperedge h1 to archived", operation: { type: GRAPH_MUTATION_OPS.RENAME_HYPEREDGE, hyperedgeId: "h1", newHyperedgeId: "archived" } },
  { text: "change the weight of hyperedge h2 to 4", operation: { type: GRAPH_MUTATION_OPS.SET_HYPEREDGE_WEIGHT, hyperedgeId: "h2", weight: 4 } },
]);

// These independently curated grammatical constructions are intentionally
// not imported from the production analyzer's phrase tables.
const HELD_OUT_FRAMES = Object.freeze([
  action => `I was not asking you to ${action}`,
  action => `We weren't requesting that you ${action}`,
  action => `I am requesting you not to ${action}`,
  action => `We asked you not to ${action}`,
  action => `I am not granting you consent to ${action}`,
  action => `We revoke authorization to ${action}`,
  action => `I retract my permission for you to ${action}`,
  action => `I refuse to grant consent for ${action}`,
  action => `No permission is being given to ${action}`,
  action => `I need to determine whether ${action} is possible before I decide`,
  action => `Before we choose whether to ${action}, I need the current facts`,
  action => `We discussed whether to ${action} yesterday`,
  action => `I might ${action} next month`,
  action => `The operator said they intend to ${action}`,
  action => `This is a past discussion about whether to ${action}`,
  action => `Do not ${action}`,
]);

const READ_ONLY_FOLLOW_UPS = Object.freeze([
  "tell me whether h1 exists",
  "report the current hyperedge count",
  "which vertices are in h1?",
  "explain what that operation would normally do",
]);

const TRUE_POSITIVES = Object.freeze([
  { query: "Delete hyperedge h1.", operations: [{ type: GRAPH_MUTATION_OPS.REMOVE_HYPEREDGE, hyperedgeId: "h1" }] },
  { query: "Clear the graph.", operations: [{ type: GRAPH_MUTATION_OPS.CLEAR_GRAPH }] },
  { query: "Create hyperedge h3 with vertices 8 and 9.", operations: [{ type: GRAPH_MUTATION_OPS.ADD_HYPEREDGE, hyperedgeId: "h3", vertices: ["8", "9"] }] },
  { query: "Remove vertex A from hyperedge h1.", operations: [{ type: GRAPH_MUTATION_OPS.REMOVE_INCIDENCE, hyperedgeId: "h1", vertexId: "A" }] },
  { query: "Rename hyperedge h1 to archived.", operations: [{ type: GRAPH_MUTATION_OPS.RENAME_HYPEREDGE, hyperedgeId: "h1", newHyperedgeId: "archived" }] },
  { query: "Change the weight of hyperedge h2 to 4.", operations: [{ type: GRAPH_MUTATION_OPS.SET_HYPEREDGE_WEIGHT, hyperedgeId: "h2", weight: 4 }] },
  { query: "I wasn't asking you to delete h1 earlier; delete hyperedge h1 now.", operations: [{ type: GRAPH_MUTATION_OPS.REMOVE_HYPEREDGE, hyperedgeId: "h1" }] },
  { query: "I am asking you not to delete h1; create hyperedge h3 with vertices 8 and 9.", operations: [{ type: GRAPH_MUTATION_OPS.ADD_HYPEREDGE, hyperedgeId: "h3", vertices: ["8", "9"] }] },
  { query: "I withdraw permission to delete h1. Create hyperedge h3 with vertices 8 and 9.", operations: [{ type: GRAPH_MUTATION_OPS.ADD_HYPEREDGE, hyperedgeId: "h3", vertices: ["8", "9"] }] },
]);

const INVALID_OPERATION_MATRIX = Object.freeze([
  { id: "proof-a-denied-delete", class: "mixed_authorized_denied", query: "Do not delete h1; create hyperedge h3 with vertices 8 and 9.", operations: [{ type: GRAPH_MUTATION_OPS.REMOVE_HYPEREDGE, hyperedgeId: "h1" }] },
  { id: "proof-b-family-substitution", class: "operation_family", query: "Create hyperedge h3 with vertices 8 and 9.", operations: [{ type: GRAPH_MUTATION_OPS.REMOVE_HYPEREDGE, hyperedgeId: "h1" }] },
  { id: "proof-c-target-substitution", class: "target", query: "Delete hyperedge h1.", operations: [{ type: GRAPH_MUTATION_OPS.REMOVE_HYPEREDGE, hyperedgeId: "h2" }] },
  { id: "proof-d-clear-substitution", class: "operation_family", query: "Delete hyperedge h1.", operations: [{ type: GRAPH_MUTATION_OPS.CLEAR_GRAPH }] },
  { id: "create-id-substitution", class: "target", query: "Create hyperedge h3 with vertices 8 and 9.", operations: [{ type: GRAPH_MUTATION_OPS.ADD_HYPEREDGE, hyperedgeId: "h4", vertices: ["8", "9"] }] },
  { id: "remove-incidence-vertex-substitution", class: "target", query: "Remove vertex A from hyperedge h1.", operations: [{ type: GRAPH_MUTATION_OPS.REMOVE_INCIDENCE, hyperedgeId: "h1", vertexId: "B" }] },
  { id: "remove-incidence-hyperedge-substitution", class: "target", query: "Remove vertex A from hyperedge h1.", operations: [{ type: GRAPH_MUTATION_OPS.REMOVE_INCIDENCE, hyperedgeId: "h2", vertexId: "A" }] },
  { id: "weight-target-substitution", class: "target", query: "Change the weight of hyperedge h2 to 4.", operations: [{ type: GRAPH_MUTATION_OPS.SET_HYPEREDGE_WEIGHT, hyperedgeId: "h1", weight: 4 }] },
  { id: "weight-value-substitution", class: "parameter", query: "Change the weight of hyperedge h2 to 4.", operations: [{ type: GRAPH_MUTATION_OPS.SET_HYPEREDGE_WEIGHT, hyperedgeId: "h2", weight: 5 }] },
  { id: "create-vertices-substitution", class: "parameter", query: "Create hyperedge h3 with vertices 8 and 9.", operations: [{ type: GRAPH_MUTATION_OPS.ADD_HYPEREDGE, hyperedgeId: "h3", vertices: ["8", "9", "10"] }] },
  { id: "multi-operation-smuggling", class: "mixed_authorized_unauthorized", query: "Create hyperedge h3 with vertices 8 and 9.", operations: [{ type: GRAPH_MUTATION_OPS.ADD_HYPEREDGE, hyperedgeId: "h3", vertices: ["8", "9"] }, { type: GRAPH_MUTATION_OPS.REMOVE_HYPEREDGE, hyperedgeId: "h1" }] },
  { id: "denied-operation-smuggling", class: "mixed_authorized_denied", query: "Do not delete h1; create hyperedge h3 with vertices 8 and 9.", operations: [{ type: GRAPH_MUTATION_OPS.ADD_HYPEREDGE, hyperedgeId: "h3", vertices: ["8", "9"] }, { type: GRAPH_MUTATION_OPS.REMOVE_HYPEREDGE, hyperedgeId: "h1" }] },
]);

function graphState() {
  const graph = [
    { id: "h1", vertices: ["A", "B"], time: null, weight: 1, attributes: {} },
    { id: "h2", vertices: ["A", "B", "C"], time: null, weight: 1, attributes: {} },
  ];
  return { graph, graphVersion: 11, hasGraph: true, hyperedgeCount: 2, vertexCount: 3 };
}

async function dispatchModelShaped(query, operations) {
  const current = graphState();
  const beforeFingerprint = graphFingerprint(current.graph);
  const semantics = analyzeRequestSemantics(query);
  let protectedHandlerCalls = 0;
  let confirmationStages = 0;
  const prepared = {
    handled: true,
    nlu: { primaryDomain: "graph_mutation", ambiguities: [], confidence: { level: "high", score: 1 }, limits: { truncated: false } },
    compilation: {
      handled: true,
      domain: "graph_mutation",
      typedKind: "GraphMutationPlan",
      typedValue: { operations },
      sideEffectClass: "graph_edit_preview",
      requestSemantics: semantics,
      dispatchAuthorized: true,
      semanticConfidence: { level: "high", score: 1 },
    },
    runtimeTrace: createRuntimeTrace({ requestId: "stage10-corrective2" }),
  };
  const result = await dispatchCompiledAction({
    prepared,
    query,
    state: current,
    handlers: {
      graphMutation: async () => {
        protectedHandlerCalls += 1;
        confirmationStages += 1;
        return { handled: true, outcome: "staged_confirmation", confirmationStaged: true, stateMutationCommitted: false };
      },
      blockedSideEffect: async () => ({ handled: true, outcome: "authorization_blocked", stateMutationCommitted: false }),
    },
  });
  return {
    query,
    operations,
    authorization: analyzePositiveAuthorization(query),
    requestSemantics: semantics,
    authorizationDecision: result.runtimeTrace.authorizationDecision,
    dispatchBlockReason: result.runtimeTrace.dispatchBlockReason,
    protectedHandlerCalls,
    confirmationStages,
    stateChanged: beforeFingerprint !== graphFingerprint(current.graph) || current.graphVersion !== 11,
  };
}

export async function runStage10Corrective2() {
  const heldOutRecords = [];
  for (const query of HELD_OUT_EXACT) {
    heldOutRecords.push(await dispatchModelShaped(query, [{ type: GRAPH_MUTATION_OPS.REMOVE_HYPEREDGE, hyperedgeId: "h1" }]));
  }
  let sequence = 0;
  for (const frame of HELD_OUT_FRAMES) {
    for (const mutation of MUTATIONS) {
      for (const followUp of READ_ONLY_FOLLOW_UPS) {
        heldOutRecords.push(await dispatchModelShaped(`${frame(mutation.text)}; ${followUp}`, [mutation.operation]));
        sequence += 1;
      }
    }
  }

  const positiveRecords = [];
  for (const item of TRUE_POSITIVES) positiveRecords.push(await dispatchModelShaped(item.query, item.operations));
  const invalidRecords = [];
  for (const item of INVALID_OPERATION_MATRIX) invalidRecords.push({ ...item, result: await dispatchModelShaped(item.query, item.operations) });
  const original = await dispatchModelShaped(ORIGINAL_S10_N01, [{ type: GRAPH_MUTATION_OPS.REMOVE_HYPEREDGE, hyperedgeId: "h1" }]);
  const corrective1 = await runStage10Corrective1Corpus();

  return {
    original: {
      protectedHandlerCalls: original.protectedHandlerCalls,
      confirmationStages: original.confirmationStages,
      stateChanged: original.stateChanged,
      authorizationMode: original.authorization.mode,
    },
    heldOut: {
      cases: heldOutRecords.length,
      wrongPositiveAuthorizations: heldOutRecords.filter(record => record.authorization.sideEffectScopes.includes("graph_edit_preview")).length,
      protectedHandlerCalls: heldOutRecords.reduce((sum, record) => sum + record.protectedHandlerCalls, 0),
      confirmationStages: heldOutRecords.reduce((sum, record) => sum + record.confirmationStages, 0),
      stateChanges: heldOutRecords.filter(record => record.stateChanged).length,
      truePositives: positiveRecords.length,
      wrongTruePositiveBlocks: positiveRecords.filter(record => record.protectedHandlerCalls !== 1 || record.confirmationStages !== 1).length,
      constructionCount: HELD_OUT_FRAMES.length,
      mutationFamilies: MUTATIONS.length,
      followUpCount: READ_ONLY_FOLLOW_UPS.length,
      failures: heldOutRecords.filter(record => record.authorization.sideEffectScopes.includes("graph_edit_preview") || record.protectedHandlerCalls || record.confirmationStages || record.stateChanged).map(record => ({ query: record.query, scopes: record.authorization.sideEffectScopes, block: record.dispatchBlockReason })),
      positiveFailures: positiveRecords.filter(record => record.protectedHandlerCalls !== 1 || record.confirmationStages !== 1).map(record => ({ query: record.query, scopes: record.authorization.sideEffectScopes, authorizedOperations: record.authorization.authorizedGraphOperations, block: record.dispatchBlockReason })),
    },
    operationBinding: {
      cases: invalidRecords.length + positiveRecords.length,
      invalidCases: invalidRecords.length,
      operationFamilySubstitutionsBlocked: invalidRecords.filter(record => record.class === "operation_family" && record.result.protectedHandlerCalls === 0).length,
      operationFamilySubstitutions: invalidRecords.filter(record => record.class === "operation_family").length,
      targetSubstitutionsBlocked: invalidRecords.filter(record => record.class === "target" && record.result.protectedHandlerCalls === 0).length,
      targetSubstitutions: invalidRecords.filter(record => record.class === "target").length,
      parameterSubstitutionsBlocked: invalidRecords.filter(record => record.class === "parameter" && record.result.protectedHandlerCalls === 0).length,
      parameterSubstitutions: invalidRecords.filter(record => record.class === "parameter").length,
      mixedSubstitutionsBlocked: invalidRecords.filter(record => record.class.startsWith("mixed_") && record.result.protectedHandlerCalls === 0).length,
      mixedSubstitutions: invalidRecords.filter(record => record.class.startsWith("mixed_")).length,
      protectedHandlerCallsForInvalidPlans: invalidRecords.reduce((sum, record) => sum + record.result.protectedHandlerCalls, 0),
      confirmationStagesForInvalidPlans: invalidRecords.reduce((sum, record) => sum + record.result.confirmationStages, 0),
      stateChangesForInvalidPlans: invalidRecords.filter(record => record.result.stateChanged).length,
      validMatchingPlanExecutions: positiveRecords.filter(record => record.protectedHandlerCalls === 1 && record.confirmationStages === 1).length,
      validMatchingPlans: positiveRecords.length,
      invalidFailures: invalidRecords.filter(record => record.result.protectedHandlerCalls || record.result.confirmationStages || record.result.stateChanged).map(record => ({ id: record.id, class: record.class, block: record.result.dispatchBlockReason })),
    },
    corrective1: {
      totalCases: corrective1.totalCases,
      readOnlyNoConsentCases: corrective1.readOnlyNoConsentCases,
      truePositiveControls: corrective1.truePositiveControls,
      wrongPositiveAuthorizations: corrective1.wrongPositiveAuthorizations,
      protectedHandlerCalls: corrective1.protectedHandlerCalls,
      confirmationStages: corrective1.confirmationStages,
      stateChanges: corrective1.stateChanges,
      wrongBlocksOfTruePositiveControls: corrective1.wrongBlocksOfTruePositiveControls,
    },
  };
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replaceAll("\\", "/")}`).href) {
  process.stdout.write(`${JSON.stringify(await runStage10Corrective2(), null, 2)}\n`);
}
