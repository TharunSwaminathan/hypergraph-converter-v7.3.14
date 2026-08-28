import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildTwoSectionProjection,
  PROJECTION_WEIGHT_POLICIES,
} from "../src/algorithms/projection.js";

const scriptRoot = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(scriptRoot);
const outputArgument = process.argv.find(argument => argument.startsWith("--output="));
const outputPath = resolve(outputArgument?.slice("--output=".length)
  ?? join(projectRoot, "artifacts", "v7.3.14-stage4-corrective-oracle.json"));

const prechange = JSON.parse(await readFile(
  join(projectRoot, "artifacts", "v7.3.14-stage4-corrective-prechange.json"),
  "utf8",
));
const projectionSource = await readFile(join(projectRoot, "src", "algorithms", "projection.js"), "utf8");
const equivalenceFixtures = [
  characterize("latin-small-e-acute", "\u00E9", "e\u0301"),
  characterize("latin-capital-a-ring", "\u00C5", "A\u030A"),
];

const weightedGraph = [
  record("h0", ["\u00E9", "e\u0301"], { weight: 0 }),
  record("h2", ["e\u0301", "\u00E9"], { weight: 2 }),
];
const weightResults = Object.fromEntries(Object.values(PROJECTION_WEIGHT_POLICIES).map(weightPolicy => [
  weightPolicy,
  buildTwoSectionProjection(weightedGraph, { weightPolicy }).edges,
]));

const nulProjection = buildTwoSectionProjection([
  record("h1", ["a", "b\u0000c"]),
  record("h2", ["a\u0000b", "c"]),
]);
const numericLexical = [
  ["01", "1"],
  ["1.0", "1"],
].map(([left, right]) => ({
  left,
  right,
  edges: buildTwoSectionProjection([
    record("h1", [left, right]),
    record("h2", [right, left]),
  ]).edges,
}));
const ordinaryProjection = buildTwoSectionProjection([record("ordinary", ["gamma", "alpha", "beta"])]);

const checks = [
  check("S4-N01C-PRECHANGE", "Pre-fix collation equality and split orientation were captured before production editing",
    prechange.parentStage4Commit === "f08780eaf1320ae7989b00fcd279f6037234b797"
      && prechange.allRequiredFailuresReproduced === true
      && prechange.fixtures.every(fixture => fixture.exactStringsDistinct
        && fixture.localeCompareResult === 0
        && fixture.projectedEdgeCount === 2
        && fixture.projectedEdges.every(edge => edge.weight === 1 && edge.hyperedges.length === 1)),
    prechange.fixtures),
  check("S4-N01C-TOTAL-ORDER", "Collation equality receives an exact deterministic tie-break without Unicode normalization",
    /const localeOrder = a\.localeCompare\(b\);\s*if \(localeOrder !== 0\) return localeOrder;\s*if \(a === b\) return 0;\s*return a < b \? -1 : 1;/m.test(projectionSource)
      && !/\.normalize\s*\(/.test(projectionSource),
    { exactTieBreakPresent: true, unicodeNormalizationAbsent: !/\.normalize\s*\(/.test(projectionSource) }),
  check("S4-N01C-UNICODE-IDENTITY", "Both composed/decomposed fixtures retain two exact vertices and one unordered pair",
    equivalenceFixtures.every(fixture => fixture.exactStringsDistinct
      && fixture.localeCompareResult === 0
      && fixture.projectedVertices.length === 2
      && new Set(fixture.projectedVertices).size === 2
      && fixture.projectedEdges.length === 1
      && fixture.projectedEdges[0].weight === 2
      && same(fixture.projectedEdges[0].hyperedges, ["h1", "h2"])
      && fixture.reversedProjectedEdges.length === 1
      && fixture.reversedProjectedEdges[0].src === fixture.projectedEdges[0].src
      && fixture.reversedProjectedEdges[0].dst === fixture.projectedEdges[0].dst),
    equivalenceFixtures),
  check("S4-N01C-WEIGHTS", "All four projection policies retain one pair, both supports, and their established zero semantics",
    weightResults.count_shared_hyperedges.length === 1
      && weightResults.count_shared_hyperedges[0].weight === 2
      && weightResults.sum_hyperedge_weights[0].weight === 2
      && weightResults.min_hyperedge_weight[0].weight === 0
      && weightResults.unweighted[0].weight === 1
      && Object.values(weightResults).every(edges => edges.length === 1 && same(edges[0].hyperedges, ["h0", "h2"])),
    weightResults),
  check("S4-N01-PRESERVATION", "Previous NUL and numeric-lexical identity corrections remain intact",
    nulProjection.edges.length === 2
      && numericLexical.every(result => result.edges.length === 1
        && result.edges[0].weight === 2
        && same(result.edges[0].hyperedges, ["h1", "h2"])),
    { nulEdges: nulProjection.edges, numericLexical }),
  check("S4-ORDERING-PRESERVATION", "Representative ordinary locale ordering remains unchanged",
    same(ordinaryProjection.vertices, ["alpha", "beta", "gamma"])
      && same(ordinaryProjection.edges, [
        { src: "alpha", dst: "beta", weight: 1, hyperedges: ["ordinary"] },
        { src: "alpha", dst: "gamma", weight: 1, hyperedges: ["ordinary"] },
        { src: "beta", dst: "gamma", weight: 1, hyperedges: ["ordinary"] },
      ]),
    ordinaryProjection),
];

const passed = checks.filter(item => item.passed).length;
const artifact = {
  stage: 4,
  corrective: "S4-N01C",
  severity: "High",
  status: passed === checks.length ? "fixed" : "unresolved",
  parentStage4Commit: "f08780eaf1320ae7989b00fcd279f6037234b797",
  passed,
  total: checks.length,
  environment: { runtime: process.version, platform: `${process.platform}/${process.arch}` },
  checks,
};

await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
console.log(`Stage 4 corrective oracle: ${passed}/${checks.length} families passed.`);
console.log(`Evidence: ${outputPath}`);
for (const item of checks) console.log(`${item.passed ? "PASS" : "FAIL"} ${item.id} — ${item.title}`);
if (passed !== checks.length) process.exitCode = 1;

function characterize(name, composed, decomposed) {
  const graph = [record("h1", [composed, decomposed]), record("h2", [decomposed, composed])];
  const projection = buildTwoSectionProjection(graph);
  const reversed = buildTwoSectionProjection([...graph].reverse());
  return {
    name,
    composed,
    decomposed,
    exactStringsDistinct: composed !== decomposed,
    localeCompareResult: composed.localeCompare(decomposed),
    projectedVertices: projection.vertices,
    projectedEdges: projection.edges,
    reversedProjectedEdges: reversed.edges,
  };
}

function check(id, title, passed, evidence) {
  return { id, title, passed: Boolean(passed), evidence };
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function record(id, vertices, extra = {}) {
  return { id, vertices, time: extra.time ?? null, weight: extra.weight ?? 1, attributes: extra.attributes ?? {} };
}
