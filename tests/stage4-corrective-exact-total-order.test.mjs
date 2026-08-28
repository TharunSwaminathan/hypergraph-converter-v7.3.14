import assert from "node:assert/strict";
import {
  buildTwoSectionProjection,
  PROJECTION_WEIGHT_POLICIES,
} from "../src/algorithms/projection.js";

const equivalenceFixtures = [
  ["latin-small-e-acute", "\u00E9", "e\u0301"],
  ["latin-capital-a-ring", "\u00C5", "A\u030A"],
];

for (const [name, composed, decomposed] of equivalenceFixtures) {
  assert.notEqual(composed, decomposed, `${name}: canonical identifiers must remain exact-distinct`);
  assert.equal(composed.localeCompare(decomposed), 0, `${name}: fixture must exercise a collation tie`);

  const graph = [
    record("h1", [composed, decomposed]),
    record("h2", [decomposed, composed]),
  ];
  const projection = buildTwoSectionProjection(graph);
  assert.deepEqual(new Set(projection.vertices), new Set([composed, decomposed]), `${name}: both exact IDs must remain vertices`);
  assert.equal(projection.vertices.length, 2, `${name}: Unicode normalization is forbidden`);
  assert.deepEqual(projection.edges, [{
    src: exactMinimum(composed, decomposed),
    dst: exactMaximum(composed, decomposed),
    weight: 2,
    hyperedges: ["h1", "h2"],
  }], `${name}: reversed memberships must resolve to one exact unordered pair`);

  const reversedInput = buildTwoSectionProjection([...graph].reverse());
  assert.equal(reversedInput.edges.length, 1, `${name}: hyperedge order must not split orientation`);
  assert.equal(reversedInput.edges[0].src, exactMinimum(composed, decomposed));
  assert.equal(reversedInput.edges[0].dst, exactMaximum(composed, decomposed));
  assert.equal(reversedInput.edges[0].weight, 2);
  assert.deepEqual(new Set(reversedInput.edges[0].hyperedges), new Set(["h1", "h2"]));
}

const [composed, decomposed] = equivalenceFixtures[0].slice(1);
const weightedUnicodeGraph = [
  record("h0", [composed, decomposed], { weight: 0 }),
  record("h2", [decomposed, composed], { weight: 2 }),
];
for (const [weightPolicy, expectedWeight] of [
  [PROJECTION_WEIGHT_POLICIES.COUNT_SHARED_HYPEREDGES, 2],
  [PROJECTION_WEIGHT_POLICIES.SUM_HYPEREDGE_WEIGHTS, 2],
  [PROJECTION_WEIGHT_POLICIES.MIN_HYPEREDGE_WEIGHT, 0],
  [PROJECTION_WEIGHT_POLICIES.UNWEIGHTED, 1],
]) {
  const projection = buildTwoSectionProjection(weightedUnicodeGraph, { weightPolicy });
  assert.equal(projection.edges.length, 1, `${weightPolicy}: collation tie must remain one pair`);
  assert.equal(projection.edges[0].weight, expectedWeight, `${weightPolicy}: weight semantics changed`);
  assert.deepEqual(projection.edges[0].hyperedges, ["h0", "h2"], `${weightPolicy}: support metadata changed`);
}

const nulProjection = buildTwoSectionProjection([
  record("h1", ["a", "b\u0000c"]),
  record("h2", ["a\u0000b", "c"]),
]);
assert.deepEqual(nulProjection.edges, [
  { src: "a", dst: "b\u0000c", weight: 1, hyperedges: ["h1"] },
  { src: "a\u0000b", dst: "c", weight: 1, hyperedges: ["h2"] },
]);

for (const [left, right, expected] of [
  ["01", "1", { src: "01", dst: "1" }],
  ["1.0", "1", { src: "1", dst: "1.0" }],
]) {
  const projection = buildTwoSectionProjection([
    record("h1", [left, right]),
    record("h2", [right, left]),
  ]);
  assert.deepEqual(projection.edges, [{ ...expected, weight: 2, hyperedges: ["h1", "h2"] }]);
}

const ordinaryProjection = buildTwoSectionProjection([
  record("ordinary", ["gamma", "alpha", "beta"]),
]);
assert.deepEqual(ordinaryProjection.vertices, ["alpha", "beta", "gamma"]);
assert.deepEqual(ordinaryProjection.edges, [
  { src: "alpha", dst: "beta", weight: 1, hyperedges: ["ordinary"] },
  { src: "alpha", dst: "gamma", weight: 1, hyperedges: ["ordinary"] },
  { src: "beta", dst: "gamma", weight: 1, hyperedges: ["ordinary"] },
]);

console.log("v7.3.14 Stage 4 corrective exact-total-order tests passed (2 Unicode collation ties, 4 policies). ");

function exactMinimum(left, right) {
  return left < right ? left : right;
}

function exactMaximum(left, right) {
  return left < right ? right : left;
}

function record(id, vertices, extra = {}) {
  return { id, vertices, time: extra.time ?? null, weight: extra.weight ?? 1, attributes: extra.attributes ?? {} };
}
