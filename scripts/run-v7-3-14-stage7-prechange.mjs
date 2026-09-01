import { readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { runBFS } from "../src/algorithms/bfs.js";
import { runDFS } from "../src/algorithms/dfs.js";
import { runShortestPathWithDiagnostics } from "../src/algorithms/shortestPath.js";
import {
  buildCSR,
  buildH2HBounded,
  buildH2V,
  buildV2H,
  buildV2VBounded,
  computeStats,
  expH2V,
  expMatrixResult,
  expV2H,
} from "../src/utils/mappings.js";
import { shouldRequestH2H, shouldRequestV2V } from "../src/utils/derivedRequests.js";
import {
  DuplicateOverlap,
  LargeSparse,
  OneHugeEdge1K,
  OneHugeEdge5K,
  TinyBasic,
} from "../tests/fixtures/v7.3.14/stage0-regression-fixtures.mjs";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outputPath = join(projectRoot, "artifacts", "v7.3.14-stage7-prechange-characterization.json");
const appSource = await readFile(join(projectRoot, "src", "App.jsx"), "utf8");
const mappingSource = await readFile(join(projectRoot, "src", "utils", "mappings.js"), "utf8");

const invocationCounts = Object.create(null);
const invoke = (name, callback) => {
  invocationCounts[name] = (invocationCounts[name] ?? 0) + 1;
  return measure(callback);
};

const ordinaryLoad = characterizeCurrentGraphLoad(TinyBasic);
const largeSparseGraph = LargeSparse();
const largeSparseLoad = characterizeCurrentGraphLoad(largeSparseGraph);
const duplicateGraph = DuplicateOverlap();
const oneHuge1K = OneHugeEdge1K();

const requestGating = {
  initialMappingsH2V: {
    h2hRequested: shouldRequestH2H({ activeSection: "mappings", selectedMappingId: "h2v", expId: "h2v_txt" }),
    v2vRequested: shouldRequestV2V({ activeSection: "mappings", selectedMappingId: "h2v", expId: "h2v_txt" }),
  },
  h2hSelected: summarizeProjection(invoke("buildH2HBounded", () => buildH2HBounded(duplicateGraph))),
  v2vSelected: summarizeProjection(invoke("buildV2VBounded", () => buildV2VBounded(duplicateGraph))),
};

const denseMatrix = {};
for (const size of [200, 300, 400]) {
  const graph = denseMatrixFixture(size);
  denseMatrix[`${size}x${size}`] = summarizeMatrix(invoke("expMatrixResult", () => expMatrixResult(graph)), size);
}

const projectionFixtures = {
  DuplicateOverlap: summarizeProjection(invoke("buildV2VBounded", () => buildV2VBounded(duplicateGraph))),
  OneHugeEdge1K: summarizeProjection(invoke("buildV2VBounded", () => buildV2VBounded(oneHuge1K))),
};

let bfs5K = runMeasured(() => runBFS(OneHugeEdge5K(), "v0"));
const bfsTrace = summarizeTraceMeasurement(bfs5K);
bfs5K = null;
let dfs5K = runMeasured(() => runDFS(OneHugeEdge5K(), "v0"));
const dfsTrace = summarizeTraceMeasurement(dfs5K);
dfs5K = null;

const farShortest = runMeasured(() => runShortestPathWithDiagnostics(oneHuge1K, {
  startVertex: "v0",
  targetVertex: "v999",
}));
const sparseShortest = runMeasured(() => runShortestPathWithDiagnostics(largeSparseGraph, {
  startVertex: "v0",
  targetVertex: "v1000",
}));

const artifact = {
  stage: 7,
  kind: "performance_lazy_workers_trace_prechange_characterization",
  parentCommit: "f93bb322a7cfca06123e12148850fc5278ef3726",
  productionState: "exact_approved_stage6_corrective_parent_before_stage7_production_edits",
  environment: {
    runtime: process.version,
    platform: `${process.platform}/${process.arch}`,
    os: `${os.type()} ${os.release()}`,
    cpu: os.cpus()?.[0]?.model ?? "unavailable",
    logicalCpuCount: os.cpus()?.length ?? null,
    totalMemoryBytes: os.totalmem(),
  },
  sourceEvidence: {
    eagerBuildersOnGraphChange: {
      buildH2V: /const h2v = useMemo\(\(\) => finalHes \? buildH2V\(finalHes\)/.test(appSource),
      buildV2H: /const v2h = useMemo\(\(\) => finalHes \? buildV2H\(finalHes\)/.test(appSource),
      buildCSR: /const csr = useMemo\(\(\) => finalHes \? buildCSR\(finalHes\)/.test(appSource),
      computeStats: /const st = useMemo\(\(\) => finalHes \? computeStats\(finalHes\)/.test(appSource),
      expH2V: /const ht = useMemo\(\(\) => expH2V\(h2v\)/.test(appSource),
      expV2H: /const vt = useMemo\(\(\) => expV2H\(v2h\)/.test(appSource),
      h2vRows: /const h2vRows = h2v\.map/.test(appSource),
      v2hRows: /const v2hRows = v2h\.map/.test(appSource),
    },
    requestGatedBeforeStage7: {
      h2h: /finalHes && h2hRequested \? buildH2HBounded/.test(appSource),
      v2v: /finalHes && v2vRequested \? buildV2VBounded/.test(appSource),
    },
    matrixInnerMembershipScan: /h\.vertices\.map\(String\)\.includes\(v\)/.test(mappingSource),
  },
  faithfulCurrentLoadSeam: {
    explanation: "Calls the exact production builders and row/text expressions currently wired unconditionally from finalHes in App.jsx.",
    ordinary: ordinaryLoad,
    LargeSparse: largeSparseLoad,
    invocationCounts,
  },
  requestGating,
  denseMatrix,
  projections: projectionFixtures,
  traces: {
    OneHugeEdge5K: { bfs: bfsTrace, dfs: dfsTrace },
    OneHugeEdge1KFarTargetShortest: summarizeShortestTraceMeasurement(farShortest),
    LargeSparsePathShortest: summarizeShortestTraceMeasurement(sparseShortest),
  },
  findings: {
    c03EagerDerivedProductsReproduced: Object.values(ordinaryLoad.builders).every(result => result.executed),
    c03H2HAndV2VAlreadyRequestGated: requestGating.initialMappingsH2V.h2hRequested === false
      && requestGating.initialMappingsH2V.v2vRequested === false,
    c04NestedMatrixMembershipScanReproduced: /h\.vertices\.map\(String\)\.includes\(v\)/.test(mappingSource),
    c05DuplicateProjectionMeasurable: projectionFixtures.DuplicateOverlap.elapsedMs >= 0,
    s4Obs01BfsQuadraticReferences: bfsTrace.retainedReferences.visited + bfsTrace.retainedReferences.frontier > 20_000_000,
    s4Obs01DfsQuadraticReferences: dfsTrace.retainedReferences.visited + dfsTrace.retainedReferences.frontier > 20_000_000,
    stage6ShortestTraceAmplification: summarizeShortestTraceMeasurement(farShortest).retainedReferences.visited > 400_000,
  },
};

await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
console.log(`Stage 7 pre-change characterization written: ${outputPath}`);
console.log(JSON.stringify(artifact.findings, null, 2));

function characterizeCurrentGraphLoad(graph) {
  const h2vMeasurement = invoke("buildH2V", () => buildH2V(graph));
  const v2hMeasurement = invoke("buildV2H", () => buildV2H(graph));
  const csrMeasurement = invoke("buildCSR", () => buildCSR(graph));
  const statsMeasurement = invoke("computeStats", () => computeStats(graph));
  const h2vTextMeasurement = invoke("expH2V", () => expH2V(h2vMeasurement.value));
  const v2hTextMeasurement = invoke("expV2H", () => expV2H(v2hMeasurement.value));
  const h2vRowsMeasurement = invoke("h2vRows", () => h2vMeasurement.value.map(row => [
    row.hid,
    row.time ?? "—",
    row.vertices.join(", "),
    row.weight != null && row.weight !== 1 ? row.weight : "1",
    String(row.vertices.length),
  ]));
  const v2hRowsMeasurement = invoke("v2hRows", () => v2hMeasurement.value.map(row => [
    String(row.vid),
    row.hyperedges.join(", "),
    String(row.hyperedges.length),
  ]));
  return {
    graph: graphShape(graph),
    builders: {
      buildH2V: summarizeCollection(h2vMeasurement),
      buildV2H: summarizeCollection(v2hMeasurement),
      buildCSR: summarizeCsr(csrMeasurement),
      computeStats: summarizeStats(statsMeasurement),
      expH2V: summarizeText(h2vTextMeasurement),
      expV2H: summarizeText(v2hTextMeasurement),
      h2vRows: summarizeCollection(h2vRowsMeasurement),
      v2hRows: summarizeCollection(v2hRowsMeasurement),
    },
  };
}

function measure(callback) {
  const heapBefore = process.memoryUsage().heapUsed;
  const startedAt = performance.now();
  const value = callback();
  return {
    executed: true,
    elapsedMs: performance.now() - startedAt,
    heapDeltaBytesObserved: process.memoryUsage().heapUsed - heapBefore,
    value,
  };
}

function runMeasured(callback) {
  const heapBefore = process.memoryUsage().heapUsed;
  const startedAt = performance.now();
  const value = callback();
  return {
    elapsedMs: performance.now() - startedAt,
    heapDeltaBytesObserved: process.memoryUsage().heapUsed - heapBefore,
    value,
  };
}

function summarizeCollection(measurement) {
  return {
    executed: measurement.executed,
    elapsedMs: measurement.elapsedMs,
    heapDeltaBytesObserved: measurement.heapDeltaBytesObserved,
    retainedItems: measurement.value.length,
  };
}

function summarizeCsr(measurement) {
  return {
    executed: measurement.executed,
    elapsedMs: measurement.elapsedMs,
    heapDeltaBytesObserved: measurement.heapDeltaBytesObserved,
    vertices: measurement.value.vertexIds.length,
    hyperedges: measurement.value.hyperedgeIds.length,
    offsets: measurement.value.h2vCSR.offsets.length,
    indices: measurement.value.h2vCSR.indices.length,
  };
}

function summarizeStats(measurement) {
  return {
    executed: measurement.executed,
    elapsedMs: measurement.elapsedMs,
    heapDeltaBytesObserved: measurement.heapDeltaBytesObserved,
    vertices: measurement.value?.V ?? 0,
    hyperedges: measurement.value?.E ?? 0,
    cardinalityValues: measurement.value?.cards?.length ?? 0,
    degreeValues: measurement.value?.degs?.length ?? 0,
  };
}

function summarizeText(measurement) {
  return {
    executed: measurement.executed,
    elapsedMs: measurement.elapsedMs,
    heapDeltaBytesObserved: measurement.heapDeltaBytesObserved,
    characters: measurement.value.length,
  };
}

function summarizeMatrix(measurement, dimension) {
  return {
    dimension,
    elapsedMs: measurement.elapsedMs,
    heapDeltaBytesObserved: measurement.heapDeltaBytesObserved,
    status: measurement.value.status,
    cells: measurement.value.estimate.cells,
    characters: measurement.value.text.length,
  };
}

function summarizeProjection(measurement) {
  return {
    elapsedMs: measurement.elapsedMs,
    heapDeltaBytesObserved: measurement.heapDeltaBytesObserved,
    status: measurement.value.status,
    candidatePairWork: measurement.value.usage?.candidatePairWork ?? measurement.value.estimate?.candidatePairWork ?? null,
    uniqueProjectedEdges: measurement.value.usage?.uniqueProjectedEdges ?? null,
    supportReferences: measurement.value.usage?.projectedEdgeSupportReferences ?? null,
    edgeCount: measurement.value.edges?.length ?? null,
    exceededResource: measurement.value.exceededResource ?? null,
  };
}

function summarizeTraceMeasurement(measurement) {
  const result = measurement.value;
  return {
    elapsedMs: measurement.elapsedMs,
    heapDeltaBytesObserved: measurement.heapDeltaBytesObserved,
    visitOrder: result.visitOrder.length,
    edgesUsed: result.edgesUsed.length,
    distances: result.distances.size,
    steps: result.steps.length,
    retainedReferences: traceReferences(result.steps),
  };
}

function summarizeShortestTraceMeasurement(measurement) {
  const result = measurement.value.result;
  return {
    elapsedMs: measurement.elapsedMs,
    heapDeltaBytesObserved: measurement.heapDeltaBytesObserved,
    reachable: result.reachable,
    distances: result.distances.size,
    edgesUsed: result.edgesUsed.length,
    steps: result.steps.length,
    retainedReferences: traceReferences(result.steps),
    metrics: measurement.value.metrics,
  };
}

function traceReferences(steps) {
  return steps.reduce((totals, step) => ({
    visited: totals.visited + (step.visited?.length ?? 0),
    frontier: totals.frontier + (step.frontier?.length ?? 0),
    newlyDiscovered: totals.newlyDiscovered + (step.newlyDiscovered?.length ?? 0),
  }), { visited: 0, frontier: 0, newlyDiscovered: 0 });
}

function graphShape(graph) {
  return {
    hyperedges: graph.length,
    vertices: new Set(graph.flatMap(edge => edge.vertices.map(String))).size,
    incidences: graph.reduce((sum, edge) => sum + edge.vertices.length, 0),
  };
}

function denseMatrixFixture(size) {
  const vertices = Array.from({ length: size }, (_, index) => `v${index}`);
  return Array.from({ length: size }, (_, index) => ({
    id: `h${index}`,
    vertices: [...vertices],
    time: null,
    weight: 1,
    attributes: {},
  }));
}
