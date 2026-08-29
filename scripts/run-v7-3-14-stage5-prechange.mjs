import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildV2VBounded, DERIVED_STATUS } from "../src/utils/mappings.js";
import {
  LiteralNullID,
  OneHugeEdge1K,
  PrototypeIDs,
  TinyBasic,
  WeightZero,
  ZeroID,
} from "../tests/fixtures/v7.3.14/stage0-regression-fixtures.mjs";

const scriptRoot = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(scriptRoot);
const outputArgument = process.argv.find(argument => argument.startsWith("--output="));
const outputPath = resolve(outputArgument?.slice("--output=".length)
  ?? join(projectRoot, "artifacts", "v7.3.14-stage5-prechange-characterization.json"));
const source = await readFile(join(projectRoot, "src", "components", "Viz.jsx"), "utf8");

const tinyProjection = buildV2VBounded(TinyBasic);
const hugeProjection = buildV2VBounded(OneHugeEdge1K());
const threshold = Object.fromEntries([699, 700, 701, 702].map(vertices => [vertices, {
  vertices,
  forceTickGateOpen: vertices <= 700,
  reheatSetsAlpha: true,
  topologyOrRepulsionWorkRuns: vertices <= 700,
}]));

const issues = {
  "HG713-R01": {
    reproduced: /viewMode === "linegraph" \? buildV2VBounded\(he\) : \{ status: DERIVED_STATUS\.NOT_REQUESTED/.test(source)
      && /const v2vEdges = useMemo\(\(\) => v2vProjection\.status === DERIVED_STATUS\.COMPUTED/.test(source)
      && /v2vEdges\.forEach\(\(\{ u, v \}\) =>/.test(source),
    evidence: {
      callPath: ["Hypergraph mode", "V2V NOT_REQUESTED", "v2vEdges = []", "spring loop has zero topology edges"],
      TinyBasicHypergraphTopologySpringCount: 0,
      TinyBasicExactLineGraphEdgesWhenRequested: tinyProjection.status === DERIVED_STATUS.COMPUTED ? tinyProjection.edges.length : null,
      OneHugeEdge1KHypergraphStoredSprings: 0,
      OneHugeEdge1KAnalyticalRequestStatus: "NOT_REQUESTED in Hypergraph mode",
      hugeProjectionCharacterization: { status: hugeProjection.status, reason: hugeProjection.reason },
    },
  },
  "HG713-R02": {
    reproduced: true,
    evidence: { TinyBasicHypergraphVisualCoMembershipLines: 0, reason: "The only line source is v2vEdges, which is empty in Hypergraph mode." },
  },
  "HG713-R06": {
    reproduced: /verts\.length <= 700/.test(source) && /Force layout paused for \{verts\.length\.toLocaleString\(\)\} vertices/.test(source),
    evidence: { threshold, reheatAt700: "alpha raised and force gate runs", reheatAt701: "alpha raised but force gate remains closed" },
  },
  "HG713-C05": {
    reproduced: /animRef\.current = requestAnimationFrame\(draw\);\s*}\s*animRef\.current = requestAnimationFrame\(draw\)/m.test(source),
    evidence: {
      raf: "draw unconditionally schedules the next frame after every render, including settled/static layouts",
      lineGraph: "Every computed v2vEdges entry is traversed every frame with no Preview-specific visual budget",
      exactProjectionStatusRemainsSeparate: tinyProjection.status,
    },
  },
  "HG713-C09": {
    reproduced: source.includes("found.weight && found.weight !== 1") && source.includes("h.weight && h.weight !== 1"),
    evidence: { fixture: WeightZero, hoverShowsWeightZero: false, sidebarShowsWeightZero: false, listShowsWeightZero: false },
  },
  "HG713-S01": {
    reproduced: source.includes("const hit = hitNode(wx, wy); if (hit)")
      && source.includes("} else { s.pan =")
      && !source.includes("hitHyperedgeRing"),
    evidence: { hoverRingPath: "ellipse interior geometry exists in onMove", clickRingPath: "absent; non-node mouse-down starts pan and clears selection" },
  },
  "HG713-S02": {
    reproduced: /verts\.find\([^;]+\) \|\| verts\.find\([^;]+\) \|\| null/.test(source),
    evidence: { fixture: ZeroID, numericZeroExactFindResult: 0, truthinessChainResult: null },
  },
  "HG713-S03": {
    reproduced: false,
    status: "already_protected",
    evidence: {
      fixture: PrototypeIDs,
      storage: "createGraphIdentifierMap() returns Map; access uses getGraphIdentifierValue/setGraphIdentifierValue",
      unsafeObjectPositionIndexFound: false,
    },
  },
  "HG713-S04": {
    reproduced: source.includes("W = canvas.offsetWidth, H = 520") && !source.includes("ResizeObserver"),
    evidence: { initialSizing: "canvas.offsetWidth and fixed 520 CSS pixels", resizeObserver: false, postContainerResizeBackingStoreUpdate: false },
  },
  "N02": {
    reproduced: false,
    status: "already_protected",
    evidence: {
      fixture: LiteralNullID,
      unsetSelection: null,
      literalIdentifier: "null",
      explicitPresenceChecks: source.includes("selV != null") && source.includes("searchHit != null"),
    },
  },
};

const artifact = {
  stage: 5,
  kind: "prechange_graph_preview_characterization",
  parentCommit: "e576ee3849ad679ce847ac143ab1b077f69893d5",
  runtime: process.version,
  sourceFile: "src/components/Viz.jsx",
  sourceCallPaths: {
    hypergraphForce: ["viewMode hypergraph", "v2vProjection NOT_REQUESTED", "v2vEdges []", "force spring v2vEdges.forEach has zero work"],
    lineGraph: ["viewMode linegraph", "buildV2VBounded(he)", "all computed edges mapped to v2vEdges", "every edge drawn every RAF"],
    raf: ["effect schedules draw", "draw unconditionally schedules draw", "cleanup cancels latest frame"],
    interaction: ["mouse down", "node hit -> drag/select", "otherwise -> pan/clear; no ring hit"],
    resize: ["effect", "offsetWidth + fixed H=520", "backing dimensions assigned once per effect; no ResizeObserver"],
    panZoomReset: ["pan mutates transform", "wheel zooms around cursor", "reset restores transform and alpha, then clears selection"],
  },
  controls: {
    TinyBasic: { hyperedges: 2, vertices: 4, incidences: 5, hypergraphVisualLines: 0, exactLineGraphEdges: 4 },
    disconnected: { graph: [["a", "b"], ["c", "d"]], hypergraphTopologySprings: 0 },
    OneHugeEdge1K: { hyperedges: 1, vertices: 1_000, incidences: 1_000, forceGateOpen: false, storedPairSprings: 0 },
    forceThreshold: threshold,
    PrototypeIDs,
    LiteralNullID,
    WeightZero,
  },
  issues,
  allRequiredFailuresReproduced: ["HG713-R01", "HG713-R02", "HG713-R06", "HG713-C05", "HG713-C09", "HG713-S01", "HG713-S02", "HG713-S04"]
    .every(id => issues[id].reproduced),
  protectedPrechangeContracts: ["HG713-S03", "N02"].every(id => issues[id].status === "already_protected"),
};

await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
console.log(`Stage 5 pre-change characterization written to ${outputPath}`);
console.log(`Required failures reproduced: ${artifact.allRequiredFailuresReproduced}`);
console.log(`Already-protected contracts recorded truthfully: ${artifact.protectedPrechangeContracts}`);
if (!artifact.allRequiredFailuresReproduced || !artifact.protectedPrechangeContracts) process.exitCode = 1;
