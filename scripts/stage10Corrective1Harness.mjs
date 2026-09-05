import { analyzePositiveAuthorization } from "../src/agent/deterministicNlu/positiveAuthorization.js";
import { analyzeRequestSemantics } from "../src/agent/deterministicNlu/requestSemantics.js";
import { dispatchCompiledAction } from "../src/agent/deterministicNlu/dispatchCompiledAction.js";
import { prepareDeterministicTurn } from "../src/agent/deterministicNlu/prepareDeterministicTurn.js";
import { createRuntimeTrace } from "../src/agent/deterministicNlu/runtimeInstrumentation.js";
import { graphFingerprint } from "../src/graph/graphFingerprint.js";

export const EXACT_S10_N01 = "I did not ask you to delete anything; tell me whether h1 exists.";

const MUTATION_PHRASES = Object.freeze([
  "delete hyperedge h1",
  "remove hyperedge h2",
  "clear the graph",
  "create hyperedge h3 with vertices 8 and 9",
  "remove vertex 7 from hyperedge h2",
  "rename hyperedge h4 to archived",
  "change the weight of hyperedge h2 to 4",
]);

const NO_CONSENT_FRAMES = Object.freeze([
  action => `I did not ask you to ${action}`,
  action => `I didn't ask you to ${action}`,
  action => `I never asked you to ${action}`,
  action => `I have not asked you to ${action}`,
  action => `I haven't asked you to ${action}`,
  action => `I am not asking you to ${action}`,
  action => `I'm not asking you to ${action}`,
  action => `I never told you to ${action}`,
  action => `I did not tell you to ${action}`,
  action => `I didn't tell you to ${action}`,
  action => `That was not permission to ${action}`,
  action => `This is not a request to ${action}`,
  action => `Do not interpret this as permission to ${action}`,
  action => `I'm only mentioning how to ${action}, not asking you to do it`,
  action => `I'm asking whether ${action} is possible, not asking you to do it`,
]);

const READ_ONLY_FOLLOW_UPS = Object.freeze([
  "tell me whether h1 exists",
  "tell me if h2 exists",
  "does h1 still exist?",
  "which vertices belong to h1?",
  "what is the current graph count?",
  "explain what the current graph contains",
]);

const JOINERS = Object.freeze(["; ", ", ", ". ", ": ", " — ", "\n"]);

const COMPOSITIONAL_READ_ONLY_CASES = Object.freeze([
  { category: "read_only_then_negated_reference", query: "Tell me whether h1 exists; I did not ask you to delete h1." },
  { category: "negated_reference_then_read_only", query: "I never told you to remove hyperedge h2. Which vertices belong to h1?" },
  { category: "positive_question_with_mutation_term", query: "Could you tell me whether deleting h1 is supported?" },
  { category: "quoted_mutation_command", query: "Read the command \"delete hyperedge h1\" as text and tell me what it means." },
  { category: "reported_mutation_command", query: "The reviewer said delete h1; tell me whether h1 exists." },
  { category: "hypothetical_mutation", query: "If I deleted h1, what would the graph contain?" },
  { category: "conditional_mutation", query: "If h1 were removed later, which vertices would remain?" },
  { category: "past_tense_mutation_statement", query: "The audit says h1 was deleted yesterday; tell me whether h1 exists now." },
  { category: "explicit_prohibition", query: "Do not delete h1; tell me whether h1 exists." },
  { category: "first_person_denial", query: "I am not authorizing you to clear the graph; what is the current graph count?" },
]);

const TRUE_POSITIVE_CONTROLS = Object.freeze([
  "Delete h1.",
  "Remove hyperedge h2.",
  "Clear the graph.",
  "Create hyperedge h3 with vertices 8 and 9.",
  "Remove vertex 7 from hyperedge h2.",
  "Rename hyperedge h4 to archived.",
  "Change the weight of hyperedge h2 to 4.",
  "I didn't ask you to delete h1 earlier; delete h1 now.",
  "I never told you to clear the graph earlier. Clear the graph now.",
  "That was not permission to remove h2. Remove h2 now.",
  "I have not asked you to create h3 before\ncreate h3 now with vertices 8 and 9.",
]);

function graphState() {
  const graph = [
    { id: "h1", vertices: ["a", "b"], time: null, weight: 1, attributes: {} },
    { id: "h2", vertices: ["b", "c"], time: null, weight: 1, attributes: {} },
  ];
  return { graph, graphVersion: 7, hasGraph: true, hyperedgeCount: 2, vertexCount: 3 };
}

function preparedGraphPlan(query, operation = { type: "DELETE_HYPEREDGE", hyperedgeId: "h1" }) {
  return {
    handled: true,
    nlu: { primaryDomain: "graph_mutation", ambiguities: [], confidence: { level: "high", score: 1 }, limits: { truncated: false } },
    compilation: {
      handled: true,
      domain: "graph_mutation",
      typedKind: "GraphMutationPlan",
      typedValue: { operations: [operation] },
      sideEffectClass: "graph_edit_preview",
      requestSemantics: analyzeRequestSemantics(query),
      dispatchAuthorized: true,
      semanticConfidence: { level: "high", score: 1 },
    },
    runtimeTrace: createRuntimeTrace({ requestId: "stage10-corrective1" }),
  };
}

