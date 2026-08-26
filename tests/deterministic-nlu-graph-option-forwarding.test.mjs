import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const panel = readFileSync(new URL("../src/components/AgentChatPanel.jsx", import.meta.url), "utf8");
const stageStart = panel.indexOf("async function stageGraphMutationDetailed");
const stageEnd = panel.indexOf("async function maybeApplyMappingConversation", stageStart);
assert.ok(stageStart >= 0 && stageEnd > stageStart, "stageGraphMutationDetailed must exist");
const stage = panel.slice(stageStart, stageEnd);
for (const field of [
  "precompiledPlan",
  "precompiledCompilation",
  "semanticConfidence",
  "contextBinding",
  "deterministicFirst",
]) {
  assert.match(stage, new RegExp(`${field}:\\s*options\\.${field}`), `${field} must be forwarded to prepareGraphMutation`);
}
assert.match(stage, /graphTracePatchFromResult\(result\)/, "graph trace data must come from actual preparation results");
assert.doesNotMatch(stage, /graphRecompileCount:\s*0,\s*modelCalls:\s*\[\]/s, "graph traces must not be hard-coded to zero");

const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
assert.match(app, /if \(precompiledPlan && semanticConfidence\?\.level === "high"\)/);
const highStart = app.indexOf('if (precompiledPlan && semanticConfidence?.level === "high")');
const highEnd = app.indexOf('if (deterministicFirst && precompiledCompilation?.handled', highStart);
const highBlock = app.slice(highStart, highEnd);
assert.doesNotMatch(highBlock, /planGraphMutationWithModel/);
assert.match(highBlock, /previewGraphMutation/);
assert.match(highBlock, /precompiledPlanUsed:\s*true/);
assert.match(highBlock, /graphRecompileCount:\s*0/);

console.log("deterministic NLU graph option forwarding tests passed.");
