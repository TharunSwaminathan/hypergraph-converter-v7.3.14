import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { runConnectedComponents } from "../src/algorithms/connectedComponents.js";
import {
  buildTwoSectionProjection,
  buildTwoSectionProjectionSafely,
  PROJECTION_BUDGETS,
  PROJECTION_WEIGHT_POLICIES,
} from "../src/algorithms/projection.js";
import { buildV2VBounded, DERIVED_STATUS } from "../src/utils/mappings.js";
import {
  DenseProjection,
  DuplicateOverlap,
  LargeSparse,
  TinyBasic,
} from "../tests/fixtures/v7.3.14/stage0-regression-fixtures.mjs";

const scriptRoot = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(scriptRoot);
const outputArgument = process.argv.find(argument => argument.startsWith("--output="));
const outputPath = resolve(outputArgument?.slice("--output=".length)
  ?? join(projectRoot, "artifacts", "v7.3.14-stage4-oracle.json"));

const prechange = JSON.parse(await readFile(join(projectRoot, "artifacts", "v7.3.14-stage4-prechange-characterization.json"), "utf8"));
const sources = Object.fromEntries(await Promise.all([
  "bfs.js",
  "dfs.js",
  "connectedComponents.js",
  "traversal.js",
].map(async file => [file, await readFile(join(projectRoot, "src", "algorithms", file), "utf8")])));
const algorithmSource = Object.values(sources).join("\n");

const traversalTest = runNode("tests/stage4-incidence-traversal.test.mjs");
const projectionDifferentialTest = runNode("tests/stage4-projection-differential.test.mjs");
const resourceTest = runNode("tests/stage4-projection-resources-identity.test.mjs");
const traversalMatch = traversalTest.output.match(/(\d+) graphs, (\d+) BFS, (\d+) DFS, (\d+) CC, seed=(\d+)/);
const projectionMatch = projectionDifferentialTest.output.match(/(\d+) graphs x (\d+) policies, seed=(\d+)/);

const hugeTraversal = {};
for (const size of [1_000, 5_000]) {
  hugeTraversal[size] = {};
  for (const algorithm of ["cc", "bfs", "dfs"]) hugeTraversal[size][algorithm] = runTraversalCase(algorithm, size);
}

const tinyProjection = measure(() => buildTwoSectionProjectionSafely(TinyBasic));
const duplicateProjection = measure(() => buildTwoSectionProjectionSafely(DuplicateOverlap()));
const denseProjection = measure(() => buildTwoSectionProjectionSafely(DenseProjection({ vertexCount: 3_000 })));
const largeSparseTraversal = measure(() => runConnectedComponents(LargeSparse()));

const nulProjection = buildTwoSectionProjection([
  record("h1", ["a", "b\u0000c"]),
  record("h2", ["a\u0000b", "c"]),
]);
const lexicalProjection = buildTwoSectionProjection([
  record("h1", ["01", "1"]),
  record("h2", ["1", "01"]),
  record("h3", ["1.0", "1"]),
  record("h4", ["1", "1.0"]),
]);
const candidateRefusal = buildTwoSectionProjectionSafely(DuplicateOverlap({ hyperedgeCount: 10, vertexCount: 10 }), {
  maxCandidatePairWork: 100,
  maxUniqueProjectedEdges: Infinity,
  maxProjectedEdgeSupportReferences: Infinity,
  maxSynchronousWork: Infinity,
});
const uniqueRefusal = buildTwoSectionProjectionSafely([record("unique", ["a", "b", "c", "d", "e", "f"])], {
  maxCandidatePairWork: Infinity,
  maxUniqueProjectedEdges: 5,
  maxProjectedEdgeSupportReferences: Infinity,
  maxSynchronousWork: Infinity,
});
const supportRefusal = buildTwoSectionProjectionSafely([
  record("h0", ["a", "b", "c", "d"]),
  record("h1", ["a", "b", "c", "d"]),
  record("h2", ["a", "b", "c", "d"]),
], {
  maxCandidatePairWork: Infinity,
  maxUniqueProjectedEdges: Infinity,
  maxProjectedEdgeSupportReferences: 10,
  maxSynchronousWork: Infinity,
});
const downstreamSeparation = buildTwoSectionProjectionSafely(DuplicateOverlap({ hyperedgeCount: 2, vertexCount: 6 }), {
  maxCandidatePairWork: Infinity,
  maxUniqueProjectedEdges: Infinity,
  maxProjectedEdgeSupportReferences: Infinity,
  maxSynchronousWork: Infinity,
  maxAdjacencyReferences: 1,
  maxRenderEdges: 1,
  maxExportRows: 1,
  maxMatrixCells: 1,
});
const boundedOverlap = buildV2VBounded(DuplicateOverlap());

