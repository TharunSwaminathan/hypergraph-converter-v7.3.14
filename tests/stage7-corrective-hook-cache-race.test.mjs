import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { createDerivedProductCache } from "../src/derived/derivedProductCache.js";
import { useAsyncDerivedProduct } from "../src/hooks/useAsyncDerivedProduct.js";

const window = new Window({ url: "http://localhost/" });
globalThis.window = window;
globalThis.document = window.document;
Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
globalThis.HTMLElement = window.HTMLElement;
globalThis.Node = window.Node;
globalThis.Event = window.Event;
globalThis.MutationObserver = window.MutationObserver;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const React = await import("react");
const { createRoot } = await import("react-dom/client");
const { act } = React;
const unhandled = [];
const onUnhandled = reason => unhandled.push(reason);
process.on("unhandledRejection", onUnhandled);

try {
  await runLifecycleRace({ name: "committed replacement", versionA: 201, versionB: 202 });
  await runLifecycleRace({ name: "same-version preview replacement", versionA: 301, versionB: 301 });
  await flush();
  assert.deepEqual(unhandled, []);
  console.log("Stage 7 corrective React hook/shared-cache lifecycle races passed (committed and same-version preview replacement)." );
} finally {
  process.off("unhandledRejection", onUnhandled);
  window.close();
}

async function runLifecycleRace({ name, versionA, versionB }) {
  const cache = createDerivedProductCache();
  const graphA = Object.freeze([{ id: "A_H", vertices: ["A_ONLY_1", "A_ONLY_2"] }]);
  const graphB = Object.freeze([{ id: "B_H", vertices: ["B_ONLY_1", "B_ONLY_2"] }]);
  const work = {
    A: { v2v: deferredExecution(), matrix: deferredExecution() },
    B: { v2v: deferredExecution(), matrix: deferredExecution() },
  };
  const blocker = deferredExecution();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);

  function DerivedView({ graphVersion, graphIdentity, label }) {
    const v2v = useAsyncDerivedProduct({
      enabled: true,
      graphVersion,
      graphIdentity,
      operationType: "v2v",
      hyperedges: graphIdentity,
      cache,
      executor: work[label].v2v.execute,
    }).result;
    const matrix = useAsyncDerivedProduct({
      enabled: true,
      graphVersion,
      graphIdentity,
      operationType: "matrix",
      hyperedges: graphIdentity,
      cache,
      executor: work[label].matrix.execute,
    }).result;
    const edgeText = v2v.edges?.map(edge => `${edge.src}--${edge.dst}`).join("|") ?? "";
    const matrixText = matrix.text ?? "";
    const ready = v2v.status === "computed" && matrix.status === "computed";
    return React.createElement("section", { "data-label": label },
      React.createElement("div", { id: "rows" }, edgeText),
      React.createElement("pre", { id: "matrix" }, matrixText),
      React.createElement("pre", { id: "export" }, ready ? `${edgeText}\n${matrixText}` : ""),
      React.createElement("button", { id: "download", disabled: !ready }, "Download"),
      React.createElement("span", { id: "loading" }, `${v2v.status}/${matrix.status}`),
    );
  }

  function AppLike({ graphVersion, graphIdentity, label, suspend }) {
    // This is the exact render-time shared-cache transition that exposed S7-N01.
    cache.activateGraph(graphVersion, graphIdentity);
    if (suspend) throw blocker.promise;
    return React.createElement(DerivedView, { graphVersion, graphIdentity, label });
  }

  const render = props => React.createElement(React.Suspense, { fallback: React.createElement("div", null, "pending") },
    React.createElement(AppLike, props));

  await act(async () => root.render(render({ graphVersion: versionA, graphIdentity: graphA, label: "A", suspend: false })));
  assert.match(host.querySelector("#loading").textContent, /computing/);

  // A transition renders B and mutates the shared cache, but suspension keeps
  // the old A hook mounted and its coordinator on A.
  await act(async () => {
    React.startTransition(() => root.render(render({ graphVersion: versionB, graphIdentity: graphB, label: "B", suspend: true })));
    await flush();
  });
  assert.equal(cache.getSnapshot().activeGraphVersion, versionB, name);
  work.A.v2v.resolve(computedV2V("A_ONLY_1", "A_ONLY_2"));
  work.A.matrix.resolve(computedMatrix("A_ONLY_MATRIX"));
  await act(async () => flush());

  assert.equal(cache.peek("v2v", {}), undefined, `${name}: old V2V must not poison B cache`);
  assert.equal(cache.peek("matrix", {}), undefined, `${name}: old Matrix must not poison B cache`);

  blocker.resolve();
  await act(async () => {
    root.render(render({ graphVersion: versionB, graphIdentity: graphB, label: "B", suspend: false }));
    await flush();
  });
  assert.doesNotMatch(host.textContent, /A_ONLY/, `${name}: no stale row/edge/text may render`);
  assert.equal(host.querySelector("#download").disabled, true, `${name}: stale download must stay unavailable`);

  work.B.v2v.resolve(computedV2V("B_ONLY_1", "B_ONLY_2"));
  work.B.matrix.resolve(computedMatrix("B_ONLY_MATRIX"));
  await act(async () => flush());
  assert.match(host.querySelector("#rows").textContent, /B_ONLY_1--B_ONLY_2/);
  assert.match(host.querySelector("#matrix").textContent, /B_ONLY_MATRIX/);
  assert.doesNotMatch(host.textContent, /A_ONLY/);
  assert.equal(host.querySelector("#download").disabled, false);
  assert.equal(host.querySelector("#loading").textContent, "computed/computed");
  assert.strictEqual(cache.peek("v2v", {}), work.B.v2v.value());
  assert.strictEqual(cache.peek("matrix", {}), work.B.matrix.value());
  assert.equal(cache.getSnapshot().entryCount, 2);

  await act(async () => root.unmount());
  host.remove();
}

function deferredExecution() {
  let resolve;
  let resolvedValue;
  const promise = new Promise(done => {
    resolve = value => { resolvedValue = value; done(value); };
  });
  return {
    promise,
    execute: () => ({ promise, cancel() {} }),
    resolve,
    value: () => resolvedValue,
  };
}

function computedV2V(src, dst) {
  return { status: "computed", edges: [{ src, dst, hyperedges: ["h"], weight: 1 }] };
}

function computedMatrix(text) {
  return { status: "computed", text, value: text };
}

function flush() { return new Promise(resolve => setTimeout(resolve, 0)); }
