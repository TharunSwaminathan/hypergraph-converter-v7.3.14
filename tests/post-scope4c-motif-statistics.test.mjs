import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { createServer } from "vite";
import { graphStatsResponse } from "../src/agent/agentResponses.js";
import { motifQueryPolicy } from "../src/agent/motifQueryPolicy.js";
import { compileDashboardActionGrammar } from "../src/agent/deterministicNlu/domains/dashboardActionGrammar.js";

const capability = { backend: "CUDA_STATIC", modes: ["STATIC"], devices: [{ id: 0, name: "Test CUDA" }] };
const statsState = {
  hasGraph: true,
  stats: {},
  hyperedgeCount: 3,
  vertexCount: 5,
  incidenceCount: 9,
  vizLimit: 50,
  candy: { authorized: true, capabilities: [capability] },
};
const statsAnswer = graphStatsResponse(statsState);
assert.match(statsAnswer, /Browser-computed Statistics/);
assert.match(statsAnswer, /Line-Graph Triangles/);
assert.match(statsAnswer, /not the 30-class hypergraph motif product/);
assert.match(statsAnswer, /Hypergraph 3-Edge Motifs/);
assert.match(statsAnswer, /explicit confirmation/);

assert.equal(compileDashboardActionGrammar("Show the triads.").canonicalIntent, "NAVIGATE_STATS");
const observation = { graph: { available: true, graphType: "Hypergraph" }, candy: { featureEnabled: true, authorized: true, capabilities: [capability] } };
assert.equal(motifQueryPolicy("Show the triads.", observation).requested, false, "explanatory/show request must not submit a Runtime job");
assert.equal(motifQueryPolicy("Count the triads using CUDA.", observation).ok, true, "triad is a product alias for an explicit compute request");

const window = new Window({ url: "http://localhost:5173/" });
globalThis.window = window;
globalThis.document = window.document;
Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
globalThis.HTMLElement = window.HTMLElement;
globalThis.Event = window.Event;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
try {
  const React = await import("react");
  const { act } = React;
  const { createRoot } = await import("react-dom/client");
  const { default: CandyMotifStatistics } = await vite.ssrLoadModule("/src/components/CandyMotifStatistics.jsx");
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  let requests = 0;
  let selector = null;
  const render = async candy => act(async () => root.render(React.createElement(CandyMotifStatistics, {
    candy,
    onRequestStaticMotif(value) { requests += 1; selector = value; },
  })));

  await render({ featureEnabled: false, graphType: "Hypergraph", graphId: "g", graphVersion: 1 });
  assert.equal(requests, 0, "opening Statistics never auto-runs motif computation");
  assert.match(text(), /no CPU fallback/i);
  assert.equal(button("Compute 3-edge motifs").disabled, true);

  await render({ featureEnabled: true, authorized: true, graphType: "OrdinaryGraph", graphId: "g", graphVersion: 1, capabilities: [capability] });
  assert.match(text(), /No implicit projection/);
  assert.equal(button("Compute 3-edge motifs").disabled, true);

  const ready = { featureEnabled: true, authorized: true, graphType: "Hypergraph", graphId: "g", graphVersion: 1, capabilities: [capability] };
  await render(ready);
  assert.equal(requests, 0, "ready rendering still does not auto-run");
  assert.match(text(), /Distinct from Line-Graph Triangles/);
  assert.doesNotMatch(text(), /ESCHER/);
  await act(async () => button("Compute 3-edge motifs").click());
  assert.equal(requests, 1);
  assert.deepEqual(selector, { mode: "STATIC", backend: "CUDA_STATIC", deviceId: 0, timeoutMs: 5000 });

  const result = {
    mode: "STATIC",
    backend: "CUDA_STATIC",
    inputGraphRef: { graphId: "g", graphVersion: 1 },
    native: { counts: Array.from({ length: 30 }, (_, index) => index), totalConnectedTriples: 435, cuda: { deviceIndex: 0, deviceName: "Test CUDA", compiledArchitecture: "sm_120" } },
  };
  await render({ ...ready, selectedMotifResult: result });
  assert.match(text(), /Total connected 3-edge motifs:\s*435/);
  assert.match(text(), /OPEN_WEDGE/);
  assert.match(text(), /CLOSED_TRIANGLE/);
  assert.equal(document.querySelectorAll("tbody tr").length, 32, "two group rows plus all 30 stable class rows render");

  await render({ ...ready, graphVersion: 2, selectedMotifResult: result });
  assert.match(text(), /does not match the active graph identity\/version/);
  assert.doesNotMatch(text(), /Total connected 3-edge motifs:\s*435/);

  const delta = {
    mode: "INCREMENTAL",
    backend: "CUDA_INCREMENTAL",
    inputGraphRef: { graphId: "g", graphVersion: 1 },
    updateRef: { updateId: "pending-1" },
    native: { deltaCounts: Array(30).fill(0), deltaTotalConnectedTriples: -1, cuda: { deviceIndex: 0, deviceName: "Test CUDA" } },
  };
  await render({ ...ready, selectedMotifResult: delta });
  assert.match(text(), /Motif change \(delta only\)/);
  assert.match(text(), /not a fabricated full count/);
  assert.match(text(), /update was not applied/);

  await act(async () => root.unmount());
} finally {
  await vite.close();
  window.close();
}

console.log("Post-Scope-4C motif Statistics integration and chatbot truthfulness passed.");

function text() {
  return document.body.textContent.replace(/\s+/g, " ");
}

function button(label) {
  const found = [...document.querySelectorAll("button")].find(element => element.textContent.trim() === label);
  assert.ok(found, `button ${label} must render`);
  return found;
}
