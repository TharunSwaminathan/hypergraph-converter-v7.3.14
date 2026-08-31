import { writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runShortestPath } from "../src/algorithms/shortestPath.js";
import { runKCore } from "../src/algorithms/kCore.js";
import { computeStats, countTriads, countTriadsBounded } from "../src/utils/mappings.js";
import {
  DuplicateOverlap,
  ManySingletons,
  ManySingletons2001,
  OneHugeEdge1K,
  PrototypeIDs,
  TinyBasic,
} from "../tests/fixtures/v7.3.14/stage0-regression-fixtures.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outputArgument = process.argv.find(argument => argument.startsWith("--output="));
const outputPath = resolve(outputArgument?.slice("--output=".length)
  ?? join(root, "artifacts", "v7.3.14-stage6-prechange-characterization.json"));

const record = (id, vertices, weight = 1) => ({ id, vertices, time: null, weight, attributes: {} });
const disconnected = [record("h0", ["a", "b"]), record("h1", ["x", "y"])];
const path = [record("h0", ["a", "b"]), record("h1", ["b", "c"]), record("h2", ["c", "d"])];
const cycle = [record("h0", ["a", "b"]), record("h1", ["b", "c"]), record("h2", ["c", "a"])];
const clique = [record("h0", ["a", "b", "c", "d"])];
const overlaps = [record("heavy", ["a", "b"], 8), record("light", ["a", "b", "c"], 2)];
const invalidWeights = [
  { ...record("missing", ["a", "b"]), weight: undefined },
  record("negative", ["b", "c"], -3),
  record("nonnumeric", ["c", "d"], "bad"),
];
const lowOverlap2101 = Array.from({ length: 2_101 }, (_, index) => record(`h${index}`, [`v${index}`, `v${index + 1}`]));
const triad = [record("h0", ["a", "b"]), record("h1", ["b", "c"]), record("h2", ["c", "a"])];
const triadExtras = [...triad, record("h3", ["isolated"])];

const shortestCases = {
  TinyBasic: capture(() => runShortestPath(TinyBasic, { startVertex: "a", targetVertex: "d" })),
  unknownStart: capture(() => runShortestPath(TinyBasic, { startVertex: "missing", targetVertex: "d" })),
  noTarget: capture(() => runShortestPath(TinyBasic, { startVertex: "a" })),
  targetReachable: capture(() => runShortestPath(path, { startVertex: "a", targetVertex: "d" })),
  targetUnreachable: capture(() => runShortestPath(disconnected, { startVertex: "a", targetVertex: "y" })),
  targetEqualsStart: capture(() => runShortestPath(path, { startVertex: "a", targetVertex: "a" })),
  zeroWeight: capture(() => runShortestPath([record("zero", ["a", "b"], 0)], { startVertex: "a", targetVertex: "b" })),
  overlappingDifferentWeights: capture(() => runShortestPath(overlaps, { startVertex: "a", targetVertex: "c" })),
  invalidWeights: capture(() => runShortestPath(invalidWeights, { startVertex: "a", targetVertex: "d" })),
  duplicateMembership: capture(() => runShortestPath([record("dup", ["a", "b", "a", "b"])], { startVertex: "a", targetVertex: "b" })),
  singleton: capture(() => runShortestPath([record("single", ["solo"])], { startVertex: "solo", targetVertex: "solo" })),
  disconnected: capture(() => runShortestPath(disconnected, { startVertex: "a" })),
  PrototypeIDs: capture(() => runShortestPath(PrototypeIDs, { startVertex: "__proto__", targetVertex: "ordinary" })),
  literalNull: capture(() => runShortestPath([record("h-null", ["null", "ordinary"])], { startVertex: "null", targetVertex: "ordinary" })),
  canonicalZero: capture(() => runShortestPath([record("h-zero", ["0", "other"])], { startVertex: "0", targetVertex: "other" })),
  numericZero: capture(() => runShortestPath([record("h-zero", [0, "other"])], { startVertex: 0, targetVertex: "other" })),
  OneHugeEdge1K: capture(() => runShortestPath(OneHugeEdge1K(), { startVertex: "v0", targetVertex: "v999" })),
};

