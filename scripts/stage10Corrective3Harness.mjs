import { analyzePositiveAuthorization } from "../src/agent/deterministicNlu/positiveAuthorization.js";
import { analyzeRequestSemantics } from "../src/agent/deterministicNlu/requestSemantics.js";
import { dispatchCompiledAction } from "../src/agent/deterministicNlu/dispatchCompiledAction.js";
import { createRuntimeTrace } from "../src/agent/deterministicNlu/runtimeInstrumentation.js";
import { graphFingerprint } from "../src/graph/graphFingerprint.js";
import { GRAPH_MUTATION_OPS } from "../src/graph/graphMutationSchema.js";
import { runStage10Corrective1Corpus } from "./stage10Corrective1Harness.mjs";
import { runStage10Corrective2 } from "./stage10Corrective2Harness.mjs";

const COLLISION_GRAPH = Object.freeze([
  { id: "h1", vertices: ["a", "A"], time: null, weight: 1, attributes: {} },
  { id: "H1", vertices: ["a"], time: null, weight: 1, attributes: {} },
  { id: "h2", vertices: ["a", "B"], time: null, weight: 1, attributes: {} },
]);

const FRESH_EXACT = Object.freeze([
  "You lack my permission to delete h1; tell me whether h1 exists.",
  "I have revoked permission to delete h1; tell me whether h1 exists.",
  "My permission to delete h1 is revoked; tell me whether h1 exists.",
  "I want to decide whether to delete h1; tell me whether h1 exists.",
  "I need to decide whether to delete h1; tell me whether h1 exists.",
  "I'm trying to decide whether to delete h1; tell me whether h1 exists.",
  "I wonder whether I should delete h1; tell me whether h1 exists.",
  "I'm weighing whether to delete h1; tell me whether h1 exists.",
]);

const MUTATION_FAMILIES = Object.freeze([
  { text: "delete hyperedge h1", operation: { type: GRAPH_MUTATION_OPS.REMOVE_HYPEREDGE, hyperedgeId: "h1" } },
  { text: "clear the graph", operation: { type: GRAPH_MUTATION_OPS.CLEAR_GRAPH } },
  { text: "create hyperedge h3 with vertices 8 and 9", operation: { type: GRAPH_MUTATION_OPS.ADD_HYPEREDGE, hyperedgeId: "h3", vertices: ["8", "9"] } },
  { text: "remove vertex a from hyperedge h1", operation: { type: GRAPH_MUTATION_OPS.REMOVE_INCIDENCE, hyperedgeId: "h1", vertexId: "a" } },
  { text: "rename hyperedge h1 to archived", operation: { type: GRAPH_MUTATION_OPS.RENAME_HYPEREDGE, hyperedgeId: "h1", newHyperedgeId: "archived" } },
  { text: "change the weight of hyperedge h2 to 4", operation: { type: GRAPH_MUTATION_OPS.SET_HYPEREDGE_WEIGHT, hyperedgeId: "h2", weight: 4 } },
]);

// Curated as semantic frames rather than imported from production patterns.
const NON_AUTHORIZING_FRAMES = Object.freeze([
  action => `You lack my permission to ${action}`,
  action => `No permission exists for you to ${action}`,
  action => `I have revoked permission to ${action}`,
  action => `My authorization to ${action} is revoked`,
  action => `I want to decide whether to ${action}`,
  action => `I need to decide whether to ${action}`,
  action => `I am trying to decide whether to ${action}`,
  action => `I wonder whether I should ${action}`,
  action => `I am weighing whether to ${action}`,
  action => `I am debating whether to ${action}`,
  action => `I am evaluating whether ${action} makes sense`,
  action => `I may consider whether to ${action} next week`,
  action => `The reviewer is considering whether to ${action}`,
  action => `The quoted note says "consider whether to ${action}"`,
  action => `If I later consider whether to ${action}, do nothing yet`,
  action => `We discussed whether to ${action} yesterday`,
]);

const FOLLOW_UP_VARIANTS = Object.freeze([
  stem => `${stem}; tell me the current graph facts.`,
  stem => `${stem}. Please report whether h1 exists!`,
  stem => `${stem} — explain the possible effect?`,
]);

const TRUE_POSITIVES = Object.freeze([
  { query: "Delete hyperedge h1.", operation: { type: GRAPH_MUTATION_OPS.REMOVE_HYPEREDGE, hyperedgeId: "h1" } },
  { query: "Please delete hyperedge h1.", operation: { type: GRAPH_MUTATION_OPS.REMOVE_HYPEREDGE, hyperedgeId: "h1" } },
  { query: "Could you delete hyperedge h1?", operation: { type: GRAPH_MUTATION_OPS.REMOVE_HYPEREDGE, hyperedgeId: "h1" } },
  { query: "I want you to delete hyperedge h1.", operation: { type: GRAPH_MUTATION_OPS.REMOVE_HYPEREDGE, hyperedgeId: "h1" } },
  { query: "Clear the graph.", operation: { type: GRAPH_MUTATION_OPS.CLEAR_GRAPH } },
  { query: "Create hyperedge h3 with vertices 8 and 9.", operation: { type: GRAPH_MUTATION_OPS.ADD_HYPEREDGE, hyperedgeId: "h3", vertices: ["8", "9"] } },
  { query: "I am deciding whether to delete h1; delete hyperedge h1 now.", operation: { type: GRAPH_MUTATION_OPS.REMOVE_HYPEREDGE, hyperedgeId: "h1" } },
  { query: "You lack my permission to delete h1; create hyperedge h3 with vertices 8 and 9.", operation: { type: GRAPH_MUTATION_OPS.ADD_HYPEREDGE, hyperedgeId: "h3", vertices: ["8", "9"] } },
]);

