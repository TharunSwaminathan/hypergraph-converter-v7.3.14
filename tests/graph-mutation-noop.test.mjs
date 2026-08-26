import assert from "node:assert/strict";
import { interpretGraphMutationRequest } from "../src/agent/graphMutationConversation.js";
import { resolveGraphMutationDraftToPlan } from "../src/agent/graphMutationModelPlanner.js";
import { GRAPH_MUTATION_DRAFT_TASK } from "../src/agent/graphMutationDraftSchema.js";
import { createGraphIdentity, nextCommittedGraphIdentity } from "../src/graph/graphIdentity.js";
import { previewGraphMutation } from "../src/graph/graphMutationPreview.js";

const graph = [
  { id: "h0", vertices: ["4", "Alice"], time: null, weight: 1, attributes: {} },
];
const identity = createGraphIdentity(graph, null, { replace: true });

const duplicateRequests = [
  "Add vertex 4 to h0.",
  "Add vertex 4 to h0 again.",
  "h0 needs vertex 4 too.",
];

for (const text of duplicateRequests) {
  const result = interpretGraphMutationRequest(text, graph, identity);
  assert.equal(result.ok, true, text);
  const preview = previewGraphMutation(graph, result.plan, identity);
  assert.equal(preview.ok, true, text);
  assert.equal(preview.graphChanged, false, text);
  assert.equal(preview.beforeFingerprint, preview.afterFingerprint, text);
  assert.match(preview.warnings.join(" "), /already in hyperedge "h0"/, text);
  const afterIdentity = nextCommittedGraphIdentity(identity, preview.hyperedges);
  assert.equal(afterIdentity.graphVersion, identity.graphVersion, "no-op preview must not imply a version increment");
}

const draft = {
  task: GRAPH_MUTATION_DRAFT_TASK,
  classification: "mutation",
  intentSummary: "Add vertex 4 to h0 again.",
  operations: [{
    type: "ADD_INCIDENCE",
    vertexReference: { entityType: "vertex", referenceKind: "literal", surfaceText: "4" },
    hyperedgeReference: { entityType: "hyperedge", referenceKind: "literal", surfaceText: "h0" },
  }],
  clarificationQuestion: null,
  correction: { isCorrection: false, replacePendingPlan: false },
  previewOnly: false,
  acknowledgement: "I will check h0 before staging the membership change.",
  confidence: "high",
};
const planned = resolveGraphMutationDraftToPlan({ draft, hyperedges: graph, graphIdentity: identity });
assert.equal(planned.ok, true);
const modelPreview = previewGraphMutation(graph, planned.plan, identity);
assert.equal(modelPreview.graphChanged, false, "model-planned duplicate incidence is a deterministic no-op before confirmation");
assert.equal(planned.plan.operations.length, 1);
assert.equal(planned.plan.operations[0].vertexId, "4");
assert.equal(planned.plan.operations[0].hyperedgeId, "h0");

const chatSource = await import("node:fs/promises")
  .then(fs => fs.readFile(new URL("../src/components/AgentChatPanel.jsx", import.meta.url), "utf8"));
const noopIndex = chatSource.indexOf("result.graphChanged === false");
const pendingIndex = chatSource.indexOf("setPendingAction({", noopIndex);
assert.ok(noopIndex > 0, "chat panel has no-op branch");
assert.ok(pendingIndex > noopIndex, "no-op branch is before graph-mutation setPendingAction");

console.log("graph mutation no-op tests passed.");
