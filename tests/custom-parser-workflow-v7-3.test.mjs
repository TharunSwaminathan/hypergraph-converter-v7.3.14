import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = path => readFile(join(root, path), "utf8");

const app = await read("src/App.jsx");
assert.match(app, /profileDatasetFiles/);
assert.match(app, /profileDatasetRelationships/);
assert.match(app, /buildDatasetGroupingDraft/);
assert.match(app, /runExclusiveLocalModelTask\(\{\s*[\s\S]*task: "plan_dataset_interpretation"/);
assert.match(app, /task: "plan_dataset_mapping_patch"/);
assert.match(app, /buildParserReconciliationReport/);
assert.match(app, /parserReconciliationAllowsApply/);
assert.match(app, /transformationPlanPreview/);

const panel = await read("src/components/AgentChatPanel.jsx");
assert.match(panel, /Profile", "Group", "Map", "Clarify", "Plan", "Generate", "Run", "Reconcile", "Preview", "Apply"/);
assert.match(panel, /Dataset profile and grouping evidence/);
assert.match(panel, /Transformation plan/);
assert.match(panel, /Parser reconciliation/);
assert.match(panel, /Undo mapping change/);

const customParser = await read("src/utils/customParser.js");
assert.match(customParser, /parseDelimited/);
assert.match(customParser, /indexBy/);
assert.match(customParser, /splitList/);
assert.doesNotMatch(`${app}\n${panel}\n${customParser}`, /apiKey|api_key|gemini|LangGraph/i);

console.log("custom parser workflow v7.3 source tests passed.");
