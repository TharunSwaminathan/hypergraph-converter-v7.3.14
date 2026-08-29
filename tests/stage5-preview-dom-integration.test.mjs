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

const context = canvasContext();
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

  const canvas = document.querySelector("canvas");
  assert.ok(canvas, "Graph Preview canvas must render");
  assert.equal(canvas.width, 1_600);
  assert.equal(canvas.height, 1_040);
  assert.match(text(), /Graph Preview/);

  await mouseDown(canvas, 656.8, 260, act);
  assert.match(text(), /Selected\s*h0/, "ring click must select the hyperedge");
  await mouseDown(canvas, 400, 31.2, act);
  assert.match(text(), /Selected\s*a/, "node click has priority over ring selection");

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
  await act(async () => {
    canvas.dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true, cancelable: true, clientX, clientY }));
  });
}

function flushFrames(queue, limit) {
  for (let count = 0; count < limit && queue.size; count += 1) {
    const [id, callback] = queue.entries().next().value;
    queue.delete(id);
    callback(performance.now());
  }
}

function canvasContext() {
  return {
    setTransform() {}, clearRect() {}, save() {}, restore() {}, translate() {}, scale() {},
    beginPath() {}, ellipse() {}, fill() {}, stroke() {}, setLineDash() {}, fillText() {},
    moveTo() {}, lineTo() {}, arc() {},
    fillStyle: "", strokeStyle: "", lineWidth: 1, font: "", textAlign: "",
  };
}
