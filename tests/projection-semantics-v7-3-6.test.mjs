import assert from "node:assert/strict";
import { buildTwoSectionProjection, incidenceDensity, projectionDensity } from "../src/algorithms/projection.js";
import { buildV2V, computeStats, expCanonicalJSON, expClique, validateHes } from "../src/utils/mappings.js";

const hyperedges = [
  { id: "h0", vertices: ["1", "2", "3"], time: null, weight: 10, attributes: {} },
  { id: "h1", vertices: ["2", "3"], time: null, weight: 5, attributes: {} },
  { id: "h2", vertices: ["4"], time: null, weight: 1, attributes: {} },
];

const projection = buildTwoSectionProjection(hyperedges);
const edge23 = projection.edges.find(edge => edge.src === "2" && edge.dst === "3");
assert.equal(edge23.weight, 2, "default V2V weight counts shared hyperedges");
assert.deepEqual(edge23.hyperedges, ["h0", "h1"]);
assert.deepEqual(buildV2V(hyperedges), projection.edges);

const weighted = buildTwoSectionProjection(hyperedges, { weightPolicy: "min_hyperedge_weight" });
assert.equal(weighted.edges.find(edge => edge.src === "2" && edge.dst === "3").weight, 5);

assert.equal(incidenceDensity(hyperedges), 6 / 12);
assert.equal(projectionDensity(hyperedges), 3 / 6);
const stats = computeStats(hyperedges);
assert.equal(stats.incidenceDensity, 0.5);
assert.equal(stats.v2vProjectionDensity, 0.5);

const clique = expClique(hyperedges);
assert.match(clique, /2,3,2/, "clique export uses shared-hyperedge-count projection weight");

const canonical = JSON.parse(expCanonicalJSON(hyperedges, { fmt: "test" }));
assert.equal(canonical.metadata.projection.weightPolicy, "count_shared_hyperedges");
assert.ok(Array.isArray(canonical.v2vProjection));

const issues = validateHes(hyperedges);
assert.equal(issues.some(issue => issue.type === "selfloop"), false);
assert.equal(issues.some(issue => issue.type === "singleton"), true);

console.log("projection semantics v7.3.6 tests passed.");
