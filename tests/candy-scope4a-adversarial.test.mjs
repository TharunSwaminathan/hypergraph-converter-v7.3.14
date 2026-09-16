import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalizeHypergraphIncidence } from "../src/candy/adapters/hypergraphIncidenceAdapter.js";
import { applyHypergraphMotifUpdate } from "../src/candy/adapters/hypergraphUpdateAdapter.js";
import { canonicalIdentifierKey } from "../src/candy/adapters/identifierMapping.js";
import { CANDY_SCHEMA_VERSIONS as S } from "../src/candy/contracts/schemaVersions.js";
import { GRAPH_TYPES as G } from "../src/candy/contracts/graphTypes.js";
import { isCandyContractError } from "../src/candy/contracts/errorClasses.js";
import { validateHypergraphMotifRequest, validateHypergraphMotifUpdate, validateHypergraphMotifResult } from "../src/candy/contracts/hypergraphMotifSchemas.js";
import { countHypergraphThreeEdgeMotifs, computeExactHypergraphMotifDelta, runStaticHypergraphMotifReference, runIncrementalHypergraphMotifReference } from "../src/candy/hypergraphMotifs/referenceOracle.js";
import { classifyMotifSignature, HYPERGRAPH_3EDGE_MOTIF_TAXONOMY_V1 as V } from "../src/candy/hypergraphMotifs/taxonomy.js";
import { hypergraphValue, ALL_30_MOTIF_WITNESSES } from "./fixtures/candy-scope4-motifs.mjs";

const reject = (fn, code) => assert.throws(fn, error => isCandyContractError(error, code));
const clone = value => structuredClone(value);
const base = hypergraphValue({ graphId: "dynamic-matrix", graphType: G.DYNAMIC_HYPERGRAPH,
  vertices: ["a", "b", "c", "isolated"],
  hyperedges: [{ id: "A", vertices: ["a"] }, { id: "B", vertices: ["a", "b"] }],
});
const updateFor = (graph, deletions, insertions) => ({
  schemaVersion: S.HYPERGRAPH_MOTIF_UPDATE, updateId: "matrix-update",
  baseGraphRef: { graphId: graph.graphId, graphVersion: graph.graphVersion },
  nextGraphVersion: graph.graphVersion + 1, ordering: "DELETE_THEN_INSERT",
  collisionPolicy: "REJECT_EXCEPT_EXACT_DELETE_REINSERT", deletions, insertions,
});
const verifyDelta = (graph, update) => {
  const result = computeExactHypergraphMotifDelta(graph, update);
  const applied = applyHypergraphMotifUpdate(graph, update);
  assert.deepEqual(result.newCounts, countHypergraphThreeEdgeMotifs(applied.value).counts);
  result.deltaCounts.forEach((delta, index) => assert.equal(result.oldCounts[index] + delta, result.newCounts[index]));
  assert.equal(result.oldTotalConnectedTriples + result.deltaCounts.reduce((sum, delta) => sum + delta, 0), result.newTotalConnectedTriples);
  return result;
};

const openUpdate = updateFor(base, [], [{ id: "C", vertices: ["b"] }]);
const open = verifyDelta(base, openUpdate);
assert.equal(open.newTotalConnectedTriples, 1);
const openGraph = applyHypergraphMotifUpdate(base, openUpdate).value;
assert.throws(() => openGraph.hyperedges[0].vertices.push("tamper"), TypeError);
assert.throws(() => openGraph.vertices.push("tamper"), TypeError);
assert.equal(verifyDelta(openGraph, updateFor(openGraph, ["C"], [])).newTotalConnectedTriples, 0);
const closedUpdate = updateFor(base, [], [{ id: "C", vertices: ["a"] }]);
assert.equal(verifyDelta(base, closedUpdate).newTotalConnectedTriples, 1);
const closedGraph = applyHypergraphMotifUpdate(base, closedUpdate).value;
assert.equal(verifyDelta(closedGraph, updateFor(closedGraph, ["C"], [])).newTotalConnectedTriples, 0);
const changedClass = verifyDelta(openGraph, updateFor(openGraph, ["C"], [{ id: "C", vertices: ["a"] }]));
assert.notDeepEqual(changedClass.oldCounts, changedClass.newCounts);
assert.equal(changedClass.oldTotalConnectedTriples, changedClass.newTotalConnectedTriples);
assert.deepEqual(verifyDelta(openGraph, updateFor(openGraph, ["C"], [{ id: "C", vertices: ["b"] }])).deltaCounts, Array(30).fill(0));
assert.deepEqual(verifyDelta(base, updateFor(base, [], [])).deltaCounts, Array(30).fill(0));
verifyDelta(base, updateFor(base, ["A"], [{ id: "replacement", vertices: ["a"] }]));
verifyDelta(base, updateFor(base, [], [{ id: "same-incidence", vertices: ["a"] }]));
verifyDelta(base, updateFor(base, [], [{ id: "sparse-90000000", vertices: ["b"] }]));
const reorderedUpdate = { ...openUpdate, insertions: [...openUpdate.insertions].reverse() };
assert.deepEqual(verifyDelta(base, reorderedUpdate).newCounts, open.newCounts);

