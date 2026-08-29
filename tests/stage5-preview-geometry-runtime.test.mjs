import assert from "node:assert/strict";
import {
  computeHyperedgeBounds,
  hitHyperedgeRing,
  hitNode,
} from "../src/visualization/previewGeometry.js";
import {
  computeCanvasBackingSize,
  createPreviewRafScheduler,
  hyperedgeMetadata,
  resolvePreviewSearch,
  shouldDisplayWeight,
} from "../src/visualization/previewRuntime.js";

const nodes = new Map([
  ["a", { id: "a", x: 100, y: 100 }],
  ["b", { id: "b", x: 200, y: 100 }],
  ["c", { id: "c", x: 150, y: 180 }],
]);
const bounds = computeHyperedgeBounds([...nodes.values()]);
assert.deepEqual(bounds, { cx: 150, cy: 126.66666666666667, rx: 78, ry: 81.33333333333333 });
const graph = [record("outer", ["a", "b", "c"]), record("small", ["a", "b"])];
assert.equal(hitHyperedgeRing(graph, nodes, bounds.cx + bounds.rx, bounds.cy)?.hyperedge.id, "outer");
assert.equal(hitHyperedgeRing(graph, nodes, 150, 100), null, "ellipse interior must not count as a ring click");
assert.equal(hitNode(nodes, 101, 100)?.id, "a", "node testing remains the first interaction priority");

const overlapNodes = new Map([
  ["a", { id: "a", x: 100, y: 100 }],
  ["b", { id: "b", x: 156, y: 100 }],
  ["c", { id: "c", x: 44, y: 100 }],
]);
const overlapping = [record("large", ["a", "b", "c"]), record("small", ["a"])];
const smallBounds = computeHyperedgeBounds([overlapNodes.get("a")]);
assert.equal(hitHyperedgeRing(overlapping, overlapNodes, smallBounds.cx + smallBounds.rx, smallBounds.cy)?.hyperedge.id, "small", "nearest/smallest ring must win overlap");

const identifiers = [0, "__proto__", "constructor", "toString", "null", " A ", "\"foo\"", "é", "e\u0301", "😀", "#lead"];
assert.equal(resolvePreviewSearch(identifiers, "0"), 0);
assert.equal(resolvePreviewSearch(identifiers, "proto"), "__proto__");
assert.equal(resolvePreviewSearch(identifiers, "null"), "null");
assert.equal(resolvePreviewSearch(identifiers, ""), null);
assert.equal(resolvePreviewSearch(identifiers, "é"), "é");
assert.equal(resolvePreviewSearch(identifiers, "e\u0301"), "e\u0301");

assert.equal(shouldDisplayWeight(0), true);
assert.equal(shouldDisplayWeight(-2), true);
assert.equal(shouldDisplayWeight(1), false);
assert.equal(shouldDisplayWeight(null), false);
assert.deepEqual(hyperedgeMetadata(record("zero", ["a", "b"], { time: 0, weight: 0 })), [
  ["vertices", "a, b"],
  ["cardinality", "2"],
  ["time", "0"],
  ["weight", "0"],
]);

assert.deepEqual(computeCanvasBackingSize(640, 520, 1), { cssWidth: 640, cssHeight: 520, dpr: 1, backingWidth: 640, backingHeight: 520 });
assert.deepEqual(computeCanvasBackingSize(640, 520, 2), { cssWidth: 640, cssHeight: 520, dpr: 2, backingWidth: 1_280, backingHeight: 1_040 });
assert.equal(computeCanvasBackingSize(640, 520, 99).dpr, 3, "absurd DPR values are capped to bound backing memory");

const callbacks = new Map();
let nextFrameId = 1;
let drawCount = 0;
let activeTicks = 3;
const scheduler = createPreviewRafScheduler({
  requestFrame(callback) { const id = nextFrameId++; callbacks.set(id, callback); return id; },
  cancelFrame(id) { callbacks.delete(id); },
  drawFrame() { drawCount += 1; activeTicks -= 1; return activeTicks > 0; },
});
assert.equal(scheduler.request(), true);
assert.equal(scheduler.request(), false, "duplicate RAF loops are forbidden");
flushFrames(callbacks);
assert.equal(drawCount, 3);
assert.equal(callbacks.size, 0, "settled graph must become RAF-idle");
activeTicks = 2;
assert.equal(scheduler.request(), true, "Reheat/interaction can restart an idle scheduler");
flushFrames(callbacks);
assert.equal(drawCount, 5);
assert.equal(callbacks.size, 0);
activeTicks = 5;
scheduler.request();
scheduler.dispose();
assert.equal(callbacks.size, 0, "unmount/dispose must cancel the outstanding RAF");
assert.equal(scheduler.request(), false);

console.log("v7.3.14 Stage 5 geometry, identity, metadata, resize, and RAF lifecycle tests passed.");

function flushFrames(queue) {
  while (queue.size) {
    const [id, callback] = queue.entries().next().value;
    queue.delete(id);
    callback(performance.now());
  }
}

function record(id, vertices, extra = {}) {
  return { id, vertices, time: extra.time ?? null, weight: extra.weight ?? 1, attributes: {} };
}
