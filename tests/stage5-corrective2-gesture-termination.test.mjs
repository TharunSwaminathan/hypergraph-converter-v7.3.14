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
  const graph = [record("h0", ["a", "b", "c"]), record("h1", ["c", "d"])];

  await act(async () => {
    root.render(React.createElement(Viz, {
      hyperedges: graph,
      vizLimit: 200,
      setVizLimit() {},
      controlledLayout: "circular",
      controlledViewMode: "hypergraph",
      algoHighlight: null,
      componentColors: new Map(),
    }));
  });
  drainFrames();
  const canvas = document.querySelector("canvas");
  assert.ok(canvas);

  // Ring selection and node-over-ring priority remain intact.
  await mouse(canvas, "mousedown", 656.8, 260, 1, act);
  await mouse(canvas, "mouseup", 656.8, 260, 0, act);
  drainFrames();
  assert.match(bodyText(), /Selected\s*h0/, "ring selection remains wired");
  const selectionNode = latestNode(4, 0);
  await mouse(canvas, "mousedown", selectionNode.x, selectionNode.y, 1, act);
  await mouse(canvas, "mouseup", selectionNode.x, selectionNode.y, 0, act);
  drainFrames();
  assert.match(bodyText(), /Selected\s*a/, "node hit remains higher priority than ring hit");

  // S5-N01: selected-state pan survives the selection-clearing rerender.
  const selectedPanStart = latestTranslation();
  await mouse(canvas, "mousedown", 20, 480, 1, act);
  assert.doesNotMatch(bodyText(), /Selected\s/, "empty canvas still clears selection");
  await mouse(canvas, "mousemove", 70, 505, 1, act);
  flushOneFrame();
  assertPoint(latestTranslation(), add(selectedPanStart, 50, 25), "selected-state pan survives rerender");
  await mouse(canvas, "mouseup", 70, 505, 0, act);
  drainFrames();

  // Normal unselected pan remains functional.
  const unselectedPanStart = latestTranslation();
  await mouse(canvas, "mousedown", 20, 480, 1, act);
  await mouse(canvas, "mousemove", 50, 500, 1, act);
  flushOneFrame();
  assertPoint(latestTranslation(), add(unselectedPanStart, 30, 20), "ordinary in-canvas pan remains functional");
  await mouse(canvas, "mouseup", 50, 500, 0, act);
  drainFrames();

  // S5-N01: node drag survives its selection-commit rerender.
  const normalDragNode = latestNode(4, 0);
  const normalDragScreen = worldToScreen(normalDragNode);
  await mouse(canvas, "mousedown", normalDragScreen.x, normalDragScreen.y, 1, act);
  const normalDragTarget = add(normalDragScreen, 60, 40);
  await mouse(canvas, "mousemove", normalDragTarget.x, normalDragTarget.y, 1, act);
  flushOneFrame();
  const normalDraggedNode = latestNode(4, 0);
  assertPoint(normalDraggedNode, screenToWorld(normalDragTarget), "ordinary in-canvas node drag remains functional");
  await mouse(canvas, "mouseup", normalDragTarget.x, normalDragTarget.y, 0, act);
  drainFrames();

  // A. A buttons-zero mousemove self-heals stale pan without another transform change.
  await mouse(canvas, "mousedown", 20, 480, 1, act);
  await mouse(canvas, "mousemove", 60, 500, 1, act);
  flushOneFrame();
  const stalePanHeld = latestTranslation();
  await mouse(canvas, "mousemove", 110, 540, 0, act);
  drainFrames();
  assertPoint(latestTranslation(), stalePanHeld, "buttons-zero movement must not continue stale pan");
  assert.equal(frames.size, 0, "buttons-zero pan self-heal must return static Preview to RAF idle");

  // B. A buttons-zero mousemove self-heals stale drag without another node move.
  const staleDragNode = latestNode(4, 0);
  const staleDragScreen = worldToScreen(staleDragNode);
  await mouse(canvas, "mousedown", staleDragScreen.x, staleDragScreen.y, 1, act);
  const staleDragHeldTarget = add(staleDragScreen, 40, 30);
  await mouse(canvas, "mousemove", staleDragHeldTarget.x, staleDragHeldTarget.y, 1, act);
  flushOneFrame();
  const staleDragHeld = latestNode(4, 0);
  await mouse(canvas, "mousemove", staleDragHeldTarget.x + 70, staleDragHeldTarget.y + 50, 0, act);
  drainFrames();
  assertPoint(latestNode(4, 0), staleDragHeld, "buttons-zero movement must not continue stale drag");
  await mouse(canvas, "mousemove", staleDragHeldTarget.x + 90, staleDragHeldTarget.y + 70, 1, act);
  drainFrames();
  assertPoint(latestNode(4, 0), staleDragHeld, "later hover movement must not revive healed drag");

  // C. A window-level mouseup terminates pan and drag outside the canvas.
  await mouse(canvas, "mousedown", 20, 480, 1, act);
  await mouse(canvas, "mousemove", 55, 500, 1, act);
  flushOneFrame();
  const windowUpPan = latestTranslation();
  await windowEvent("mouseup", act, { buttons: 0 });
  await mouse(canvas, "mousemove", 120, 540, 1, act);
  drainFrames();
  assertPoint(latestTranslation(), windowUpPan, "window mouseup must terminate pan");

  const windowUpDragNode = latestNode(4, 0);
  const windowUpDragScreen = worldToScreen(windowUpDragNode);
  await mouse(canvas, "mousedown", windowUpDragScreen.x, windowUpDragScreen.y, 1, act);
  await mouse(canvas, "mousemove", windowUpDragScreen.x + 30, windowUpDragScreen.y + 20, 1, act);
  flushOneFrame();
  const windowUpDrag = latestNode(4, 0);
  await windowEvent("mouseup", act, { buttons: 0 });
  await mouse(canvas, "mousemove", windowUpDragScreen.x + 100, windowUpDragScreen.y + 80, 1, act);
  drainFrames();
  assertPoint(latestNode(4, 0), windowUpDrag, "window mouseup must terminate drag");

  // D. Window blur terminates either transient gesture without resetting world state.
  await mouse(canvas, "mousedown", 20, 480, 1, act);
  await mouse(canvas, "mousemove", 45, 495, 1, act);
  flushOneFrame();
  const blurPan = latestTranslation();
  await windowEvent("blur", act);
  await mouse(canvas, "mousemove", 120, 540, 1, act);
  drainFrames();
  assertPoint(latestTranslation(), blurPan, "window blur must terminate pan");

  const blurDragNode = latestNode(4, 0);
  const blurDragScreen = worldToScreen(blurDragNode);
  await mouse(canvas, "mousedown", blurDragScreen.x, blurDragScreen.y, 1, act);
  await mouse(canvas, "mousemove", blurDragScreen.x + 25, blurDragScreen.y + 15, 1, act);
  flushOneFrame();
  const blurDrag = latestNode(4, 0);
  await windowEvent("blur", act);
  await mouse(canvas, "mousemove", blurDragScreen.x + 90, blurDragScreen.y + 70, 1, act);
  drainFrames();
  assertPoint(latestNode(4, 0), blurDrag, "window blur must terminate drag");

  // F. Existing direct canvas mouseleave remains an independent termination path.
  const leavePanStart = latestTranslation();
  await mouse(canvas, "mousedown", 20, 480, 1, act);
  await mouse(canvas, "mouseout", 20, 480, 0, act, { relatedTarget: null });
  await mouse(canvas, "mousemove", 100, 520, 1, act);
  drainFrames();
  assertPoint(latestTranslation(), leavePanStart, "canvas mouseleave must still terminate pan");

  // G/H. Touch end and cancellation terminate touch gestures without a mouse-buttons dependency.
  await touch(canvas, "touchstart", [{ clientX: 20, clientY: 480 }], act);
  await touch(canvas, "touchmove", [{ clientX: 60, clientY: 500 }], act);
  flushOneFrame();
  const touchEndPan = latestTranslation();
  await touch(canvas, "touchend", [], act);
  await touch(canvas, "touchmove", [{ clientX: 120, clientY: 540 }], act);
  drainFrames();
  assertPoint(latestTranslation(), touchEndPan, "touchend must terminate pan");

  await touch(canvas, "touchstart", [{ clientX: 20, clientY: 480 }], act);
  await touch(canvas, "touchmove", [{ clientX: 55, clientY: 500 }], act);
  flushOneFrame();
  const touchCancelPan = latestTranslation();
  await touch(canvas, "touchcancel", [], act);
  await touch(canvas, "touchmove", [{ clientX: 130, clientY: 545 }], act);
  drainFrames();
  assertPoint(latestTranslation(), touchCancelPan, "touchcancel must terminate pan");
  assert.equal(frames.size, 0, "all static termination paths must finish at RAF idle");

  await act(async () => root.unmount());
  assert.equal(frames.size, 0);
  assert.ok(cancelledFrames > 0, "effect lifecycle must cancel outstanding frames");
} finally {
  await vite.close();
  window.close();
}

console.log("v7.3.14 Stage 5 corrective #2 fail-closed gesture termination passed.");

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

async function windowEvent(type, act, options = {}) {
  await act(async () => {
    const event = type === "mouseup"
      ? new window.MouseEvent(type, { bubbles: false, cancelable: true, ...options })
      : new window.Event(type);
    window.dispatchEvent(event);
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

function latestNode(vertexCount, index) {
  const nodes = probe.arcs.filter(({ radius }) => radius <= 14).slice(-vertexCount);
  assert.equal(nodes.length, vertexCount);
  return { x: nodes[index].x, y: nodes[index].y };
}

function latestTranslation() {
  const value = probe.translations.at(-1) ?? { x: 0, y: 0 };
  return { ...value };
}

function worldToScreen(point) {
  const transform = latestTranslation();
  return add(point, transform.x, transform.y);
}

function screenToWorld(point) {
  const transform = latestTranslation();
  return add(point, -transform.x, -transform.y);
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
