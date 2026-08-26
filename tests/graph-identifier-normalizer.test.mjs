import assert from "node:assert/strict";
import {
  normalizeGraphEntityReference,
  splitGraphEntityList,
} from "../src/agent/deterministicNlu/domains/graphIdentifierNormalizer.js";
import { compileGraphMutationGrammar } from "../src/agent/deterministicNlu/domains/graphMutationGrammar.js";
import { createGraphIdentity } from "../src/graph/graphIdentity.js";

const graph = [
  { id: "h0", vertices: ["4"], time: null, weight: 1, attributes: {} },
  { id: "h2", vertices: ["1", "2"], time: null, weight: 1, attributes: {} },
];
const identity = createGraphIdentity(graph, null, { replace: true });

assert.equal(normalizeGraphEntityReference("a vertex 6", { kind: "vertex" }), "6");
assert.equal(normalizeGraphEntityReference("the hyperedge h2", { kind: "hyperedge" }), "h2");
assert.equal(normalizeGraphEntityReference('"a vertex 6"', { kind: "vertex" }), "a vertex 6");
assert.deepEqual(splitGraphEntityList("vertices 8 and 9", { kind: "vertex" }), ["8", "9"]);
assert.deepEqual(splitGraphEntityList('"vertices 8" and 9', { kind: "vertex" }), ["vertices 8", "9"]);

const add = compileGraphMutationGrammar("add a vertex 6 to hyperedge h2", { hyperedges: graph, graphIdentity: identity });
assert.equal(add.ok, true);
assert.equal(add.plan.operations[0].vertexId, "6");
assert.equal(add.plan.operations[0].hyperedgeId, "h2");

const create = compileGraphMutationGrammar("create hyperedge h3 with vertices 8 and 9", { hyperedges: graph, graphIdentity: identity });
assert.equal(create.ok, true);
assert.deepEqual(create.plan.operations[0].vertices, ["8", "9"]);

const remove = compileGraphMutationGrammar("remove the vertex 4 from h0 and remove empty hyperedge", { hyperedges: graph, graphIdentity: identity });
assert.equal(remove.ok, true);
assert.equal(remove.plan.operations[0].vertexId, "4");

const rename = compileGraphMutationGrammar("rename the vertex 4 to 5", { hyperedges: graph, graphIdentity: identity });
assert.equal(rename.ok, true);
assert.equal(rename.plan.operations[0].vertexId, "4");
assert.equal(rename.plan.operations[0].newVertexId, "5");

const quoted = compileGraphMutationGrammar('add "a vertex 6" to hyperedge h2', { hyperedges: graph, graphIdentity: identity });
assert.equal(quoted.ok, true);
assert.equal(quoted.plan.operations[0].vertexId, "a vertex 6");

console.log("graph identifier normalizer tests passed.");
