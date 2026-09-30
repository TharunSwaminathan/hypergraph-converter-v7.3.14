import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Window } from "happy-dom";
import { createServer } from "vite";
import { controlsHarness } from "./fixtures/candy-scope5d-controls.mjs";
import { commitGraphState } from "../src/graph/graphState.js";

const window = new Window({ url: "http://localhost:5173/" });
Object.assign(globalThis, { window, document: window.document, HTMLElement: window.HTMLElement, Event: window.Event, MouseEvent: window.MouseEvent, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
try {
  const React = await import("react"), { act } = React, { createRoot } = await import("react-dom/client");
  const { default: Panel } = await vite.ssrLoadModule("/src/components/DynamicHypergraphUpdatePanel.jsx");
  const { default: Advanced } = await vite.ssrLoadModule("/src/components/AdvancedOptionsPanel.jsx");
  const { h, controls, getCandy, selector } = await controlsHarness();
  controls.discard(selector());
  let text = "DELETE h1", setText, previewCalls = 0;
  function Host() {
    React.useSyncExternalStore(h.pending.subscribe, h.pending.getCurrent, h.pending.getCurrent);
    React.useSyncExternalStore(h.analysis.subscribe, h.analysis.getSnapshot, h.analysis.getSnapshot);
    const [draft, update] = React.useState(text); setText = update; text = draft;
    return React.createElement("div", null,
      React.createElement(Advanced, { dynamicUpdateMode: h.graph.graphType === "DynamicHypergraph", batchText: draft, setBatchText: update,
        batchParsedCount: 1, batchWarnings: [], hasGraph: true }),
      React.createElement(Panel, { graphType: h.graph.graphType, graphVersion: h.graph.graphVersion, pending: controls.observe(), controls,
        candy: getCandy().state, batchText: draft, onPreview: () => { previewCalls++; }, onEdit() {} }));
  }
  const root = createRoot(document.body.appendChild(document.createElement("div")));
  const render = () => act(async () => root.render(React.createElement(Host)));
  const button = name => [...document.querySelectorAll("button")].find(item => item.textContent.trim() === name);
  const click = async name => { const target = button(name); assert.ok(target, name); assert.equal(target.disabled, false, name); await act(async () => { target.click(); await new Promise(resolve => setTimeout(resolve, 30)); }); };
  await render();
  assert.match(document.body.textContent, /Dynamic Hypergraph Update/);
  assert.equal(button("Commit Batch Changes"), undefined, "one dynamic control surface");
  assert.equal(button("Apply pending update").disabled, true); assert.equal(button("Analyze motif delta").disabled, true);
  assert.equal(h.counts.commits, 0); assert.equal(h.counts.submissions, 0, "render inert");
  await click("Stage pending update"); const first = h.pending.getCurrent();
  assert.equal(first.status, "VALIDATED"); assert.equal(h.counts.commits, 0);
  await click("Inspect pending preview"); assert.equal(previewCalls, 1);
  await click("Analyze motif delta"); assert.equal(h.counts.submissions, 0);
  assert.match(document.querySelector('[aria-label="Pending update confirmation"]').textContent, /computational action.*graph will not/s);
  await click("Confirm analysis only"); assert.equal(h.counts.commits, 0); assert.equal(h.counts.submissions, 1);
  await click("Open signed delta result");
  assert.match(document.body.textContent, /Motif change \(delta only\)/); assert.match(document.body.textContent, /Affected \/ nonzero classes first/);
  const classes = document.querySelector('[aria-label="Validated hypergraph motif delta"] details');
  assert.equal(classes.querySelectorAll("td").length, 90, "stable 30 classes");
  await click("Apply pending update");
  assert.match(document.querySelector('[aria-label="Pending update confirmation"]').textContent, /does not run CANDY analysis/);
  const jobs = h.counts.submissions;
  await act(async () => { button("Confirm Apply only").click(); button("Confirm Apply only").click(); await new Promise(resolve => setTimeout(resolve, 30)); });
  assert.equal(h.counts.commits, 1); assert.equal(h.counts.submissions, jobs);
  assert.equal(document.querySelector('[aria-label="Validated hypergraph motif delta"]'), null);
  await act(async () => setText("DELETE h2")); await click("Stage pending update");
  await act(async () => setText("UPDATE h2: x, z")); await click("Re-stage edited commands");
  assert.ok(h.pending.getCurrent().revision > first.revision + 1);
  await click("Apply pending update");
  await act(async () => {
    h.graph = commitGraphState(h.graph, h.graph.hyperedges, { graphType: "Hypergraph" });
    h.pending.onGraphTransition(h.graph, "GRAPH_TYPE_CHANGED"); h.analysis.synchronize();
  });
  assert.match(document.body.textContent, /Graph changed, changed type, or was replaced/);
  assert.equal(button("Confirm Apply only").disabled, true);
  assert.equal(button("Analyze motif delta").disabled, true); assert.equal(button("Apply pending update").disabled, true);
  assert.ok(button("Commit Batch Changes"), "Hypergraph keeps existing Batch controls");
  await click("Discard pending update"); assert.equal(h.pending.getCurrent(), null);
  assert.equal(h.counts.commits, 1);
  await act(async () => root.unmount());
  const app = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.match(app, /Line-Graph Triangles/); assert.match(app, /<CandyMotifStatistics/);
  assert.match(app, /hyperedges=\{pendingPreview\?\.hyperedges \?\? finalHes\}/);
  const chat = await readFile(new URL("../src/components/AgentChatPanel.jsx", import.meta.url), "utf8");
  assert.match(chat, /onClick=\{\(\) => agentActions.openDynamicUpdatePanel\?\.\(\)\}/);
  console.log("Scope 5D mounted panel workflow, independent confirmations, delta display, stale controls, inert render and navigation wiring passed.");
} finally { await vite.close(); window.close(); }