for (const id of ["", " ", null, undefined, {}, [], true, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, 1.25, 1n]) {
  reject(() => canonicalIdentifierKey(id), "INVALID_GRAPH_SCHEMA");
}
reject(() => canonicalIdentifierKey("x".repeat(513)), "RESOURCE_LIMIT");
reject(() => canonicalizeHypergraphIncidence({ ...base, graphId: "x".repeat(513) }), "RESOURCE_LIMIT");
reject(() => canonicalizeHypergraphIncidence({ ...base, provenance: { text: "x".repeat(16385) } }), "RESOURCE_LIMIT");
const circular = {}; circular.self = circular;
reject(() => canonicalizeHypergraphIncidence({ ...base, provenance: circular }), "INVALID_GRAPH_SCHEMA");
const metadata = { nested: { label: "original" } };
const snapshot = canonicalizeHypergraphIncidence({ ...base, provenance: metadata });
metadata.nested.label = "changed";
assert.equal(snapshot.provenance.nested.label, "original");
assert.notEqual(canonicalIdentifierKey("42"), canonicalIdentifierKey(42));
for (const type of [G.ORDINARY, G.DYNAMIC_ORDINARY, G.PROJECTED_ORDINARY]) {
  reject(() => countHypergraphThreeEdgeMotifs({ ...base, graphType: type }), "INVALID_GRAPH_TYPE");
}
reject(() => countHypergraphThreeEdgeMotifs({ ...base, vertexMapping: {}, hyperedgeMapping: {} }), "INVALID_GRAPH_SCHEMA");
reject(() => applyHypergraphMotifUpdate({ ...base, vertexMapping: {}, hyperedgeMapping: {} }, openUpdate), "INVALID_GRAPH_SCHEMA");
for (const limits of [{ maxHyperedges: Infinity }, { maxHyperedges: 257 }, { maxIncidences: -1 }, { unknown: 1 }, []]) {
  reject(() => countHypergraphThreeEdgeMotifs(base, limits), "RESOURCE_LIMIT");
}
reject(() => canonicalizeHypergraphIncidence(base, { maxVertices: 1 }), "RESOURCE_LIMIT");
reject(() => canonicalizeHypergraphIncidence(base, { maxHyperedgeCardinality: 1 }), "RESOURCE_LIMIT");
reject(() => canonicalizeHypergraphIncidence(base, { maxTotalIncidences: 2 }), "RESOURCE_LIMIT");
reject(() => canonicalizeHypergraphIncidence({ ...base, hyperedges: [{ id: "oversized", vertices: Array(1000001) }] }), "RESOURCE_LIMIT");
reject(() => validateHypergraphMotifUpdate({ ...openUpdate, insertions: [{ id: "oversized", vertices: Array(1000001) }] }), "RESOURCE_LIMIT");
reject(() => countHypergraphThreeEdgeMotifs(openGraph, { maxRegionMembershipVisits: 1 }), "RESOURCE_LIMIT");
reject(() => canonicalizeHypergraphIncidence({ ...base, schemaVersion: "unknown" }), "INVALID_GRAPH_SCHEMA");
reject(() => canonicalizeHypergraphIncidence({ ...base, h2h: [] }), "INVALID_GRAPH_SCHEMA");
reject(() => canonicalizeHypergraphIncidence({ ...base, v2h: [] }), "INVALID_GRAPH_SCHEMA");
reject(() => canonicalizeHypergraphIncidence({ ...base, vertices: ["a", "a"] }), "INVALID_GRAPH_SCHEMA");
const canonical = canonicalizeHypergraphIncidence(base);
for (const update of [
  { ...openUpdate, extra: true }, { ...openUpdate, schemaVersion: "unknown" },
  { ...openUpdate, deletions: ["missing"] }, { ...openUpdate, insertions: [{ id: "A", vertices: ["a"] }] },
  { ...openUpdate, insertions: [{ id: "C", vertices: [] }] },
  { ...openUpdate, insertions: [{ id: "C", vertices: ["a"] }, { id: "C", vertices: ["b"] }] },
  { ...openUpdate, ordering: "INSERT_THEN_DELETE" },
]) reject(() => validateHypergraphMotifUpdate(update, canonical), "INVALID_UPDATE_BATCH");
reject(() => validateHypergraphMotifUpdate({ ...openUpdate, baseGraphRef: { graphId: "wrong", graphVersion: 1 } }, canonical), "STALE_GRAPH_VERSION");

const request = { schemaVersion: S.HYPERGRAPH_MOTIF_REQUEST, requestId: "audit", algorithm: "HYPERGRAPH_3EDGE_MOTIF_COUNT",
  taxonomyVersion: V, mode: "STATIC", graphRef: { graphId: base.graphId, graphVersion: 1 } };
