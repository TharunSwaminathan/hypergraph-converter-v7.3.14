import assert from "node:assert/strict";
import { runShortestPath } from "../src/algorithms/shortestPath.js";
import { legacyRunShortestPath, serializeShortest } from "./helpers/stage6LegacyAlgorithms.mjs";

const SEED = 0x6a7135;
const GRAPH_COUNT = 3_000;
let state = SEED >>> 0;
let runCount = 0;
let mismatches = 0;
const ids = ["0", "null", "__proto__", "constructor", "toString", "é", "東京", "a", "2", "10", "z"];

for (let graphIndex = 0; graphIndex < GRAPH_COUNT; graphIndex += 1) {
  const vertexCount = 1 + randomInt(9);
  const vertices = ids.slice(0, vertexCount);
  const hyperedgeCount = 1 + randomInt(8);
  const graph = [];
  for (let hyperedgeIndex = 0; hyperedgeIndex < hyperedgeCount; hyperedgeIndex += 1) {
    const membershipCount = 1 + randomInt(Math.min(vertexCount + 2, 7));
    const members = Array.from({ length: membershipCount }, () => vertices[randomInt(vertices.length)]);
    const weightChoice = randomInt(7);
    const weight = [0, 1, 2, 5, undefined, -2, "bad"][weightChoice];
    const hyperedge = { id: graphIndex % 97 === 0 && hyperedgeIndex === 0 ? "__proto__" : `g${graphIndex}h${hyperedgeIndex}`, vertices: members, time: null, attributes: {} };
    if (weightChoice !== 4) hyperedge.weight = weight;
    graph.push(hyperedge);
  }

  const startsAndTargets = [
    { startVertex: vertices[0], targetVertex: vertices.at(-1) },
    { startVertex: vertices[randomInt(vertices.length)], targetVertex: null },
    { startVertex: vertices[randomInt(vertices.length)], targetVertex: vertices[randomInt(vertices.length)] },
    { startVertex: "missing", targetVertex: vertices[0] },
  ];
  for (const options of startsAndTargets) {
    runCount += 1;
    const actual = serializeShortest(runShortestPath(graph, options));
    const expected = serializeShortest(legacyRunShortestPath(graph, options));
    try {
      assert.deepEqual(actual, expected);
    } catch (error) {
      mismatches += 1;
      throw new assert.AssertionError({
        message: `Shortest differential mismatch at graph ${graphIndex}, options ${JSON.stringify(options)}: ${error.message}`,
        actual,
        expected,
      });
    }
  }
}

assert.equal(mismatches, 0);
assert.equal(runCount, 12_000);
console.log(`Stage 6 shortest differential passed: seed=${SEED}, graphs=${GRAPH_COUNT}, runs=${runCount}, mismatches=${mismatches}.`);

function randomInt(maximum) {
  state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
  return state % maximum;
}