async function dispatchModelShaped(query, operations, graph = COLLISION_GRAPH) {
  const current = {
    graph,
    graphHyperedges: graph,
    graphVersion: 23,
    hasGraph: graph.length > 0,
    hyperedgeCount: graph.length,
    vertexCount: new Set(graph.flatMap(edge => edge.vertices)).size,
  };
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
    runtimeTrace: createRuntimeTrace({ requestId: "stage10-corrective3" }),
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
    graphIds: {
      hyperedges: graph.map(edge => edge.id),
      vertices: [...new Set(graph.flatMap(edge => edge.vertices))],
    },
    authorization: analyzePositiveAuthorization(query),
    requestSemantics: semantics,
    authorizationDecision: result.runtimeTrace.authorizationDecision,
    dispatchBlockReason: result.runtimeTrace.dispatchBlockReason ?? null,
    authorizedGraphOperations: result.runtimeTrace.authorizedGraphOperations ?? [],
    unmatchedGraphOperations: result.runtimeTrace.unmatchedGraphOperations ?? [],
    protectedHandlerCalls,
    confirmationStages,
    stateChanged: beforeFingerprint !== graphFingerprint(current.graph) || current.graphVersion !== 23,
  };
}

async function runCaseResolutionMatrix() {
  const uniqueGraph = [{ id: "H1", vertices: ["A", "B"], time: null, weight: 1, attributes: {} }];
  const cases = [
    { id: "exact-h1-to-h1", expectedAllowed: true, query: "Delete hyperedge h1.", operation: { type: GRAPH_MUTATION_OPS.REMOVE_HYPEREDGE, hyperedgeId: "h1" }, graph: COLLISION_GRAPH },
    { id: "exact-h1-to-H1", expectedAllowed: false, query: "Delete hyperedge h1.", operation: { type: GRAPH_MUTATION_OPS.REMOVE_HYPEREDGE, hyperedgeId: "H1" }, graph: COLLISION_GRAPH },
    { id: "exact-H1-to-H1", expectedAllowed: true, query: "Delete hyperedge H1.", operation: { type: GRAPH_MUTATION_OPS.REMOVE_HYPEREDGE, hyperedgeId: "H1" }, graph: COLLISION_GRAPH },
    { id: "exact-H1-to-h1", expectedAllowed: false, query: "Delete hyperedge H1.", operation: { type: GRAPH_MUTATION_OPS.REMOVE_HYPEREDGE, hyperedgeId: "h1" }, graph: COLLISION_GRAPH },
    { id: "vertex-a-to-A", expectedAllowed: false, query: "Remove vertex a from hyperedge h1.", operation: { type: GRAPH_MUTATION_OPS.REMOVE_INCIDENCE, hyperedgeId: "h1", vertexId: "A" }, graph: COLLISION_GRAPH },
    { id: "vertex-a-hyperedge-substitution", expectedAllowed: false, query: "Remove vertex a from hyperedge h1.", operation: { type: GRAPH_MUTATION_OPS.REMOVE_INCIDENCE, hyperedgeId: "H1", vertexId: "a" }, graph: COLLISION_GRAPH },
    { id: "unique-case-insensitive-hyperedge", expectedAllowed: true, query: "Delete hyperedge h1.", operation: { type: GRAPH_MUTATION_OPS.REMOVE_HYPEREDGE, hyperedgeId: "H1" }, graph: uniqueGraph },
    { id: "unique-case-insensitive-wrong-raw", expectedAllowed: false, query: "Delete hyperedge h1.", operation: { type: GRAPH_MUTATION_OPS.REMOVE_HYPEREDGE, hyperedgeId: "h1" }, graph: uniqueGraph },
    { id: "unique-case-insensitive-vertex", expectedAllowed: true, query: "Remove vertex a from hyperedge H1.", operation: { type: GRAPH_MUTATION_OPS.REMOVE_INCIDENCE, hyperedgeId: "H1", vertexId: "A" }, graph: uniqueGraph },
    { id: "ambiguous-case-insensitive-to-h1", expectedAllowed: false, query: "Delete hyperedge hI.", operation: { type: GRAPH_MUTATION_OPS.REMOVE_HYPEREDGE, hyperedgeId: "h1" }, graph: COLLISION_GRAPH },
    { id: "ambiguous-case-insensitive-to-H1", expectedAllowed: false, query: "Delete hyperedge hI.", operation: { type: GRAPH_MUTATION_OPS.REMOVE_HYPEREDGE, hyperedgeId: "H1" }, graph: COLLISION_GRAPH },
  ];
  const records = [];
  for (const item of cases) {
    const result = await dispatchModelShaped(item.query, [item.operation], item.graph);
    records.push({
      id: item.id,
      expectedAllowed: item.expectedAllowed,
      allowed: result.protectedHandlerCalls === 1 && result.confirmationStages === 1,
      result,
    });
  }
  return records;
}

