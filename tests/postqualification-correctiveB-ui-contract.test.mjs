import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Window } from "happy-dom";
import { createServer } from "vite";
import {
  UPLOAD_ACCEPT_ATTRIBUTE,
  UPLOAD_POLICY,
  validateSelectedFiles,
} from "../src/agent/uploadPolicy.js";

const appSource = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const panelSource = readFileSync(new URL("../src/components/AgentChatPanel.jsx", import.meta.url), "utf8");
const composerSource = readFileSync(new URL("../src/components/agent/AgentComposer.jsx", import.meta.url), "utf8");
const batchPanelSource = readFileSync(new URL("../src/components/AdvancedOptionsPanel.jsx", import.meta.url), "utf8");
const prechange = JSON.parse(readFileSync(new URL("../artifacts/v7.3.14-postqualification-correctiveB-prechange.json", import.meta.url), "utf8"));

assert.equal(prechange.capturedAgainstCommit, "cfbe3e1da1b7050a2cc72cd00d08a49128a1562b");
assert.equal(prechange.workingTreeAtCapture, "clean");

// B01: internal compatibility routes remain, but the normal selector excludes
// them from its authoritative visible projection.
assert.match(appSource, /id: "freeform", label: "Freeform \/ NLP"/);
assert.match(appSource, /id: "ai_prompt", label: "AI Prompt"/);
assert.match(appSource, /group === "advanced" && !\["freeform", "ai_prompt"\]\.includes\(f\.id\)/);
assert.match(appSource, /id: "custom", label: "Custom Parser"[^\n]+group: "advanced"/);

// B04: visible Assistant upload controls and their former hidden owner are
// absent, while the shared upload action remains owned by App/Batch Updates.
assert.doesNotMatch(composerSource, /Attach \/ new batch|agent-composer__attach|onAttach/);
assert.doesNotMatch(panelSource, />\s*\+ New batch\s*</);
assert.doesNotMatch(panelSource, /Upload a new file batch to Hypergraph Assistant/);
assert.match(appSource, /uploadAgentFiles,/);
assert.match(panelSource, /agentActions\.openBatchUpdates/);

// B03 and B05 structural contracts are also exercised as mounted production
// components below.
assert.match(panelSource, /aria-label="Quick Links"/);
assert.match(batchPanelSource, />Batch Updates</);
assert.doesNotMatch(batchPanelSource, />Advanced Options</);
assert.match(batchPanelSource, /data-upload-target="batch-updates"/);
assert.match(batchPanelSource, /onDrop=\{handleDrop\}/);

assert.deepEqual(
  {
    maxFiles: UPLOAD_POLICY.maxFiles,
    maxSingleFileBytes: UPLOAD_POLICY.maxSingleFileBytes,
    maxAggregateBytes: UPLOAD_POLICY.maxAggregateBytes,
  },
  { maxFiles: 50, maxSingleFileBytes: 10 * 1024 * 1024, maxAggregateBytes: 50 * 1024 * 1024 },
);
assert.match(UPLOAD_ACCEPT_ATTRIBUTE, /\.edge(?:,|$)/);
assert.match(UPLOAD_ACCEPT_ATTRIBUTE, /\.edges(?:,|$)/);

