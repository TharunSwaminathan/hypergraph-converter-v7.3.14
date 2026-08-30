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

const rafCallbacks = new Map();
let nextRafId = 1;
globalThis.requestAnimationFrame = callback => {
  const id = nextRafId;
  nextRafId += 1;
  rafCallbacks.set(id, callback);
  return id;
};
globalThis.cancelAnimationFrame = id => rafCallbacks.delete(id);
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  disconnect() {}
};

const drawProbe = { arcs: [], translations: [] };
window.HTMLCanvasElement.prototype.getContext = () => canvasContext(drawProbe);
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

  await act(async () => {
    root.render(React.createElement(Viz, {
      hyperedges: [record("h0", ["a", "b", "c"]), record("h1", ["c", "d"])],
      vizLimit: 200,
      setVizLimit() {},
      controlledLayout: "circular",
      controlledViewMode: "hypergraph",
      algoHighlight: null,
      componentColors: new Map(),
    }));
  });
  flushFrames();

  const canvas = document.querySelector("canvas");
  assert.ok(canvas);
  const initialA = latestNodePosition(drawProbe, 4, 0);

  await dispatch(canvas, "mousedown", initialA.x, initialA.y, act);
  assert.match(document.body.textContent, /Selected\s*a/);
  flushFrames();
  await dispatch(canvas, "mousemove", initialA.x + 120, initialA.y + 100, act);
  flushFrames();
  const afterDragAttempt = latestNodePosition(drawProbe, 4, 0);
  const nodeMoved = distance(initialA, afterDragAttempt) > 1;
  await dispatch(canvas, "mouseup", initialA.x + 120, initialA.y + 100, act);

  const translationBeforePan = latestTranslation(drawProbe);
  await dispatch(canvas, "mousedown", 20, 480, act);
  assert.doesNotMatch(document.body.textContent, /Selected\s/);
  flushFrames();
  await dispatch(canvas, "mousemove", 80, 510, act);
  flushFrames();
  const translationAfterPanAttempt = latestTranslation(drawProbe);
  const panMoved = distance(translationBeforePan, translationAfterPanAttempt) > 1;
  await dispatch(canvas, "mouseup", 80, 510, act);

  assert.equal(nodeMoved, false, "Stage 5 parent must reproduce drag cancellation after selection commit");
  assert.equal(panMoved, false, "Stage 5 parent must reproduce pan cancellation after selection clearing");

  const result = {
    stage: "5-corrective-prechange",
    parentCommit: "2b61a6e4f7d6764bf0796b2c265c87d0fb3ad7cd",
    runtimeHarness: "happy-dom + React DOM + Vite SSR + deterministic canvas/RAF",
    sourceSequence: {
      nodeDown: "s.drag set -> setSelV/setSelHE -> selection-dependent effect cleanup/recreate -> drag:null",
      selectedPan: "s.pan set -> selection cleared -> selection-dependent effect cleanup/recreate -> pan:null",
    },
    nodeDrag: {
      selectionCommitted: true,
      initialPosition: initialA,
      requestedPosition: { x: initialA.x + 120, y: initialA.y + 100 },
      observedPosition: afterDragAttempt,
      moved: nodeMoved,
      reproduced: !nodeMoved,
    },
    selectedStatePan: {
      selectionCleared: true,
      initialTranslation: translationBeforePan,
      requestedDelta: { x: 60, y: 30 },
      observedTranslation: translationAfterPanAttempt,
      moved: panMoved,
      reproduced: !panMoved,
    },
    rootCause: "The visualization effect recreates mutable simulation state for selection dependencies and unconditionally initializes drag and pan to null.",
  };
  console.log(JSON.stringify(result, null, 2));

  await act(async () => root.unmount());
} finally {
  await vite.close();
  window.close();
}

function record(id, vertices) {
  return { id, vertices, time: null, weight: 1, attributes: {} };
}

async function dispatch(canvas, type, clientX, clientY, act) {
  await act(async () => {
    canvas.dispatchEvent(new window.MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX,
      clientY,
      buttons: type === "mouseup" ? 0 : 1,
    }));
  });
}

function flushFrames(limit = 20) {
  for (let count = 0; count < limit && rafCallbacks.size; count += 1) {
    const [id, callback] = rafCallbacks.entries().next().value;
    rafCallbacks.delete(id);
    callback(performance.now());
  }
}

function latestNodePosition(probe, vertexCount, index) {
  const arcs = probe.arcs.slice(-vertexCount);
  assert.equal(arcs.length, vertexCount);
  return { x: arcs[index].x, y: arcs[index].y };
}

function latestTranslation(probe) {
  const value = probe.translations.at(-1) ?? { x: 0, y: 0 };
  return { ...value };
}

function distance(left, right) {
  return Math.hypot(left.x - right.x, left.y - right.y);
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
