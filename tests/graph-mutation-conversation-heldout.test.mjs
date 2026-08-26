import assert from "node:assert/strict";
import { interpretGraphMutationRequest } from "../src/agent/graphMutationConversation.js";
import { createGraphIdentity } from "../src/graph/graphIdentity.js";

const graph = [
  { id: "h0", vertices: ["1", "2", "3"], time: null, weight: 1, attributes: {} },
  { id: "h1", vertices: ["Alice"], time: null, weight: 1, attributes: {} },
];
const identity = createGraphIdentity(graph, null, { replace: true });

const modifierCases = [
  "Add vertex 4 to h0 again.",
  "Again, add vertex 4 to h0.",
  "Please add vertex 4 to h0.",
  "Add vertex 4 to h0, please.",
  "Add vertex 4 to h0 too.",
  "Add vertex 4 to h0 as well.",
  "Now add vertex 4 to h0.",
  "This time, add vertex 4 to h0.",
  "Could you add vertex 4 to h0?",
  "Would you please put vertex 4 in h0?",
  "h0 needs vertex 4 too.",
  "Make sure vertex 4 belongs to h0.",
];

for (const text of modifierCases) {
  const result = interpretGraphMutationRequest(text, graph, identity);
  assert.equal(result.ok, true, text);
  assert.equal(result.plan.operations[0].type, "ADD_INCIDENCE", text);
  assert.equal(result.plan.operations[0].vertexId, "4", text);
  assert.equal(result.plan.operations[0].hyperedgeId, "h0", text);
}

const naturalCases = [
  ["Add Alice to h0.", "ADD_INCIDENCE"],
  ["Put Alice in h0.", "ADD_INCIDENCE"],
  ["Include Alice in h0.", "ADD_INCIDENCE"],
  ["Alice should be in h0.", "ADD_INCIDENCE"],
  ["h0 needs Alice.", "ADD_INCIDENCE"],
  ["Make Alice part of h0.", "ADD_INCIDENCE"],
  ["Connect Alice to hyperedge h0.", "ADD_INCIDENCE"],
  ["Remove Alice from h1 and keep empty hyperedge.", "REMOVE_INCIDENCE"],
  ["Take Alice out of h1 and keep empty hyperedge.", "REMOVE_INCIDENCE"],
  ["Alice should no longer belong to h1 and keep empty hyperedge.", "REMOVE_INCIDENCE"],
  ["Detach Alice from h1 and keep empty hyperedge.", "REMOVE_INCIDENCE"],
  ["Rename h0 to Apollo.", "RENAME_HYPEREDGE"],
  ["Call hyperedge h0 Apollo.", "RENAME_HYPEREDGE"],
  ["Set h0's weight to 2.5.", "SET_HYPEREDGE_WEIGHT"],
  ["Make the weight of h0 2.5.", "SET_HYPEREDGE_WEIGHT"],
];

for (const [text, type] of naturalCases) {
  const result = interpretGraphMutationRequest(text, graph, identity);
  assert.equal(result.ok, true, text);
  assert.equal(result.plan.operations[0].type, type, text);
}

const modifierIdGraph = [
  { id: "again", vertices: ["1"], time: null, weight: 1, attributes: {} },
  { id: "h0 again", vertices: ["2"], time: null, weight: 1, attributes: {} },
  { id: "please", vertices: ["3"], time: null, weight: 1, attributes: {} },
  { id: "now", vertices: ["4"], time: null, weight: 1, attributes: {} },
];
const modifierIdIdentity = createGraphIdentity(modifierIdGraph, null, { replace: true });
const exactAgain = interpretGraphMutationRequest("Add 4 to hyperedge \"again\".", modifierIdGraph, modifierIdIdentity);
assert.equal(exactAgain.ok, true);
assert.equal(exactAgain.plan.operations[0].hyperedgeId, "again");
const exactH0Again = interpretGraphMutationRequest("Add 4 to \"h0 again\".", modifierIdGraph, modifierIdIdentity);
assert.equal(exactH0Again.ok, true);
assert.equal(exactH0Again.plan.operations[0].hyperedgeId, "h0 again");
const exactPlease = interpretGraphMutationRequest("Add 4 to hyperedge please.", modifierIdGraph, modifierIdIdentity);
assert.equal(exactPlease.ok, true);
assert.equal(exactPlease.plan.operations[0].hyperedgeId, "please");
const exactNow = interpretGraphMutationRequest("Add 4 to hyperedge now.", modifierIdGraph, modifierIdIdentity);
assert.equal(exactNow.ok, true);
assert.equal(exactNow.plan.operations[0].hyperedgeId, "now");

assert.equal(interpretGraphMutationRequest("What is a hyperedge?", graph, identity).noMatch, true);
assert.equal(interpretGraphMutationRequest("Show me the graph.", graph, identity).noMatch, true);
assert.equal(interpretGraphMutationRequest("Export H2V.", graph, identity).noMatch, true);

console.log(`graph mutation held-out conversation tests passed (${modifierCases.length + naturalCases.length + 7} checks).`);
