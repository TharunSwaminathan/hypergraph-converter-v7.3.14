import { writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildTwoSectionProjection } from "../src/algorithms/projection.js";

const scriptRoot = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(scriptRoot);
const outputArgument = process.argv.find(argument => argument.startsWith("--output="));
const outputPath = resolve(outputArgument?.slice("--output=".length)
  ?? join(projectRoot, "artifacts", "v7.3.14-stage4-corrective-prechange.json"));

const fixtures = [
  characterize("latin-small-e-acute", "\u00E9", "e\u0301"),
  characterize("latin-capital-a-ring", "\u00C5", "A\u030A"),
];

const allRequiredFailuresReproduced = fixtures.every(fixture =>
  fixture.exactStringsDistinct
  && fixture.localeCompareResult === 0
  && fixture.projectedEdges.length === 2
  && fixture.projectedEdges.every(edge => edge.weight === 1 && edge.hyperedges.length === 1)
  && new Set(fixture.projectedEdges.flatMap(edge => edge.hyperedges)).size === 2);

const artifact = {
  stage: "4-corrective",
  issue: "S4-N01C",
  kind: "prechange_exact_total_order_reproduction",
  parentStage4Commit: "f08780eaf1320ae7989b00fcd279f6037234b797",
  runtime: process.version,
  allRequiredFailuresReproduced,
  fixtures,
  conclusion: allRequiredFailuresReproduced
    ? "Distinct canonical Unicode identifiers that collate equally split one unordered pair into opposite orientations."
    : "The required pre-change failure did not reproduce in this runtime.",
};

await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
console.log(`Stage 4 corrective pre-change evidence written to ${outputPath}`);
console.log(JSON.stringify({ allRequiredFailuresReproduced, fixtures }, null, 2));
if (!allRequiredFailuresReproduced) process.exitCode = 1;

function characterize(name, composed, decomposed) {
  const graph = [
    record("h1", [composed, decomposed]),
    record("h2", [decomposed, composed]),
  ];
  const projection = buildTwoSectionProjection(graph);
  return {
    name,
    composed,
    decomposed,
    composedCodePoints: codePoints(composed),
    decomposedCodePoints: codePoints(decomposed),
    exactStringsDistinct: composed !== decomposed,
    localeCompareResult: composed.localeCompare(decomposed),
    projectedVertexCount: projection.vertices.length,
    projectedVertices: projection.vertices,
    projectedEdgeCount: projection.edges.length,
    projectedEdges: projection.edges,
  };
}

function codePoints(value) {
  return [...value].map(character => `U+${character.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`);
}

function record(id, vertices) {
  return { id, vertices, time: null, weight: 1, attributes: {} };
}
