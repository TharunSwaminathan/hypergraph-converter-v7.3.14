import assert from "node:assert/strict";
import { buildIncidenceIndex, getHyperedgeVertexIds, getIncidentHyperedgeIds } from "../src/graph/incidenceIndex.js";
import { buildV2V } from "../src/utils/mappings.js";

const SEED = 0x73_03_14;
const CASES = 3_000;
const IDENTIFIERS = ["0", "null", "__proto__", "constructor", "toString", " A ", "\"foo\"", "A,1", "Δ😀", "#h1", "a", "b", "c", "d"];

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

const random = mulberry32(SEED);
const integer = maximum => Math.floor(random() * maximum);

function generatedGraph(caseIndex) {
  const vertexPool = IDENTIFIERS.slice(0, 1 + integer(IDENTIFIERS.length));
  const hyperedgeCount = integer(9);
  const graph = [];
  for (let edgeIndex = 0; edgeIndex < hyperedgeCount; edgeIndex += 1) {
    const cardinality = integer(Math.min(7, vertexPool.length + 1));
    const members = [];
    while (members.length < cardinality) {
      const candidate = vertexPool[integer(vertexPool.length)];
      if (!members.includes(candidate)) members.push(candidate);
    }
    graph.push({
      id: `case-${caseIndex}-h${edgeIndex}`,
      vertices: members,
      time: edgeIndex % 4 === 0 ? 0 : null,
      weight: edgeIndex % 5 === 0 ? 0 : 1,
      attributes: {},
    });
  }
  return graph;
}

function incidenceNeighbors(index, vertex) {
  const neighbors = new Set();
  for (const hyperedgeId of getIncidentHyperedgeIds(index, vertex)) {
    for (const member of getHyperedgeVertexIds(index, hyperedgeId)) {
      if (member !== vertex) neighbors.add(member);
    }
  }
  return neighbors;
}

function projectedAdjacency(index, edges) {
  const adjacency = new Map(index.vertices.map(vertex => [vertex, new Set()]));
  for (const edge of edges) {
    adjacency.get(edge.src).add(edge.dst);
    adjacency.get(edge.dst).add(edge.src);
  }
  return adjacency;
}

function components(vertices, neighborsFor) {
  const seen = new Set();
  const result = [];
  for (const start of vertices) {
    if (seen.has(start)) continue;
    const queue = [start];
    const component = [];
    seen.add(start);
    for (let offset = 0; offset < queue.length; offset += 1) {
      const vertex = queue[offset];
      component.push(vertex);
      for (const neighbor of neighborsFor(vertex)) {
        if (seen.has(neighbor)) continue;
        seen.add(neighbor);
        queue.push(neighbor);
      }
    }
    result.push(component.sort());
  }
  return result.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

let projectedNeighborMismatches = 0;
let connectednessMismatches = 0;
for (let caseIndex = 0; caseIndex < CASES; caseIndex += 1) {
  const graph = generatedGraph(caseIndex);
  const index = buildIncidenceIndex(graph);
  const exactV2V = buildV2V(graph);
  const adjacency = projectedAdjacency(index, exactV2V);
  assert.deepEqual(index.vertices, [...new Set(graph.flatMap(edge => edge.vertices))], `vertex order case ${caseIndex}`);
  for (const vertex of index.vertices) {
    const fromIndex = [...incidenceNeighbors(index, vertex)].sort();
    const fromProjection = [...adjacency.get(vertex)].sort();
    if (JSON.stringify(fromIndex) !== JSON.stringify(fromProjection)) projectedNeighborMismatches += 1;
    assert.deepEqual(fromIndex, fromProjection, `projected neighbors case ${caseIndex}, vertex ${JSON.stringify(vertex)}`);
  }
  const incidenceComponents = components(index.vertices, vertex => incidenceNeighbors(index, vertex));
  const projectionComponents = components(index.vertices, vertex => adjacency.get(vertex));
  if (JSON.stringify(incidenceComponents) !== JSON.stringify(projectionComponents)) connectednessMismatches += 1;
  assert.deepEqual(incidenceComponents, projectionComponents, `components case ${caseIndex}`);
}

assert.equal(projectedNeighborMismatches, 0);
assert.equal(connectednessMismatches, 0);
console.log(`v7.3.14 Stage 3 randomized incidence differential passed: ${CASES}/${CASES} cases, seed=${SEED}.`);
