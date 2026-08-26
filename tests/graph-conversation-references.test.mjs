import assert from "node:assert/strict";
import {
  addVerifiedGraphReferences,
  createGraphConversationReferences,
  pruneGraphConversationReferences,
  recentReferenceContext,
  referencesFromMutationPlan,
} from "../src/agent/graphConversationReferences.js";
import { resolveHyperedgeReference } from "../src/graph/entityResolver.js";
import { GRAPH_MUTATION_OPS } from "../src/graph/graphMutationSchema.js";

const graph = [
  { id: "h0", vertices: ["1", "2"] },
  { id: "h1", vertices: ["7"] },
];

let refs = createGraphConversationReferences("g1");
refs = addVerifiedGraphReferences(refs, {
  graphId: "g1",
  vertices: ["7", "invented"],
  hyperedges: ["h1", "missing"],
  source: "resolved_plan",
  currentHyperedges: graph,
});
assert.deepEqual(recentReferenceContext(refs), { vertices: ["7"], hyperedges: ["h1"] });

const resolved = resolveHyperedgeReference("that one", graph, null, { recentIds: recentReferenceContext(refs).hyperedges });
assert.equal(resolved.ok, true);
assert.equal(resolved.id, "h1");
assert.equal(resolved.method, "recent");

let ambiguous = addVerifiedGraphReferences(refs, {
  graphId: "g1",
  hyperedges: ["h0"],
  source: "visual_selection",
  currentHyperedges: graph,
});
const ambiguousResolution = resolveHyperedgeReference("that one", graph, null, { recentIds: recentReferenceContext(ambiguous).hyperedges });
assert.equal(ambiguousResolution.ok, false);
assert.equal(ambiguousResolution.reason, "ambiguous_reference");

const selectedResolution = resolveHyperedgeReference("that one", graph, { type: "hyperedge", id: "h0", version: 1 }, { recentIds: recentReferenceContext(ambiguous).hyperedges });
assert.equal(selectedResolution.ok, true);
assert.equal(selectedResolution.id, "h0");
assert.equal(selectedResolution.method, "selection");

const pruned = pruneGraphConversationReferences(refs, { graphId: "g2", hyperedges: graph });
assert.deepEqual(recentReferenceContext(pruned), { vertices: [], hyperedges: [] });

const extracted = referencesFromMutationPlan({
  operations: [{ type: GRAPH_MUTATION_OPS.ADD_INCIDENCE, hyperedgeId: "h1", vertexId: "7" }],
});
assert.deepEqual(extracted, { vertices: ["7"], hyperedges: ["h1"] });

console.log("graph conversation reference tests passed.");
