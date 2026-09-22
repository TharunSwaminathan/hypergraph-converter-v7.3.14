import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { createServer } from "vite";
import {
  parsePreviewLimitInput,
  PREVIEW_LIMIT_MAX,
  PREVIEW_LIMIT_MIN,
  resolvePreviewHyperedgeSearch,
} from "../src/visualization/previewRuntime.js";

assert.deepEqual(parsePreviewLimitInput(String(PREVIEW_LIMIT_MIN)), { ok: true, value: 1, error: null });
assert.deepEqual(parsePreviewLimitInput(String(PREVIEW_LIMIT_MAX)), { ok: true, value: 10000, error: null });
for (const value of ["", "0", "-1", "1.5", "not-a-number", "10001", "999999999999"]) {
  assert.equal(parsePreviewLimitInput(value).ok, false, `${JSON.stringify(value)} must not authorize a preview limit`);
}

const searchGraph = [record("h0", ["a", "b"]), record("h10", ["b", "c"]), record("other", ["d"])];
assert.deepEqual(resolvePreviewHyperedgeSearch(searchGraph, "h0").map(item => item.id), ["h0"]);
assert.deepEqual(resolvePreviewHyperedgeSearch(searchGraph, "h1").map(item => item.id), ["h10"]);
assert.deepEqual(resolvePreviewHyperedgeSearch(searchGraph, "missing"), []);
assert.deepEqual(resolvePreviewHyperedgeSearch(searchGraph, "x".repeat(241)), []);

const window = new Window({ url: "http://localhost:5173/" });
globalThis.window = window;
globalThis.document = window.document;
Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
globalThis.HTMLElement = window.HTMLElement;
globalThis.HTMLCanvasElement = window.HTMLCanvasElement;
globalThis.Event = window.Event;
globalThis.MouseEvent = window.MouseEvent;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.requestAnimationFrame = callback => setTimeout(() => callback(performance.now()), 0);
globalThis.cancelAnimationFrame = clearTimeout;
globalThis.ResizeObserver = class ResizeObserver { observe() {} disconnect() {} };
window.HTMLCanvasElement.prototype.getContext = () => canvasContext();
window.HTMLCanvasElement.prototype.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 520, right: 800, bottom: 520 });

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
try {
  const React = await import("react");
  const { act } = React;
  const { createRoot } = await import("react-dom/client");
  const { default: Viz } = await vite.ssrLoadModule("/src/components/Viz.jsx");
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const appliedLimits = [];
  let props = {
    hyperedges: searchGraph,
    vizLimit: 50,
    setVizLimit: value => appliedLimits.push(value),
    algoHighlight: null,
    componentColors: new Map(),
    graphVersion: 1,
  };
  const render = async patch => {
    props = { ...props, ...patch };
    await act(async () => root.render(React.createElement(Viz, props)));
  };
  await render({});

  for (const fixed of [10, 25, 50, 100, 200]) assert.ok(button(String(fixed)), `fixed limit ${fixed} remains visible`);
  await act(async () => button("10").click());
  assert.equal(appliedLimits.at(-1), 10, "fixed limits update the authoritative setter");

  const custom = document.querySelector("[aria-label='Custom preview size value']");
  await change(custom, "37", act);
  await act(async () => document.querySelector("form[aria-label='Custom preview size']").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })));
  assert.equal(appliedLimits.at(-1), 37, "valid custom size uses the same authoritative setter");

  const callCount = appliedLimits.length;
  for (const invalid of ["0", "-1", "1.5", "abc", "10001"]) {
    await change(custom, invalid, act);
    await act(async () => document.querySelector("form[aria-label='Custom preview size']").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })));
    assert.equal(appliedLimits.length, callCount, `${invalid} must not update the preview limit`);
    assert.match(text(), /whole number|Preview size must be/);
  }

  const vertexSearch = document.querySelector("[aria-label='Search vertex']");
  await change(vertexSearch, "a", act);
  assert.match(text(), /Found:\s*a/);
  await change(vertexSearch, "missing", act);
  assert.match(text(), /Vertex not found/);

  let hyperedgeSearch = document.querySelector("[aria-label='Search hyperedge']");
  await change(hyperedgeSearch, "h1", act);
  assert.match(text(), /Found 1:\s*h10/);
  assert.match(text(), /Hyperedges \(1 of 3\)/);
  await change(hyperedgeSearch, "missing", act);
  assert.match(text(), /Hyperedge not found/);
  assert.match(text(), /No hyperedges match this read-only filter/);
  await act(async () => document.querySelector("[aria-label='Clear hyperedge search']").click());
  assert.match(text(), /Hyperedges \(3\)/);

  hyperedgeSearch = document.querySelector("[aria-label='Search hyperedge']");
  await change(hyperedgeSearch, "h0", act);
  await act(async () => button("Line Graph").click());
  assert.equal(document.querySelector("[aria-label='Search hyperedge']"), null, "Line Graph does not retain a misleading hyperedge filter");
  assert.match(text(), /Line Graph dots are vertices/);
  await act(async () => button("Hypergraph").click());
  assert.equal(document.querySelector("[aria-label='Search hyperedge']").value, "", "view switch clears the hyperedge filter");

  await change(document.querySelector("[aria-label='Search hyperedge']"), "h0", act);
  await render({ hyperedges: [record("replacement", ["z"])], graphVersion: 2 });
  assert.equal(document.querySelector("[aria-label='Search hyperedge']").value, "", "graph replacement clears stale hyperedge search");
  assert.equal(document.querySelector("[aria-label='Search vertex']").value, "", "graph replacement clears stale vertex search");

  await render({ hyperedges: [], graphVersion: 3 });
  assert.match(text(), /of 0/, "empty graph stays render-safe");

  await act(async () => root.unmount());
} finally {
  await vite.close();
  window.close();
}

console.log("Post-Scope-4C custom preview-size and hyperedge-search controls passed.");

function record(id, vertices) {
  return { id, vertices, time: null, weight: 1, attributes: {} };
}

function text() {
  return document.body.textContent.replace(/\s+/g, " ");
}

function button(label) {
  return [...document.querySelectorAll("button")].find(element => element.textContent.trim() === label);
}

async function change(element, value, act) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(element, value);
    element.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
}

function canvasContext() {
  return {
    setTransform() {}, clearRect() {}, save() {}, restore() {}, scale() {}, translate() {},
    beginPath() {}, ellipse() {}, fill() {}, stroke() {}, setLineDash() {}, fillText() {},
    moveTo() {}, lineTo() {}, arc() {},
    fillStyle: "", strokeStyle: "", lineWidth: 1, font: "", textAlign: "",
  };
}
