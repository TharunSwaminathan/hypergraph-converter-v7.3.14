import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { createServer } from "vite";
import { setup, seed } from "./fixtures/candy-scope8a-portability.mjs";
import { historyGraph } from "./fixtures/candy-scope8b-history.mjs";
import { createGraphState } from "../src/graph/graphState.js";
import { createProjectSession } from "../src/persistence/projectSession.js";

const window = new Window({ url: "http://127.0.0.1:5173" }); Object.assign(globalThis, { window, document: window.document, HTMLElement: window.HTMLElement, Event: window.Event, IS_REACT_ACT_ENVIRONMENT: true }); Object.defineProperty(globalThis, "navigator", { configurable: true, value: window.navigator });
const vite = await createServer({ server: { middlewareMode: true, watch: { ignored: ["**/artifacts/**"] } }, appType: "custom", logLevel: "error" });
try {
  const React = await import("react"), { act } = React, { createRoot } = await import("react-dom/client"), { useAlgorithms } = await vite.ssrLoadModule("/src/hooks/useAlgorithms.js"), { useAnalysisHistory } = await vite.ssrLoadModule("/src/persistence/useAnalysisHistory.js"), { default: Panel } = await vite.ssrLoadModule("/src/components/AnalysisHistoryPanel.jsx");
  const s = setup(), id = await seed(s.store), memoryBefore = (await s.store.readMemory(id)).envelope.sha256, modelBefore = JSON.stringify((await s.store.readConnectionProfile()).profile), session = createProjectSession(s.store, await s.store.readProject(id)); let current, changeGraph, repaint, accept = false, confirmCalls = 0;
  function Host() {
    const [graph, setGraph] = React.useState(historyGraph), [, tick] = React.useState(0); changeGraph = setGraph; repaint = () => tick(n => n + 1);
    const history = useAnalysisHistory({ session, ready: true, hyperedges: graph.hyperedges }), algo = useAlgorithms(graph.hyperedges, { onCompleted: history.complete, historyContext: { projectId: id, graph, preview: true } }); current = { history, algo, graph };
    return React.createElement(React.Fragment, null, React.createElement("button", { onClick: algo.run }, "Run actual algorithm"), React.createElement(Panel, { history, confirm: async () => { confirmCalls++; return accept; }, onRerun: r => algo.runSelection(r.algorithm, r.parameters) }));
  }
  const root = createRoot(document.body.appendChild(document.createElement("div"))), button = text => [...document.querySelectorAll("button")].find(x => x.textContent === text);
  async function spin(fn) { for (let n = 0; n < 2000; n++) { await act(async () => { await new Promise(resolve => setTimeout(resolve, 2)); }); if (fn()) return; } throw Error("History UI timeout " + document.body.textContent); }
  await act(async () => root.render(React.createElement(React.StrictMode, null, React.createElement(Host)))); await spin(() => current.history.status === "ready"); assert.equal(current.history.records.length, 0);
  await act(async () => button("Run actual algorithm").click()); await spin(() => current.history.records.length === 1 && current.history.status === "ready"); const first = current.history.records[0]; assert.equal(first.algorithm, "connected_components");
  await act(async () => repaint()); await spin(() => current.history.status === "ready"); assert.equal((await s.store.readAnalysisHistory(id)).envelope.records.length, 1, "render/StrictMode do not duplicate completion");
  await act(async () => document.querySelector('.analysis-history__list button').click()); const beforeGraph = current.graph; assert.match(document.body.textContent, /historical result/); assert.equal(current.graph, beforeGraph);
  await act(async () => button("Rerun on matching current input").click()); await spin(() => current.history.records.length === 2 && current.history.status === "ready"); assert.notEqual(current.history.records[1].recordId, first.recordId); assert.equal(current.history.records[1].resultSha256, first.resultSha256);
  await act(async () => changeGraph(createGraphState([{ id: "new", vertices: ["A", "<img src=x onerror=alert(1)>"] }]))); await spin(() => button("Rerun on matching current input").disabled); assert.equal(current.history.records.length, 2, "automatic live recompute is not another intentional completion");
  await act(async () => button("Run actual algorithm").click()); await spin(() => current.history.records.length === 3 && current.history.status === "ready"); await act(async () => document.querySelector('.analysis-history__list button').click()); assert(document.querySelector('[aria-label="Historical outcome"]').textContent.includes('<img')); assert.equal(document.querySelector('.analysis-history img'), null, "malicious strings render only as text");
  await act(async () => button("Clear project analysis history…").click()); await spin(() => confirmCalls === 1); assert.equal(current.history.records.length, 3, "Cancel retains evidence"); accept = true; await act(async () => button("Clear project analysis history…").click()); await spin(() => current.history.records.length === 0); assert.equal((await s.store.readMemory(id)).envelope.sha256, memoryBefore); assert.equal(JSON.stringify((await s.store.readConnectionProfile()).profile), modelBefore);
  await act(async () => root.unmount()); await s.store.close();
  console.log("Scope 8B mounted StrictMode: explicit completions, no render/recompute duplicate, fresh rerun, read-only inspect, escaped strings, reviewed clear and unchanged memory/model PASS (happy-dom + transactional double; native separate).");
} finally { await vite.close(); await window.happyDOM.close(); }
