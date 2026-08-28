import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runBFS } from "../src/algorithms/bfs.js";
import { runConnectedComponents } from "../src/algorithms/connectedComponents.js";
import { runDFS } from "../src/algorithms/dfs.js";
import { buildAdjacencyList } from "../src/algorithms/graphModel.js";
import {
  buildTwoSectionProjection,
  buildTwoSectionProjectionSafely,
  estimateProjectionPairCount,
  PROJECTION_BUDGETS,
} from "../src/algorithms/projection.js";
import { buildV2VBounded } from "../src/utils/mappings.js";
import {
  DuplicateOverlap,
  OneHugeEdge1K,
  TinyBasic,
} from "../tests/fixtures/v7.3.14/stage0-regression-fixtures.mjs";

const scriptRoot = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(scriptRoot);
const outputArgument = process.argv.find(argument => argument.startsWith("--output="));
const outputPath = resolve(outputArgument?.slice("--output=".length)
  ?? join(projectRoot, "artifacts", "v7.3.14-stage4-prechange-characterization.json"));

const algorithmSources = Object.fromEntries(await Promise.all([
  "bfs.js",
  "dfs.js",
  "connectedComponents.js",
  "graphModel.js",
  "projection.js",
].map(async name => [name, await readFile(join(projectRoot, "src", "algorithms", name), "utf8")])));

const duplicateOverlap = DuplicateOverlap();
const duplicateProjection = buildTwoSectionProjectionSafely(duplicateOverlap);
const huge = OneHugeEdge1K();
const hugeFailures = Object.fromEntries([
  ["buildAdjacencyList", () => buildAdjacencyList(huge)],
  ["runBFS", () => runBFS(huge, "v0")],
  ["runDFS", () => runDFS(huge, "v0")],
  ["runConnectedComponents", () => runConnectedComponents(huge)],
].map(([name, operation]) => [name, capture(operation)]));

const nulGraph = [
  { id: "h1", vertices: ["a", "b\u0000c"] },
  { id: "h2", vertices: ["a\u0000b", "c"] },
];
const nulProjection = buildTwoSectionProjection(nulGraph);
const numericLexicalGraph = [
  { id: "h1", vertices: ["01", "1"] },
  { id: "h2", vertices: ["1", "01"] },
];
const numericLexicalProjection = buildTwoSectionProjection(numericLexicalGraph);

const tinyBfs = runBFS(TinyBasic, "a");
const tinyDfs = runDFS(TinyBasic, "a");
const tinyCc = runConnectedComponents(TinyBasic);
const projectionCallers = await findProjectionCallers(join(projectRoot, "src"));
const estimatedDuplicatePairs = estimateProjectionPairCount(duplicateOverlap, Number.MAX_SAFE_INTEGER).estimatedPairs;
const effectiveBudget = Math.min(
  PROJECTION_BUDGETS.maxEstimatedPairs,
  PROJECTION_BUDGETS.maxProjectedEdges,
  PROJECTION_BUDGETS.maxOutputRows,
  Math.floor(PROJECTION_BUDGETS.maxAdjacencyReferences / 2),
);

const reproductions = {
  "HG713-R04": {
    reproduced: duplicateProjection.ok === false
      && estimatedDuplicatePairs === 207_000
      && duplicateProjection.budget === effectiveBudget,
    expectedCandidatePairs: 207_000,
    expectedUniqueEdges: 1_035,
    effectiveBudget,
    result: duplicateProjection,
    adapter: buildV2VBounded(duplicateOverlap),
  },
  "HG713-R05": {
    reproduced: Object.values(hugeFailures).every(result => result.ok === false && /projection not computed/i.test(result.error)),
    expectedCandidatePairs: 499_500,
    failures: hugeFailures,
  },
  "S4-N01A": {
    reproduced: nulProjection.edges.length === 1
      && nulProjection.edges[0].hyperedges.length === 2,
    expectedDistinctEdges: 2,
    actualEdges: nulProjection.edges,
  },
  "S4-N01B": {
    reproduced: numericLexicalProjection.edges.length === 2,
    expectedDistinctEdges: 1,
    actualEdges: numericLexicalProjection.edges,
  },
};

