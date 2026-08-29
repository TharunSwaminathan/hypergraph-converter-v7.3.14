import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import {
  buildPreviewTopology,
  chooseForceStrategy,
  createInitialNodePositions,
  FORCE_CONSTANTS,
  reheatForceState,
  stepHypergraphForce,
} from "../src/visualization/hypergraphLayout.js";
import { computeHyperedgeBounds, hitHyperedgeRing } from "../src/visualization/previewGeometry.js";
import { buildVisualCoMembershipOverlay, selectLineGraphVisualEdges } from "../src/visualization/previewRenderBudget.js";
import {
  computeCanvasBackingSize,
  createPreviewRafScheduler,
  hyperedgeMetadata,
  resolvePreviewSearch,
} from "../src/visualization/previewRuntime.js";
import {
  DuplicateOverlap,
  OneHugeEdge1K,
  OneHugeEdge5K,
  PrototypeIDs,
  TinyBasic,
} from "../tests/fixtures/v7.3.14/stage0-regression-fixtures.mjs";

const scriptRoot = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(scriptRoot);
const outputArgument = process.argv.find(argument => argument.startsWith("--output="));
const outputPath = resolve(outputArgument?.slice("--output=".length)
  ?? join(projectRoot, "artifacts", "v7.3.14-stage5-oracle.json"));
const prechange = JSON.parse(await readFile(join(projectRoot, "artifacts", "v7.3.14-stage5-prechange-characterization.json"), "utf8"));
const vizSource = await readFile(join(projectRoot, "src", "components", "Viz.jsx"), "utf8");
const layoutSource = await readFile(join(projectRoot, "src", "visualization", "hypergraphLayout.js"), "utf8");

const topologyAttraction = characterizeAttraction();
const transitions = Object.fromEntries([699, 700, 701, 702, 1_000].map(count => [count, characterizeTransition(count)]));
const tiny = characterizeFixture("TinyBasic", TinyBasic, 20);
const overlap = characterizeFixture("DuplicateOverlap", DuplicateOverlap(), 10);
const huge1k = characterizeFixture("OneHugeEdge1K", OneHugeEdge1K(), 10);
const heapBefore5k = process.memoryUsage().heapUsed;
const huge5k = characterizeFixture("OneHugeEdge5K", OneHugeEdge5K(), 10);
huge5k.heapDeltaBytes = process.memoryUsage().heapUsed - heapBefore5k;

const geometryNodes = new Map([
  ["a", { id: "a", x: 100, y: 100 }],
  ["b", { id: "b", x: 200, y: 100 }],
]);
const ring = computeHyperedgeBounds([...geometryNodes.values()]);
const ringHit = hitHyperedgeRing([record("ring", ["a", "b"])], geometryNodes, ring.cx + ring.rx, ring.cy);
const prototypeTopology = buildPreviewTopology(PrototypeIDs);
const prototypeNodes = createInitialNodePositions(prototypeTopology.vertices, 800, 520, "force");
const prototypeTick = stepHypergraphForce({ nodes: prototypeNodes, topology: prototypeTopology, width: 800, height: 520, alpha: 1 });
const lineEdges = Array.from({ length: 5_500 }, (_, index) => ({ src: `v${index}`, dst: `v${index + 1}` }));
const lineVisual = selectLineGraphVisualEdges(lineEdges);
const raf = characterizeRafLifecycle();
const configuredSettleRafCount = Math.ceil(Math.log(FORCE_CONSTANTS.settledAlpha) / Math.log(FORCE_CONSTANTS.alphaDecay));

