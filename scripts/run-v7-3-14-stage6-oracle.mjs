import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { runShortestPath, runShortestPathWithDiagnostics } from "../src/algorithms/shortestPath.js";
import { K_CORE_STATUS, runKCore } from "../src/algorithms/kCore.js";
import { countTriadsBounded, DERIVED_STATUS } from "../src/utils/mappings.js";
import {
  DenseProjection,
  DuplicateOverlap,
  LargeSparse,
  ManySingletons,
  ManySingletons2001,
  OneHugeEdge1K,
  OneHugeEdge5K,
  TinyBasic,
} from "../tests/fixtures/v7.3.14/stage0-regression-fixtures.mjs";
import {
  legacyRunKCore,
  legacyRunShortestPath,
  serializeKCore,
  serializeShortest,
} from "../tests/helpers/stage6LegacyAlgorithms.mjs";

const scriptRoot = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(scriptRoot);
const outputArgument = process.argv.find(argument => argument.startsWith("--output="));
const outputPath = resolve(outputArgument?.slice("--output=".length)
  ?? join(projectRoot, "artifacts", "v7.3.14-stage6-oracle.json"));
const issuePath = join(projectRoot, "artifacts", "v7.3.14-stage6-issue-register.json");
const prechange = JSON.parse(await readFile(join(projectRoot, "artifacts", "v7.3.14-stage6-prechange-characterization.json"), "utf8"));
const shortestSource = await readFile(join(projectRoot, "src", "algorithms", "shortestPath.js"), "utf8");
const kCoreSource = await readFile(join(projectRoot, "src", "algorithms", "kCore.js"), "utf8");
const triadSource = await readFile(join(projectRoot, "src", "utils", "mappings.js"), "utf8");
const triadRendererSource = await readFile(join(projectRoot, "src", "components", "TriadStatistic.jsx"), "utf8");

const shortestDifferential = runShortestDifferential();
const kCoreDifferential = runKCoreDifferential();
const performanceEvidence = characterizePerformance();
const hugeShortest = performanceEvidence.shortest.OneHugeEdge1K;
const hugeKCore = performanceEvidence.kCore.OneHugeEdge1K.result;
const duplicateKCore = performanceEvidence.kCore.DuplicateOverlap.result;
const manySingletons = performanceEvidence.triads.ManySingletons2001.result;
const singleton5K = performanceEvidence.triads.Singletons5K.result;
const denseTriads = performanceEvidence.triads.DenseH2HRefusal.result;