export async function runStage10Corrective3() {
  const heldOutRecords = [];
  for (const query of FRESH_EXACT) {
    heldOutRecords.push(await dispatchModelShaped(query, [{ type: GRAPH_MUTATION_OPS.REMOVE_HYPEREDGE, hyperedgeId: "h1" }]));
  }
  for (const frame of NON_AUTHORIZING_FRAMES) {
    for (const mutation of MUTATION_FAMILIES) {
      for (const followUp of FOLLOW_UP_VARIANTS) {
        heldOutRecords.push(await dispatchModelShaped(followUp(frame(mutation.text)), [mutation.operation]));
      }
    }
  }

  const positiveRecords = [];
  for (const item of TRUE_POSITIVES) positiveRecords.push(await dispatchModelShaped(item.query, [item.operation]));
  const caseResolution = await runCaseResolutionMatrix();
  const corrective1 = await runStage10Corrective1Corpus();
  const corrective2 = await runStage10Corrective2();

  const heldOutFailures = heldOutRecords.filter(record => record.authorization.sideEffectScopes.includes("graph_edit_preview")
    || record.protectedHandlerCalls
    || record.confirmationStages
    || record.stateChanged);
  const positiveFailures = positiveRecords.filter(record => record.protectedHandlerCalls !== 1
    || record.confirmationStages !== 1
    || record.stateChanged);
  const caseFailures = caseResolution.filter(record => record.allowed !== record.expectedAllowed || record.result.stateChanged);

  return {
    positiveEvidence: {
      model: "recognized affirmative execution frame plus exact operation binding",
      negativeEvidenceAbsenceIsAuthority: false,
      graphMutationVerbAloneIsAuthority: false,
    },
    heldOut: {
      cases: heldOutRecords.length,
      wrongPositiveAuthorizations: heldOutRecords.filter(record => record.authorization.sideEffectScopes.includes("graph_edit_preview")).length,
      protectedHandlerCalls: heldOutRecords.reduce((sum, record) => sum + record.protectedHandlerCalls, 0),
      confirmationStages: heldOutRecords.reduce((sum, record) => sum + record.confirmationStages, 0),
      stateChanges: heldOutRecords.filter(record => record.stateChanged).length,
      truePositives: positiveRecords.length,
      wrongTruePositiveBlocks: positiveFailures.length,
      freshExact: heldOutRecords.slice(0, FRESH_EXACT.length).map(record => ({
        query: record.query,
        authorizationMode: record.authorization.mode,
        sideEffectScopes: record.authorization.sideEffectScopes,
        protectedHandlerCalls: record.protectedHandlerCalls,
        confirmationStages: record.confirmationStages,
        stateChanged: record.stateChanged,
      })),
      failures: heldOutFailures.map(record => ({ query: record.query, scopes: record.authorization.sideEffectScopes, block: record.dispatchBlockReason })),
      positiveFailures: positiveFailures.map(record => ({ query: record.query, block: record.dispatchBlockReason })),
    },
    caseBinding: {
      graphIds: { hyperedges: ["h1", "H1"], vertices: ["a", "A"] },
      cases: caseResolution.length,
      exactAllowed: caseResolution.filter(record => record.expectedAllowed && record.allowed).length,
      invalidBlocked: caseResolution.filter(record => !record.expectedAllowed && !record.allowed).length,
      protectedHandlerCallsForInvalid: caseResolution.filter(record => !record.expectedAllowed).reduce((sum, record) => sum + record.result.protectedHandlerCalls, 0),
      confirmationStagesForInvalid: caseResolution.filter(record => !record.expectedAllowed).reduce((sum, record) => sum + record.result.confirmationStages, 0),
      stateChanges: caseResolution.filter(record => record.result.stateChanged).length,
      records: caseResolution.map(record => ({
        id: record.id,
        expectedAllowed: record.expectedAllowed,
        allowed: record.allowed,
        authorizationDecision: record.result.authorizationDecision,
        dispatchBlockReason: record.result.dispatchBlockReason,
        protectedHandlerCalls: record.result.protectedHandlerCalls,
        confirmationStages: record.result.confirmationStages,
      })),
      failures: caseFailures.map(record => record.id),
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
    corrective2: {
      heldOut: corrective2.heldOut,
      operationBinding: corrective2.operationBinding,
    },
  };
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replaceAll("\\", "/")}`).href) {
  process.stdout.write(`${JSON.stringify(await runStage10Corrective3(), null, 2)}\n`);
}
