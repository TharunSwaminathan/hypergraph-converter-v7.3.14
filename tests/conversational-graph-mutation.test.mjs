import assert from "node:assert/strict";
import { interpretGraphMutationRequest } from "../src/agent/graphMutationConversation.js";
import { createGraphIdentity } from "../src/graph/graphIdentity.js";

const graph = [
  { id: "h0", vertices: ["Alice", "Bob"], time: null, weight: 1, attributes: {} },
  { id: "h1", vertices: ["Solo"], time: 2024, weight: 2, attributes: {} },
];
const identity = createGraphIdentity(graph, null, { replace: true });

const standalone = interpretGraphMutationRequest("add vertex called Charlie", graph, identity);
assert.equal(standalone.needsClarification, true);
assert.match(standalone.message, /standalone vertex is ambiguous/i);

const add = interpretGraphMutationRequest("add Charlie to h0", graph, identity);
assert.equal(add.ok, true);
assert.equal(add.plan.operations[0].type, "ADD_INCIDENCE");
assert.equal(add.plan.operations[0].vertexId, "Charlie");

const rename = interpretGraphMutationRequest("rename vertex Alice to Alicia", graph, identity);
assert.equal(rename.ok, true);
assert.equal(rename.plan.operations[0].type, "RENAME_VERTEX");
assert.equal(rename.plan.operations[0].newVertexId, "Alicia");

const empty = interpretGraphMutationRequest("remove Solo from h1", graph, identity);
assert.equal(empty.needsClarification, true);
assert.match(empty.message, /would make hyperedge "h1" empty/i);

const clear = interpretGraphMutationRequest("clear current graph", graph, identity);
assert.equal(clear.ok, true);
assert.equal(clear.plan.operations[0].type, "CLEAR_GRAPH");

const undo = interpretGraphMutationRequest("undo last mutation", graph, identity, [{ id: "history-1", beforeHyperedges: [] }]);
assert.equal(undo.ok, true);
assert.equal(undo.plan.operations[0].type, "UNDO_LAST_MUTATION");

const selected = interpretGraphMutationRequest("add Dana to that hyperedge", graph, identity, [], { type: "hyperedge", id: "h0" });
assert.equal(selected.ok, true);
assert.equal(selected.plan.operations[0].hyperedgeId, "h0");

console.log("conversational graph mutation tests passed.");
