import assert from "node:assert/strict";
import {
  buildIncidenceIndex,
  getHyperedgeVertexIds,
  getIncidentHyperedgeIds,
  hasHyperedge,
  hasVertex,
} from "../src/graph/incidenceIndex.js";
import { normalizeHyperedges } from "../src/utils/parsers.js";
import {
  LiteralNullID,
  PrototypeIDs,
  TinyBasic,
  ZeroID,
} from "./fixtures/v7.3.14/stage0-regression-fixtures.mjs";

const canonical = graph => normalizeHyperedges(graph, { identifierMode: "structured" }).hyperedges;

const tiny = canonical(TinyBasic);
const tinyIndex = buildIncidenceIndex(tiny);
assert.deepEqual(tinyIndex.vertices, ["a", "b", "c", "d"]);
assert.deepEqual(tinyIndex.hyperedges, ["h0", "h1"]);
assert.ok(tinyIndex.hyperedgesById instanceof Map);
assert.ok(tinyIndex.vertexToHyperedges instanceof Map);
assert.ok(tinyIndex.hyperedgeToVertices instanceof Map);
assert.strictEqual(tinyIndex.hyperedgesById.get("h0"), tiny[0]);
assert.deepEqual([...tinyIndex.vertexToHyperedges.get("a")], ["h0"]);
assert.deepEqual([...tinyIndex.vertexToHyperedges.get("c")], ["h0", "h1"]);
assert.deepEqual([...tinyIndex.hyperedgeToVertices.get("h0")], ["a", "b", "c"]);
assert.deepEqual(tinyIndex.counts, { hyperedges: 2, vertices: 4, incidences: 5 });

const metadata = [{
  id: "meta",
  vertices: ["v"],
  time: 0,
  weight: 0,
  attributes: { nested: { preserved: true }, label: "original" },
}];
const metadataSnapshot = structuredClone(metadata);
const metadataIndex = buildIncidenceIndex(metadata);
assert.strictEqual(metadataIndex.hyperedgesById.get("meta"), metadata[0]);
assert.equal(metadataIndex.hyperedgesById.get("meta").weight, 0);
assert.equal(metadataIndex.hyperedgesById.get("meta").time, 0);
assert.strictEqual(metadataIndex.hyperedgesById.get("meta").attributes, metadata[0].attributes);
assert.deepEqual(metadata, metadataSnapshot);
assert.deepEqual(Object.keys(metadata[0]), ["id", "vertices", "time", "weight", "attributes"]);

const identifierGraph = [{
  id: "#h1",
  vertices: ["0", "null", "__proto__", "constructor", "toString", " A ", "\"foo\"", "A,1", "Δ😀", "#h1"],
  time: null,
  weight: 1,
  attributes: {},
}, {
  id: "constructor",
  vertices: ["toString", "ordinary"],
  time: null,
  weight: 1,
  attributes: {},
}];
const identifierIndex = buildIncidenceIndex(identifierGraph);
for (const id of ["0", "null", "__proto__", "constructor", "toString", " A ", "\"foo\"", "A,1", "Δ😀", "#h1"]) {
  assert.equal(hasVertex(identifierIndex, id), true, id);
  assert.ok(getIncidentHyperedgeIds(identifierIndex, id).length >= 1, id);
}
assert.equal(hasVertex(identifierIndex, "A"), false, "whitespace-bearing identifiers remain exact");
assert.equal(hasVertex(identifierIndex, "foo"), false, "literal quotes are not stripped");
assert.equal(hasHyperedge(identifierIndex, "#h1"), true);
assert.equal(hasHyperedge(identifierIndex, "__proto__"), false);

for (const fixture of [ZeroID, PrototypeIDs, LiteralNullID]) {
  const index = buildIncidenceIndex(canonical(fixture));
  assert.equal(index.counts.hyperedges, fixture.length);
}
assert.deepEqual(buildIncidenceIndex(canonical(ZeroID)).vertices, ["0", "control"]);
assert.deepEqual(getIncidentHyperedgeIds(buildIncidenceIndex(canonical(PrototypeIDs)), "__proto__"), ["__proto__"]);
assert.deepEqual(getIncidentHyperedgeIds(buildIncidenceIndex(canonical(LiteralNullID)), "null"), ["h-null"]);

