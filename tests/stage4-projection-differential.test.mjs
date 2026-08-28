import assert from "node:assert/strict";
import {
  buildTwoSectionProjection,
  PROJECTION_WEIGHT_POLICIES,
} from "../src/algorithms/projection.js";
import { legacyBuildTwoSectionProjection } from "./helpers/stage4LegacyProjection.mjs";

const RANDOM_SEED = 0x74_04_14;
const RANDOM_GRAPHS = 3_000;
const random = mulberry32(RANDOM_SEED);
const identifiers = ["0", "null", "__proto__", "constructor", "toString", "2", "10", "Δ😀", "😀", "a", "b", "c"];
const weights = [0, 1, 2, null, "bad", -1];
const policies = Object.values(PROJECTION_WEIGHT_POLICIES);
const mismatches = Object.fromEntries(policies.map(policy => [policy, 0]));

for (let caseIndex = 0; caseIndex < RANDOM_GRAPHS; caseIndex += 1) {
  const graph = randomGraph(caseIndex);
  for (const weightPolicy of policies) {
    const actual = buildTwoSectionProjection(graph, { weightPolicy });
    const expected = legacyBuildTwoSectionProjection(graph, { weightPolicy });
    if (JSON.stringify(actual) !== JSON.stringify(expected)) mismatches[weightPolicy] += 1;
  }
}

assert.deepEqual(mismatches, Object.fromEntries(policies.map(policy => [policy, 0])));
console.log(`v7.3.14 Stage 4 projection differential passed: ${RANDOM_GRAPHS} graphs x ${policies.length} policies, seed=${RANDOM_SEED}.`);

function randomGraph(caseIndex) {
  const integer = maximum => Math.floor(random() * maximum);
  const pool = identifiers.slice(0, 1 + integer(identifiers.length));
  return Array.from({ length: integer(8) }, (_, edgeIndex) => {
    const cardinality = integer(Math.min(7, pool.length + 1));
    const vertices = [];
    while (vertices.length < cardinality) {
      const vertex = pool[integer(pool.length)];
      if (!vertices.includes(vertex)) vertices.push(vertex);
    }
    if (vertices.length && random() < 0.2) vertices.push(vertices[0]);
    return {
      id: `case-${caseIndex}-h${edgeIndex}`,
      vertices,
      time: null,
      weight: weights[integer(weights.length)],
      attributes: {},
    };
  });
}

function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let result = value;
    result = Math.imul(result ^ result >>> 15, result | 1);
    result ^= result + Math.imul(result ^ result >>> 7, result | 61);
    return ((result ^ result >>> 14) >>> 0) / 4_294_967_296;
  };
}
