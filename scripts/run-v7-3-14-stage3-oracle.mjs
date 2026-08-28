import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import {
  buildIncidenceIndex,
  getHyperedgeVertexIds,
  getIncidentHyperedgeIds,
  hasHyperedge,
  hasVertex,
} from "../src/graph/incidenceIndex.js";
import { buildV2V } from "../src/utils/mappings.js";
import { normalizeHyperedges } from "../src/utils/parsers.js";
import {
  DuplicateOverlap,
  LargeSparse,
  OneHugeEdge1K,
  OneHugeEdge5K,
  PrototypeIDs,
  TinyBasic,
  ZeroID,
} from "../tests/fixtures/v7.3.14/stage0-regression-fixtures.mjs";

const scriptRoot = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(scriptRoot);
const outputArgument = process.argv.find(argument => argument.startsWith("--output="));
const outputPath = resolve(outputArgument?.slice("--output=".length)
  ?? join(projectRoot, "artifacts", "v7.3.14-stage3-oracle.json"));
const canonical = graph => normalizeHyperedges(graph, { identifierMode: "structured" }).hyperedges;

const checks = [];
const verify = (id, title, fixed, evidence) => checks.push({ id, title, fixed: Boolean(fixed), evidence });
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

const tiny = canonical(TinyBasic);
const tinyIndex = buildIncidenceIndex(tiny);
verify(
  "STAGE3-STRUCTURE",
  "Incidence index contains exact deterministic bidirectional relations",
  same(tinyIndex.vertices, ["a", "b", "c", "d"])
    && same(tinyIndex.hyperedges, ["h0", "h1"])
    && tinyIndex.hyperedgesById.get("h0") === tiny[0]
    && same([...tinyIndex.vertexToHyperedges.get("c")], ["h0", "h1"])
    && same([...tinyIndex.hyperedgeToVertices.get("h0")], ["a", "b", "c"])
    && same(tinyIndex.counts, { hyperedges: 2, vertices: 4, incidences: 5 }),
  {
    vertices: tinyIndex.vertices,
    hyperedges: tinyIndex.hyperedges,
    cIncidences: [...tinyIndex.vertexToHyperedges.get("c")],
    h0Members: [...tinyIndex.hyperedgeToVertices.get("h0")],
    counts: tinyIndex.counts,
  },
);

const identifierValues = ["0", "null", "__proto__", "constructor", "toString", " A ", "\"foo\"", "A,1", "Δ😀", "#h1"];
const identifierGraph = [{ id: "#h1", vertices: identifierValues, time: null, weight: 1, attributes: {} }];
const identifierIndex = buildIncidenceIndex(identifierGraph);
verify(
  "STAGE3-IDENTIFIERS",
  "Canonical and prototype-like identifiers retain exact lookup semantics",
  identifierValues.every(id => hasVertex(identifierIndex, id))
    && !hasVertex(identifierIndex, "A")
    && !hasVertex(identifierIndex, "foo")
    && hasHyperedge(identifierIndex, "#h1")
    && buildIncidenceIndex(canonical(ZeroID)).vertices[0] === "0"
    && getIncidentHyperedgeIds(buildIncidenceIndex(canonical(PrototypeIDs)), "__proto__")[0] === "__proto__",
  { identifierValues, indexedVertices: identifierIndex.vertices },
);

const source = [{ id: "h", vertices: ["a", "a", "b"], time: 0, weight: 0, attributes: { nested: { keep: true } } }];
const snapshot = structuredClone(source);
const duplicateIndex = buildIncidenceIndex(source);
verify(
  "STAGE3-IMMUTABILITY-DUPLICATES",
  "Construction leaves source data unchanged and deduplicates only derived incidence relationships",
  same(source, snapshot)
    && duplicateIndex.hyperedgesById.get("h") === source[0]
    && same([...duplicateIndex.hyperedgeToVertices.get("h")], ["a", "b"])
    && same(duplicateIndex.counts, { hyperedges: 1, vertices: 2, incidences: 2 }),
  { sourceUnchanged: same(source, snapshot), members: [...duplicateIndex.hyperedgeToVertices.get("h")], counts: duplicateIndex.counts },
);