const result = runStaticHypergraphMotifReference(request, base);
reject(() => validateHypergraphMotifRequest({ ...request, extra: true }, canonical), "INVALID_GRAPH_SCHEMA");
reject(() => validateHypergraphMotifRequest({ ...request, graphRef: { graphId: "wrong", graphVersion: 1 } }, canonical), "STALE_GRAPH_VERSION");
const state = { schemaVersion: S.HYPERGRAPH_MOTIF_STATE, stateId: "state", graphId: base.graphId,
  graphVersion: 1, stateVersion: 1, taxonomyVersion: V };
const incrementalRequest = { ...request, mode: "INCREMENTAL", motifStateRef: state,
  updateRef: { updateId: openUpdate.updateId, baseGraphId: base.graphId, baseGraphVersion: 1, nextGraphVersion: 2 } };
reject(() => validateHypergraphMotifRequest(incrementalRequest, canonical, { ...state, stateVersion: 2 }), "STALE_PROPERTY_STATE");
reject(() => runIncrementalHypergraphMotifReference(incrementalRequest, base, openUpdate), "STALE_PROPERTY_STATE");
reject(() => runIncrementalHypergraphMotifReference(incrementalRequest, base, openUpdate, { ...state, stateVersion: 2 }), "STALE_PROPERTY_STATE");
assert.equal(runIncrementalHypergraphMotifReference(incrementalRequest, base, openUpdate, state).totalConnectedTriples, 1);
for (const stale of [{ ...state, stateVersion: 0 }, { ...state, graphId: "wrong" }, { ...state, taxonomyVersion: "unknown" }]) {
  reject(() => validateHypergraphMotifRequest({ ...incrementalRequest, motifStateRef: stale }, canonical), "STALE_PROPERTY_STATE");
}
reject(() => validateHypergraphMotifResult({ ...result, counts: Array(30).fill(Number.MAX_SAFE_INTEGER), totalConnectedTriples: Number.MAX_SAFE_INTEGER }), "RESULT_VALIDATION_FAILURE");
reject(() => validateHypergraphMotifResult({ ...result, counts: [NaN, ...Array(29).fill(0)] }), "OUTPUT_PARSE_FAILURE");
reject(() => validateHypergraphMotifResult({ ...result, warnings: Array(21).fill("warning") }), "OUTPUT_PARSE_FAILURE");

// Exhaustive realizability: create one incidence witness for every one of 128
// labeled signatures and compare set-connectivity with product classification.
const members = [[0], [1], [2], [0, 1], [1, 2], [0, 2], [0, 1, 2]];
const permutations = [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
for (let mask = 0; mask < 128; mask += 1) {
  const edges = [[], [], []]; const vertices = [];
  members.forEach((region, index) => { if (mask & (1 << index)) { vertices.push(`v${index}`); region.forEach(edge => edges[edge].push(`v${index}`)); } });
  if (edges.some(edge => edge.length === 0)) { assert.equal(classifyMotifSignature(mask), null); continue; }
  const value = hypergraphValue({ vertices, hyperedges: edges.map((vertices, index) => ({ id: `e${index}`, vertices })) });
  const intersects = (a, b) => a.some(vertex => b.includes(vertex));
  const pairs = [[0,1],[1,2],[0,2]].filter(([a,b]) => intersects(edges[a], edges[b])).length;
  const expected = Number(pairs >= 2);
  const counted = countHypergraphThreeEdgeMotifs(value);
  const expectedCounts = Array(30).fill(0);
  if (expected) expectedCounts[classifyMotifSignature(mask).motifId - 1] = 1;
  assert.deepEqual(counted.counts, expectedCounts);
  assert.equal(counted.totalConnectedTriples, expected);
  assert.equal(counted.counts.reduce((sum,count) => sum+count,0), expected);
  for (const permutation of permutations) {
    assert.deepEqual(countHypergraphThreeEdgeMotifs({ ...value, hyperedges: permutation.map(index => value.hyperedges[index]) }).counts, counted.counts);
  }
}
for (const { graph } of ALL_30_MOTIF_WITNESSES) {
  const remapped = clone(graph); const renaming = new Map(graph.vertices.map((id,index) => [id, 1000000-index*43]));
  remapped.vertices = graph.vertices.map(id => renaming.get(id)).reverse();
  remapped.hyperedges = graph.hyperedges.map((edge,index) => ({ id: 900000-index*29, vertices: edge.vertices.map(id=>renaming.get(id)).reverse() })).reverse();
  assert.deepEqual(countHypergraphThreeEdgeMotifs(remapped).counts, countHypergraphThreeEdgeMotifs(graph).counts);
}
// Ensure no production executor imports the new oracle/schema/adapter family.
for (const file of ["src/candy/capabilityDiscovery.js", "src/candy/client.js", "src/candy/deterministicRouting.js", "candy-runtime/src/cli.js"]) {
  assert.doesNotMatch(await readFile(new URL(`../${file}`, import.meta.url), "utf8"), /hypergraphMotifs|hypergraphMotifSchemas|hypergraphIncidenceAdapter/);
}
console.log("Scope 4A-R adversarial matrix passed: 10 transitions, 128 signatures, all-30 numeric renaming, hard boundaries.");
