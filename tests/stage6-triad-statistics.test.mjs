import assert from "node:assert/strict";
import {
  countTriads,
  countTriadsBounded,
  countTriadsExact,
  DERIVED_STATUS,
} from "../src/utils/mappings.js";
import {
  DuplicateOverlap,
  ManySingletons,
  ManySingletons2001,
  PrototypeIDs,
} from "./fixtures/v7.3.14/stage0-regression-fixtures.mjs";

const record = (id, vertices, extra = {}) => ({ id, vertices, time: extra.time ?? null, weight: extra.weight ?? 1, attributes: {} });
const triangle = [
  record("h0", ["a", "b"]),
  record("h1", ["b", "c"]),
  record("h2", ["c", "a"]),
];

for (const [name, graph, expected] of [
  ["empty", [], 0],
  ["one", [record("h0", ["a"])], 0],
  ["two disconnected", [record("h0", ["a"]), record("h1", ["b"])], 0],
  ["triangle", triangle, 1],
  ["triangle plus extras", [...triangle, record("h3", ["isolated"])], 1],
  ["prototype ids", PrototypeIDs, 0],
  ["literal null", [record("null", ["null", "ordinary"])], 0],
  ["zero metadata", [record("zero", ["a", "b"], { time: 0, weight: 0 })], 0],
]) {
  assert.equal(countTriadsExact(graph), expected, name);
  assert.equal(countTriads(graph), expected, `${name} compatibility exact name`);
  const bounded = countTriadsBounded(graph);
  assert.equal(bounded.status, DERIVED_STATUS.COMPUTED, name);
  assert.equal(bounded.value, expected, name);
  assert.ok(Number.isFinite(bounded.value), `${name} computed result must be finite`);
}

for (const count of [2_000, 2_001, 5_000]) {
  const result = countTriadsBounded(ManySingletons(count));
  assert.equal(result.status, DERIVED_STATUS.COMPUTED, `${count} singleton hyperedges`);
  assert.equal(result.value, 0);
  assert.equal(result.estimate.h2hNeighborReferences, 0);
  assert.equal(result.estimate.wedgeWork, 0);
}

const many = countTriadsBounded(ManySingletons2001());
assert.equal(many.status, DERIVED_STATUS.COMPUTED);
assert.equal(many.value, 0);

const lowOverlap = Array.from({ length: 2_101 }, (_, index) => record(`h${index}`, [`v${index}`, `v${index + 1}`]));
const low = countTriadsBounded(lowOverlap);
assert.equal(low.status, DERIVED_STATUS.COMPUTED);
assert.equal(low.value, 0);
assert.equal(low.estimate.h2hNeighborReferences, 4_200);
assert.equal(low.estimate.wedgeWork, 2_099);

const duplicate = countTriadsBounded(DuplicateOverlap());
assert.equal(duplicate.status, DERIVED_STATUS.OVER_BUDGET);
assert.equal(duplicate.exceededResource, "wedgeWork");
assert.equal(duplicate.value, null);

assert.equal(countTriadsBounded(triangle, { maxCandidatePairWork: 2 }).exceededResource, "candidatePairWork");
assert.equal(countTriadsBounded(triangle, { maxCandidatePairWork: 3 }).status, DERIVED_STATUS.COMPUTED);
assert.equal(countTriadsBounded(triangle, { maxNeighborRefs: 5 }).exceededResource, "h2hNeighborReferences");
assert.equal(countTriadsBounded(triangle, { maxNeighborRefs: 6 }).status, DERIVED_STATUS.COMPUTED);
assert.equal(countTriadsBounded(triangle, { maxWedgeWork: 2 }).exceededResource, "wedgeWork");
assert.equal(countTriadsBounded(triangle, { maxWedgeWork: 3 }).status, DERIVED_STATUS.COMPUTED);
assert.equal(countTriadsBounded(triangle, { maxSynchronousWork: 5 }).exceededResource, "synchronousWork");
assert.equal(countTriadsBounded(triangle, { maxSynchronousWork: 6 }).status, DERIVED_STATUS.COMPUTED);

const highDegree = Array.from({ length: 1_000 }, (_, index) => record(`h${index}`, ["shared", `v${index}`]));
const high = countTriadsBounded(highDegree);
assert.equal(high.status, DERIVED_STATUS.OVER_BUDGET);
assert.equal(high.exceededResource, "h2hNeighborReferences");
assert.equal(high.value, null);

assert.throws(() => countTriadsBounded(triangle, { maxWedgeWork: -1 }), /non-negative/);
console.log("Stage 6 triad producer, work-boundary, and finite-value gates passed.");