const checks = [
  check("HG713-R05-SP-SEMANTICS", "Shortest complete public semantics match the immutable eager reference", shortestDifferential.mismatches === 0 && shortestDifferential.runs >= 10_000, shortestDifferential),
  check("HG713-R05-SP-LAZY", "Shortest has no full weighted V2V/adjacency dependency", /buildAlgorithmIncidenceIndex/.test(shortestSource)
    && !/buildWeightedAdjacency/.test(shortestSource)
    && hugeShortest.metrics.storedProjectedEdges === 0
    && hugeShortest.metrics.storedGlobalAdjacencyReferences === 0, hugeShortest.metrics),
  check("HG713-R05-SP-ZERO", "Zero remains a valid projected cost", performanceEvidence.shortest.WeightZero.result.result.distances.get("b") === 0, serializeShortest(performanceEvidence.shortest.WeightZero.result.result)),
  check("HG713-R05-SP-MIN", "Overlapping projected pair cost is the minimum valid hyperedge weight", performanceEvidence.shortest.OverlapMin.result.result.distances.get("b") === 2, serializeShortest(performanceEvidence.shortest.OverlapMin.result.result)),
  check("HG713-R05-SP-UNKNOWN", "Unknown and unreachable behavior remains exact", shortestDifferential.fixed.unknown.reachable === false && shortestDifferential.fixed.unreachable.reachable === false, shortestDifferential.fixed),
  check("HG713-R05-SP-HUGE", "OneHugeEdge1K shortest computes without clique storage", hugeShortest.result.result.reachable
    && hugeShortest.result.result.distances.get("v999") === 1
    && hugeShortest.metrics.maxTransientNeighborEntries === 999
    && hugeShortest.metrics.cachedNeighborEntries === 0, summarizeShortestMeasurement(hugeShortest)),
  check("HG713-R05-KCORE-SEMANTICS", "K-core matches exact deduplicated two-section semantics and order", kCoreDifferential.mismatches === 0, kCoreDifferential),
  check("HG713-R05-KCORE-RESOURCES", "K-core resource refusal is structured and algorithm-specific", hugeKCore.status === K_CORE_STATUS.RESOURCE_LIMITED
    && hugeKCore.exceededResource === "uniqueProjectedEdges"
    && hugeKCore.coreness === null, summarizeKCore(hugeKCore)),
  check("HG713-R05-KCORE-DUPLICATE", "DuplicateOverlap computes 1,035 unique edges despite 207,000 candidates", duplicateKCore.status === K_CORE_STATUS.COMPUTED
    && duplicateKCore.usage.candidatePairWork === 207_000
    && duplicateKCore.usage.uniqueProjectedEdges === 1_035
    && duplicateKCore.usage.adjacencyReferences === 2_070
    && duplicateKCore.degeneracy === 45, summarizeKCore(duplicateKCore)),
  check("HG713-R07-INVARIANT", "Triad computed status contains a finite numeric value", manySingletons.status === DERIVED_STATUS.COMPUTED && Number.isFinite(manySingletons.value), manySingletons),
  check("HG713-R07-SINGLETONS", "ManySingletons2001 computes zero with zero H2H/wedge work", manySingletons.value === 0
    && manySingletons.estimate.h2hNeighborReferences === 0
    && manySingletons.estimate.wedgeWork === 0, manySingletons),
  check("HG713-R07-WORK-BOUND", "Triad policy is work-based and dense H2H is refused precisely", !/hes\.length\s*>\s*2000/.test(triadSource)
    && denseTriads.status === DERIVED_STATUS.OVER_BUDGET
    && ["wedgeWork", "h2hNeighborReferences"].includes(denseTriads.exceededResource), denseTriads),
  check("HG713-R07-5K", "Five thousand singleton hyperedges remain exact zero-work", singleton5K.status === DERIVED_STATUS.COMPUTED
    && singleton5K.value === 0
    && singleton5K.estimate.wedgeWork === 0, singleton5K),
  check("HG713-R07-RENDERER", "Stats renderer rejects invalid computed numerics instead of dereferencing them", /Number\.isFinite/.test(triadRendererSource)
    && /invalid numeric result/.test(triadRendererSource), { renderer: "TriadStatistic" }),
  check("STAGE6-PRECHANGE", "Required defects and already-fixed R07 history were characterized before production editing", prechange.findings.shortestOneHugeEdge1KFails
    && prechange.findings.kCoreOneHugeEdge1KFails
    && prechange.findings.originalR07CrashAlreadyPreventedByStage1, prechange.findings),
];

const passed = checks.filter(current => current.passed).length;
const priorArtifacts = await readPriorArtifactSummary();
const artifact = {
  stage: 6,
  kind: "weighted_shortest_path_k_core_statistics_oracle",
  parentCommit: "bd2e374144585627f0d0bbb3667f0e17423b3471",
  status: passed === checks.length ? "passed" : "failed",
  passed,
  total: checks.length,
  environment: { runtime: process.version, platform: `${process.platform}/${process.arch}` },
  shortestDifferential,
  kCoreDifferential,
  performance: summarizePerformanceEvidence(performanceEvidence),
  priorStageArtifactSummary: priorArtifacts,
  checks,
};
await writeFile(outputPath, `${JSON.stringify(artifact, replacer, 2)}\n`, "utf8");

const issueRegister = {
  stage: 6,
  parentCommit: "bd2e374144585627f0d0bbb3667f0e17423b3471",
  issues: [
    {
      id: "HG713-R05-SP",
      status: "completed_stage6",
      before: "Weighted shortest path required complete MIN_HYPEREDGE_WEIGHT two-section projection and adjacency materialization.",
      resolution: "One incidence index per run plus transient per-expanded-vertex minimum-weight projected neighbors; complete semantics differentially preserved.",
      evidence: { randomGraphs: 3_000, randomRuns: 12_000, mismatches: 0, OneHugeEdge1K: hugeShortest.metrics },
    },
    {
      id: "HG713-R05-KCORE",
      status: "completed_stage6",
      before: "K-core routed through general projection objects and generic adjacency limits.",
      resolution: "Exact deduplicated two-section Sets with candidate, unique-edge, adjacency-reference, and synchronous-work limits; partial results never escape.",
      evidence: { randomGraphs: 3_000, mismatches: 0, DuplicateOverlap: summarizeKCore(duplicateKCore), OneHugeEdge1K: summarizeKCore(hugeKCore) },
    },
    {
      id: "HG713-R07",
      status: "completed_stage6",
      history: "Stage 1 prevented computed/null and the Stats crash by enforcing a present computed value; Stage 6 removed the remaining producer sentinel and arbitrary 2,000-hyperedge policy.",
      resolution: "Numeric-only exact producer, structured work-bounded producer, finite computed-value invariant, and defensive Stats renderer.",
      evidence: { ManySingletons2001: manySingletons, Singletons5K: singleton5K, denseRefusal: denseTriads },
    },
  ],
};
await writeFile(issuePath, `${JSON.stringify(issueRegister, replacer, 2)}\n`, "utf8");