async function dispatchCase(query, operation, category = null) {
  const state = graphState();
  const before = graphFingerprint(state.graph);
  let protectedHandlerCalls = 0;
  let confirmationStages = 0;
  let blockedHandlerCalls = 0;
  const result = await dispatchCompiledAction({
    query,
    category,
    state,
    prepared: preparedGraphPlan(query, operation),
    handlers: {
      graphMutation: async () => {
        protectedHandlerCalls += 1;
        confirmationStages += 1;
        return { handled: true, outcome: "staged_confirmation", confirmationStaged: true, stateMutationCommitted: false };
      },
      blockedSideEffect: async () => {
        blockedHandlerCalls += 1;
        return { handled: true, outcome: "authorization_blocked", stateMutationCommitted: false };
      },
    },
  });
  return {
    query,
    authorization: analyzePositiveAuthorization(query),
    requestSemantics: analyzeRequestSemantics(query),
    result,
    protectedHandlerCalls,
    blockedHandlerCalls,
    confirmationStages,
    graphFingerprintBefore: before,
    graphFingerprintAfter: graphFingerprint(state.graph),
    graphVersionBefore: state.graphVersion,
    graphVersionAfter: state.graphVersion,
  };
}

export async function runStage10Corrective1Corpus() {
  const readOnlyRecords = [];
  let sequence = 0;
  for (const frame of NO_CONSENT_FRAMES) {
    for (const action of MUTATION_PHRASES) {
      for (const joiner of JOINERS) {
        const followUp = READ_ONLY_FOLLOW_UPS[sequence % READ_ONLY_FOLLOW_UPS.length];
        sequence += 1;
        readOnlyRecords.push(await dispatchCase(`${frame(action)}${joiner}${followUp}`));
      }
    }
  }
  for (const { category, query } of COMPOSITIONAL_READ_ONLY_CASES) {
    readOnlyRecords.push(await dispatchCase(query, undefined, category));
  }
  const positiveRecords = [];
  for (const query of TRUE_POSITIVE_CONTROLS) {
    const matchingOperation = analyzePositiveAuthorization(query).authorizedGraphOperations[0];
    positiveRecords.push(await dispatchCase(query, matchingOperation));
  }
  const exact = await dispatchCase(EXACT_S10_N01);
  const exactState = graphState();
  const exactPrepared = prepareDeterministicTurn({
    query: EXACT_S10_N01,
    analysisContext: { graph: exactState },
    compileContext: { graph: exactState },
  });

  const wrongPositiveAuthorizations = readOnlyRecords.filter(record => record.authorization.sideEffectScopes.includes("graph_edit_preview")).length;
  const protectedHandlerCalls = readOnlyRecords.reduce((sum, record) => sum + record.protectedHandlerCalls, 0);
  const confirmationStages = readOnlyRecords.reduce((sum, record) => sum + record.confirmationStages, 0);
  const stateChanges = readOnlyRecords.filter(record => record.graphFingerprintBefore !== record.graphFingerprintAfter || record.graphVersionBefore !== record.graphVersionAfter).length;
  const wrongBlocksOfTruePositiveControls = positiveRecords.filter(record => record.protectedHandlerCalls !== 1 || record.confirmationStages !== 1).length;
  return {
    totalCases: readOnlyRecords.length + positiveRecords.length,
    readOnlyNoConsentCases: readOnlyRecords.length,
    wrongPositiveAuthorizations,
    protectedHandlerCalls,
    confirmationStages,
    stateChanges,
    truePositiveControls: positiveRecords.length,
    wrongBlocksOfTruePositiveControls,
    exact: {
      authorizationMode: exact.authorization.mode,
      authorizationScopes: exact.authorization.sideEffectScopes,
      requestMode: exact.requestSemantics.mode,
      readOnlyScope: exact.requestSemantics.readOnlyScope,
      preparedDomain: exactPrepared.compilation?.domain ?? null,
      typedKind: exactPrepared.compilation?.typedKind ?? null,
      actualSideEffectClass: exact.result.runtimeTrace.actualSideEffectClass,
      authorizationDecision: exact.result.runtimeTrace.authorizationDecision,
      dispatchPath: exact.result.runtimeTrace.dispatchPath,
      dispatchBlockReason: exact.result.runtimeTrace.dispatchBlockReason,
      graphMutationHandlerCalls: exact.protectedHandlerCalls,
      confirmationStaged: exact.confirmationStages > 0,
      stateChanged: exact.graphFingerprintBefore !== exact.graphFingerprintAfter || exact.graphVersionBefore !== exact.graphVersionAfter,
    },
    coverage: {
      mutationFamilies: MUTATION_PHRASES.length,
      noConsentFrames: NO_CONSENT_FRAMES.length,
      punctuationVariants: JOINERS.length,
      readOnlyFollowUps: READ_ONLY_FOLLOW_UPS.length,
      compositionalCategories: COMPOSITIONAL_READ_ONLY_CASES.map(item => item.category),
    },
    failures: [
      ...readOnlyRecords.filter(record => record.authorization.sideEffectScopes.includes("graph_edit_preview") || record.protectedHandlerCalls || record.confirmationStages || record.graphFingerprintBefore !== record.graphFingerprintAfter).map(record => ({ type: "read_only", query: record.query, scopes: record.authorization.sideEffectScopes, handlerCalls: record.protectedHandlerCalls })),
      ...positiveRecords.filter(record => record.protectedHandlerCalls !== 1 || record.confirmationStages !== 1).map(record => ({ type: "positive", query: record.query, scopes: record.authorization.sideEffectScopes, handlerCalls: record.protectedHandlerCalls })),
    ],
  };
}
