import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { createServer } from "vite";

const window = new Window({ url: "http://localhost:5173/" });
globalThis.window = window;
globalThis.document = window.document;
Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
Object.defineProperty(window, "devicePixelRatio", { value: 2, configurable: true });
globalThis.HTMLElement = window.HTMLElement;
globalThis.HTMLCanvasElement = window.HTMLCanvasElement;
globalThis.Event = window.Event;
globalThis.MouseEvent = window.MouseEvent;
globalThis.WheelEvent = window.WheelEvent;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const rafCallbacks = new Map();
let nextRafId = 1;
let cancelledFrames = 0;
globalThis.requestAnimationFrame = callback => { const id = nextRafId++; rafCallbacks.set(id, callback); return id; };
globalThis.cancelAnimationFrame = id => { if (rafCallbacks.delete(id)) cancelledFrames += 1; };

const resizeObservers = [];
globalThis.ResizeObserver = class ResizeObserver {
  constructor(callback) { this.callback = callback; this.target = null; resizeObservers.push(this); }
  observe(target) { this.target = target; }
  disconnect() { this.target = null; }
  emit(width, height) { this.callback([{ target: this.target, contentRect: { width, height } }]); }
};

const drawProbe = { arcs: [], translations: [] };
const context = canvasContext(drawProbe);
window.HTMLCanvasElement.prototype.getContext = () => context;
window.HTMLCanvasElement.prototype.toDataURL = () => "data:image/png;base64,probe";
window.HTMLCanvasElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
  return { left: 0, top: 0, width: 800, height: Number.parseFloat(this.style.height) || 520, right: 800, bottom: 520 };
};

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
try {
  const React = await import("react");
  const { act } = React;
  const { createRoot } = await import("react-dom/client");
  const { default: Viz } = await vite.ssrLoadModule("/src/components/Viz.jsx");

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  let props = baseProps({ hyperedges: tinyGraph(), controlledLayout: "circular" });
  const render = async patch => {
    props = { ...props, ...patch };
    await act(async () => { root.render(React.createElement(Viz, props)); });
  };
  await render({});
  flushFrames(rafCallbacks, 2);

  const canvas = document.querySelector("canvas");
  assert.ok(canvas, "Graph Preview canvas must render");
  assert.equal(canvas.width, 1_600);
  assert.equal(canvas.height, 1_040);
  assert.match(text(), /Graph Preview/);

  await mouseDown(canvas, 656.8, 260, act);
  assert.match(text(), /Selected\s*h0/, "ring click must select the hyperedge");
  const initialNodeA = latestNode(drawProbe, 4, 0);
  await mouseDown(canvas, initialNodeA.x, initialNodeA.y, act);
  assert.match(text(), /Selected\s*a/, "node click has priority over ring selection");
  const draggedNodeA = { x: initialNodeA.x + 100, y: initialNodeA.y + 80 };
  await mouseMove(canvas, draggedNodeA.x, draggedNodeA.y, act);
  flushFrames(rafCallbacks, 1);
  assertPoint(latestNode(drawProbe, 4, 0), draggedNodeA, "node drag must survive its selection commit");
  await mouseUp(canvas, draggedNodeA.x, draggedNodeA.y, act);
  flushFrames(rafCallbacks, 4);

  const translationBeforePan = latestTranslation(drawProbe);
  await mouseDown(canvas, 20, 480, act);
  assert.doesNotMatch(text(), /Selected\s/, "empty-canvas pan keeps the existing selection-clearing contract");
  await mouseMove(canvas, 80, 510, act);
  flushFrames(rafCallbacks, 1);
  assertPoint(latestTranslation(drawProbe), {
    x: translationBeforePan.x + 60,
    y: translationBeforePan.y + 30,
  }, "pan must survive selection clearing");
  await mouseUp(canvas, 80, 510, act);
  flushFrames(rafCallbacks, 4);

  const translationWithoutSelection = latestTranslation(drawProbe);
  await mouseDown(canvas, 20, 480, act);
  await mouseMove(canvas, 50, 500, act);
  flushFrames(rafCallbacks, 1);
  assertPoint(latestTranslation(drawProbe), {
    x: translationWithoutSelection.x + 30,
    y: translationWithoutSelection.y + 20,
  }, "pan without a prior selection must remain functional");
  await mouseUp(canvas, 50, 500, act);
  flushFrames(rafCallbacks, 4);

  await render({
    hyperedges: [record("h-zero", ["0", "__proto__", "null"], { time: 0, weight: 0 })],
    controlledSearch: "0",
  });
  assert.match(text(), /Found:\s*0/, "canonical zero search must survive explicit presence checks");
  assert.match(text(), /w0/, "weight zero must appear in the hyperedge list");
  await render({ controlledSearch: "null" });
  assert.match(text(), /Found:\s*null/, "literal null identifier must remain searchable");
  await render({ controlledSearch: "__proto__" });
  assert.match(text(), /Found:\s*__proto__/, "prototype-like identifier positions and search must remain safe");

  assert.ok(resizeObservers.length > 0, "Viz must install ResizeObserver");
  await act(async () => { resizeObservers.at(-1).emit(640, 400); });
  assert.equal(canvas.width, 1_280, "DPR-aware backing width must follow container resize");
  assert.equal(canvas.height, 800, "DPR-aware backing height must follow container resize");
  assert.match(text(), /Found:\s*__proto__/, "resize must preserve search/world state");

  await act(async () => {
    canvas.dispatchEvent(new window.WheelEvent("wheel", { bubbles: true, cancelable: true, clientX: 320, clientY: 200, deltaY: -100 }));
  });
  assert.doesNotMatch(text(), /100%/, "wheel zoom must update the visible transform percentage");

  await render({ controlledLayout: "force", controlledSearch: "" });
  const reheatButton = button("reheat");
  assert.equal(reheatButton.disabled, false);
  const queuedBeforeReheat = rafCallbacks.size;
  await act(async () => { reheatButton.click(); });
  assert.ok(rafCallbacks.size >= queuedBeforeReheat, "Reheat must schedule or retain active Force work");
  flushFrames(rafCallbacks, 4);

  await act(async () => { button("Line Graph").click(); });
  assert.match(text(), /edges=co-membership/);
  await act(async () => { button("Hypergraph").click(); });
  assert.match(text(), /rings=hyperedges/);

  await render({
    controlledLayout: "grid",
    controlledViewMode: "linegraph",
    hyperedges: [record("dense", Array.from({ length: 100 }, (_, index) => `v${index}`))],
  });
  assert.match(text(), /Line Graph computed exactly/, "analytically computed Line Graph must report visual LOD separately");
  assert.match(text(), /Previewing 4,000 of 4,950 edges/);

  await render({
    hyperedges: [record("over-budget", Array.from({ length: 3_000 }, (_, index) => `v${index}`))],
  });
  assert.match(text(), /Line Graph not computed/, "analytical resource refusal must remain truthful");

  await act(async () => { root.unmount(); });
  assert.equal(rafCallbacks.size, 0, "unmount must cancel the outstanding Preview RAF");
  assert.ok(cancelledFrames > 0, "at least one active RAF must be canceled during lifecycle changes");
} finally {
  await vite.close();
  window.close();
}

