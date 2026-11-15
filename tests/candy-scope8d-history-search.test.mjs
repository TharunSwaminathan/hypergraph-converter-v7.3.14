import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { createServer } from "vite";

const window = new Window({ url: "http://127.0.0.1:5173" });
Object.assign(globalThis, { window, document: window.document, HTMLElement: window.HTMLElement, Event: window.Event, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, "navigator", { configurable: true, value: window.navigator });
const vite = await createServer({
  server: { middlewareMode: true, watch: { ignored: ["**/artifacts/**"] } },
  appType: "custom", logLevel: "error",
});
let root;
try {
  const { createElement, StrictMode, act } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { default: Panel } = await vite.ssrLoadModule("/src/components/AnalysisHistoryPanel.jsx");
  const host = document.body.appendChild(document.createElement("div"));
  root = createRoot(host);

  // History snapshots and imperative actions are doubles. Native transactions,
  // keyboard behavior and actual app authority are qualified separately.
  const projectA = "00000000-0000-4000-8000-000000000001";
  const projectB = "00000000-0000-4000-8000-000000000002";
  const record = (id, label, backend, source = "LOCAL") => Object.freeze({
    recordId: id, label, sha256: "record-" + id, completedAt: "2026-11-15T18:00:00.000Z",
    execution: Object.freeze({ backend }),
    provenance: Object.freeze({ origin: source }),
    input: Object.freeze({ contentSha256: "current", graphVersion: 1 }),
    payload: Object.freeze({ data: "payload-only keyword <example>" }),
  });
  const cpu = record("a", "Breadth-First Search", "CPU");
  const gpu = record("b", "Hypergraph motifs", "CUDA_STATIC", "IMPORTED");
  const delta = record("c", "Hypergraph motif delta", "CUDA_INCREMENTAL");
  const other = record("d", "Degree Distribution", "CPU", "IMPORTED");
  const retained = Object.freeze([cpu, gpu, delta, other]);
  const calls = [], cases = [];
  let accept = false;
  const coordinator = {
    review: async command => {
      calls.push(["review", command]);
      return { owner: projectA, revision: 10, command };
    },
    commitReview: async value => calls.push(["commit", value]),
  };
  const controls = {
    confirm: async request => { calls.push(["confirm", request.title]); return accept; },
    onRerun: async selected => calls.push(["rerun", selected]),
  };
  const current = { projectId: projectA, records: retained, status: "ready", message: "History available.", inputDigest: "current", coordinator };
  async function render(history = current, overrides = {}) {
    await act(async () => root.render(createElement(StrictMode, null, createElement(Panel, { history, ...controls, ...overrides }))));
  }
  const panel = () => host.querySelector(".analysis-history");
  const search = () => panel().querySelector("input[type=search]");
  const facets = () => [...panel().querySelectorAll("select")];
  const list = () => [...panel().querySelectorAll(".analysis-history__list button")];
  const details = () => panel().querySelector("article");
  const count = () => panel().querySelector(".analysis-history__count").textContent.trim();
  const button = text => [...panel().querySelectorAll("button")].find(node => node.textContent === text);
  async function click(node) { assert(node); await act(async () => node.click()); }
  async function query(text) {
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(search(), text);
      search().dispatchEvent(new window.Event("input", { bubbles: true }));
    });
  }
  async function choose(index, value) {
    await act(async () => {
      const select = facets()[index];
      select.value = value;
      select.dispatchEvent(new window.Event("change", { bubbles: true }));
    });
  }
  function order(...records) {
    assert.deepEqual(list().map(row => row.textContent), records.map(r => r.label + " · " + r.completedAt + " · " + r.execution.backend));
  }

  await render();
  order(other, delta, gpu, cpu);
  assert.equal(count(), "Showing 4 of 4 results");
  assert.equal(panel().dataset.historyCount, "4");
  assert.equal(search().labels[0].textContent.trim(), "Search analysis labels");
  assert.equal(panel().querySelector(".analysis-history__count").getAttribute("aria-live"), "polite");
  assert.deepEqual(facets().map(s => [...s.options].map(o => [o.value, o.label || o.textContent])), [
    [["", "All"], ["CPU", "CPU"], ["CUDA_STATIC", "CUDA_STATIC"], ["CUDA_INCREMENTAL", "CUDA_INCREMENTAL"]],
    [["", "All"], ["LOCAL", "Local"], ["IMPORTED", "Imported / unverified"]],
  ]);
  cases.push("defaults, count semantics, labels, ordered facet values and reverse retained order");

  await query("  hYPERGRAPH motif  ");
  order(delta, gpu);
  assert.equal(count(), "Showing 2 of 4 results");
  await query("payload-only");
  order();
  await query("[");
  order();
  await query("<example>");
  order();
  assert.equal(panel().querySelector("example"), null);
  await query(" ".repeat(80) + "Breadth");
  assert.equal(search().maxLength, 80);
  assert.equal(search().value.length, 80);
  order(other, delta, gpu, cpu);
  await query(" ".repeat(78) + "💡X");
  assert.equal(search().value.length, 80);
  cases.push("literal case and space matching, payload exclusion, inert text and UTF-16 cap");

  await query("motif");
  await choose(0, "CUDA_STATIC"); order(gpu);
  await choose(1, "LOCAL"); order();
  await choose(1, "IMPORTED"); order(gpu);
  await choose(0, "CUDA_INCREMENTAL"); order();
  await choose(1, "LOCAL"); order(delta);
  await choose(0, "CPU"); order();
  await query(" "); order(cpu);
  await choose(1, "IMPORTED"); order(other);
  await choose(0, "UNSUPPORTED");
  assert.equal(facets()[0].value, ""); order(other, gpu);
  await choose(1, "UNSUPPORTED");
  assert.equal(facets()[1].value, ""); order(other, delta, gpu, cpu);
  await act(async () => search().dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })));
  await click(button("Reset filters"));
  assert.deepEqual(calls, []);
  cases.push("exact backend and origin facets, AND matching, fallback, Enter and reset with zero actions");

  await click(list()[3]);
  await query("breadth");
  assert.match(details().textContent, /Breadth-First Search/);
  await click(button("Reset filters"));
  assert.match(details().textContent, /Breadth-First Search/);
  await query("degree");
  assert.equal(details(), null);
  await click(button("Reset filters"));
  assert.equal(details(), null);
  await click(list()[3]);
  await render({ ...current, records: retained.slice(1) });
  assert.equal(details(), null);
  await render();
  assert.equal(details(), null);
  cases.push("eligible selection retained, excluded or removed selection never revived");

  await query("breadth");
  await click(list()[0]);
  await render({ ...current, projectId: projectB, records: [other] });
  assert.equal(search().value, ""); assert.equal(details(), null); order(other);
  await choose(0, "CPU");
  await render({ ...current, projectId: null, records: [], status: "loading", message: "Checking history." });
  assert.equal(facets()[0].value, "");
  assert.match(panel().textContent, /Checking history/);
  assert.doesNotMatch(panel().textContent, /No completed analyses|Showing/);
  await query("temporary");
  await render({ ...current, projectId: projectB, records: [], status: "error", message: "History unavailable." });
  assert.equal(search().value, "");
  assert.match(panel().textContent, /History unavailable/);
  assert.doesNotMatch(panel().textContent, /No completed analyses|Showing/);
  await render({ ...current, records: [] });
  assert.equal(count(), "Showing 0 of 0 results");
  assert.match(panel().textContent, /No completed analyses/);
  await render();
  await query("no such label");
  assert.equal(count(), "Showing 0 of 4 results");
  assert.match(panel().textContent, /No analysis results match/);
  await render({ ...current, status: "writing", message: "Saving historical result." });
  assert.equal(count(), "Showing 0 of 4 results");
  assert.match(panel().textContent, /Saving historical result.*Previously loaded history snapshot/s);
  assert.doesNotMatch(panel().textContent, /No completed analyses/);
  await render({ ...current, status: "error", message: "History could not refresh." });
  assert.match(panel().textContent, /History could not refresh.*Previously loaded history snapshot/s);
  await act(async () => root.unmount());
  root = createRoot(host);
  await render(); assert.equal(search().value, ""); assert.equal(details(), null); order(other, delta, gpu, cpu);
  cases.push("owner transitions, remount, loading/error/ready/write and loaded snapshot distinction");

  await query("breadth");
  await click(list()[0]);
  await render({ ...current, inputDigest: "different" });
  assert.equal(button("Rerun on matching current input").disabled, true);
  await render();
  assert.equal(button("Rerun on matching current input").disabled, false);
  await click(button("Rerun on matching current input"));
  assert.deepEqual(calls.pop(), ["rerun", cpu]);
  await click(button("Delete historical result…"));
  const deleteCommand = { kind: "delete", recordId: cpu.recordId, recordSha256: cpu.sha256 };
  assert.deepEqual(calls.splice(0), [["review", deleteCommand], ["confirm", "Delete historical result?"]]);
  accept = true;
  await click(button("Delete historical result…"));
  assert.deepEqual(calls.splice(0), [
    ["review", deleteCommand], ["confirm", "Delete historical result?"],
    ["commit", { owner: projectA, revision: 10, command: deleteCommand }],
  ]);
  await query("nothing");
  await click(button("Clear project analysis history…"));
  assert.deepEqual(calls.splice(0), [
    ["review", { kind: "clear" }], ["confirm", "Clear project analysis history?"],
    ["commit", { owner: projectA, revision: 10, command: { kind: "clear" } }],
  ]);
  await query("motif");
  await choose(0, "CUDA_STATIC");
  await click(list()[0]);
  assert.match(details().textContent, /Imported evidence/);
  assert.equal(button("Review a new native run").disabled, true);
  await render(current, { nativeReady: true });
  assert.equal(button("Review a new native run").disabled, false);
  await choose(0, "CUDA_INCREMENTAL");
  await click(list()[0]);
  assert.equal(button("Review a new native run"), undefined);
  assert.match(details().textContent, /recreate and review a current pending update/);
  assert.deepEqual(calls, []);
  assert.deepEqual(retained.map(r => r.recordId), ["a", "b", "c", "d"]);
  cases.push("explicit rerun and delete positive controls, digest/ID review, guarded native actions, archive-wide clear");

  console.log(JSON.stringify({ scope: "8D", result: "PASS", cases, evidence: "StrictMode happy-dom with snapshot and action doubles. Native Chrome/IndexedDB separate." }));
} finally {
  if (root) {
    const { act } = await import("react");
    await act(async () => root.unmount());
  }
  await vite.close();
  await window.happyDOM.close();
}