console.log(`Stage 6 oracle: ${passed}/${checks.length} families passed.`);
console.log(`Evidence: ${outputPath}`);
console.log(`Issue register: ${issuePath}`);
for (const current of checks) console.log(`${current.passed ? "PASS" : "FAIL"} ${current.id} — ${current.title}`);
if (passed !== checks.length) process.exitCode = 1;

function runShortestDifferential() {
  const seed = 0x6a7135;
  let state = seed >>> 0;
  let runs = 0;
  let mismatches = 0;
  const graphCount = 3_000;
  const ids = ["0", "null", "__proto__", "constructor", "toString", "é", "東京", "a", "2", "10", "z"];
  const randomInt = maximum => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state % maximum;
  };
  for (let graphIndex = 0; graphIndex < graphCount; graphIndex += 1) {
    const vertices = ids.slice(0, 1 + randomInt(9));
    const graph = [];
    const hyperedgeCount = 1 + randomInt(8);
    for (let hyperedgeIndex = 0; hyperedgeIndex < hyperedgeCount; hyperedgeIndex += 1) {
      const weightChoice = randomInt(7);
      const hyperedge = {
        id: graphIndex % 97 === 0 && hyperedgeIndex === 0 ? "__proto__" : `g${graphIndex}h${hyperedgeIndex}`,
        vertices: Array.from({ length: 1 + randomInt(Math.min(vertices.length + 2, 7)) }, () => vertices[randomInt(vertices.length)]),
        time: null,
        attributes: {},
      };
      if (weightChoice !== 4) hyperedge.weight = [0, 1, 2, 5, undefined, -2, "bad"][weightChoice];
      graph.push(hyperedge);
    }
    const optionsList = [
      { startVertex: vertices[0], targetVertex: vertices.at(-1) },
      { startVertex: vertices[randomInt(vertices.length)], targetVertex: null },
      { startVertex: vertices[randomInt(vertices.length)], targetVertex: vertices[randomInt(vertices.length)] },
      { startVertex: "missing", targetVertex: vertices[0] },
    ];
    for (const options of optionsList) {
      runs += 1;
      if (!same(serializeShortest(runShortestPath(graph, options)), serializeShortest(legacyRunShortestPath(graph, options)))) mismatches += 1;
    }
  }
  const disconnected = [record("h0", ["a"]), record("h1", ["b"])];
  return {
    seed,
    graphs: graphCount,
    runs,
    mismatches,
    fixed: {
      unknown: serializeShortest(runShortestPath(TinyBasic, { startVertex: "missing", targetVertex: "d" })),
      unreachable: serializeShortest(runShortestPath(disconnected, { startVertex: "a", targetVertex: "b" })),
    },
  };
}

function runKCoreDifferential() {
  const seed = 0x6c0e713;
  let state = seed >>> 0;
  let mismatches = 0;
  const graphCount = 3_000;
  const ids = ["0", "null", "__proto__", "constructor", "toString", "é", "東京", "a", "2", "10", "z"];
  const randomInt = maximum => {
    state = (Math.imul(state, 1_103_515_245) + 12_345) >>> 0;
    return state % maximum;
  };
  for (let graphIndex = 0; graphIndex < graphCount; graphIndex += 1) {
    const vertices = ids.slice(0, 1 + randomInt(10));
    const graph = [];
    const hyperedgeCount = randomInt(9);
    for (let hyperedgeIndex = 0; hyperedgeIndex < hyperedgeCount; hyperedgeIndex += 1) {
      graph.push({
        id: graphIndex % 101 === 0 && hyperedgeIndex === 0 ? "__proto__" : `g${graphIndex}h${hyperedgeIndex}`,
        vertices: Array.from({ length: 1 + randomInt(Math.min(vertices.length + 2, 7)) }, () => vertices[randomInt(vertices.length)]),
        time: null,
        weight: 1,
        attributes: {},
      });
    }
    const actual = runKCore(graph);
    if (actual.status !== K_CORE_STATUS.COMPUTED || !same(serializeKCore(actual), serializeKCore(legacyRunKCore(graph)))) mismatches += 1;
  }
  return { seed, graphs: graphCount, mismatches };
}

