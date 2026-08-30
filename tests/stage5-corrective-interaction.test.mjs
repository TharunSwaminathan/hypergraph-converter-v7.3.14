import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { createServer } from "vite";

const window = new Window({ url: "http://localhost:5173/" });
globalThis.window = window;
globalThis.document = window.document;
Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
globalThis.HTMLElement = window.HTMLElement;
globalThis.HTMLCanvasElement = window.HTMLCanvasElement;
globalThis.Event = window.Event;
globalThis.MouseEvent = window.MouseEvent;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const frames = new Map();
let nextFrameId = 1;
let cancelledFrames = 0;
globalThis.requestAnimationFrame = callback => {
  const id = nextFrameId;
  nextFrameId += 1;
  frames.set(id, callback);
  return id;
};
globalThis.cancelAnimationFrame = id => {
  if (frames.delete(id)) cancelledFrames += 1;
};
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  disconnect() {}
};

const probe = { arcs: [], translations: [] };
window.HTMLCanvasElement.prototype.getContext = () => context(probe);
window.HTMLCanvasElement.prototype.toDataURL = () => "data:image/png;base64,probe";
window.HTMLCanvasElement.prototype.getBoundingClientRect = () => ({
  left: 0, top: 0, width: 800, height: 520, right: 800, bottom: 520,
});

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
try {
  const React = await import("react");
  const { act } = React;
  const { createRoot } = await import("react-dom/client");
  const { default: Viz } = await vite.ssrLoadModule("/src/components/Viz.jsx");
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  const tiny = [record("h0", ["a", "b", "c"]), record("h1", ["c", "d"])];
  let props = baseProps(tiny);
  const render = async patch => {
    props = { ...props, ...patch };
    await act(async () => root.render(React.createElement(Viz, props)));
  };

  await render({});
  drainFrames();
  const canvas = document.querySelector("canvas");
  assert.ok(canvas);

  await mouse(canvas, "mousedown", 656.8, 260, 1, act);
  await mouse(canvas, "mouseup", 656.8, 260, 0, act);
  drainFrames();
  assert.match(bodyText(), /Selected\s*h0/, "ring selection remains wired");

  const initialA = latestNode(4, 0);
  await mouse(canvas, "mousedown", initialA.x, initialA.y, 1, act);
  assert.match(bodyText(), /Selected\s*a/, "node selection remains wired");
  const targetA = { x: initialA.x + 120, y: initialA.y + 100 };
  await mouse(canvas, "mousemove", targetA.x, targetA.y, 1, act);
  flushOneFrame();
  assertPoint(latestNode(4, 0), targetA, "drag must survive the selection effect commit");
  await mouse(canvas, "mouseup", targetA.x, targetA.y, 0, act);
  drainFrames();
  assert.equal(frames.size, 0, "mouseup must return the static Circular Preview to RAF idle");
  await mouse(canvas, "mousemove", targetA.x + 70, targetA.y + 50, 0, act);
  drainFrames();
  assertPoint(latestNode(4, 0), targetA, "mousemove after mouseup must not retain stale drag");

  const selectedPanStart = latestTranslation();
  await mouse(canvas, "mousedown", 20, 480, 1, act);
  assert.doesNotMatch(bodyText(), /Selected\s/, "empty pan preserves selection clearing");
  await mouse(canvas, "mousemove", 80, 510, 1, act);
  flushOneFrame();
  assertPoint(latestTranslation(), add(selectedPanStart, 60, 30), "pan must survive selection-clearing commit");
  await mouse(canvas, "mouseup", 80, 510, 0, act);
  drainFrames();
  assert.equal(frames.size, 0);

  const unselectedPanStart = latestTranslation();
  await mouse(canvas, "mousedown", 20, 480, 1, act);
  await mouse(canvas, "mousemove", 50, 500, 1, act);
  flushOneFrame();
  assertPoint(latestTranslation(), add(unselectedPanStart, 30, 20), "pan without prior selection must work");
  await mouse(canvas, "mouseup", 50, 500, 0, act);
  drainFrames();

  const leaveStart = latestTranslation();
  await mouse(canvas, "mousedown", 20, 480, 1, act);
  await mouse(canvas, "mouseout", 20, 480, 0, act, { relatedTarget: null });
  await mouse(canvas, "mousemove", 90, 515, 1, act);
  drainFrames();
  assertPoint(latestTranslation(), leaveStart, "mouseleave must terminate pan before later movement");
  assert.equal(frames.size, 0);

  const touchStart = latestTranslation();
  await touch(canvas, "touchstart", [{ clientX: 20, clientY: 480 }], act);
  await touch(canvas, "touchend", [], act);
  await touch(canvas, "touchmove", [{ clientX: 100, clientY: 510 }], act);
  drainFrames();
  assertPoint(latestTranslation(), touchStart, "touchend must terminate pan before later touch movement");
  assert.equal(frames.size, 0);

  const beforeGraph = structuredClone(tiny);
  const currentTransform = latestTranslation();
  const currentA = latestNode(4, 0);
  await mouse(canvas, "mousedown", currentA.x + currentTransform.x, currentA.y + currentTransform.y, 1, act);
  const replacement = [record("replacement", ["x", "y"])];
  await render({ hyperedges: replacement });
  drainFrames();
  const replacementBeforeMove = latestNodes(2);
  await mouse(canvas, "mousemove", 600, 300, 1, act);
  drainFrames();
  assert.deepEqual(latestNodes(2), replacementBeforeMove, "graph replacement must reject removed drag IDs");
  assert.deepEqual(tiny, beforeGraph, "Preview dragging must never mutate canonical graph data");
  assert.equal(frames.size, 0);

  await render({ hyperedges: tiny, controlledLayout: "circular", controlledViewMode: "hypergraph" });
  drainFrames();
  const transformAfterReplacement = latestTranslation();
  const layoutA = latestNode(4, 0);
  await mouse(canvas, "mousedown", layoutA.x + transformAfterReplacement.x, layoutA.y + transformAfterReplacement.y, 1, act);
  await render({ controlledLayout: "grid" });
  drainFrames();
  const gridBeforeMove = latestNodes(4);
  await mouse(canvas, "mousemove", 700, 400, 1, act);
  drainFrames();
  assert.deepEqual(latestNodes(4), gridBeforeMove, "layout replacement must cancel incompatible drag");

  await mouse(canvas, "mousedown", 20, 480, 1, act);
  await render({ controlledViewMode: "linegraph" });
  drainFrames();
  const viewSwitchTranslation = latestTranslation();
  await mouse(canvas, "mousemove", 100, 510, 1, act);
  drainFrames();
  assertPoint(latestTranslation(), viewSwitchTranslation, "view replacement must cancel incompatible pan");
  await mouse(canvas, "mouseup", 100, 510, 0, act);
  assert.deepEqual(tiny, beforeGraph, "view switching must not mutate canonical graph data");

  await act(async () => root.unmount());
  assert.equal(frames.size, 0);
  assert.ok(cancelledFrames > 0, "effect replacement/unmount must cancel outstanding frames");
} finally {
  await vite.close();
  window.close();
}

