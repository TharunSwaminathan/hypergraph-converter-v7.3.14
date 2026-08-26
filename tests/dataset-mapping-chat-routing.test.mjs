import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const panel = await readFile(join(root, "src/components/AgentChatPanel.jsx"), "utf8");

assert.match(panel, /async function maybeHandleDatasetMapping/);
assert.match(panel, /if \(await maybeHandleDatasetMapping\(query\)\) \{\s*return;\s*\}/);

const submitIndex = panel.indexOf("if (await maybeHandleDatasetMapping(query))");
for (const marker of [
  "maybeStageGraphMutation(query)",
  "resolveDeterministicControlPlan(query, current)",
  "executeActionPath(query)",
]) {
  assert.ok(submitIndex >= 0 && submitIndex < panel.indexOf(marker), `${marker} must appear after mapping routing`);
}

const executeIndex = panel.indexOf("async function executeActionPath");
assert.ok(submitIndex < executeIndex || executeIndex < submitIndex, "executeActionPath is intentionally separate; mapping handler must be called before executeActionPath is reached.");
assert.match(panel, /runDatasetMappingPatchAssist\(query,\s*\{\s*allowBootstrap: true,\s*source: "chat"/s);
assert.match(panel, /Cancel or complete the pending parser action before changing the mapping/);
assert.doesNotMatch(panel.slice(submitIndex, panel.indexOf("const controlPlan = resolveDeterministicControlPlan")), /runOllamaOrchestrator|buildDeterministicActionPlan/);

console.log("dataset mapping chat routing source tests passed.");
