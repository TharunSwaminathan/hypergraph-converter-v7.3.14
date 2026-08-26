import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const panel = await readFile("src/components/AgentChatPanel.jsx", "utf8");
const app = await readFile("src/App.jsx", "utf8");
const compiler = await readFile("src/agent/deterministicNlu/compileDeterministicAction.js", "utf8");
const metrics = await readFile("tests/helpers/evaluateDeterministicNluCorpus.mjs", "utf8");

assert.match(panel, /agentActions\.compileDeterministicTurn/);
assert.equal(panel.includes("../agent/deterministicNlu/domains/graphMutationGrammar.js"), false);
assert.equal(panel.includes("../agent/deterministicNlu/domains/parserWorkflowGrammar.js"), false);
assert.equal(panel.includes("../agent/deterministicNlu/domains/groundedQuestionGrammar.js"), false);
assert.match(app, /compileDeterministicAction/);
assert.match(app, /compileDeterministicTurnForAgent/);
assert.match(compiler, /typedValueForDomain/);
assert.match(metrics, /rate:\s*evaluated \? Number/);
assert.match(metrics, /rate:\s*evaluated \? Number[\s\S]*:\s*null/);

console.log("v7.3.4 regression tests passed.");
