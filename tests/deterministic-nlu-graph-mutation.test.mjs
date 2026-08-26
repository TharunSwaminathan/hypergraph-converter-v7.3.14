import assert from "node:assert/strict";
import { interpretGraphMutationRequest } from "../src/agent/graphMutationConversation.js";
import { createGraphIdentity } from "../src/graph/graphIdentity.js";

const graph = [
  { id: "h0", vertices: ["1", "2"], time: null, weight: 1, attributes: {} },
  { id: "h1", vertices: ["4", "5"], time: null, weight: 1, attributes: {} },
];
const identity = createGraphIdentity(graph, null, { replace: true });

const include = interpretGraphMutationRequest("h0 should include 4 too.", graph, identity);
assert.equal(include.ok, true);
assert.equal(include.plan.operations[0].type, "ADD_INCIDENCE");
assert.equal(include.plan.operations[0].hyperedgeId, "h0");
assert.equal(include.plan.operations[0].vertexId, "4");

const scoped = interpretGraphMutationRequest("Take vertex 4 out of h1, but keep it in the other hyperedges.", graph, identity);
assert.equal(scoped.ok, true);
assert.equal(scoped.plan.operations[0].type, "REMOVE_INCIDENCE");
assert.equal(scoped.plan.operations[0].hyperedgeId, "h1");

console.log("deterministic NLU graph mutation tests passed.");
