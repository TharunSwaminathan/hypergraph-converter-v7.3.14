import assert from "node:assert/strict";
import { K_CORE_STATUS, runKCore } from "../src/algorithms/kCore.js";
import { legacyRunKCore, serializeKCore } from "./helpers/stage6LegacyAlgorithms.mjs";

const SEED = 0x6c0e713;
const GRAPH_COUNT = 3_000;
let state = SEED >>> 0;
let mismatches = 0;
const ids = ["0", "null", "__proto__", "constructor", "toString", "é", "東京", "a", "2", "10", "z"];

for (let graphIndex = 0; graphIndex < GRAPH_COUNT; graphIndex += 1) {
  const vertexCount = 1 + randomInt(10);
  const vertices = ids.slice(0, vertexCount);
  const hyperedgeCount = randomInt(9);
  const graph = [];
  for (let hyperedgeIndex = 0; hyperedgeIndex < hyperedgeCount; hyperedgeIndex += 1) {
    const membershipCount = 1 + randomInt(Math.min(vertexCount + 2, 7));
    graph.push({
      id: graphIndex % 101 === 0 && hyperedgeIndex === 0 ? "__proto__" : `g${graphIndex}h${hyperedgeIndex}`,
      vertices: Array.from({ length: membershipCount }, () => vertices[randomInt(vertices.length)]),
      time: null,
      weight: 1,
      attributes: {},
    });
  }
  const actual = runKCore(graph);
  assert.equal(actual.status, K_CORE_STATUS.COMPUTED);
  try {
    assert.deepEqual(serializeKCore(actual), serializeKCore(legacyRunKCore(graph)));
  } catch (error) {
    mismatches += 1;
    throw new assert.AssertionError({
      message: `K-core differential mismatch at graph ${graphIndex}: ${error.message}`,
      actual: serializeKCore(actual),
      expected: serializeKCore(legacyRunKCore(graph)),
    });
  }
}

assert.equal(mismatches, 0);
console.log(`Stage 6 K-core differential passed: seed=${SEED}, graphs=${GRAPH_COUNT}, mismatches=${mismatches}.`);

function randomInt(maximum) {
  state = (Math.imul(state, 1_103_515_245) + 12_345) >>> 0;
  return state % maximum;
}