console.log("v7.3.14 Stage 5 corrective interaction lifecycle passed (drag/pan commits, termination, and replacement safety).");

function baseProps(hyperedges) {
  return {
    hyperedges,
    vizLimit: 200,
    setVizLimit() {},
    controlledLayout: "circular",
    controlledViewMode: "hypergraph",
    algoHighlight: null,
    componentColors: new Map(),
  };
}

function record(id, vertices) {
  return { id, vertices, time: null, weight: 1, attributes: {} };
}

async function mouse(canvas, type, clientX, clientY, buttons, act, extra = {}) {
  await act(async () => {
    canvas.dispatchEvent(new window.MouseEvent(type, {
      bubbles: true, cancelable: true, clientX, clientY, buttons, ...extra,
    }));
  });
}

async function touch(canvas, type, touches, act) {
  const event = new window.Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "touches", { value: touches });
  await act(async () => canvas.dispatchEvent(event));
}

function flushOneFrame() {
  assert.ok(frames.size > 0, "an interaction frame must be scheduled");
  const [id, callback] = frames.entries().next().value;
  frames.delete(id);
  callback(performance.now());
}

function drainFrames(limit = 20) {
  let count = 0;
  while (frames.size && count < limit) {
    flushOneFrame();
    count += 1;
  }
  assert.equal(frames.size, 0, `RAF did not become idle within ${limit} frames`);
}

function latestNodes(vertexCount) {
  return probe.arcs.filter(({ radius }) => radius <= 14).slice(-vertexCount).map(({ x, y }) => ({ x, y }));
}

function latestNode(vertexCount, index) {
  const nodes = latestNodes(vertexCount);
  assert.equal(nodes.length, vertexCount);
  return nodes[index];
}

function latestTranslation() {
  const value = probe.translations.at(-1) ?? { x: 0, y: 0 };
  return { ...value };
}

function add(point, x, y) {
  return { x: point.x + x, y: point.y + y };
}

function assertPoint(actual, expected, message) {
  assert.ok(Math.abs(actual.x - expected.x) < 0.001 && Math.abs(actual.y - expected.y) < 0.001,
    `${message}: expected (${expected.x}, ${expected.y}), received (${actual.x}, ${actual.y})`);
}

function bodyText() {
  return document.body.textContent.replace(/\s+/g, " ");
}

function context(drawProbe) {
  return {
    setTransform() {}, clearRect() {}, save() {}, restore() {}, scale() {},
    beginPath() {}, ellipse() {}, fill() {}, stroke() {}, setLineDash() {}, fillText() {},
    moveTo() {}, lineTo() {},
    translate(x, y) { drawProbe.translations.push({ x, y }); },
    arc(x, y, radius) { drawProbe.arcs.push({ x, y, radius }); },
    fillStyle: "", strokeStyle: "", lineWidth: 1, font: "", textAlign: "",
  };
}