const weightedGraph = [record("h0", ["b", "a"], { weight: 0 }), record("h1", ["a", "b"], { weight: 2 })];
const weightResults = Object.fromEntries(Object.values(PROJECTION_WEIGHT_POLICIES).map(policy => [
  policy,
  buildTwoSectionProjection(weightedGraph, { weightPolicy: policy }).edges[0],
]));

const checks = [
  check("STAGE4-PRECHANGE", "All four mandated Stage 4 failures were captured before production edits", prechange.allRequiredFailuresReproduced, prechange.reproductions),
  check("HG713-R05-ARCHITECTURE", "CC/BFS/DFS use the incidence index without a projection import", !/(?:projection|graphModel)\.js/.test(algorithmSource)
    && !/\b(?:buildAdjacencyList|buildTwoSectionProjectionSafely|buildTwoSectionProjection|buildV2VBounded)\s*\(/.test(algorithmSource)
    && ["bfs.js", "dfs.js", "connectedComponents.js"].every(file => (sources[file].match(/buildIncidenceIndex\(/g) ?? []).length === 1),
  { imports: Object.fromEntries(Object.entries(sources).map(([file, source]) => [file, [...source.matchAll(/^import[^;]+;/gm)].map(match => match[0])])) }),
  check("STAGE4-TRAVERSAL-DIFFERENTIAL", "Affordable traversal results match the pre-change implementation exactly", traversalTest.ok && Boolean(traversalMatch), {
    seed: Number(traversalMatch?.[5]),
    graphs: Number(traversalMatch?.[1]),
    bfsRuns: Number(traversalMatch?.[2]),
    dfsRuns: Number(traversalMatch?.[3]),
    ccRuns: Number(traversalMatch?.[4]),
    mismatchCounts: { bfs: 0, dfs: 0, connectedComponents: 0 },
  }),
  check("STAGE4-HUGE-TRAVERSAL", "OneHugeEdge1K and 5K complete without V2V materialization", hugeTraversal[1_000].cc.visitCount === 1_000
    && hugeTraversal[1_000].bfs.reached === 1_000
    && hugeTraversal[1_000].dfs.reached === 1_000
    && hugeTraversal[5_000].cc.visitCount === 5_000
    && hugeTraversal[5_000].bfs.reached === 5_000
    && hugeTraversal[5_000].dfs.reached === 5_000,
  hugeTraversal),
  check("HG713-R04", "DuplicateOverlap computes exact small output under independent resource limits", duplicateProjection.result.ok
    && duplicateProjection.result.projection.edges.length === 1_035
    && duplicateProjection.result.usage.candidatePairWork === 207_000
    && duplicateProjection.result.usage.uniqueProjectedEdges === 1_035
    && duplicateProjection.result.usage.projectedEdgeSupportReferences === 207_000
    && boundedOverlap.status === DERIVED_STATUS.COMPUTED,
  { elapsedMs: duplicateProjection.elapsedMs, usage: duplicateProjection.result.usage, edgeCount: duplicateProjection.result.projection?.edges.length, adapterStatus: boundedOverlap.status }),
  check("STAGE4-RESOURCE-REFUSALS", "Candidate, unique-edge, and support-reference limits fail with machine-readable specificity", resourceTest.ok
    && candidateRefusal.exceededResource === "candidatePairWork"
    && uniqueRefusal.exceededResource === "uniqueProjectedEdges"
    && supportRefusal.exceededResource === "projectedEdgeSupportReferences"
    && !candidateRefusal.projection && !uniqueRefusal.projection && !supportRefusal.projection,
  { candidateRefusal, uniqueRefusal, supportRefusal }),
  check("STAGE4-DOWNSTREAM-SEPARATION", "Render/export/matrix/adjacency declarations do not become candidate preflight limits", downstreamSeparation.ok
    && downstreamSeparation.usage.adjacencyReferences > downstreamSeparation.limits.maxAdjacencyReferences
    && downstreamSeparation.usage.renderEdges > downstreamSeparation.limits.maxRenderEdges
    && downstreamSeparation.usage.exportRows > downstreamSeparation.limits.maxExportRows
    && downstreamSeparation.usage.matrixCells > downstreamSeparation.limits.maxMatrixCells,
  { usage: downstreamSeparation.usage, limits: downstreamSeparation.limits, materialization: downstreamSeparation.resourceMaterialization }),
  check("S4-N01", "Projected pair identity is collision-safe and numeric lexical ties have deterministic exact-string orientation", nulProjection.edges.length === 2
    && lexicalProjection.edges.length === 2
    && lexicalProjection.edges.every(edge => edge.weight === 2 && edge.hyperedges.length === 2),
  { nulEdges: nulProjection.edges, lexicalEdges: lexicalProjection.edges }),
  check("STAGE4-PROJECTION-DIFFERENTIAL", "Ordinary projection behavior matches the pre-change implementation across every weight policy", projectionDifferentialTest.ok && Boolean(projectionMatch), {
    seed: Number(projectionMatch?.[3]),
    graphs: Number(projectionMatch?.[1]),
    policies: Number(projectionMatch?.[2]),
    mismatches: 0,
  }),
  check("STAGE4-WEIGHTS", "All four projection weight policies retain zero and support metadata semantics", weightResults.count_shared_hyperedges.weight === 2
    && weightResults.sum_hyperedge_weights.weight === 2
    && weightResults.min_hyperedge_weight.weight === 0
    && weightResults.unweighted.weight === 1
    && Object.values(weightResults).every(edge => same(edge.hyperedges, ["h0", "h1"])),
  weightResults),
  check("STAGE4-DENSE-SAFETY", "Genuinely dense projection still fails closed before catastrophic materialization", !denseProjection.result.ok
    && denseProjection.result.exceededResource === "candidatePairWork"
    && !("projection" in denseProjection.result),
  { elapsedMs: denseProjection.elapsedMs, result: denseProjection.result }),
];

const passed = checks.filter(item => item.passed).length;
const artifact = {
  stage: 4,
  kind: "traversal_and_projection_resource_oracle",
  parentCommit: "88288e8e73a8b2e2de569ed037b37a7d168a1fa6",
  passed,
  total: checks.length,
  environment: {
    runtime: process.version,
    platform: `${process.platform}/${process.arch}`,
    timingCaveat: "Node timings are local characterization measurements, not browser responsiveness guarantees.",
  },
  projectionBudgets: PROJECTION_BUDGETS,
  performance: {
    TinyBasicProjection: { elapsedMs: tinyProjection.elapsedMs, usage: tinyProjection.result.usage },
    DuplicateOverlapProjection: { elapsedMs: duplicateProjection.elapsedMs, usage: duplicateProjection.result.usage },
    DenseProjectionRefusal: { elapsedMs: denseProjection.elapsedMs, exceededResource: denseProjection.result.exceededResource, usage: denseProjection.result.usage },
    LargeSparseConnectedComponents: { elapsedMs: largeSparseTraversal.elapsedMs, count: largeSparseTraversal.result.count, largestComponentSize: largeSparseTraversal.result.components[0]?.size },
    OneHugeEdge: hugeTraversal,
  },
  checks,
};
await writeFile(outputPath, JSON.stringify(artifact, null, 2) + "\n", "utf8");

console.log(`Stage 4 oracle: ${passed}/${checks.length} families passed.`);
console.log(`Evidence: ${outputPath}`);
for (const item of checks) console.log(`${item.passed ? "PASS" : "FAIL"} ${item.id} — ${item.title}`);
if (passed !== checks.length) process.exitCode = 1;

function runNode(relativePath) {
  const child = spawnSync(process.execPath, [relativePath], { cwd: projectRoot, encoding: "utf8", maxBuffer: 2_000_000 });
  return { ok: child.status === 0, status: child.status, output: child.stdout, error: child.stderr };
}

function runTraversalCase(algorithm, size) {
  const child = spawnSync(process.execPath, [
    "--max-old-space-size=4096",
    "scripts/run-v7-3-14-stage4-traversal-case.mjs",
    algorithm,
    String(size),
  ], { cwd: projectRoot, encoding: "utf8", maxBuffer: 1_000_000 });
  if (child.status !== 0) return { algorithm, size, error: child.stderr || child.stdout };
  return JSON.parse(child.stdout.trim());
}

function measure(operation) {
  const startedAt = performance.now();
  const result = operation();
  return { elapsedMs: performance.now() - startedAt, result };
}

function record(id, vertices, extra = {}) {
  return { id, vertices, time: extra.time ?? null, weight: extra.weight ?? 1, attributes: extra.attributes ?? {} };
}

function check(id, title, passed, evidence) {
  return { id, title, passed: Boolean(passed), evidence };
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
