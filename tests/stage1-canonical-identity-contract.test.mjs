import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compareWithExpectedOutput, parseExpectedOutputText } from "../src/agent/expectedOutputComparison.js";
import { normalizeHyperedges, parseCSRJson, parseJSON, parseSimple } from "../src/utils/parsers.js";
import { CSRInvalidIds, DuplicateHyperedgeID, ExpectedProtoID } from "./fixtures/v7.3.14/stage0-regression-fixtures.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const valid = normalizeHyperedges([
  {
    id: 0,
    vertices: ["ordinary", 0, "0", "__proto__", "constructor", "toString", "null", "Δelta", "😀", -4, 2.5],
  },
]).hyperedges[0];
assert.equal(valid.id, "0");
assert.deepEqual(valid.vertices, ["ordinary", "0", "__proto__", "constructor", "toString", "null", "Δelta", "😀", "-4", "2.5"]);

for (const [label, value] of [
  ["object", {}],
  ["array", []],
  ["null", null],
  ["NaN", Number.NaN],
  ["Infinity", Number.POSITIVE_INFINITY],
  ["-Infinity", Number.NEGATIVE_INFINITY],
]) {
  assert.throws(
    () => normalizeHyperedges([{ id: "h", vertices: [value] }]),
    /must be .*finite number identifier/,
    label,
  );
  assert.throws(
    () => normalizeHyperedges([{ id: value, vertices: ["v"] }]),
    /must be .*finite number identifier/,
    `${label} hyperedge ID`,
  );
}
assert.throws(
  () => normalizeHyperedges([{ id: "h", vertices: [undefined] }]),
  /must be a string or finite number identifier/,
  "undefined",
);
assert.throws(
  () => normalizeHyperedges([{ id: undefined, vertices: ["v"] }]),
  /must be a string or finite number identifier/,
  "undefined hyperedge ID",
);
assert.throws(
  () => normalizeHyperedges([{ id: "h", vertices: [""] }]),
  /non-empty string or finite number identifier/,
  "blank identifier",
);
assert.throws(
  () => normalizeHyperedges([{ id: "", vertices: ["v"] }]),
  /non-empty string or finite number identifier/,
  "blank hyperedge ID",
);
assert.equal(normalizeHyperedges([{ vertices: ["v"] }]).hyperedges[0].id, "h1");

for (const fixture of Object.values(CSRInvalidIds)) {
  assert.throws(
    () => parseCSRJson(JSON.stringify(fixture)),
    /must be a string or finite number identifier/,
  );
}

const duplicateText = DuplicateHyperedgeID.map(edge => `${edge.id}: ${edge.vertices.join(" ")}`).join("\n");
assert.throws(() => parseSimple(duplicateText), /duplicate.*hyperedge|duplicates.*hyperedge/i);

const expectedProto = parseExpectedOutputText(ExpectedProtoID.text);
assert.equal(Object.hasOwn(expectedProto.h2v, "__proto__"), true);
assert.deepEqual(expectedProto.h2v.__proto__, ["a", "b"]);
const expectedComparison = compareWithExpectedOutput(ExpectedProtoID.actual, expectedProto);
assert.equal(expectedComparison.expectedStats.hyperedges, 1);
assert.equal(expectedComparison.allHyperedgeIdsMatched, true);
assert.equal(expectedComparison.vertexSetsMatched, 1);

const canonicalReserved = parseJSON(JSON.stringify([
  { id: "__proto__", vertices: ["constructor", "toString", "null", 0] },
]));
assert.equal(canonicalReserved[0].id, "__proto__");
assert.deepEqual(canonicalReserved[0].vertices, ["constructor", "toString", "null", "0"]);

const identifiers = await import("../src/utils/graphIdentifiers.js");
for (const unsupported of [null, undefined, {}, [], Number.NaN, Infinity, -Infinity, false, 1n]) {
  assert.throws(() => identifiers.normalizeGraphIdentifier(unsupported), /string or finite number|finite number/);
}
assert.equal(identifiers.hasGraphIdentifier(null), false);
assert.equal(identifiers.hasGraphIdentifier(undefined), false);
for (const present of [0, "0", "", false, "null"]) assert.equal(identifiers.hasGraphIdentifier(present), true);
assert.equal(identifiers.graphIdentifiersEqual(null, "null"), false);
assert.equal(identifiers.graphIdentifiersEqual(undefined, "null"), false);
assert.equal(identifiers.graphIdentifiersEqual(0, "0"), true);
assert.equal(identifiers.graphIdentifiersEqual("null", "null"), true);

const keyed = identifiers.createGraphIdentifierMap();
for (const id of ["__proto__", "constructor", "toString"]) identifiers.setGraphIdentifierValue(keyed, id, { id });
assert.equal(keyed.size, 3);
for (const id of ["__proto__", "constructor", "toString"]) {
  assert.equal(identifiers.getGraphIdentifierValue(keyed, id).id, id);
}

const vizSource = await readFile(join(root, "src", "components", "Viz.jsx"), "utf8");
assert.doesNotMatch(vizSource, /const nodes = \{\}/);
assert.doesNotMatch(vizSource, /String\(searchHit\) === String\(/);
assert.doesNotMatch(vizSource, /String\(selV\) === String\(/);
assert.match(vizSource, /createGraphIdentifierMap/);
assert.match(vizSource, /graphIdentifiersEqual/);

console.log("v7.3.14 Stage 1 canonical identity contract passed.");