console.log("v7.3.14 Stage 5 happy-dom Preview integration passed (canvas interactions, identity, resize, Force, and view/resource states).");

function baseProps(overrides = {}) {
  return {
    hyperedges: [],
    vizLimit: 200,
    setVizLimit() {},
    algoHighlight: null,
    componentColors: new Map(),
    ...overrides,
  };
}

function tinyGraph() {
  return [record("h0", ["a", "b", "c"]), record("h1", ["c", "d"])];
}

function record(id, vertices, extra = {}) {
  return { id, vertices, time: extra.time ?? null, weight: extra.weight ?? 1, attributes: {} };
}

function text() {
  return document.body.textContent.replace(/\s+/g, " ");
}

function button(label) {
  const found = [...document.querySelectorAll("button")].find(element => element.textContent.trim() === label);
  assert.ok(found, `button ${JSON.stringify(label)} must render`);
  return found;
}

async function mouseDown(canvas, clientX, clientY, act) {
  await mouse(canvas, "mousedown", clientX, clientY, act, 1);
}

async function mouseMove(canvas, clientX, clientY, act) {
  await mouse(canvas, "mousemove", clientX, clientY, act, 1);
}

async function mouseUp(canvas, clientX, clientY, act) {
  await mouse(canvas, "mouseup", clientX, clientY, act, 0);
}

async function mouse(canvas, type, clientX, clientY, act, buttons) {
  await act(async () => {
    canvas.dispatchEvent(new window.MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY, buttons }));
  });
}

function flushFrames(queue, limit) {
  for (let count = 0; count < limit && queue.size; count += 1) {
    const [id, callback] = queue.entries().next().value;
    queue.delete(id);
    callback(performance.now());
  }
}

function latestNode(probe, vertexCount, index) {
  const nodes = probe.arcs.filter(({ radius }) => radius <= 14).slice(-vertexCount);
  assert.equal(nodes.length, vertexCount);
  return nodes[index];
}

function latestTranslation(probe) {
  return probe.translations.at(-1) ?? { x: 0, y: 0 };
}

function assertPoint(actual, expected, message) {
  assert.ok(Math.abs(actual.x - expected.x) < 0.001 && Math.abs(actual.y - expected.y) < 0.001,
    `${message}: expected (${expected.x}, ${expected.y}), received (${actual.x}, ${actual.y})`);
}

function canvasContext(probe) {
  return {
    setTransform() {}, clearRect() {}, save() {}, restore() {}, scale() {},
    beginPath() {}, ellipse() {}, fill() {}, stroke() {}, setLineDash() {}, fillText() {},
    moveTo() {}, lineTo() {},
    translate(x, y) { probe.translations.push({ x, y }); },
    arc(x, y, radius) { probe.arcs.push({ x, y, radius }); },
    fillStyle: "", strokeStyle: "", lineWidth: 1, font: "", textAlign: "",
  };
}
