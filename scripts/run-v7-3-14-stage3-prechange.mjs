import { access, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { buildGraphEntityIndex } from "../src/graph/entityResolver.js";
import { buildV2H } from "../src/utils/mappings.js";
import { normalizeHyperedges } from "../src/utils/parsers.js";
import {
  DuplicateOverlap,
  LargeSparse,
  OneHugeEdge1K,
  OneHugeEdge5K,
  TinyBasic,
} from "../tests/fixtures/v7.3.14/stage0-regression-fixtures.mjs";

const scriptRoot = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(scriptRoot);
const outputArgument = process.argv.find(argument => argument.startsWith("--output="));
const outputPath = resolve(outputArgument?.slice("--output=".length)
  ?? join(projectRoot, "artifacts", "v7.3.14-stage3-prechange-characterization.json"));

const canonical = graph => normalizeHyperedges(graph, { identifierMode: "structured" }).hyperedges;
const fixtureEntries = [
  ["TinyBasic", canonical(TinyBasic)],
  ["LargeSparse", canonical(LargeSparse())],
  ["OneHugeEdge1K", canonical(OneHugeEdge1K())],
  ["OneHugeEdge5K", canonical(OneHugeEdge5K())],
  ["DuplicateOverlap", canonical(DuplicateOverlap())],
];

function counts(graph) {
  const vertices = new Set();
  let incidences = 0;
  for (const hyperedge of graph) {
    const unique = new Set(hyperedge.vertices);
    incidences += unique.size;
    for (const vertex of unique) vertices.add(vertex);
  }
  return { hyperedges: graph.length, vertices: vertices.size, incidences };
}

function measure(operation, repeats = 3) {
  const samples = [];
  let value;
  for (let index = 0; index < repeats; index += 1) {
    const start = performance.now();
    value = operation();
    samples.push(performance.now() - start);
  }
  return {
    elapsedMsMedian: [...samples].sort((left, right) => left - right)[Math.floor(samples.length / 2)],
    samplesMs: samples,
    value,
  };
}

const baselineMeasurements = {};
for (const [name, graph] of fixtureEntries) {
  const v2h = measure(() => buildV2H(graph));
  const entity = measure(() => buildGraphEntityIndex(graph));
  baselineMeasurements[name] = {
    ...counts(graph),
    buildV2HElapsedMsMedian: v2h.elapsedMsMedian,
    graphEntityIndexElapsedMsMedian: entity.elapsedMsMedian,
    v2hRows: v2h.value.length,
    entityHyperedgeEntries: entity.value.hyperedgesById.size,
    entityVertexEntries: entity.value.verticesById.size,
  };
}

const targetModule = join(projectRoot, "src", "graph", "incidenceIndex.js");
let explicitIncidenceIndexExists = true;
try { await access(targetModule, constants.F_OK); }
catch { explicitIncidenceIndexExists = false; }

const appSource = await readFile(join(projectRoot, "src", "App.jsx"), "utf8");
const graphIdentitySource = await readFile(join(projectRoot, "src", "graph", "graphIdentity.js"), "utf8");
const artifact = {
  stage: 3,
  kind: "prechange_architecture_characterization",
  parentCommit: "e84732d773584b99592ae827b0e33616aecde090",
  explicitReusableIncidenceIndexExists: explicitIncidenceIndexExists,
  nearExistingAbstraction: {
    path: "src/graph/entityResolver.js",
    assessment: "buildGraphEntityIndex is resolver-specific and incomplete: it exposes hyperedgesById and verticesById arrays, string-coerces IDs, amplifies duplicate membership, and has no hyperedgeToVertices relation or explicit ordering/immutability contract.",
  },
  canonicalOwnership: {
    state: "AppCore hes/finalHes canonical hyperedge array",
    commitPath: "App.jsx commitGraph(nextHyperedges, ...)",
    graphIdentity: "src/graph/graphIdentity.js nextCommittedGraphIdentity",
    graphVersionIncrementsOnFingerprintChange: /graphVersion:\s*\(previous\?\.graphVersion\s*\?\?\s*0\)\s*\+\s*1/.test(graphIdentitySource),
    appOwnsCommitGraph: /const commitGraph = useCallback/.test(appSource),
  },
  incidenceLikeRebuildInventory: [
    { path: "src/utils/mappings.js", consumers: ["buildV2H", "buildH2H", "estimateH2HNeighborReferences", "computeStats", "countTriads"], classification: "mapping/statistics functions independently rebuild vertex membership or degree maps" },
    { path: "src/algorithms/projection.js", consumers: ["buildTwoSectionProjection", "buildTwoSectionProjectionSafely"], classification: "pairwise V2V projection enumerates co-membership pairs" },
    { path: "src/algorithms/graphModel.js", consumers: ["buildAdjacencyList", "buildWeightedAdjacency", "getAllVertices"], classification: "algorithm adapter constructs projected adjacency and independently collects vertices" },
    { path: "src/components/Viz.jsx", consumers: ["verts", "hiHEs"], classification: "preview independently derives vertices and scans hyperedge membership for selection highlighting" },
    { path: "src/graph/entityResolver.js", consumers: ["buildGraphEntityIndex"], classification: "reference resolution builds a partial resolver-specific vertex-to-hyperedge index" },
    { path: "src/App.jsx", consumers: ["v2h useMemo", "vertex-count summaries"], classification: "dashboard materializes V2H and independently counts unique vertices" },
  ],
  baselineEnvironment: {
    runtime: process.version,
    platform: `${process.platform}/${process.arch}`,
    note: "Node measurements characterize this machine only; they are not browser scalability claims.",
  },
  baselineMeasurements,
};

await writeFile(outputPath, JSON.stringify(artifact, null, 2) + "\n", "utf8");
console.log("Stage 3 pre-change architecture characterization captured.");
console.log("Explicit reusable incidence index exists: " + explicitIncidenceIndexExists);
console.log("Evidence: " + outputPath);
