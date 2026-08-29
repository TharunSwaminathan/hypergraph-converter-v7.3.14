import assert from "node:assert/strict";
import {
  buildPreviewTopology,
  chooseForceStrategy,
  createInitialNodePositions,
  reheatForceState,
  stepHypergraphForce,
} from "../src/visualization/hypergraphLayout.js";
import {
  OneHugeEdge1K,
  OneHugeEdge5K,
} from "./fixtures/v7.3.14/stage0-regression-fixtures.mjs";

const disconnected = [record("h1", ["a", "b"]), record("h2", ["c", "d"])];
const disconnectedTopology = buildPreviewTopology(disconnected);
assert.equal(disconnectedTopology.counts.incidences, 4);
assert.equal(disconnectedTopology.attractionRelationships, 4);
const initial = new Map([
  ["a", node("a", 80, 250)],
  ["b", node("b", 330, 250)],
  ["c", node("c", 670, 250)],
  ["d", node("d", 920, 250)],
]);
const attracted = cloneNodes(initial);
const control = cloneNodes(initial);
const noTopology = { hyperedges: [], counts: { hyperedges: 0, vertices: 4, incidences: 0 } };
let attractedAlpha = 1;
let controlAlpha = 1;
for (let tick = 0; tick < 40; tick += 1) {
  attractedAlpha = stepHypergraphForce({ nodes: attracted, topology: disconnectedTopology, width: 1_000, height: 500, alpha: attractedAlpha }).alpha;
  controlAlpha = stepHypergraphForce({ nodes: control, topology: noTopology, width: 1_000, height: 500, alpha: controlAlpha }).alpha;
}
assert.ok(distance(attracted, "a", "b") < distance(control, "a", "b") * 0.8, "incidence topology must materially attract shared members");
assert.ok(distance(attracted, "c", "d") < distance(control, "c", "d") * 0.8, "disconnected hyperedge members must receive their own attraction");

const overlapTopology = buildPreviewTopology([
  record("h1", ["a", "b", "c"]),
  record("h2", ["c", "d"]),
]);
const overlapNodes = createInitialNodePositions(overlapTopology.vertices, 800, 520, "force");
const overlapTick = stepHypergraphForce({ nodes: overlapNodes, topology: overlapTopology, width: 800, height: 520, alpha: 1 });
assert.equal(overlapTick.attractionWork, 5, "the shared vertex participates once per incident hyperedge without clique springs");
assert.equal("pairSprings" in overlapTopology, false);

const emptySingletonTopology = buildPreviewTopology([
  record("empty", []),
  record("singleton", ["solo"]),
]);
const singletonNodes = createInitialNodePositions(emptySingletonTopology.vertices, 400, 300, "force");
const singletonTick = stepHypergraphForce({ nodes: singletonNodes, topology: emptySingletonTopology, width: 400, height: 300, alpha: 1 });
assert.equal(singletonTick.attractionWork, 0, "empty/singleton hyperedges must not create self-attraction");

for (const vertexCount of [699, 700, 701, 702, 1_000]) {
  const ids = Array.from({ length: vertexCount }, (_, index) => `v${index}`);
  const topology = buildPreviewTopology([record("transition", ids)]);
  const nodes = createInitialNodePositions(ids, 1_200, 720, "force");
  const before = nodes.get("v0").x;
  const result = stepHypergraphForce({ nodes, topology, width: 1_200, height: 720, alpha: 1 });
  assert.equal(result.strategy.forceMode, vertexCount <= 700 ? "exact" : "approximate");
  assert.ok(result.repulsionWork > 0 && result.attractionWork === vertexCount);
  assert.notEqual(nodes.get("v0").x, before, `${vertexCount}: an active force tick must change a valid position`);
  assertFinite(nodes);
  const state = { alpha: 0 };
  assert.equal(reheatForceState(state), true);
  assert.equal(state.alpha, 1, `${vertexCount}: Reheat must restore energy`);
}

const hugeTopology = buildPreviewTopology(OneHugeEdge1K());
const hugeNodes = createInitialNodePositions(hugeTopology.vertices, 1_200, 720, "force");
const hugeTick = stepHypergraphForce({ nodes: hugeNodes, topology: hugeTopology, width: 1_200, height: 720, alpha: 1 });
assert.equal(hugeTopology.counts.vertices, 1_000);
assert.equal(hugeTopology.counts.incidences, 1_000);
assert.equal(hugeTopology.attractionRelationships, 1_000);
assert.equal(hugeTick.strategy.forceMode, "approximate");
assert.ok(hugeTick.repulsionWork <= 24_000);
assert.equal(hugeTick.attractionWork, 1_000);
assert.equal("pairSprings" in hugeTopology, false);
assertFinite(hugeNodes);

const stressStarted = performance.now();
const stressTopology = buildPreviewTopology(OneHugeEdge5K());
const stressNodes = createInitialNodePositions(stressTopology.vertices, 1_600, 900, "force");
let stressAlpha = 1;
let stressTick;
for (let tick = 0; tick < 5; tick += 1) {
  stressTick = stepHypergraphForce({ nodes: stressNodes, topology: stressTopology, width: 1_600, height: 900, alpha: stressAlpha });
  stressAlpha = stressTick.alpha;
}
assert.equal(stressTick.strategy.forceMode, "approximate");
assert.equal(stressTick.attractionWork, 5_000);
assert.ok(stressTick.repulsionWork <= 120_000);
assertFinite(stressNodes);

console.log(`v7.3.14 Stage 5 incidence-native layout tests passed; OneHugeEdge5K init+5 ticks ${(performance.now() - stressStarted).toFixed(1)}ms.`);

function record(id, vertices) {
  return { id, vertices, time: null, weight: 1, attributes: {} };
}

function node(id, x, y) {
  return { id, x, y, vx: 0, vy: 0 };
}

function cloneNodes(nodes) {
  return new Map([...nodes].map(([id, value]) => [id, { ...value }]));
}

function distance(nodes, left, right) {
  return Math.hypot(nodes.get(left).x - nodes.get(right).x, nodes.get(left).y - nodes.get(right).y);
}

function assertFinite(nodes) {
  for (const current of nodes.values()) {
    assert.ok([current.x, current.y, current.vx, current.vy].every(Number.isFinite), `${current.id}: coordinates must remain finite`);
  }
}
