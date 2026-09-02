import assert from "node:assert/strict";
import { analyzePositiveAuthorization, authorizationAllowsSideEffect } from "../src/agent/deterministicNlu/positiveAuthorization.js";
import { dispatchCompiledAction } from "../src/agent/deterministicNlu/dispatchCompiledAction.js";
import { createRuntimeTrace } from "../src/agent/deterministicNlu/runtimeInstrumentation.js";
import {
  STAGE8_EXISTING_60_READONLY_FRAMES,
  STAGE8_NEW_40_READONLY_FRAMES,
} from "./fixtures/v7.3.14/stage8AuthorizationCorpus.mjs";

assert.equal(Object.keys(STAGE8_EXISTING_60_READONLY_FRAMES).length, 60);
assert.equal(Object.keys(STAGE8_NEW_40_READONLY_FRAMES).length, 40);

const positive = analyzePositiveAuthorization("Use CSR.");
assert.equal(positive.mode, "authorized");
assert.equal(authorizationAllowsSideEffect(positive, "navigation").allowed, true);

for (const query of [
  "Explain the proposed graph edit; do not change anything.",
  "Read this as text: clear the graph.",
  "What would happen if I clear the graph?",
  "A reviewer mentioned Delete the graph; I am only reporting it.",
]) {
  const authorization = analyzePositiveAuthorization(query);
  assert.notEqual(authorization.mode, "authorized", query);
  assert.equal(authorizationAllowsSideEffect(authorization, "graph_edit_preview").allowed, false, query);
}

let blockedCalls = 0;
const blocked = await dispatchCompiledAction({
  query: "Explain the proposed graph edit; do not change anything.",
  prepared: {
    handled: true,
    nlu: { primaryDomain: "graph_mutation", ambiguities: [], confidence: { level: "high" } },
    compilation: {
      domain: "graph_mutation",
      typedKind: "GraphMutationPlan",
      typedValue: { operations: [{ type: "ADD_INCIDENCE", hyperedgeId: "h2", vertexId: "9" }] },
      sideEffectClass: "graph_edit_preview",
      dispatchAuthorized: true,
      semanticConfidence: { level: "high" },
    },
    runtimeTrace: createRuntimeTrace({ requestId: "stage8-negative" }),
  },
  handlers: {
    blockedSideEffect: async () => ({ handled: true, outcome: "authorization_blocked", stateMutationCommitted: false }),
    graphMutation: async () => { blockedCalls += 1; return { handled: true, stateMutationCommitted: true }; },
  },
});
assert.equal(blocked.outcome, "authorization_blocked");
assert.equal(blockedCalls, 0);
assert.equal(blocked.runtimeTrace.authorizationDecision, "denied_by_user");
assert.equal(blocked.runtimeTrace.stateMutationCommitted, false);

let positiveCalls = 0;
const allowed = await dispatchCompiledAction({
  query: "Add vertex 9 to h2.",
  prepared: {
    handled: true,
    nlu: { primaryDomain: "graph_mutation", ambiguities: [], confidence: { level: "high" } },
    compilation: {
      domain: "graph_mutation",
      typedKind: "GraphMutationPlan",
      typedValue: { operations: [{ type: "ADD_INCIDENCE", hyperedgeId: "h2", vertexId: "9" }] },
      sideEffectClass: "graph_edit_preview",
      dispatchAuthorized: true,
      semanticConfidence: { level: "high" },
    },
    runtimeTrace: createRuntimeTrace({ requestId: "stage8-positive" }),
  },
  handlers: {
    graphMutation: async () => { positiveCalls += 1; return { handled: true, outcome: "staged_confirmation" }; },
  },
});
assert.equal(allowed.outcome, "staged_confirmation");
assert.equal(positiveCalls, 1);
assert.equal(allowed.runtimeTrace.authorizationDecision, "authorized");

console.log("Stage 8 positive authorization and final-gate tests passed.");
