import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const panelSource = readFileSync(new URL("../src/components/AgentChatPanel.jsx", import.meta.url), "utf8");
const composerSource = readFileSync(new URL("../src/components/agent/AgentComposer.jsx", import.meta.url), "utf8");
const batchPanelSource = readFileSync(new URL("../src/components/AdvancedOptionsPanel.jsx", import.meta.url), "utf8");

test("Corrective B pre-change UI characterization is reproducible from the approved parent", () => {
  assert.match(appSource, /label: "Freeform \/ NLP"/);
  assert.match(appSource, /label: "AI Prompt"/);
  assert.match(appSource, /FMTS\.filter\(f => f\.group === "advanced"\)/);
  assert.match(composerSource, />\s*Attach \/ new batch\s*</);
  assert.match(panelSource, />\s*\+ New batch\s*</);
  assert.match(batchPanelSource, />Advanced Options</);
  assert.doesNotMatch(batchPanelSource, /onDrop=/);
  assert.doesNotMatch(panelSource, /aria-label="Quick Links"/);
});