const specialIndex = buildIncidenceIndex([
  { id: "empty", vertices: [], time: null, weight: 1, attributes: {} },
  { id: "single", vertices: ["v"], time: null, weight: 1, attributes: {} },
]);
verify(
  "STAGE3-EMPTY-SINGLETON",
  "Empty and singleton hyperedges retain canonical incidence semantics",
  hasHyperedge(specialIndex, "empty")
    && getHyperedgeVertexIds(specialIndex, "empty").length === 0
    && same(getHyperedgeVertexIds(specialIndex, "single"), ["v"])
    && same(getIncidentHyperedgeIds(specialIndex, "v"), ["single"]),
  { hyperedges: specialIndex.hyperedges, counts: specialIndex.counts },
);

const RANDOM_SEED = 0x73_03_14;
const RANDOM_CASES = 3_000;
const randomIds = ["0", "null", "__proto__", "constructor", "toString", " A ", "Δ😀", "#h1", "a", "b", "c", "d"];
const random = mulberry32(RANDOM_SEED);
let projectedNeighborMismatches = 0;
let connectednessMismatches = 0;
for (let caseIndex = 0; caseIndex < RANDOM_CASES; caseIndex += 1) {
  const graph = randomGraph(caseIndex, random, randomIds);
  const index = buildIncidenceIndex(graph);
  const projected = projectedAdjacency(index, buildV2V(graph));
  for (const vertex of index.vertices) {
    if (!same([...incidenceNeighbors(index, vertex)].sort(), [...projected.get(vertex)].sort())) projectedNeighborMismatches += 1;
  }
  if (!same(
    components(index.vertices, vertex => incidenceNeighbors(index, vertex)),
    components(index.vertices, vertex => projected.get(vertex)),
  )) connectednessMismatches += 1;
}
verify(
  "STAGE3-RANDOM-DIFFERENTIAL",
  "Seeded incidence traversal matches exact V2V neighbors and connectedness",
  projectedNeighborMismatches === 0 && connectednessMismatches === 0,
  { seed: RANDOM_SEED, generatedCases: RANDOM_CASES, v2vAffordableCasesCompared: RANDOM_CASES, projectedNeighborMismatches, connectednessMismatches },
);

const performanceFixtures = [
  ["TinyBasic", canonical(TinyBasic)],
  ["LargeSparse", canonical(LargeSparse())],
  ["OneHugeEdge1K", canonical(OneHugeEdge1K())],
  ["OneHugeEdge5K", canonical(OneHugeEdge5K())],
  ["DuplicateOverlap", canonical(DuplicateOverlap())],
];
const measurements = {};
for (const [name, graph] of performanceFixtures) measurements[name] = measureIndex(graph);
verify(
  "STAGE3-STRUCTURAL-SCALING",
  "Large fixtures remain O(H + V + I) without persistent projected neighbors",
  same(pickCounts(measurements.OneHugeEdge5K), { hyperedges: 1, vertices: 5_000, incidences: 5_000 })
    && measurements.OneHugeEdge5K.setEntries === 10_000
    && measurements.OneHugeEdge5K.setEntries < 12_497_500
    && same(pickCounts(measurements.DuplicateOverlap), { hyperedges: 200, vertices: 46, incidences: 9_200 })
    && measurements.DuplicateOverlap.setEntries === 18_400
    && measurements.DuplicateOverlap.setEntries < 207_000,
  measurements,
);

