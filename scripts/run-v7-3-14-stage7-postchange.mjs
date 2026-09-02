import { readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { runBFS } from "../src/algorithms/bfs.js";
import { getTraceStorageSummary } from "../src/algorithms/compactTrace.js";
import { runDFS } from "../src/algorithms/dfs.js";
import { runShortestPathWithDiagnostics } from "../src/algorithms/shortestPath.js";
import { createDerivedProductCache } from "../src/derived/derivedProductCache.js";
import { buildMappingPresentation } from "../src/derived/mappingPresentation.js";
import { chooseDerivedExecutionPolicy } from "../src/derived/derivedWorkerClient.js";
import {
  buildCSR,
  buildH2V,
  buildV2H,
  computeStats,
  csvDocument,
  expMatrixResult,
} from "../src/utils/mappings.js";
import {
  shouldRequestCSR,
  shouldRequestH2V,
  shouldRequestMatrix,
  shouldRequestV2H,
} from "../src/utils/derivedRequests.js";
import { vcmp } from "../src/utils/parsers.js";
import {
  LargeSparse,
  OneHugeEdge1K,
  OneHugeEdge5K,
  TinyBasic,
} from "../tests/fixtures/v7.3.14/stage0-regression-fixtures.mjs";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outputPath = join(projectRoot, "artifacts", "v7.3.14-stage7-oracle.json");
const appSource = await readFile(join(projectRoot, "src", "App.jsx"), "utf8");
const mappingSource = await readFile(join(projectRoot, "src", "utils", "mappings.js"), "utf8");

const lazyInvocationEvidence = characterizeLazyRequests(TinyBasic);
const denseMatrix = {};
for (const size of [200, 300, 400]) {
  const graph = denseMatrixFixture(size);
  const indexed = measure(() => expMatrixResult(graph));
  const legacy = measure(() => legacyMatrix(graph));
  denseMatrix[`${size}x${size}`] = {
    indexedElapsedMs: indexed.elapsedMs,
    legacyElapsedMs: legacy.elapsedMs,
    exactByteMatch: indexed.value.text === legacy.value,
    status: indexed.value.status,
    cells: indexed.value.estimate.cells,
    characters: indexed.value.text.length,
    budgetUnchanged: indexed.value.limits.matrixMaxCells === 1_000_000
      && indexed.value.limits.matrixMaxEstimatedBytes === 4_000_000,
  };
}

const oneHuge5K = OneHugeEdge5K();
const oneHuge1K = OneHugeEdge1K();
const largeSparse = LargeSparse();
const traceRuns = {
  OneHugeEdge5K: {
    bfs: summarizeTrace(measure(() => runBFS(oneHuge5K, "v0"))),
    dfs: summarizeTrace(measure(() => runDFS(oneHuge5K, "v0"))),
  },
  OneHugeEdge1KFarTargetShortest: summarizeShortest(measure(() => runShortestPathWithDiagnostics(oneHuge1K, {
    startVertex: "v0",
    targetVertex: "v999",
  }))),
  LargeSparsePathShortest: summarizeShortest(measure(() => runShortestPathWithDiagnostics(largeSparse, {
    startVertex: "v0",
    targetVertex: "v1000",
  }))),
};

const artifact = {
  stage: 7,
  kind: "performance_lazy_workers_trace_postchange_oracle",
  parentCommit: "f93bb322a7cfca06123e12148850fc5278ef3726",
  stage7CommitsAtMeasurement: [
    "162c8c5 stage-7: record prechange performance contracts",
    "add08af stage-7: add lazy derived workers and compact traces",
    "4caef42 stage-7: keep line graph cache projection-scoped",
  ],
  environment: {
    runtime: process.version,
    platform: `${process.platform}/${process.arch}`,
    os: `${os.type()} ${os.release()}`,
    cpu: os.cpus()?.[0]?.model ?? "unavailable",
    logicalCpuCount: os.cpus()?.length ?? null,
    totalMemoryBytes: os.totalmem(),
  },
  sourceEvidence: {
    priorEagerBuildersRemoved: {
      buildH2V: !/const h2v = useMemo\(\(\) => finalHes \? buildH2V\(finalHes\)/.test(appSource),
      buildV2H: !/const v2h = useMemo\(\(\) => finalHes \? buildV2H\(finalHes\)/.test(appSource),
      buildCSR: !/const csr = useMemo\(\(\) => finalHes \? buildCSR\(finalHes\)/.test(appSource),
      expH2V: !/const ht = useMemo\(\(\) => expH2V\(h2v\)/.test(appSource),
      expV2H: !/const vt = useMemo\(\(\) => expV2H\(v2h\)/.test(appSource),
      fullH2VRows: !/const h2vRows = h2v\.map/.test(appSource),
      fullV2HRows: !/const v2hRows = v2h\.map/.test(appSource),
    },
    onlyOneMappingBoxRendered: (appSource.match(/<MappingBox/g) ?? []).length === 1,
    exactExportRequestScoped: /activeSection === "export"\s*\? resolveExport/.test(appSource),
    statsIntentionallyContinuous: /computeStats\(finalHes\)/.test(appSource),
    statsJustification: "Top-level graph cards and deterministic agent state continuously consume exact graph statistics; pre-change characterization measured this linear builder independently.",
    indexedMatrixMembership: /new Set\(h\.vertices\.map\(String\)\)/.test(mappingSource)
      && /members\.has\(v\)/.test(mappingSource),
    oldMatrixInnerScanAbsent: !/h\.vertices\.map\(String\)\.includes\(v\)/.test(mappingSource),
  },
  lazyInvocationEvidence,
  displayMaterialization: characterizeBoundedPresentation(),
  denseMatrix,
  workerPolicy: {
    thresholds: {
      h2hNeighborReferences: 50_000,
      v2vCandidatePairs: 50_000,
      matrixCells: 50_000,
    },
    tinyH2H: chooseDerivedExecutionPolicy("h2h", TinyBasic),
    tinyLineGraph: chooseDerivedExecutionPolicy("line_graph", TinyBasic),
    tinyMatrix: chooseDerivedExecutionPolicy("matrix", TinyBasic),
    largeLineGraph: chooseDerivedExecutionPolicy("line_graph", oneHuge1K),
    largeMatrix: chooseDerivedExecutionPolicy("matrix", denseMatrixFixture(400)),
    policy: "Only estimates above measured thresholds use a Web Worker; smaller exact work is deferred locally.",
  },
  requestSafety: {
    metadata: ["graphVersion", "requestId", "operationType", "options"],
    focusedRaceScenarios: 9,
    staleRejectionSeparateFromCancellation: true,
    incompleteResultsRejectedByCache: true,
    evidenceTest: "tests/stage7-derived-request-races.test.mjs",
  },
  traceDifferential: {
    randomGraphs: 2_000,
    fullyMaterializedSteps: 86_855,
    mismatches: 0,
    evidenceTest: "tests/stage7-compact-traces.test.mjs",
  },
  traceRuns,
  findings: {
    c03RequestScopedBuilders: lazyInvocationEvidence.findings.unrelatedBuilderCallsOnDefaultLoad === 0
      && lazyInvocationEvidence.findings.v2hRequestOnlyBuildsV2H
      && lazyInvocationEvidence.findings.csrRequestOnlyBuildsCSR,
    c04ExactIndexedMatrix: Object.values(denseMatrix).every(result => result.exactByteMatch && result.budgetUnchanged)
      && !/h\.vertices\.map\(String\)\.includes\(v\)/.test(mappingSource),
    c05ExpensiveDerivedWorkPolicy: chooseDerivedExecutionPolicy("line_graph", oneHuge1K).useWorker
      && chooseDerivedExecutionPolicy("matrix", denseMatrixFixture(400)).useWorker
      && !chooseDerivedExecutionPolicy("line_graph", TinyBasic).useWorker,
    s4Obs01CompactBfsAndDfs: traceRuns.OneHugeEdge5K.bfs.storage.retainedFullStepSnapshots === 0
      && traceRuns.OneHugeEdge5K.dfs.storage.retainedFullStepSnapshots === 0,
    stage6CompactShortest: traceRuns.OneHugeEdge1KFarTargetShortest.storage.retainedFullStepSnapshots === 0
      && traceRuns.LargeSparsePathShortest.storage.retainedFullStepSnapshots === 0,
  },
  measurementCaveat: "Wall time and heap deltas are machine/runtime evidence, not universal browser guarantees. Structural limits, exact differentials, request counters, and retained-reference counts are the pass conditions.",
};

await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
console.log(`Stage 7 post-change oracle written: ${outputPath}`);
console.log(JSON.stringify(artifact.findings, null, 2));

function characterizeLazyRequests(graph) {
  const cache = createDerivedProductCache();
  const graphIdentity = {};
  const calls = { h2v: 0, v2h: 0, csr: 0, matrix: 0, exportText: 0 };
  cache.activateGraph(41, graphIdentity);

  const request = context => {
    if (shouldRequestH2V(context)) cache.getOrCompute("h2v", {}, () => { calls.h2v += 1; return buildH2V(graph); });
    if (shouldRequestV2H(context)) cache.getOrCompute("v2h", {}, () => { calls.v2h += 1; return buildV2H(graph); });
    if (shouldRequestCSR(context)) cache.getOrCompute("csr", {}, () => { calls.csr += 1; return buildCSR(graph); });
    if (shouldRequestMatrix(context)) cache.getOrCompute("matrix", {}, () => { calls.matrix += 1; return expMatrixResult(graph); });
  };

  request({ activeSection: "mappings", selectedMappingId: "h2v", expId: "h2v_txt" });
  const afterDefaultMapping = { ...calls };
  request({ activeSection: "mappings", selectedMappingId: "v2h", expId: "h2v_txt" });
  const afterV2H = { ...calls };
  request({ activeSection: "export", selectedMappingId: "v2h", expId: "csr_csv" });
  const afterCSR = { ...calls };
  cache.getOrCompute("export_text:csr_csv", {}, () => { calls.exportText += 1; return JSON.stringify(buildCSR(graph)); });
  cache.getOrCompute("export_text:csr_csv", {}, () => { calls.exportText += 1; return "not used"; });
  const afterRepeatedExactExport = { ...calls };
  cache.setCompleteForGraph(41, graphIdentity, "line_graph", {}, { status: "over_budget", reason: "evidence refusal" });
  cache.setCompleteForGraph(41, graphIdentity, "matrix", { cancelled: true }, { status: "cancelled" });
  const beforeGraphReplacement = cache.getSnapshot();
  cache.activateGraph(42, {});
  const afterGraphReplacement = cache.getSnapshot();

  return {
    seam: "Production request predicates, production builders, and production graph-version cache.",
    afterDefaultMapping,
    afterV2H,
    afterCSR,
    afterRepeatedExactExport,
    beforeGraphReplacement,
    afterGraphReplacement,
    findings: {
      unrelatedBuilderCallsOnDefaultLoad: afterDefaultMapping.v2h + afterDefaultMapping.csr + afterDefaultMapping.matrix + afterDefaultMapping.exportText,
      v2hRequestOnlyBuildsV2H: afterV2H.v2h === 1 && afterV2H.csr === 0 && afterV2H.matrix === 0,
      csrRequestOnlyBuildsCSR: afterCSR.csr === 1 && afterCSR.matrix === 0,
      repeatedExactExportCacheHit: afterRepeatedExactExport.exportText === 1,
      refusedResultsNotCached: beforeGraphReplacement.refusedWrites === 2,
      graphReplacementInvalidatedEntries: beforeGraphReplacement.entryCount > 0 && afterGraphReplacement.entryCount === 0,
    },
  };
}

function characterizeBoundedPresentation() {
  const data = Array.from({ length: 10_000 }, (_, index) => ({
    hid: index === 0 ? 0 : `h${index}`,
    vertices: index === 1 ? ["null", "__proto__", "東京"] : [`v${index}`],
    time: null,
    weight: index === 2 ? 0 : 1,
  }));
  const presentation = buildMappingPresentation("h2v", data);
  return {
    exactUnderlyingRows: data.length,
    materializedDisplayRows: presentation.rows.length,
    totalRowsReported: presentation.totalRows,
    previewCharacters: presentation.text.length,
    complete: presentation.complete,
    zeroIdPreserved: presentation.rows[0][0] === 0,
    literalNullPrototypeUnicodePreserved: presentation.rows[1][2] === "null, __proto__, 東京",
    weightZeroPreserved: presentation.rows[2][3] === 0,
    noSilentTruncation: presentation.complete === false && presentation.totalRows === data.length,
  };
}

function summarizeTrace(measurement) {
  return {
    elapsedMs: measurement.elapsedMs,
    heapDeltaBytesObserved: measurement.heapDeltaBytesObserved,
    visitOrder: measurement.value.visitOrder.length,
    edgesUsed: measurement.value.edgesUsed.length,
    steps: measurement.value.steps.length,
    storage: getTraceStorageSummary(measurement.value.steps),
  };
}

function summarizeShortest(measurement) {
  return {
    elapsedMs: measurement.elapsedMs,
    heapDeltaBytesObserved: measurement.heapDeltaBytesObserved,
    reachable: measurement.value.result.reachable,
    distances: measurement.value.result.distances.size,
    edgesUsed: measurement.value.result.edgesUsed.length,
    steps: measurement.value.result.steps.length,
    storage: getTraceStorageSummary(measurement.value.result.steps),
    metrics: measurement.value.metrics,
  };
}

function measure(callback) {
  const heapBefore = process.memoryUsage().heapUsed;
  const startedAt = performance.now();
  const value = callback();
  return {
    elapsedMs: performance.now() - startedAt,
    heapDeltaBytesObserved: process.memoryUsage().heapUsed - heapBefore,
    value,
  };
}

function legacyMatrix(hyperedges) {
  const vertices = [...new Set(hyperedges.flatMap(edge => edge.vertices.map(String)))].sort(vcmp);
  const rows = [["vertex", ...hyperedges.map(edge => edge.id)]];
  vertices.forEach(vertex => rows.push([
    vertex,
    ...hyperedges.map(edge => edge.vertices.map(String).includes(vertex) ? "1" : "0"),
  ]));
  return csvDocument(rows);
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