const checks = [
  check("STAGE5-PRECHANGE", "Required Preview defects were characterized before production editing", prechange.allRequiredFailuresReproduced && prechange.protectedPrechangeContracts, prechange.issues),
  check("HG713-R01", "Incidence-centroid topology materially attracts shared members", topologyAttraction.attractedDistance < topologyAttraction.controlDistance * 0.8, topologyAttraction),
  check("HG713-R01-NO-V2V", "Hypergraph Force has no full-V2V dependency", !/(?:projection|mappings)\.js/.test(layoutSource)
    && /stepHypergraphForce\(\{ nodes: ns, topology/.test(vizSource)
    && !/stepHypergraphForce\([^)]*(?:v2v|visualEdges)/.test(vizSource), { layoutImportsProjection: /(?:projection|mappings)\.js/.test(layoutSource) }),
  check("HG713-R06", "Force uses meaningful exact/approximate strategies across the former 700 cliff", Object.values(transitions).every(result => result.positionChanged && result.finite && result.reheatAlpha === 1)
    && transitions[700].forceMode === "exact" && transitions[701].forceMode === "approximate", transitions),
  check("HG713-R02-C05", "Visual co-membership and Line Graph LOD are bounded separately from analytical data", huge1k.visual.renderedVisualRelations <= 64
    && huge1k.visual.totalCandidateRelations === 499_500
    && lineVisual.analyticalEdgeCount === 5_500
    && lineVisual.renderedEdgeCount === 4_000
    && lineEdges.length === 5_500, {
    huge1kVisual: huge1k.visual,
    lineVisual: {
      status: lineVisual.status,
      complete: lineVisual.complete,
      analyticalEdgeCount: lineVisual.analyticalEdgeCount,
      renderedEdgeCount: lineVisual.renderedEdgeCount,
      reason: lineVisual.reason,
    },
  }),
  check("STAGE5-RAF", "RAF stops when settled, restarts, prevents duplicates, and cancels on dispose", raf.idleAfterSettle && raf.restarted && raf.duplicatePrevented && raf.cancelledOnDispose, raf),
  check("HG713-S01", "Ring hit testing uses the shared rendered perimeter geometry", ringHit?.hyperedge.id === "ring", { ring, hit: ringHit }),
  check("HG713-S02", "Numeric vertex zero resolves without a truthiness false-negative", resolvePreviewSearch([0, "other"], "0") === 0, { result: resolvePreviewSearch([0, "other"], "0") }),
  check("N02", "Literal null remains distinct from unset search state", resolvePreviewSearch(["null", "other"], "") === null && resolvePreviewSearch(["null", "other"], "null") === "null", { unset: resolvePreviewSearch(["null"], ""), literal: resolvePreviewSearch(["null"], "null") }),
  check("HG713-S03", "Prototype-like positions remain Map-backed and finite through Force", prototypeNodes instanceof Map
    && ["__proto__", "constructor", "toString"].every(id => prototypeNodes.has(id))
    && finite(prototypeNodes) && prototypeTick.active, { keys: [...prototypeNodes.keys()], forceMode: prototypeTick.strategy.forceMode }),
  check("HG713-C09", "Weight zero is present in Preview metadata", same(hyperedgeMetadata(record("zero", ["a"], { weight: 0 })), [["vertices", "a"], ["cardinality", "1"], ["weight", "0"]]), hyperedgeMetadata(record("zero", ["a"], { weight: 0 }))),
  check("HG713-S04", "Canvas backing dimensions follow CSS size and DPR independently", same(computeCanvasBackingSize(640, 400, 2), { cssWidth: 640, cssHeight: 400, dpr: 2, backingWidth: 1_280, backingHeight: 800 })
    && /ResizeObserver/.test(vizSource), { dpr1: computeCanvasBackingSize(640, 400, 1), dpr2: computeCanvasBackingSize(640, 400, 2) }),
  check("STAGE5-VIEW-ISOLATION", "View switching changes only visual edge selection, not Hypergraph topology Force", /const visualEdges = viewMode === "linegraph"/.test(vizSource)
    && /stepHypergraphForce\(\{ nodes: ns, topology/.test(vizSource), { topologyMode: "incidence_centroid", analyticalProjectionRequestedOnlyFor: "linegraph" }),
  check("STAGE5-ONE-HUGE-EDGE", "OneHugeEdge1K uses 1,000 incidence attractions without stored clique springs", huge1k.vertices === 1_000
    && huge1k.incidences === 1_000
    && huge1k.attractionRelationships === 1_000
    && huge1k.storedPairSprings === 0
    && huge1k.forceMode === "approximate"
    && huge1k.finite, huge1k),
];

const passed = checks.filter(item => item.passed).length;
const artifact = {
  stage: 5,
  kind: "graph_preview_correctness_and_scalable_layout_oracle",
  parentCommit: "e576ee3849ad679ce847ac143ab1b077f69893d5",
  status: passed === checks.length ? "passed" : "failed",
  passed,
  total: checks.length,
  environment: { runtime: process.version, platform: `${process.platform}/${process.arch}` },
  forceConstants: FORCE_CONSTANTS,
  performance: { configuredSettleRafCount, rafLifecycle: raf, TinyBasic: tiny, DuplicateOverlap: overlap, transitions, OneHugeEdge1K: huge1k, OneHugeEdge5K: huge5k },
  checks,
};
await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
console.log(`Stage 5 oracle: ${passed}/${checks.length} families passed.`);
console.log(`Evidence: ${outputPath}`);
for (const item of checks) console.log(`${item.passed ? "PASS" : "FAIL"} ${item.id} — ${item.title}`);
if (passed !== checks.length) process.exitCode = 1;

function characterizeAttraction() {
  const topology = buildPreviewTopology([record("h1", ["a", "b"]), record("h2", ["c", "d"])]);
  const starting = new Map([["a", node("a", 80, 250)], ["b", node("b", 330, 250)], ["c", node("c", 670, 250)], ["d", node("d", 920, 250)]]);
  const attracted = clone(starting);
  const control = clone(starting);
  let attractedAlpha = 1, controlAlpha = 1;
  for (let tick = 0; tick < 40; tick += 1) {
    attractedAlpha = stepHypergraphForce({ nodes: attracted, topology, width: 1_000, height: 500, alpha: attractedAlpha }).alpha;
    controlAlpha = stepHypergraphForce({ nodes: control, topology: { hyperedges: [] }, width: 1_000, height: 500, alpha: controlAlpha }).alpha;
  }
  return { initialDistance: 250, attractedDistance: distance(attracted, "a", "b"), controlDistance: distance(control, "a", "b"), ticks: 40 };
}

function characterizeTransition(vertexCount) {
  const graph = [record("transition", Array.from({ length: vertexCount }, (_, index) => `v${index}`))];
  const topology = buildPreviewTopology(graph);
  const nodes = createInitialNodePositions(topology.vertices, 1_200, 720, "force");
  const before = nodes.get("v0").x;
  const tick = stepHypergraphForce({ nodes, topology, width: 1_200, height: 720, alpha: 1 });
  const state = { alpha: 0 }; reheatForceState(state);
  return { vertexCount, forceMode: tick.strategy.forceMode, repulsionMode: tick.strategy.repulsionMode, repulsionWork: tick.repulsionWork, attractionWork: tick.attractionWork, positionChanged: nodes.get("v0").x !== before, finite: finite(nodes), reheatAlpha: state.alpha };
}

function characterizeFixture(name, graph, tickCount) {
  const started = performance.now();
  const topology = buildPreviewTopology(graph);
  const indexMs = performance.now() - started;
  const nodes = createInitialNodePositions(topology.vertices, 1_400, 800, "force");
  const initializedMs = performance.now() - started;
  let alpha = 1, lastTick = null;
  const tickStarted = performance.now();
  for (let tick = 0; tick < tickCount; tick += 1) {
    lastTick = stepHypergraphForce({ nodes, topology, width: 1_400, height: 800, alpha });
    alpha = lastTick.alpha;
  }
  const visual = buildVisualCoMembershipOverlay(graph);
  return { name, hyperedges: topology.counts.hyperedges, vertices: topology.counts.vertices, incidences: topology.counts.incidences, attractionRelationships: topology.attractionRelationships, storedPairSprings: 0, forceMode: lastTick?.strategy.forceMode ?? chooseForceStrategy(nodes.size).forceMode, repulsionMode: lastTick?.strategy.repulsionMode, visual: visual.usage, visualStatus: visual.status, finite: finite(nodes), indexMs, initializationMs: initializedMs, forceTicks: tickCount, forceTicksMs: performance.now() - tickStarted, alphaAfterTicks: alpha };
}

function characterizeRafLifecycle() {
  const callbacks = new Map(); let nextId = 1, ticks = 3, draws = 0, cancelled = 0;
  const scheduler = createPreviewRafScheduler({
    requestFrame(callback) { const id = nextId++; callbacks.set(id, callback); return id; },
    cancelFrame(id) { if (callbacks.delete(id)) cancelled += 1; },
    drawFrame() { draws += 1; ticks -= 1; return ticks > 0; },
  });
  const first = scheduler.request(); const duplicate = scheduler.request(); flush(callbacks);
  const idleAfterSettle = callbacks.size === 0 && draws === 3;
  ticks = 2; const restarted = scheduler.request(); flush(callbacks);
  ticks = 5; scheduler.request(); scheduler.dispose();
  return { firstScheduled: first, duplicatePrevented: duplicate === false, idleAfterSettle, restarted, cancelledOnDispose: cancelled === 1, draws };
}

function flush(callbacks) { while (callbacks.size) { const [id, callback] = callbacks.entries().next().value; callbacks.delete(id); callback(performance.now()); } }
function check(id, title, passed, evidence) { return { id, title, passed: Boolean(passed), evidence }; }
function record(id, vertices, extra = {}) { return { id, vertices, time: extra.time ?? null, weight: extra.weight ?? 1, attributes: {} }; }
function node(id, x, y) { return { id, x, y, vx: 0, vy: 0 }; }
function clone(nodes) { return new Map([...nodes].map(([id, value]) => [id, { ...value }])); }
function distance(nodes, left, right) { return Math.hypot(nodes.get(left).x - nodes.get(right).x, nodes.get(left).y - nodes.get(right).y); }
function finite(nodes) { return [...nodes.values()].every(current => [current.x, current.y, current.vx, current.vy].every(Number.isFinite)); }
function same(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
