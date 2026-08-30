import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Window } from "happy-dom";
import { createServer } from "vite";

const parentCommit = "d688b065dd284207b679a432d0f18147f2acce8d";
const outputPath = resolve("artifacts/v7.3.14-stage5-corrective2-prechange.json");
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
globalThis.requestAnimationFrame = callback => {
  const id = nextFrameId;
  nextFrameId += 1;
  frames.set(id, callback);
  return id;
};
globalThis.cancelAnimationFrame = id => frames.delete(id);
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
  drainFrames();
  const canvas = document.querySelector("canvas");
  assert.ok(canvas);

  const initialNode = latestNode(4, 0);
  await mouse(canvas, "mousedown", initialNode.x, initialNode.y, 1, act);
  assert.match(document.body.textContent, /Selected\s*a/);
  const heldNodeTarget = add(initialNode, 60, 40);
  await mouse(canvas, "mousemove", heldNodeTarget.x, heldNodeTarget.y, 1, act);
  flushOneFrame();
  const afterHeldNodeMove = latestNode(4, 0);
  const releasedNodeTarget = add(initialNode, 120, 80);
  await mouse(canvas, "mousemove", releasedNodeTarget.x, releasedNodeTarget.y, 0, act);
  flushOneFrame();
  const afterButtonsZeroNodeMove = latestNode(4, 0);
  const staleDragReproduced = distance(afterHeldNodeMove, afterButtonsZeroNodeMove) > 1;
  await mouse(canvas, "mouseup", releasedNodeTarget.x, releasedNodeTarget.y, 0, act);
  drainFrames();

  const initialTranslation = latestTranslation();
  await mouse(canvas, "mousedown", 20, 480, 1, act);
  assert.doesNotMatch(document.body.textContent, /Selected\s/);
  await mouse(canvas, "mousemove", 60, 500, 1, act);
  flushOneFrame();
  const afterHeldPanMove = latestTranslation();
  await mouse(canvas, "mousemove", 100, 530, 0, act);
  flushOneFrame();
  const afterButtonsZeroPanMove = latestTranslation();
  const stalePanReproduced = distance(afterHeldPanMove, afterButtonsZeroPanMove) > 1;
  await mouse(canvas, "mouseup", 100, 530, 0, act);
  drainFrames();

  assert.equal(staleDragReproduced, true, "pre-fix source must move a stale drag on buttons-zero mousemove");
  assert.equal(stalePanReproduced, true, "pre-fix source must move a stale pan on buttons-zero mousemove");

  const result = {
    stage: "5-corrective2-prechange",
    issue: "S5-N02",
    parentCommit,
    runtimeHarness: "happy-dom + React DOM + Vite SSR + deterministic canvas/RAF",
    omittedTerminationEvents: ["canvas mouseup", "canvas mouseleave"],
    staleDrag: {
      selectionCommitted: true,
      initialPosition: initialNode,
      heldMovePosition: afterHeldNodeMove,
      buttonsZeroRequestedPosition: releasedNodeTarget,
      buttonsZeroObservedPosition: afterButtonsZeroNodeMove,
      postReleaseMovement: distance(afterHeldNodeMove, afterButtonsZeroNodeMove),
      reproduced: staleDragReproduced,
    },
    stalePan: {
      initialTranslation,
      heldMoveTranslation: afterHeldPanMove,
      buttonsZeroObservedTranslation: afterButtonsZeroPanMove,
      postReleaseMovement: distance(afterHeldPanMove, afterButtonsZeroPanMove),
      reproduced: stalePanReproduced,
    },
    rootCause: "Viz.onMove applies active drag/pan state without checking MouseEvent.buttons, while canvas-local termination events are not guaranteed after an outside-canvas release.",
  };
  writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));

  await act(async () => root.unmount());
} finally {
  await vite.close();
  window.close();
}

function record(id, vertices) {
  return { id, vertices, time: null, weight: 1, attributes: {} };
}

async function mouse(canvas, type, clientX, clientY, buttons, act) {
  await act(async () => {
    canvas.dispatchEvent(new window.MouseEvent(type, {
      bubbles: true, cancelable: true, clientX, clientY, buttons,
    }));
  });
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

function add(point, x, y) {
  return { x: point.x + x, y: point.y + y };
}

function distance(left, right) {
  return Math.hypot(left.x - right.x, left.y - right.y);
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
