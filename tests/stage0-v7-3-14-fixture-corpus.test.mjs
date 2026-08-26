import assert from "node:assert/strict";
import {
  CSVQuoted,
  CSRInvalidIds,
  DenseProjection,
  DuplicateHyperedgeID,
  DuplicateOverlap,
  ExpectedProtoID,
  IncidenceConflict,
  LargeSparse,
  LiteralNullID,
  MalformedAdjacency,
  MalformedH2H,
  ManySingletons2001,
  OneHugeEdge1K,
  OneHugeEdge5K,
  PrototypeIDs,
  STAGE0_FIXTURE_NAMES,
  Stage0Fixtures,
  TinyBasic,
  WeightZero,
  WhitespaceRows,
  ZeroID,
} from "./fixtures/v7.3.14/stage0-regression-fixtures.mjs";

assert.equal(STAGE0_FIXTURE_NAMES.length, 19);
assert.deepEqual(Object.keys(Stage0Fixtures), STAGE0_FIXTURE_NAMES);

assert.equal(TinyBasic.length, 2);
assert.equal(WhitespaceRows.text, "1 2 3\n2 4\n1 3 4 5");
assert.deepEqual(WhitespaceRows.expected.map(edge => edge.vertices), [[1, 2, 3], [2, 4], [1, 3, 4, 5]]);
assert.equal(CSVQuoted.expectedRows[0][0], "Smith, John");
assert.deepEqual(ZeroID[0].vertices, [0, "0", "control"]);
assert.deepEqual(PrototypeIDs[0].vertices, ["__proto__", "constructor", "toString"]);
assert.equal(LiteralNullID[0].vertices[0], "null");
assert.equal(WeightZero[0].weight, 0);
assert.equal(DuplicateHyperedgeID[0].id, DuplicateHyperedgeID[1].id);

const overlap = DuplicateOverlap();
assert.equal(overlap.length, 200);
assert.equal(overlap[0].vertices.length, 46);
assert.equal(200 * ((46 * 45) / 2), 207_000);
assert.equal((46 * 45) / 2, 1_035);

assert.equal(OneHugeEdge1K()[0].vertices.length, 1_000);
assert.equal(OneHugeEdge5K()[0].vertices.length, 5_000);
assert.equal(ManySingletons2001().length, 2_001);
assert.match(IncidenceConflict.weight, /h1,b,t1,3/);
assert.equal(typeof CSRInvalidIds.vertexObject.vertexIds[0], "object");
assert.ok(MalformedH2H.every(value => value.includes(":")));
assert.ok(MalformedAdjacency.some(value => !value.includes(":")));
assert.equal(LargeSparse({ hyperedgeCount: 32 }).length, 32);
assert.equal(DenseProjection()[0].vertices.length, 632);
assert.equal(ExpectedProtoID.actual[0].id, "__proto__");

console.log("v7.3.14 Stage 0 permanent fixture corpus passed (19/19 fixture families).");