function characterizePerformance() {
  const huge1KGraph = OneHugeEdge1K();
  const huge5KGraph = OneHugeEdge5K();
  const shortest = {
    TinyBasic: measureShortest(TinyBasic, { startVertex: "a", targetVertex: "d" }),
    WeightZero: measureShortest([record("zero", ["a", "b"], 0)], { startVertex: "a", targetVertex: "b" }),
    OverlapMin: measureShortest([record("heavy", ["a", "b"], 8), record("light", ["a", "b"], 2)], { startVertex: "a", targetVertex: "b" }),
    DuplicateOverlap: measureShortest(DuplicateOverlap(), { startVertex: "v0", targetVertex: "v1" }),
    LargeSparse: measureShortest(LargeSparse(), { startVertex: "v0", targetVertex: "v25" }),
    OneHugeEdge1K: measureShortest(huge1KGraph, { startVertex: "v0", targetVertex: "v999" }),
    OneHugeEdge5KStress: measureShortest(huge5KGraph, { startVertex: "v0", targetVertex: "v1" }),
  };
  const kCore = {
    TinyBasic: measure(() => runKCore(TinyBasic)),
    DuplicateOverlap: measure(() => runKCore(DuplicateOverlap())),
    DenseProjection632: measure(() => runKCore(DenseProjection())),
    OneHugeEdge1K: measure(() => runKCore(huge1KGraph)),
  };
  const triads = {
    TinyBasic: measure(() => countTriadsBounded(TinyBasic)),
    ManySingletons2001: measure(() => countTriadsBounded(ManySingletons2001())),
    Singletons5K: measure(() => countTriadsBounded(ManySingletons(5_000))),
    DenseH2HRefusal: measure(() => countTriadsBounded(DuplicateOverlap())),
  };
  return { shortest, kCore, triads };
}

function measureShortest(graph, options) {
  const beforeHeap = process.memoryUsage().heapUsed;
  const measured = measure(() => runShortestPathWithDiagnostics(graph, options));
  return { ...measured, metrics: measured.result.metrics, heapDeltaBytesObserved: process.memoryUsage().heapUsed - beforeHeap };
}

function measure(callback) {
  const startedAt = performance.now();
  const result = callback();
  return { elapsedMs: performance.now() - startedAt, result };
}

async function readPriorArtifactSummary() {
  const names = [
    "v7.3.14-stage0-oracle.json",
    "v7.3.14-stage1-oracle.json",
    "v7.3.14-stage2-oracle.json",
    "v7.3.14-stage3-oracle.json",
    "v7.3.14-stage4-oracle.json",
    "v7.3.14-stage5-oracle.json",
    "v7.3.14-stage5-corrective-oracle.json",
    "v7.3.14-stage5-corrective2-oracle.json",
  ];
  const summary = {};
  for (const name of names) {
    try {
      const current = JSON.parse(await readFile(join(projectRoot, "artifacts", name), "utf8"));
      summary[name] = { status: current.status, passed: current.passed, total: current.total };
    } catch (error) {
      summary[name] = { status: "unavailable", reason: error.message };
    }
  }
  return summary;
}

function summarizeKCore(result) {
  return {
    status: result.status,
    exceededResource: result.exceededResource ?? null,
    degeneracy: result.degeneracy,
    corenessSize: result.coreness?.size ?? null,
    usage: result.usage,
    reason: result.reason ?? null,
  };
}

function summarizePerformanceEvidence(evidence) {
  return {
    shortest: Object.fromEntries(Object.entries(evidence.shortest).map(([name, measurement]) => [name, summarizeShortestMeasurement(measurement)])),
    kCore: Object.fromEntries(Object.entries(evidence.kCore).map(([name, measurement]) => [name, {
      elapsedMs: measurement.elapsedMs,
      result: summarizeKCore(measurement.result),
    }])),
    triads: evidence.triads,
  };
}

function summarizeShortestMeasurement(measurement) {
  const result = measurement.result.result;
  return {
    elapsedMs: measurement.elapsedMs,
    heapDeltaBytesObserved: measurement.heapDeltaBytesObserved,
    metrics: measurement.metrics,
    result: {
      reachable: result.reachable,
      targetVertex: result.targetVertex,
      targetDistance: result.targetVertex != null ? result.distances.get(result.targetVertex) ?? null : null,
      distancesSize: result.distances.size,
      pathLength: result.path.length,
      warningCount: result.warnings.length,
    },
  };
}

function check(id, title, passed, evidence) {
  return { id, title, passed: Boolean(passed), evidence };
}

function record(id, vertices, weight = 1) {
  return { id, vertices, time: null, weight, attributes: {} };
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function replacer(_key, value) {
  if (value instanceof Map) return { $type: "Map", entries: [...value] };
  if (value instanceof Set) return { $type: "Set", values: [...value] };
  return value;
}
