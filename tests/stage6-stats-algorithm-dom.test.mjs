import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { createServer } from "vite";
import { ManySingletons2001 } from "./fixtures/v7.3.14/stage0-regression-fixtures.mjs";
import { countTriadsBounded } from "../src/utils/mappings.js";
import { runKCore } from "../src/algorithms/kCore.js";
import { runShortestPath } from "../src/algorithms/shortestPath.js";

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
  const { default: TriadStatistic } = await vite.ssrLoadModule("/src/components/TriadStatistic.jsx");
  const { default: AlgorithmsPanel } = await vite.ssrLoadModule("/src/components/AlgorithmsPanel.jsx");
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  const render = async element => act(async () => root.render(element));
  const bodyText = () => document.body.textContent.replace(/\s+/g, " ").trim();

  const manySingletons = countTriadsBounded(ManySingletons2001());
  await render(React.createElement(TriadStatistic, { result: manySingletons }));
  assert.equal(document.querySelector("[data-derived-status='computed']")?.textContent, "0");
  assert.doesNotMatch(bodyText(), /Not computed/);

  await render(React.createElement(TriadStatistic, { result: { type: "triads", status: "computed", value: null, reason: null } }));
  assert.match(bodyText(), /Not computed — invalid numeric result/);

  const graph = [record("h0", ["a", "b"]), record("h1", ["b", "c"])];
  const shortest = runShortestPath(graph, { startVertex: "a", targetVertex: "c" });
  await render(React.createElement(AlgorithmsPanel, { algo: algorithmState("shortest_path", shortest, true) }));
  assert.match(bodyText(), /Shortest path/);
  assert.match(bodyText(), /Distance2/);

  const zero = runShortestPath([record("zero", ["a", "b"], 0)], { startVertex: "a", targetVertex: "b" });
  await render(React.createElement(AlgorithmsPanel, { algo: algorithmState("shortest_path", zero, true) }));
  assert.match(bodyText(), /Distance0/);

  const unreachable = runShortestPath([record("h0", ["a"]), record("h1", ["b"])], { startVertex: "a", targetVertex: "b" });
  await render(React.createElement(AlgorithmsPanel, { algo: algorithmState("shortest_path", unreachable, true) }));
  assert.match(bodyText(), /No path exists from a to b/);

  const kCore = runKCore([record("clique", ["a", "b", "c"])]);
  await render(React.createElement(AlgorithmsPanel, { algo: algorithmState("k_core", kCore, false) }));
  assert.match(bodyText(), /Degeneracy2/);
  assert.match(bodyText(), /coreness 2 shell/);

  const limited = runKCore([record("clique", ["a", "b", "c"])], { maxUniqueProjectedEdges: 1 });
  await render(React.createElement(AlgorithmsPanel, { algo: algorithmState("k_core", limited, false) }));
  assert.match(bodyText(), /K-core not computed — resource limit reached/);
  assert.match(bodyText(), /Exceeded resource: uniqueProjectedEdges/);

  await act(async () => root.unmount());
} finally {
  await vite.close();
  window.close();
}

console.log("Stage 6 Stats and AlgorithmsPanel DOM integration passed.");

function record(id, vertices, weight = 1) {
  return { id, vertices, time: null, weight, attributes: {} };
}

function algorithmState(algorithmId, result, supportsAnimation) {
  return {
    algorithms: [{ id: algorithmId, label: algorithmId, sub: "test" }],
    algorithm: { id: algorithmId, needsStartVertex: algorithmId === "shortest_path", needsTargetVertex: algorithmId === "shortest_path", supportsAnimation },
    algorithmId,
    selectAlgorithm() {},
    vertices: ["a", "b", "c"],
    startVertex: "a",
    setStartVertex() {},
    targetVertex: "c",
    setTargetVertex() {},
    run() {},
    result,
    error: "",
    animation: { supported: supportsAnimation, isPlaying: false, stepIndex: 0, totalSteps: result.steps?.length ?? 0, play() {}, pause() {}, stepForward() {}, stepBack() {} },
  };
}
