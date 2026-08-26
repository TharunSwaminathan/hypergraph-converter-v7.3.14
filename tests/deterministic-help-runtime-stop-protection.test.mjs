import assert from "node:assert/strict";
import fs from "node:fs";
import { prepareDeterministicTurn } from "../src/agent/deterministicNlu/prepareDeterministicTurn.js";
import { buildCompilerContexts } from "./helpers/evaluateDeterministicNluCorpus.mjs";

const contexts = await buildCompilerContexts("dashboard-workspace");

const help = prepareDeterministicTurn({
  query: "How do I stop the current request?",
  analysisContext: contexts.analysisContext,
  compileContext: contexts.compileContext,
});
assert.equal(help.nlu.speechAct, "help_seeking_question");
assert.equal(help.compilation.domain, "help_query");
assert.equal(help.compilation.sideEffectClass, "read_only");

const direct = prepareDeterministicTurn({
  query: "Stop the current request",
  analysisContext: contexts.analysisContext,
  compileContext: contexts.compileContext,
});
assert.equal(direct.nlu.speechAct, "cancellation");
assert.equal(direct.compilation.domain, "legacy_action");
assert.equal(direct.compilation.typedValue.intent, "runtime_stop");

const panelSource = fs.readFileSync(new URL("../src/components/AgentChatPanel.jsx", import.meta.url), "utf8");
assert.match(panelSource, /const\s+semantics\s*=\s*analyzeRequestSemantics\(query\)/, "busy gate computes compositional request semantics before blocking");
assert.match(panelSource, /const\s+mayInterruptRuntime\s*=\s*semantics\.readOnlyScope\s*\|\|\s*semantics\.directRuntimeStop/, "read-only Help and direct Stop can reach deterministic routing while runtime is busy");
assert.match(panelSource, /coordinator\.begin\(\{[\s\S]*allowConcurrent:\s*mayInterruptRuntime/, "owner-ID request coordination permits only read-only Help or direct Stop to overlap");
assert.doesNotMatch(panelSource, /requestInFlightRef/, "a shared Boolean request flag must not control concurrent lifecycle ownership");
assert.match(panelSource, /localModel\?\.request\?\.busy\s*&&\s*!mayInterruptRuntime/, "local model busy gate preserves Help/stop text");

console.log("deterministic Help runtime-stop protection tests passed.");
