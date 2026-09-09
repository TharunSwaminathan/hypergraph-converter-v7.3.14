import assert from "node:assert/strict";
import { canonicalOrdinaryGraphToCsr, validateNativeWeight } from "../src/candy/adapters/csrAdapter.js";
import { createVertexMapping } from "../src/candy/adapters/vertexMapping.js";
import { GRAPH_TYPES } from "../src/candy/contracts/graphTypes.js";
import { CANDY_ERROR_CODES, isCandyContractError } from "../src/candy/contracts/errorClasses.js";

const expectCode = (fn, code) => assert.throws(fn, error => isCandyContractError(error, code));
const mapping = createVertexMapping(["10", 10, "A", "2"]);
assert.notEqual(mapping.toNative("10"), mapping.toNative(10), "numeric-looking strings remain distinct from numbers");
for (const entry of mapping.entries) assert.deepEqual(mapping.toCanonical(entry.nativeIndex), entry.canonicalId);
assert.deepEqual(
  createVertexMapping(["10", 10, "A", "2"]).entries.map(entry => entry.key),
  mapping.entries.map(entry => entry.key),
  "mapping order is deterministic",
);
expectCode(() => mapping.toNative("missing"), CANDY_ERROR_CODES.INVALID_VERTEX);
expectCode(() => mapping.toCanonical(99), CANDY_ERROR_CODES.INVALID_VERTEX);
expectCode(() => createVertexMapping(["A", "A"]), CANDY_ERROR_CODES.INVALID_VERTEX);

const graph = {
  graphType: GRAPH_TYPES.ORDINARY,
  directed: true,
  vertices: ["C", "A", "isolated", "B"],
  edges: [
    { source: "B", target: "C", weight: 2 },
    { source: "A", target: "B", weight: 0 },
    { source: "A", target: "C", weight: 5 },
  ],
};
const csr = canonicalOrdinaryGraphToCsr(graph);
assert.equal(csr.vertexCount, 4);
assert.equal(csr.edgeCount, 3);
assert.deepEqual(csr.rowOffsets, [0, 2, 3, 3, 3]);
assert.deepEqual(csr.columnIndices, [1, 2, 2]);
assert.deepEqual(csr.weights, [0, 5, 2]);
assert.equal(csr.mapping.toNative("isolated"), 3);

const reordered = canonicalOrdinaryGraphToCsr({ ...graph, vertices: [...graph.vertices].reverse(), edges: [...graph.edges].reverse() });
assert.deepEqual(reordered.rowOffsets, csr.rowOffsets);
assert.deepEqual(reordered.columnIndices, csr.columnIndices);
assert.deepEqual(reordered.weights, csr.weights);

expectCode(() => canonicalOrdinaryGraphToCsr({ ...graph, graphType: GRAPH_TYPES.HYPERGRAPH }), CANDY_ERROR_CODES.INVALID_GRAPH_TYPE);
expectCode(() => canonicalOrdinaryGraphToCsr({ ...graph, edges: [...graph.edges, { source: "A", target: "B", weight: 1 }] }), CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA);
const selfLoop = { ...graph, edges: [{ source: "A", target: "A", weight: 1 }] };
assert.equal(canonicalOrdinaryGraphToCsr(selfLoop).edgeCount, 1);
expectCode(() => canonicalOrdinaryGraphToCsr(selfLoop, { selfLoopPolicy: "REJECT" }), CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA);
assert.equal(validateNativeWeight(0), 0);
assert.equal(validateNativeWeight(2_147_483_647), 2_147_483_647);
for (const invalid of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2_147_483_648]) {
  expectCode(() => validateNativeWeight(invalid), CANDY_ERROR_CODES.UNSUPPORTED_WEIGHT_MODEL);
}
expectCode(() => canonicalOrdinaryGraphToCsr(graph, { limits: { maxVertices: 3, maxEdges: 10 } }), CANDY_ERROR_CODES.RESOURCE_LIMIT);

console.log("CANDY Phase A vertex mapping and CSR tests passed.");