const lowLevel = [{
  id: "h1",
  vertices: ["a", "a", "b"],
  time: 7,
  weight: 0,
  attributes: { keep: true },
}, {
  id: "h2",
  vertices: ["a"],
  time: null,
  weight: 1,
  attributes: {},
}];
const lowLevelSnapshot = structuredClone(lowLevel);
const duplicateIndex = buildIncidenceIndex(lowLevel);
assert.deepEqual([...duplicateIndex.vertexToHyperedges.get("a")], ["h1", "h2"]);
assert.deepEqual([...duplicateIndex.hyperedgeToVertices.get("h1")], ["a", "b"]);
assert.deepEqual(duplicateIndex.counts, { hyperedges: 2, vertices: 2, incidences: 3 });
assert.deepEqual(lowLevel, lowLevelSnapshot, "duplicate-membership defense cannot mutate canonical input");

const specialIndex = buildIncidenceIndex([
  { id: "empty", vertices: [], time: null, weight: 1, attributes: { kind: "empty" } },
  { id: "single", vertices: ["v"], time: null, weight: 1, attributes: { kind: "singleton" } },
]);
assert.deepEqual(specialIndex.hyperedges, ["empty", "single"]);
assert.deepEqual([...specialIndex.hyperedgeToVertices.get("empty")], []);
assert.deepEqual([...specialIndex.hyperedgeToVertices.get("single")], ["v"]);
assert.deepEqual(getIncidentHyperedgeIds(specialIndex, "v"), ["single"]);

const missingA = getIncidentHyperedgeIds(tinyIndex, "missing");
const missingB = getIncidentHyperedgeIds(tinyIndex, "missing");
assert.strictEqual(missingA, missingB, "missing queries return the stable empty result");
assert.deepEqual(missingA, []);
assert.strictEqual(getHyperedgeVertexIds(tinyIndex, "missing"), missingA);
const vertexMapSize = tinyIndex.vertexToHyperedges.size;
assert.equal(hasVertex(tinyIndex, "missing"), false);
assert.equal(tinyIndex.vertexToHyperedges.size, vertexMapSize, "read helpers never create entries");
assert.throws(() => tinyIndex.vertexToHyperedges.set("corrupt", new Set()), /read-only/i);
assert.throws(() => tinyIndex.hyperedgeToVertices.get("h0").add("corrupt"), /read-only/i);
assert.throws(
  () => tinyIndex.vertexToHyperedges.forEach((_value, _key, map) => map.set("corrupt", new Set())),
  /read-only/i,
  "forEach cannot leak the mutable backing map",
);

for (const input of [null, undefined, {}, "graph", 0]) {
  assert.throws(() => buildIncidenceIndex(input), /canonical hyperedge array/i);
}
assert.throws(() => buildIncidenceIndex([null]), /hyperedges\[0\].*record/i);
assert.throws(() => buildIncidenceIndex([{ vertices: [] }]), /hyperedges\[0\]\.id/i);
assert.throws(() => buildIncidenceIndex([{ id: 0, vertices: [] }]), /already be canonical/i);
assert.throws(() => buildIncidenceIndex([{ id: "h", vertices: [0] }]), /already be canonical/i);
assert.throws(() => buildIncidenceIndex([{ id: "h", vertices: null }]), /vertices.*array/i);
assert.throws(() => buildIncidenceIndex([{ id: "same", vertices: [] }, { id: "same", vertices: [] }]), /duplicate/i);

const graphA = buildIncidenceIndex([{ id: "a-edge", vertices: ["a"], time: null, weight: 1, attributes: {} }]);
const graphB = buildIncidenceIndex([{ id: "b-edge", vertices: ["b"], time: null, weight: 1, attributes: {} }]);
assert.equal(hasVertex(graphA, "b"), false);
assert.equal(hasVertex(graphB, "a"), false);
const graphAAgain = buildIncidenceIndex([{ id: "a-edge", vertices: ["a"], time: null, weight: 1, attributes: {} }]);
assert.deepEqual(graphAAgain.vertices, graphA.vertices);
assert.deepEqual(graphAAgain.hyperedges, graphA.hyperedges);
assert.deepEqual(getIncidentHyperedgeIds(graphAAgain, "a"), getIncidentHyperedgeIds(graphA, "a"));

console.log("v7.3.14 Stage 3 incidence index structure and identifier safety passed.");