const window = new Window({ url: "http://localhost:5173/" });
globalThis.window = window;
globalThis.document = window.document;
Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
globalThis.HTMLElement = window.HTMLElement;
globalThis.Event = window.Event;
globalThis.MouseEvent = window.MouseEvent;
globalThis.KeyboardEvent = window.KeyboardEvent;
globalThis.File = window.File;
globalThis.requestAnimationFrame = callback => setTimeout(() => callback(Date.now()), 0);
globalThis.cancelAnimationFrame = id => clearTimeout(id);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
try {
  const React = await import("react");
  const { act } = React;
  const { createRoot } = await import("react-dom/client");
  const { default: AdvancedOptionsPanel } = await vite.ssrLoadModule("/src/components/AdvancedOptionsPanel.jsx");

  const uploadCalls = [];
  let previewCalls = 0;
  let commitCalls = 0;
  let discardCalls = 0;

  function likelyRoute(files) {
    if (files.some(file => /\.edges?$/i.test(file.name))) return "Graph Edge List";
    if (files.some(file => /adj/i.test(file.name))) return "Adjacency List";
    if (files.some(file => /\.csv$/i.test(file.name))) return "CSV";
    return "H2V / Simple";
  }

  async function authoritativeUpload(files) {
    try {
      const accepted = validateSelectedFiles(files);
      const result = {
        ok: true,
        count: accepted.length,
        batch: { label: `Batch ${uploadCalls.length + 1}` },
        detection: { label: likelyRoute(accepted) },
      };
      uploadCalls.push({ ok: true, names: accepted.map(file => file.name) });
      return result;
    } catch (error) {
      uploadCalls.push({ ok: false, error: error.message });
      return { ok: false, error: error.message };
    }
  }

  const baseProps = {
    batchText: "ADD_HYPEREDGE h3: 8, 9",
    setBatchText() {},
    batchPreviewActive: false,
    onPreviewBatch() { previewCalls += 1; return { ok: true }; },
    onCommitBatch() { commitCalls += 1; return { ok: true }; },
    onDiscardBatch() { discardCalls += 1; return { ok: true }; },
    batchParsedCount: 1,
    batchUnknownCount: 0,
    batchWarnings: [],
    hasGraph: true,
    exampleText: "ADD_HYPEREDGE h3: 8, 9",
    onUploadFiles: authoritativeUpload,
    activeUploadBatch: null,
  };

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const render = async (overrides = {}) => act(async () => root.render(React.createElement(AdvancedOptionsPanel, { ...baseProps, ...overrides })));
  await render();

  const bodyText = () => document.body.textContent.replace(/\s+/g, " ").trim();
  const target = () => document.querySelector("[data-upload-target='batch-updates']");
  const fileInput = () => document.querySelector("input[aria-label='Choose files for Batch Updates']");
  const makeFile = (name, text = "h1: A, B") => new window.File([text], name, { type: "text/plain" });
  const sizedFile = (name, size) => ({ name, size, type: "text/plain", text: async () => "x" });

  function transfer(files = [], types = ["Files"]) {
    return { files, types, dropEffect: "none" };
  }

  async function dispatchTransfer(type, dataTransfer) {
    const event = new window.Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, "dataTransfer", { value: dataTransfer, configurable: true });
    await act(async () => {
      target().dispatchEvent(event);
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    return event;
  }

  assert.match(bodyText(), /^Batch Updates/);
  assert.doesNotMatch(bodyText(), /Advanced Options/);
  assert.ok(fileInput(), "Batch Updates file picker must render");
  assert.equal(fileInput().multiple, true);
  assert.equal(fileInput().getAttribute("tabindex"), "-1");
  assert.ok(target(), "Batch Updates drag/drop target must render");
  assert.equal(target().tagName, "BUTTON", "drop target must be keyboard-operable");
  assert.match(target().textContent, /Drop files here or choose files/);

  const dragOver = await dispatchTransfer("dragover", transfer([makeFile("drag.txt")]));
  assert.equal(dragOver.defaultPrevented, true, "file dragover must opt into drop only on the target");
  assert.match(target().textContent, /Release to add files/);

  let event = await dispatchTransfer("drop", transfer([makeFile("graph.h2v.txt")]));
  assert.equal(event.defaultPrevented, true, "file drop must prevent browser navigation");
  assert.deepEqual(uploadCalls.at(-1), { ok: true, names: ["graph.h2v.txt"] });
  assert.match(bodyText(), /1 file accepted/);
  assert.equal(commitCalls, 0, "upload must not commit graph changes");

  await dispatchTransfer("drop", transfer([makeFile("adjacency.txt", "a: b c"), makeFile("table.csv", "h,v\nh1,a")]));
  assert.deepEqual(uploadCalls.at(-1), { ok: true, names: ["adjacency.txt", "table.csv"] });

  for (const name of ["graph.edge", "graph.EDGE", "graph.EdGe", "graph.edges"]) {
    await dispatchTransfer("drop", transfer([makeFile(name, "A B\nB C")]));
    assert.deepEqual(uploadCalls.at(-1), { ok: true, names: [name] }, `${name} drop must preserve Corrective A acceptance`);
  }

  await dispatchTransfer("drop", transfer([makeFile("graph.edg", "A B")]));
  assert.equal(uploadCalls.at(-1).ok, false);
  assert.match(uploadCalls.at(-1).error, /Unsupported upload extension/);
  assert.match(document.querySelector("[role='alert']")?.textContent ?? "", /Unsupported upload extension/);

  await dispatchTransfer("drop", transfer([sizedFile("oversized.txt", UPLOAD_POLICY.maxSingleFileBytes + 1)]));
  assert.equal(uploadCalls.at(-1).ok, false);
  assert.match(uploadCalls.at(-1).error, /max single-file size/);

  await dispatchTransfer("drop", transfer(Array.from({ length: 6 }, (_, index) => sizedFile(`aggregate-${index}.txt`, UPLOAD_POLICY.maxSingleFileBytes))));
  assert.equal(uploadCalls.at(-1).ok, false);
  assert.match(uploadCalls.at(-1).error, /max aggregate size/);

  await dispatchTransfer("drop", transfer(Array.from({ length: 51 }, (_, index) => sizedFile(`count-${index}.txt`, 1))));
  assert.equal(uploadCalls.at(-1).ok, false);
  assert.match(uploadCalls.at(-1).error, /at most 50 files/);

  const beforeNonFile = uploadCalls.length;
  event = await dispatchTransfer("drop", transfer([], ["text/plain"]));
  assert.equal(event.defaultPrevented, false, "non-file drop is not globally suppressed");
  assert.equal(uploadCalls.length, beforeNonFile, "non-file DataTransfer content must not upload");

  await dispatchTransfer("drop", transfer([makeFile("repeat.edge", "A B")]));
  await dispatchTransfer("drop", transfer([makeFile("repeat.edge", "A C")]));
  assert.deepEqual(uploadCalls.slice(-2).map(call => call.names), [["repeat.edge"], ["repeat.edge"]], "same-name uploads must each enter the authoritative batch path");

  const pickerFile = makeFile("picker.csv", "h,v\nh1,a");
  Object.defineProperty(fileInput(), "files", { value: [pickerFile], configurable: true });
  await act(async () => {
    fileInput().dispatchEvent(new window.Event("change", { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  assert.deepEqual(uploadCalls.at(-1), { ok: true, names: ["picker.csv"] }, "file picker must use the same callback as drop");

  const previewButton = [...document.querySelectorAll("button")].find(button => button.textContent.includes("Preview Batch Changes"));
  const commitButton = [...document.querySelectorAll("button")].find(button => button.textContent.includes("Commit Batch Changes"));
  assert.ok(previewButton && commitButton);
  await act(async () => previewButton.click());
  assert.equal(previewCalls, 1);
  assert.equal(commitCalls, 0, "preview must not silently commit");

  await render({ batchPreviewActive: true, activeUploadBatch: { label: "Batch 9", fileCount: 2, detectedLabel: "H2V / Simple" } });
  assert.match(bodyText(), /Preview active/);
  assert.match(bodyText(), /Active workspace batch: Batch 9 · 2 files · H2V \/ Simple/);
  const explicitCommit = [...document.querySelectorAll("button")].find(button => button.textContent.includes("Commit Batch Changes"));
  await act(async () => explicitCommit.click());
  assert.equal(commitCalls, 1, "commit must occur only after the explicit commit control is activated");
  assert.equal(discardCalls, 0);

  await act(async () => root.unmount());
} finally {
  await vite.close();
  window.close();
}

console.log("v7.3.14 post-qualification Corrective B UI contract tests passed.");
