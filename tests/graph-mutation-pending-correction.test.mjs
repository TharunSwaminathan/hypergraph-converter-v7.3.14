import assert from "node:assert/strict";
import { resolveGraphMutationDraftToPlan } from "../src/agent/graphMutationModelPlanner.js";
import { GRAPH_MUTATION_DRAFT_TASK } from "../src/agent/graphMutationDraftSchema.js";
import { createGraphIdentity } from "../src/graph/graphIdentity.js";
import { createMutationPlan } from "../src/graph/graphMutationValidator.js";
import { previewGraphMutation } from "../src/graph/graphMutationPreview.js";
import { createConfirmationSnapshot, isConfirmationStale } from "../src/agent/confirmationState.js";

const graph = [
  { id: "h0", vertices: ["Alice", "Bob"], time: null, weight: 1, attributes: {} },
  { id: "h1", vertices: ["Alice", "Carol"], time: null, weight: 1, attributes: {} },
];
const identity = createGraphIdentity(graph, null, { replace: true });
const state = {
  graphId: identity.graphId,
  graphVersion: identity.graphVersion,
  graphFingerprint: identity.graphFingerprint,
  batchVersion: 0,
  customCodeVersion: 0,
  customResultId: null,
  activeBatchId: null,
};

const originalPlan = createMutationPlan({
  graphIdentity: identity,
  source: "conversation",
  summary: "Remove vertex Alice from every hyperedge.",
  operations: [{ type: "REMOVE_VERTEX_GLOBAL", vertexId: "Alice", emptyHyperedgePolicy: "remove_empty" }],
});
const originalPreview = previewGraphMutation(graph, originalPlan, identity);
const originalConfirmation = createConfirmationSnapshot("apply_graph_mutation", state, { mutationPlan: originalPlan });
const pendingAction = {
  actionType: "apply_graph_mutation",
  plan: originalPlan,
  preview: originalPreview,
  confirmationToken: originalConfirmation,
};

const correctionDraft = {
  task: GRAPH_MUTATION_DRAFT_TASK,
  classification: "mutation",
  intentSummary: "Actually, only remove Alice from h0.",
  operations: [{
    type: "REMOVE_INCIDENCE",
    vertexReference: { entityType: "vertex", referenceKind: "literal", surfaceText: "Alice" },
    hyperedgeReference: { entityType: "hyperedge", referenceKind: "literal", surfaceText: "h0" },
    emptyHyperedgePolicy: "remove_empty",
  }],
  clarificationQuestion: null,
  correction: { isCorrection: true, replacePendingPlan: true },
  previewOnly: false,
  acknowledgement: "I will replace the pending global removal with a local membership removal.",
  confidence: "high",
};

const revised = resolveGraphMutationDraftToPlan({
  draft: correctionDraft,
  hyperedges: graph,
  graphIdentity: identity,
  pendingAction,
});
assert.equal(revised.ok, true);
assert.equal(revised.plan.operations[0].type, "REMOVE_INCIDENCE");
assert.equal(revised.plan.operations[0].hyperedgeId, "h0");
assert.equal(revised.plan.operations[0].vertexId, "Alice");
assert.equal(revised.plan.metadata.pendingPlanReplaced, true);
assert.notEqual(revised.plan.planId, originalPlan.planId);
assert.notEqual(revised.plan.planHash, originalPlan.planHash);

const revisedPreview = previewGraphMutation(graph, revised.plan, identity);
assert.equal(revisedPreview.ok, true);
assert.equal(revisedPreview.delta.incidences, -1);
assert.equal(revisedPreview.after.hyperedges, 2, "local incidence correction keeps h1 untouched");

assert.equal(isConfirmationStale(originalConfirmation, {
  ...state,
  graphVersion: identity.graphVersion + 1,
}), true, "old confirmation is rejected if graph state advances");

const renameDraft = {
  task: GRAPH_MUTATION_DRAFT_TASK,
  classification: "mutation",
  intentSummary: "No, call it Artemis instead.",
  operations: [{
    type: "RENAME_HYPEREDGE",
    hyperedgeReference: { entityType: "hyperedge", referenceKind: "literal", surfaceText: "h0" },
    newHyperedgeId: "Artemis",
  }],
  clarificationQuestion: null,
  correction: { isCorrection: true, replacePendingPlan: true },
  previewOnly: false,
  acknowledgement: "I will revise the pending rename.",
  confidence: "high",
};
const rename = resolveGraphMutationDraftToPlan({ draft: renameDraft, hyperedges: graph, graphIdentity: identity, pendingAction });
assert.equal(rename.ok, true);
assert.equal(rename.plan.operations[0].type, "RENAME_HYPEREDGE");
assert.equal(rename.plan.operations[0].newHyperedgeId, "Artemis");
assert.equal(rename.plan.metadata.pendingPlanReplaced, true);

const impactQuestionDraft = {
  task: GRAPH_MUTATION_DRAFT_TASK,
  classification: "not_mutation",
  intentSummary: "What will this affect?",
  operations: [],
  clarificationQuestion: null,
  correction: { isCorrection: false, replacePendingPlan: false },
  previewOnly: false,
  acknowledgement: "The user is asking about the pending preview.",
  confidence: "medium",
};
const impact = resolveGraphMutationDraftToPlan({ draft: impactQuestionDraft, hyperedges: graph, graphIdentity: identity, pendingAction });
assert.equal(impact.noMatch, true, "pending impact questions are not converted into replacement plans");

console.log("graph mutation pending correction tests passed.");
