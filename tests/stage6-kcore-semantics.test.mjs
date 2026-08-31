import assert from "node:assert/strict";
import { K_CORE_STATUS, runKCore } from "../src/algorithms/kCore.js";
import {
  DuplicateOverlap,
  OneHugeEdge1K,
  PrototypeIDs,
  TinyBasic,
} from "./fixtures/v7.3.14/stage0-regression-fixtures.mjs";
import { legacyRunKCore, serializeKCore } from "./helpers/stage6LegacyAlgorithms.mjs";

const record = (id, vertices) => ({ id, vertices, time: null, weight: 1, attributes: {} });
const path = [record("h0", ["a", "b"]), record("h1", ["b", "c"]), record("h2", ["c", "d"])];
const cycle = [record("h0", ["a", "b"]), record("h1", ["b", "c"]), record("h2", ["c", "a"])];
const cases = [
  ["tiny", TinyBasic],
  ["empty", []],
  ["singleton", [record("h0", ["solo"])]],
  ["path", path],
  ["cycle", cycle],
  ["clique", [record("h0", ["a", "b", "c", "d"])]],
  ["disconnected", [record("h0", ["a", "b"]), record("h1", ["x", "y"])]],
  ["overlap", [record("h0", ["a", "b", "c"]), record("h1", ["b", "c", "d"])]],
  ["prototype", PrototypeIDs],
  ["zero/null", [record("h0", [0, "null", "other"])]],
];
for (const [name, graph] of cases) {
  const actual = runKCore(graph);
  assert.equal(actual.status, K_CORE_STATUS.COMPUTED, name);
  assert.deepEqual(serializeKCore(actual), serializeKCore(legacyRunKCore(graph)), name);
}

const duplicate = runKCore(DuplicateOverlap());
assert.equal(duplicate.status, K_CORE_STATUS.COMPUTED);
assert.equal(duplicate.usage.candidatePairWork, 207_000);
assert.equal(duplicate.usage.uniqueProjectedEdges, 1_035);
assert.equal(duplicate.usage.adjacencyReferences, 2_070);
assert.equal(duplicate.degeneracy, 45);
assert.ok([...duplicate.coreness.values()].every(value => value === 45));

const huge = runKCore(OneHugeEdge1K());
assert.equal(huge.status, K_CORE_STATUS.RESOURCE_LIMITED);
assert.equal(huge.exceededResource, "uniqueProjectedEdges");
assert.equal(huge.value, null);
assert.equal(huge.coreness, null);
assert.equal(huge.degeneracy, null);
assert.match(huge.reason, /200,001 unique projected edges/);

const candidateLimited = runKCore([record("h", ["a", "b", "c"])], { maxCandidatePairWork: 2 });
assert.equal(candidateLimited.status, K_CORE_STATUS.RESOURCE_LIMITED);
assert.equal(candidateLimited.exceededResource, "candidatePairWork");

const edgeLimited = runKCore([record("h", ["a", "b", "c"])], { maxUniqueProjectedEdges: 2 });
assert.equal(edgeLimited.exceededResource, "uniqueProjectedEdges");

const adjacencyLimited = runKCore([record("h", ["a", "b"])], { maxAdjacencyReferences: 1 });
assert.equal(adjacencyLimited.exceededResource, "adjacencyReferences");

console.log("Stage 6 K-core semantic and resource gates passed.");