const kCoreCases = {
  TinyBasic: capture(() => runKCore(TinyBasic)),
  empty: capture(() => runKCore([])),
  singleton: capture(() => runKCore([record("single", ["solo"])])),
  path: capture(() => runKCore(path)),
  cycle: capture(() => runKCore(cycle)),
  clique: capture(() => runKCore(clique)),
  disconnected: capture(() => runKCore(disconnected)),
  overlaps: capture(() => runKCore(overlaps)),
  DuplicateOverlap: capture(() => runKCore(DuplicateOverlap())),
  PrototypeIDs: capture(() => runKCore(PrototypeIDs)),
  zeroAndNull: capture(() => runKCore([record("h0", [0, "null", "other"])])),
  OneHugeEdge1K: capture(() => runKCore(OneHugeEdge1K())),
};

const statsCases = Object.fromEntries([
  ["TinyBasic", TinyBasic],
  ["empty", []],
  ["single", [record("single", ["solo"])]],
  ["twoDisconnected", [record("h0", ["a"]), record("h1", ["b"])]],
  ["trueTriangle", triad],
  ["trianglePlusExtras", triadExtras],
  ["DuplicateOverlap", DuplicateOverlap()],
  ["singletons2000", ManySingletons(2_000)],
  ["ManySingletons2001", ManySingletons2001()],
  ["singletons5000", ManySingletons(5_000)],
  ["lowOverlap2101", lowOverlap2101],
  ["highOverlap", DuplicateOverlap({ hyperedgeCount: 120, vertexCount: 20 })],
  ["weightZero", [record("zero", ["a", "b"], 0)]],
  ["PrototypeIDs", PrototypeIDs],
  ["literalNull", [record("h-null", ["null", "ordinary"]) ]],
].map(([name, graph]) => [name, {
  hyperedges: graph.length,
  raw: capture(() => countTriads(graph)),
  bounded: capture(() => countTriadsBounded(graph)),
  stats: capture(() => computeStats(graph)),
}]));

const manySingletons = statsCases.ManySingletons2001.bounded.value;
const originalCrashPrevented = manySingletons?.status !== "computed" || manySingletons?.value != null;
const artifact = {
  stage: 6,
  kind: "prechange_semantic_characterization",
  parentCommit: "bd2e374144585627f0d0bbb3667f0e17423b3471",
  packageVersion: "7.3.13",
  sourceArchitecture: {
    shortest: "runShortestPath -> buildWeightedAdjacency -> buildTwoSectionProjectionSafely(MIN_HYPEREDGE_WEIGHT, defaultWeight=1) -> full weighted adjacency -> Dijkstra",
    kCore: "runKCore -> buildAdjacencyList -> buildTwoSectionProjectionSafely(UNWEIGHTED) -> full deduplicated adjacency -> first-minimum linear-scan peeling",
    triads: "countTriadsBounded -> estimateH2HNeighborReferences -> countTriads; countTriads returns null for H > 2000; Stage 1 converts that sentinel to over_budget",
  },
  shortestCases,
  kCoreCases,
  statsCases,
  findings: {
    shortestOneHugeEdge1KFails: shortestCases.OneHugeEdge1K.status === "threw",
    kCoreOneHugeEdge1KFails: kCoreCases.OneHugeEdge1K.status === "threw",
    manySingletons2001Status: manySingletons?.status ?? null,
    manySingletons2001Value: manySingletons?.value ?? null,
    originalR07CrashCurrentlyReproducible: !originalCrashPrevented,
    originalR07CrashAlreadyPreventedByStage1: originalCrashPrevented,
    remainingR07Work: "remove the mixed numeric/null producer convention and replace the hyperedge-count sentinel with bounded work-based triad semantics",
  },
};

await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
console.log(`Stage 6 pre-change characterization written: ${outputPath}`);
console.log(JSON.stringify(artifact.findings, null, 2));

function capture(callback) {
  try {
    return { status: "returned", value: serialize(callback()) };
  } catch (error) {
    return { status: "threw", error: error?.message ?? String(error) };
  }
}

function serialize(value) {
  if (value instanceof Map) return { $type: "Map", entries: [...value].map(([key, current]) => [key, serialize(current)]) };
  if (value instanceof Set) return { $type: "Set", values: [...value].map(serialize) };
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, current]) => [key, serialize(current)]));
  return value;
}