const artifact = {
  stage: 4,
  kind: "pre_change_characterization",
  parentCommit: "88288e8e73a8b2e2de569ed037b37a7d168a1fa6",
  allRequiredFailuresReproduced: Object.values(reproductions).every(item => item.reproduced),
  architecture: {
    bfsImportsProjectedAdjacency: /import\s+{\s*buildAdjacencyList\s*}/.test(algorithmSources["bfs.js"]),
    dfsImportsProjectedAdjacency: /import\s+{\s*buildAdjacencyList\s*}/.test(algorithmSources["dfs.js"]),
    connectedComponentsImportsProjectedAdjacency: /buildAdjacencyList/.test(algorithmSources["connectedComponents.js"]),
    graphModelCallsBoundedProjection: /buildTwoSectionProjectionSafely\(/.test(algorithmSources["graphModel.js"]),
    projectionUsesNulJoinedKey: /`\$\{src}\}\\u0000\$\{dst\}`/.test(algorithmSources["projection.js"]),
    effectiveBudgetUsesMinimumOfUnrelatedDimensions: /Math\.min\(maxEstimatedPairs, maxProjectedEdges, maxOutputRows/.test(algorithmSources["projection.js"]),
    projectionCallers,
  },
  resultContracts: {
    bfsKeys: Object.keys(tinyBfs),
    bfsStepKeys: Object.keys(tinyBfs.steps[0]),
    dfsKeys: Object.keys(tinyDfs),
    dfsStepKeys: Object.keys(tinyDfs.steps[0]),
    connectedComponentsKeys: Object.keys(tinyCc),
    componentKeys: Object.keys(tinyCc.components[0]),
    unknownBfs: summarizeAlgorithm(runBFS(TinyBasic, "missing")),
    unknownDfs: summarizeAlgorithm(runDFS(TinyBasic, "missing")),
  },
  projectionContracts: {
    exactProjectionKeys: Object.keys(buildTwoSectionProjection(TinyBasic)),
    safeSuccessKeys: Object.keys(buildTwoSectionProjectionSafely(TinyBasic)),
    safeRefusalKeys: Object.keys(buildTwoSectionProjectionSafely(huge)),
    estimateKeys: Object.keys(estimateProjectionPairCount(TinyBasic)),
  },
  reproductions,
};

await writeFile(outputPath, JSON.stringify(artifact, null, 2) + "\n", "utf8");
console.log(`Stage 4 pre-change characterization: ${artifact.allRequiredFailuresReproduced ? "4/4 failures reproduced" : "INCOMPLETE"}.`);
console.log(`Evidence: ${outputPath}`);
for (const [id, result] of Object.entries(reproductions)) console.log(`${result.reproduced ? "REPRODUCED" : "NOT REPRODUCED"} ${id}`);
if (!artifact.allRequiredFailuresReproduced) process.exitCode = 1;

function capture(operation) {
  try {
    return { ok: true, value: operation() };
  } catch (error) {
    return { ok: false, error: `${error?.name ?? "Error"}: ${error?.message ?? String(error)}` };
  }
}

function summarizeAlgorithm(result) {
  return {
    algorithm: result.algorithm,
    startVertex: result.startVertex,
    visitOrder: result.visitOrder,
    edgesUsed: result.edgesUsed,
    distances: [...result.distances],
    steps: result.steps,
    reached: result.reached,
    total: result.total,
  };
}

async function findProjectionCallers(root) {
  const matches = [];
  for (const path of await walk(root)) {
    if (![".js", ".jsx"].includes(extname(path))) continue;
    const source = await readFile(path, "utf8");
    const lines = source.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (/buildTwoSectionProjection(?:Safely|Sample)?\(|estimateProjectionPairCount\(|buildV2VBounded\(/.test(line)) {
        matches.push({ file: relative(projectRoot, path).replaceAll("\\", "/"), line: index + 1, source: line.trim() });
      }
    });
  }
  return matches;
}

async function walk(root) {
  const paths = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) paths.push(...await walk(path));
    else paths.push(path);
  }
  return paths;
}
