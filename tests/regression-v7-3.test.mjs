import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = path => readFile(join(root, path), "utf8");
const packageJson = JSON.parse(await read("package.json"));
assert.equal(packageJson.name, "hypergraph-converter-studio");
assert.equal(packageJson.version, "7.3.14");

for (const file of [
  "src/utils/delimitedText.js",
  "src/agent/datasetProfiler.js",
  "src/agent/datasetRelationshipProfiler.js",
  "src/agent/datasetGrouping.js",
  "src/agent/datasetInterpretationPlanner.js",
  "src/agent/datasetMappingSpecV2.js",
  "src/agent/datasetMappingPatchApplier.js",
  "src/agent/transformationPlan.js",
  "src/agent/transformationPlanCompiler.js",
  "src/agent/parserReconciliation.js",
  "docs/V7_3_IMPLEMENTATION.md",
  "docs/V7_3_TEST_REPORT.md",
]) {
  assert.equal(existsSync(join(root, file)), true, `${file} must exist`);
}

const planner = await read("src/agent/datasetInterpretationPlanner.js");
const patchPlanner = await read("src/agent/datasetMappingPatchPlanner.js");
assert.match(`${planner}\n${patchPlanner}`, /generateWithLocalModel/);
assert.match(`${planner}\n${patchPlanner}`, /LOCAL_MODEL_TASK_TIMEOUTS/);
assert.doesNotMatch(`${planner}\n${patchPlanner}`, /fetch\(|openai|gemini|apiKey|api_key|LangGraph/i);

console.log("v7.3 regression source tests passed.");
