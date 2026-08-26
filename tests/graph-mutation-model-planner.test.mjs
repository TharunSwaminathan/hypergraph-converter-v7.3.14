import assert from "node:assert/strict";
import { validateGraphMutationDraft } from "../src/agent/graphMutationDraftValidator.js";
import {
  isPlausibleGraphMutationText,
  planGraphMutationWithModel,
  resolveGraphMutationDraftToPlan,
} from "../src/agent/graphMutationModelPlanner.js";
import { GRAPH_MUTATION_DRAFT_TASK } from "../src/agent/graphMutationDraftSchema.js";
import { createGraphIdentity } from "../src/graph/graphIdentity.js";

const graph = [
  { id: "h0", vertices: ["Alice", "Bob"], time: null, weight: 1, attributes: {} },
  { id: "h1", vertices: ["Carol"], time: null, weight: 1, attributes: {} },
];
const identity = createGraphIdentity(graph, null, { replace: true });

function ref(entityType, surfaceText, referenceKind = "literal") {
  return { entityType, referenceKind, surfaceText };
}

function draft(overrides = {}) {
  return {
    task: GRAPH_MUTATION_DRAFT_TASK,
    classification: "mutation",
    intentSummary: "Add Alice to h1.",
    operations: [
      {
        type: "ADD_INCIDENCE",
        vertexReference: ref("vertex", "Alice"),
        hyperedgeReference: ref("hyperedge", "h1"),
      },
    ],
    clarificationQuestion: null,
    correction: { isCorrection: false, replacePendingPlan: false },
    previewOnly: false,
    acknowledgement: "I will prepare adding Alice to h1.",
    confidence: "high",
    ...overrides,
  };
}

const valid = validateGraphMutationDraft(JSON.stringify(draft()));
assert.equal(valid.ok, true, "valid GraphMutationDraft passes strict validation");

assert.equal(validateGraphMutationDraft(JSON.stringify(draft({ task: "chat" }))).ok, false, "invalid task rejected");
assert.equal(validateGraphMutationDraft(JSON.stringify(draft({ classification: "execute" }))).ok, false, "unknown classification rejected");
assert.equal(validateGraphMutationDraft(JSON.stringify(draft({ extra: true }))).ok, false, "extra top-level property rejected");
assert.equal(validateGraphMutationDraft(JSON.stringify(draft({ acknowledgement: "x".repeat(301) }))).ok, false, "oversized acknowledgement rejected");
assert.equal(validateGraphMutationDraft(JSON.stringify(draft({
  operations: [{ type: "ADD_INCIDENCE", vertexReference: ref("vertex", "Alice") }],
}))).ok, false, "missing reference rejected");
assert.equal(validateGraphMutationDraft(JSON.stringify(draft({
  operations: [{ type: "MAKE_GRAPH", vertexReference: ref("vertex", "Alice"), hyperedgeReference: ref("hyperedge", "h1") }],
}))).ok, false, "unknown operation rejected");
assert.equal(validateGraphMutationDraft(JSON.stringify(draft({
  operations: [{
    type: "SET_HYPEREDGE_WEIGHT",
    hyperedgeReference: ref("hyperedge", "h0"),
    weight: "NaN",
  }],
}))).ok, false, "non-finite number rejected");
assert.equal(validateGraphMutationDraft(JSON.stringify(draft({
  operations: [{
    type: "SET_HYPEREDGE_ATTRIBUTE",
    hyperedgeReference: ref("hyperedge", "h0"),
    key: "__proto__",
    value: "blocked",
  }],
}))).ok, false, "unsafe attribute key rejected");
assert.equal(validateGraphMutationDraft(JSON.stringify(draft({
  operations: [{
    type: "ADD_INCIDENCE",
    vertexReference: ref("hyperedge", "Alice"),
    hyperedgeReference: ref("hyperedge", "h1"),
  }],
}))).ok, false, "wrong entity type rejected");
assert.equal(validateGraphMutationDraft(JSON.stringify(draft({
  operations: Array.from({ length: 11 }, () => ({
    type: "ADD_INCIDENCE",
    vertexReference: ref("vertex", "Alice"),
    hyperedgeReference: ref("hyperedge", "h1"),
  })),
}))).ok, false, "more than ten operations rejected");
assert.equal(validateGraphMutationDraft(JSON.stringify(draft({
  acknowledgement: "Use eval(alert(1))",
}))).ok, false, "executable-looking field rejected");
assert.equal(validateGraphMutationDraft(JSON.stringify(draft({
  classification: "clarification",
  operations: [],
  clarificationQuestion: "Which hyperedge should I use?",
}))).ok, true, "clarification draft with question accepted");
assert.equal(validateGraphMutationDraft(JSON.stringify(draft({
  classification: "not_mutation",
  operations: [],
  acknowledgement: "That is not a graph edit.",
}))).ok, true, "not_mutation draft accepted without operations");

const generated = await planGraphMutationWithModel({
  config: { enabled: true, activeBaseUrl: "http://127.0.0.1:11434", model: "qwen3:8b" },
  userQuery: "Put Alice in h1.",
  hyperedges: graph,
  graphIdentity: identity,
  generate: async (_config, request) => {
    assert.equal(request.task, GRAPH_MUTATION_DRAFT_TASK);
    assert.equal(request.taskMode, "PLAN_GRAPH_MUTATION");
    assert.equal(Boolean(request.responseSchema), true, "strict response schema is attached");
    return JSON.stringify(draft());
  },
});
assert.equal(generated.ok, true);
assert.equal(generated.plannerPath, "model");

const resolved = resolveGraphMutationDraftToPlan({
  draft: generated.draft,
  hyperedges: graph,
  graphIdentity: identity,
});
assert.equal(resolved.ok, true);
assert.equal(resolved.plan.operations[0].type, "ADD_INCIDENCE");
assert.equal(resolved.plan.operations[0].hyperedgeId, "h1");
assert.equal(resolved.plan.operations[0].vertexId, "Alice");
assert.equal(resolved.plan.source, "conversation_model_planner");

const repair = await planGraphMutationWithModel({
  config: { enabled: true, activeBaseUrl: "http://127.0.0.1:11434", model: "qwen3:8b" },
  userQuery: "Put Alice in h1.",
  hyperedges: graph,
  graphIdentity: identity,
  generate: async (_config, request) => request.repairAttempt ? JSON.stringify(draft()) : "{\"task\":\"bad\"}",
});
assert.equal(repair.ok, true, "one repair attempt can recover a valid draft");
assert.equal(repair.attempts.length, 2);

const notMutation = resolveGraphMutationDraftToPlan({
  draft: draft({ classification: "not_mutation", operations: [] }),
  hyperedges: graph,
  graphIdentity: identity,
});
assert.equal(notMutation.noMatch, true, "not_mutation returns to normal conversation/control flow");

assert.equal(isPlausibleGraphMutationText("h1 needs vertex Alice too"), true);
assert.equal(isPlausibleGraphMutationText("What is a hyperedge?"), false);

console.log("graph mutation model planner tests passed.");
