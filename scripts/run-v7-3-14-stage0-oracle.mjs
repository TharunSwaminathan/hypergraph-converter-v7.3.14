import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";
import { analyzeDeterministicNlu } from "../src/agent/deterministicNlu/deterministicNlu.js";
import { compileDeterministicAction } from "../src/agent/deterministicNlu/compileDeterministicAction.js";
import { compareWithExpectedOutput, parseExpectedOutputText } from "../src/agent/expectedOutputComparison.js";
import { isPlausibleGraphMutationText } from "../src/agent/graphMutationModelPlanner.js";
import { PENDING_ROUTE, routePendingSubmission } from "../src/agent/pendingSubmissionRouter.js";
import { buildAdjacencyList } from "../src/algorithms/graphModel.js";
import { buildTwoSectionProjectionSafely } from "../src/algorithms/projection.js";
import { runBFS } from "../src/algorithms/bfs.js";
import { runDFS } from "../src/algorithms/dfs.js";
import { runConnectedComponents } from "../src/algorithms/connectedComponents.js";
import { countTriadsBounded, expMatrixResult } from "../src/utils/mappings.js";
import {
  autoDetect,
  parseAdjList,
  parseCSVFmt,
  parseCSRJson,
  parseH2HText,
  parseIncidence,
  parseSimple,
} from "../src/utils/parsers.js";
import { buildCompilerContexts } from "../tests/helpers/evaluateDeterministicNluCorpus.mjs";
import {
  CSRInvalidIds,
  DenseProjection,
  DuplicateHyperedgeID,
  DuplicateOverlap,
  ExpectedProtoID,
  IncidenceConflict,
  MalformedAdjacency,
  MalformedH2H,
  ManySingletons2001,
  OneHugeEdge1K,
  WeightZero,
  WhitespaceRows,
} from "../tests/fixtures/v7.3.14/stage0-regression-fixtures.mjs";

const scriptRoot = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(scriptRoot);
const options = parseOptions(process.argv.slice(2));
const mainRoot = requiredPath(options, "main-root");
const targetArchive = requiredPath(options, "target-archive");
const mainArchive = requiredPath(options, "main-archive");
const outputPath = resolve(options.output ?? join(projectRoot, "artifacts", "v7.3.14-stage0-oracle.json"));

const currentVizSource = await readFile(join(projectRoot, "src", "components", "Viz.jsx"), "utf8");
const currentAppSource = await readFile(join(projectRoot, "src", "App.jsx"), "utf8");
const currentMappingSource = await readFile(join(projectRoot, "src", "utils", "mappings.js"), "utf8");
const mainVizSource = await readFile(join(mainRoot, "src", "components", "Viz.jsx"), "utf8");
const mainParsers = await import(pathToFileURL(join(mainRoot, "src", "utils", "parsers.js")).href);
const mainProjection = await import(pathToFileURL(join(mainRoot, "src", "algorithms", "projection.js")).href);
const mainGraphModel = await import(pathToFileURL(join(mainRoot, "src", "algorithms", "graphModel.js")).href);

const results = [];
const timings = {};
const observe = (id, title, reproduced, evidence, method = "runtime") => {
  results.push({ id, title, reproduced: Boolean(reproduced), method, evidence });
};