const indexSource = await readFile(join(projectRoot, "src", "graph", "incidenceIndex.js"), "utf8");
verify(
  "STAGE3-NO-PROJECTION-DEPENDENCY",
  "Index construction has no mapping, graph-model, or projection dependency",
  !/from\s+["'][^"']*(?:projection|mappings|graphModel)[^"']*["']/i.test(indexSource)
    && !/\b(?:buildV2V|buildV2VBounded|buildTwoSectionProjectionSafely|buildH2H)\s*\(/.test(indexSource),
  { imports: [...indexSource.matchAll(/^import[^;]+;/gm)].map(match => match[0]) },
);

const stateA = [{ id: "h1", vertices: ["a", "b"], time: null, weight: 1, attributes: {} }];
const stateB = [{ id: "h2", vertices: ["b", "c"], time: null, weight: 1, attributes: {} }];
const indexA = buildIncidenceIndex(stateA);
const indexB = buildIncidenceIndex(stateB);
const indexCleared = buildIncidenceIndex([]);
verify(
  "STAGE3-REBUILD",
  "Pure rebuilds cannot retain stale graph state or leak between graphs",
  hasHyperedge(indexA, "h1")
    && !hasHyperedge(indexA, "h2")
    && hasHyperedge(indexB, "h2")
    && !hasHyperedge(indexB, "h1")
    && !hasVertex(indexB, "a")
    && same(indexCleared.counts, { hyperedges: 0, vertices: 0, incidences: 0 }),
  { stateA: { vertices: indexA.vertices, hyperedges: indexA.hyperedges }, stateB: { vertices: indexB.vertices, hyperedges: indexB.hyperedges }, cleared: indexCleared.counts },
);

const fixedCount = checks.filter(check => check.fixed).length;
const artifact = {
  stage: 3,
  kind: "incidence_index_behavior_oracle",
  parentCommit: "e84732d773584b99592ae827b0e33616aecde090",
  fixedCount,
  total: checks.length,
  environment: {
    runtime: process.version,
    platform: `${process.platform}/${process.arch}`,
    timingCaveat: "Elapsed times are measurements on this Node environment only, not browser scalability claims.",
  },
  checks,
};
await writeFile(outputPath, JSON.stringify(artifact, null, 2) + "\n", "utf8");

console.log("Stage 3 incidence-index oracle: " + fixedCount + "/" + checks.length + " families passed.");
console.log("Evidence: " + outputPath);
for (const check of checks) console.log((check.fixed ? "PASS" : "FAIL") + " " + check.id + " — " + check.title);
if (fixedCount !== checks.length) process.exitCode = 1;

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

function randomGraph(caseIndex, random, ids) {
  const integer = maximum => Math.floor(random() * maximum);
  const pool = ids.slice(0, 1 + integer(ids.length));
  return Array.from({ length: integer(9) }, (_, edgeIndex) => {
    const cardinality = integer(Math.min(7, pool.length + 1));
    const vertices = [];
    while (vertices.length < cardinality) {
      const candidate = pool[integer(pool.length)];
      if (!vertices.includes(candidate)) vertices.push(candidate);
    }
    return { id: `case-${caseIndex}-h${edgeIndex}`, vertices, time: null, weight: edgeIndex % 5 === 0 ? 0 : 1, attributes: {} };
  });
}

function incidenceNeighbors(index, vertex) {
  const neighbors = new Set();
  for (const hyperedgeId of getIncidentHyperedgeIds(index, vertex)) {
    for (const member of getHyperedgeVertexIds(index, hyperedgeId)) if (member !== vertex) neighbors.add(member);
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

function measureIndex(graph) {
  const samplesMs = [];
  let index;
  for (let iteration = 0; iteration < 5; iteration += 1) {
    const start = performance.now();
    index = buildIncidenceIndex(graph);
    samplesMs.push(performance.now() - start);
  }
  const vertexIncidenceEntries = [...index.vertexToHyperedges.values()].reduce((sum, ids) => sum + ids.size, 0);
  const hyperedgeIncidenceEntries = [...index.hyperedgeToVertices.values()].reduce((sum, ids) => sum + ids.size, 0);
  return {
    ...index.counts,
    elapsedMsMedian: [...samplesMs].sort((left, right) => left - right)[2],
    samplesMs,
    mapEntries: index.hyperedgesById.size + index.vertexToHyperedges.size + index.hyperedgeToVertices.size,
    setEntries: vertexIncidenceEntries + hyperedgeIncidenceEntries,
  };
}

function pickCounts(measurement) {
  return { hyperedges: measurement.hyperedges, vertices: measurement.vertices, incidences: measurement.incidences };
}