// R01/R02: main used the V2V edges both for attraction and display; v7.3.13
// requests them only for Line Graph mode while still consuming the empty list.
observe(
  "HG713-R01",
  "Hypergraph Force lost topology-aware attraction",
  /viewMode === "linegraph" \? buildV2VBounded\(he\)/.test(currentVizSource)
    && /v2vEdges\.forEach\(\(\{ u, v \}\)/.test(currentVizSource)
    && !/viewMode === "linegraph" \? buildV2VBounded\(he\)/.test(mainVizSource),
  { currentLineGraphOnly: true, forceStillConsumesV2V: true, mainAlwaysBuildsV2V: true },
  "differential_source",
);
observe(
  "HG713-R02",
  "Hypergraph co-membership lines disappeared",
  /viewMode === "linegraph" \? buildV2VBounded\(he\)/.test(currentVizSource)
    && /v2vEdges\.forEach\(\(\{ u, v \}\)/.test(currentVizSource),
  { hypergraphModeSuppliesEmptyV2V: true, drawLoopUsesV2V: true },
  "source",
);

const currentWhitespace = parseCSVFmt(WhitespaceRows.text).map(edge => edge.vertices);
const mainWhitespace = mainParsers.parseCSVFmt(WhitespaceRows.text).map(edge => edge.vertices);
observe(
  "HG713-R03",
  "Whitespace-row built-in example is misparsed",
  autoDetect(WhitespaceRows.text) === "csv"
    && JSON.stringify(currentWhitespace) !== JSON.stringify(WhitespaceRows.expected.map(edge => edge.vertices))
    && JSON.stringify(mainWhitespace) === JSON.stringify(WhitespaceRows.expected.map(edge => edge.vertices)),
  { detectedAs: autoDetect(WhitespaceRows.text), currentMemberships: currentWhitespace, mainMemberships: mainWhitespace },
  "differential_runtime",
);

const duplicateOverlap = DuplicateOverlap();
let started = performance.now();
const currentOverlap = buildTwoSectionProjectionSafely(duplicateOverlap);
timings.currentDuplicateOverlapMs = roundMs(performance.now() - started);
started = performance.now();
const mainOverlap = mainProjection.buildTwoSectionProjectionSafely(duplicateOverlap);
timings.mainDuplicateOverlapMs = roundMs(performance.now() - started);
observe(
  "HG713-R04",
  "Projection budget conflates candidate work and unique output",
  currentOverlap.ok === false && currentOverlap.estimatedPairs > currentOverlap.budget
    && mainOverlap.ok === true && mainOverlap.projection.edges.length === 1_035,
  {
    candidatePairs: 207_000,
    currentEstimateAtAbort: currentOverlap.estimatedPairs,
    currentBudget: currentOverlap.budget,
    mainUniqueEdges: mainOverlap.projection?.edges.length ?? null,
  },
  "differential_runtime",
);

const huge1k = OneHugeEdge1K();
const traversalFailures = {};
for (const [name, run] of [
  ["adjacency", () => buildAdjacencyList(huge1k)],
  ["bfs", () => runBFS(huge1k, "v0")],
  ["dfs", () => runDFS(huge1k, "v0")],
  ["connected_components", () => runConnectedComponents(huge1k)],
]) {
  try {
    run();
    traversalFailures[name] = null;
  } catch (error) {
    traversalFailures[name] = String(error?.message ?? error);
  }
}
started = performance.now();
const mainAdjacency = mainGraphModel.buildAdjacencyList(huge1k);
timings.mainOneHugeEdge1KAdjacencyMs = roundMs(performance.now() - started);
observe(
  "HG713-R05",
  "Core algorithms unnecessarily require full V2V",
  Object.values(traversalFailures).every(message => /V2V projection not computed/.test(message ?? ""))
    && mainAdjacency.size === 1_000 && mainAdjacency.get("v0")?.size === 999,
  { currentFailures: traversalFailures, mainVertices: mainAdjacency.size, mainDegreeV0: mainAdjacency.get("v0")?.size ?? null },
  "differential_runtime",
);

observe(
  "HG713-R06",
  "Force has a 700/701 cliff and reheat can be a no-op",
  /verts\.length <= 700/.test(currentVizSource)
    && /function reheat\(\).*alpha = 1\.0/.test(currentVizSource)
    && /Force layout paused/.test(currentVizSource),
  { forceGuard: "verts.length <= 700", reheatOnlySetsAlpha: true },
  "source",
);

const triads = countTriadsBounded(ManySingletons2001());
let triadRendererThrows = false;
try {
  triads.value.toLocaleString();
} catch {
  triadRendererThrows = true;
}
observe(
  "HG713-R07",
  "Bounded triad wrapper produces computed plus null",
  triads.status === "computed" && triads.value === null && triadRendererThrows
    && /triadResult\.value\.toLocaleString\(\)/.test(currentAppSource),
  { result: triads, rendererThrows: triadRendererThrows },
  "runtime_and_source",
);

const targetZip = readZipCentralDirectory(await readFile(targetArchive));
const mainZip = readZipCentralDirectory(await readFile(mainArchive));
const targetShellModes = shellModes(targetZip);
const mainShellModes = shellModes(mainZip);
observe(
  "HG713-R08",
  "Portable ZIP lost Unix executable metadata",
  targetShellModes.length > 0
    && targetShellModes.every(item => item.createSystem === 0 && item.mode === 0)
    && mainShellModes.length > 0
    && mainShellModes.every(item => item.createSystem === 3 && item.mode === 0o100755),
  { targetShellModes, mainShellModes },
  "archive_runtime",
);

const readonlyQueries = [
  "Keep the workspace untouched while describing create hyperedge h3 with vertices 8 and 9.",
  "I do not consent to any operation. Tell me what create hyperedge h3 with vertices 8 and 9 would change.",
  "Read Create hyperedge h3 with vertices 8 and 9 as text and explain its semantics.",
];
const compilerContexts = await buildCompilerContexts("graph-basic");
const readonlyCompilations = readonlyQueries.map(query => {
  const nlu = analyzeDeterministicNlu(query, compilerContexts.analysisContext);
  const compilation = compileDeterministicAction(nlu, compilerContexts.compileContext);
  return {
    query,
    speechAct: compilation.speechAct,
    sideEffectClass: compilation.sideEffectClass,
    dispatchAuthorized: compilation.dispatchAuthorized,
    mode: compilation.mode,
  };
});
observe(
  "HG713-C01",
  "Read-only language can authorize graph mutation",
  readonlyCompilations.every(item => item.sideEffectClass === "graph_edit_preview" && item.dispatchAuthorized === true),
  { compilations: readonlyCompilations },
  "runtime",
);

const pendingAction = {
  actionType: "apply_graph_mutation",
  planId: "stage0-pending",
  plan: { operations: [{ type: "ADD_INCIDENCE", hyperedgeId: "h2", vertexId: "6" }] },
  graphSnapshot: [{ id: "h2", vertices: ["6"] }],
};
const pendingQueries = readonlyQueries.map(query => query.replace(/create hyperedge h3 with vertices 8 and 9/ig, "change the pending vertex from 6 to 7"));
const pendingRoutes = pendingQueries.map(query => {
  const routed = routePendingSubmission({
    query,
    pendingAction,
    graphMutationCandidate: isPlausibleGraphMutationText(query, { pendingAction }),
  });
  return {
    query,
    route: routed.route,
    mode: routed.semantics.mode,
    executionAuthorized: routed.semantics.executionAuthorized,
    authorizedPendingCorrection: routed.semantics.authorizedPendingCorrection,
  };
});
observe(
  "HG713-C02",
  "Read-only pending correction wording replaces staged graph action",
  pendingRoutes.every(item => item.route === PENDING_ROUTE.GRAPH_REPLACEMENT && item.authorizedPendingCorrection === true),
  { routes: pendingRoutes },
  "runtime",
);

observe(
  "HG713-C03",
  "Ordinary graph load eagerly derives base structures and strings",
  /const v2h = useMemo\(\(\) => finalHes \? buildV2H\(finalHes\)/.test(currentAppSource)
    && /const csr = useMemo\(\(\) => finalHes \? buildCSR\(finalHes\)/.test(currentAppSource)
    && /const ht = useMemo\(\(\) => expH2V\(h2v\)/.test(currentAppSource)
    && /const vt = useMemo\(\(\) => expV2H\(v2h\)/.test(currentAppSource),
  { eagerDerivedProducts: ["h2v", "v2h", "csr", "h2v_text", "v2h_text"] },
  "source",
);

const denseMatrix = Array.from({ length: 400 }, (_, edgeIndex) => ({
  id: `h${edgeIndex}`,
  vertices: Array.from({ length: 400 }, (_, vertexIndex) => `v${vertexIndex}`),
}));
started = performance.now();
const denseMatrixResult = expMatrixResult(denseMatrix);
timings.denseMatrix400x400Ms = roundMs(performance.now() - started);
observe(
  "HG713-C04",
  "Dense Matrix export repeats membership scans per cell",
  /hes\.map\(h => h\.vertices\.map\(String\)\.includes\(v\)/.test(currentMappingSource)
    && denseMatrixResult.status === "computed",
  { cells: denseMatrixResult.estimate?.cells ?? 160_801, elapsedMs: timings.denseMatrix400x400Ms },
  "runtime_and_source",
);

started = performance.now();
const denseProjection = buildTwoSectionProjectionSafely(DenseProjection());
timings.lineGraph632Ms = roundMs(performance.now() - started);
observe(
  "HG713-C05",
  "Allowed Line Graph work can block and redraw too much",
  denseProjection.ok === true
    && denseProjection.projection.edges.length === 199_396
    && /requestAnimationFrame\(draw\)/.test(currentVizSource)
    && /v2vEdges\.forEach/.test(currentVizSource),
  { uniqueEdges: denseProjection.projection?.edges.length ?? null, elapsedMs: timings.lineGraph632Ms, continuousRaf: true },
  "runtime_and_source",
);

const invalidCsr = parseCSRJson(JSON.stringify(CSRInvalidIds.vertexObject));
observe(
  "HG713-C06",
  "CSR/CSC invalid identifiers are silently string-coerced",
  invalidCsr[0]?.vertices?.[0] === "[object Object]",
  { parsedVertexId: invalidCsr[0]?.vertices?.[0] ?? null },
  "runtime",
);

const incidenceWeight = parseIncidence(IncidenceConflict.weight);
const incidenceTime = parseIncidence(IncidenceConflict.time);
observe(
  "HG713-C07",
  "Incidence metadata conflicts are silently discarded",
  incidenceWeight[0]?.weight === 2 && incidenceTime[0]?.time === "t1",
  { retainedWeight: incidenceWeight[0]?.weight, retainedTime: incidenceTime[0]?.time },
  "runtime",
);

const malformedH2HResults = MalformedH2H.map(text => attempt(() => parseH2HText(text)));
const malformedAdjacencyResults = MalformedAdjacency.map(text => attempt(() => parseAdjList(text)));
observe(
  "HG713-C08",
  "Malformed H2H and adjacency syntax is accepted",
  malformedH2HResults[0].ok === true
    && malformedH2HResults[0].value[0]?.vertices?.length === 0
    && malformedAdjacencyResults.every(result => result.ok === true),
  { malformedH2HResults, malformedAdjacencyResults },
  "runtime",
);

observe(
  "HG713-C09",
  "Graph Preview hides valid weight zero",
  (currentVizSource.match(/h\.weight && h\.weight !== 1/g) ?? []).length >= 2
    && (currentVizSource.match(/found\.weight && found\.weight !== 1/g) ?? []).length >= 1,
  { truthinessChecks: (currentVizSource.match(/(?:h|found)\.weight &&/g) ?? []).length, fixtureWeight: WeightZero[0].weight },
  "source",
);

observe(
  "HG713-S01",
  "Preview claims ring clicks but click path only hit-tests nodes",
  /Click a node or<br \/>ring to inspect/.test(currentVizSource)
    && /const onDown = useCallback\([\s\S]*?const hit = hitNode\(wx, wy\)/.test(currentVizSource)
    && !/function hit(?:Ring|Hyperedge)/.test(currentVizSource),
  { ringClickClaimed: true, clickHitTest: "node_only" },
  "source",
);

observe(
  "HG713-S02",
  "Numeric vertex zero search falls through truthiness fallback",
  /verts\.find\([\s\S]*?\|\| verts\.find\([\s\S]*?\|\| null/.test(currentVizSource)
    && ((0 || null) === null),
  { javascriptFallbackForNumericZero: 0 || null },
  "source_and_language_runtime",
);

const unsafeNodes = {};
unsafeNodes.__proto__ = { id: "__proto__" };
observe(
  "HG713-S03",
  "Plain-object node storage mishandles __proto__",
  /const nodes = \{\}/.test(currentVizSource)
    && !Object.prototype.hasOwnProperty.call(unsafeNodes, "__proto__"),
  { ownProtoNode: Object.prototype.hasOwnProperty.call(unsafeNodes, "__proto__") },
  "source_and_language_runtime",
);

observe(
  "HG713-S04",
  "Canvas backing size does not observe container resize",
  /canvas\.offsetWidth/.test(currentVizSource) && !/ResizeObserver/.test(currentVizSource),
  { readsOffsetWidth: true, resizeObserverPresent: false },
  "source",
);

const duplicateParsed = parseSimple(DuplicateHyperedgeID.map(edge => `${edge.id}: ${edge.vertices.join(" ")}`).join("\n"));
observe(
  "N01",
  "Simple/H2V accepts duplicate hyperedge IDs",
  duplicateParsed.length === 2 && duplicateParsed[0].id === duplicateParsed[1].id,
  { parsedIds: duplicateParsed.map(edge => edge.id) },
  "runtime",
);

observe(
  "N02",
  "Literal null identifier collides with unset Preview state",
  /String\(searchHit\) === String\(v\)/.test(currentVizSource)
    && String(null) === String("null"),
  { unsetString: String(null), literalId: "null", collide: String(null) === String("null") },
  "source_and_language_runtime",
);

const expectedProto = parseExpectedOutputText(ExpectedProtoID.text);
const expectedProtoComparison = compareWithExpectedOutput(ExpectedProtoID.actual, expectedProto);
observe(
  "N03",
  "Expected-output text parser loses __proto__ hyperedge ID",
  Object.keys(expectedProto.h2v).length === 0
    && expectedProtoComparison.expectedStats.hyperedges === 0
    && expectedProtoComparison.allHyperedgeIdsMatched === false,
  {
    ownKeys: Object.keys(expectedProto.h2v),
    expectedHyperedges: expectedProtoComparison.expectedStats.hyperedges,
    warnings: expectedProtoComparison.warnings,
  },
  "runtime",
);

const reproduced = results.filter(result => result.reproduced).length;
const report = {
  stage: 0,
  packageVersion: "7.3.13",
  projectRoot,
  referenceRoot: mainRoot,
  targetArchive,
  mainArchive,
  generatedAt: new Date().toISOString(),
  environment: {
    platform: process.platform,
    architecture: process.arch,
    node: process.version,
  },
  summary: {
    total: results.length,
    reproduced,
    notReproduced: results.length - reproduced,
  },
  timings,
  results,
};

await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(`Stage 0 defect oracle: ${reproduced}/${results.length} issue families reproduced.`);
console.log(`Evidence: ${outputPath}`);
for (const result of results) {
  console.log(`${result.reproduced ? "REPRODUCED" : "NOT REPRODUCED"} ${result.id} — ${result.title}`);
}
if (reproduced !== results.length) process.exitCode = 1;

function parseOptions(args) {
  return Object.fromEntries(args.map(argument => {
    const separator = argument.indexOf("=");
    if (!argument.startsWith("--") || separator < 0) throw new Error(`Expected --name=value argument, received ${argument}`);
    return [argument.slice(2, separator), argument.slice(separator + 1)];
  }));
}

function requiredPath(values, name) {
  if (!values[name]) throw new Error(`Missing required --${name}=... argument.`);
  return resolve(values[name]);
}

function roundMs(value) {
  return Math.round(value * 100) / 100;
}

function attempt(run) {
  try {
    const value = run();
    return { ok: true, value };
  } catch (error) {
    return { ok: false, error: String(error?.message ?? error) };
  }
}

function shellModes(entries) {
  return entries
    .filter(entry => entry.name.toLowerCase().endsWith(".sh"))
    .map(entry => ({ name: entry.name, createSystem: entry.createSystem, mode: entry.mode }));
}

function readZipCentralDirectory(buffer) {
  const eocdSignature = 0x06054b50;
  const centralSignature = 0x02014b50;
  let eocd = -1;
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 65_557); offset -= 1) {
    if (buffer.readUInt32LE(offset) === eocdSignature) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) throw new Error("ZIP end-of-central-directory record not found.");
  const entryCount = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries = [];
  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(offset) !== centralSignature) throw new Error(`Invalid central-directory entry at offset ${offset}.`);
    const madeBy = buffer.readUInt16LE(offset + 4);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const externalAttributes = buffer.readUInt32LE(offset + 38);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    entries.push({
      name,
      createSystem: madeBy >>> 8,
      mode: (externalAttributes >>> 16) & 0xffff,
    });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}
