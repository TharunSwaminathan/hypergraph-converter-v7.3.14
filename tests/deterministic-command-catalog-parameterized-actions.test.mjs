import assert from "node:assert/strict";
import { COMMAND_CATALOG } from "../src/agent/deterministicNlu/commandCatalog.js";
import { REQUIRED_CONTEXT, SIDE_EFFECT } from "../src/agent/deterministicNlu/commandCatalogSchema.js";
import { extractActionArguments, findActionIntentForText } from "../src/agent/actionIntentRegistry.js";
import { prepareDeterministicTurn } from "../src/agent/deterministicNlu/prepareDeterministicTurn.js";
import { buildCompilerContexts } from "./helpers/evaluateDeterministicNluCorpus.mjs";

const byId = new Map(COMMAND_CATALOG.map(entry => [entry.id, entry]));

const activateEntry = byId.get("files.activate-batch-number");
assert.ok(activateEntry, "numbered batch activation must be cataloged");
assert.ok(activateEntry.patterns.includes("Activate batch <number>"));
assert.ok(activateEntry.requiredContext.includes(REQUIRED_CONTEXT.EXISTING_BATCH));
assert.equal(activateEntry.sideEffect, SIDE_EFFECT.BATCH_STATE_EDIT);

const generateEntry = byId.get("files.generate-parser-for-batch");
assert.ok(generateEntry, "numbered parser generation must be cataloged");
assert.ok(generateEntry.patterns.includes("Generate parser for batch <number>"));
assert.ok(generateEntry.requiredContext.includes(REQUIRED_CONTEXT.VALID_MAPPING_FOR_BATCH));

const modelEntry = byId.get("runtime.use-model-name");
assert.ok(modelEntry, "model-name command must be cataloged");
assert.ok(modelEntry.patterns.includes("Use model <model name>"));
assert.equal(modelEntry.sideEffect, SIDE_EFFECT.RUNTIME_CONTROL);

const examples = [
  ["Activate batch 12", "activate_batch_number", { batchNumber: 12 }],
  ["Switch to batch 3", "activate_batch_number", { batchNumber: 3 }],
  ["Generate parser for batch 2", "generate_parser_for_batch", { batchNumber: 2 }],
  ["Create parser for batch 4", "generate_parser_for_batch", { batchNumber: 4 }],
  ["Use model qwen3:8b", "local_model_select", { modelName: "qwen3:8b" }],
];

const contexts = await buildCompilerContexts("dashboard-workspace");
for (const [query, expectedIntent, expectedArgs] of examples) {
  const action = findActionIntentForText(query);
  assert.equal(action?.intent, expectedIntent, query);
  assert.deepEqual(extractActionArguments(action, query), expectedArgs, query);

  const prepared = prepareDeterministicTurn({
    query,
    analysisContext: contexts.analysisContext,
    compileContext: contexts.compileContext,
  });
  assert.equal(prepared.compilation.domain, "legacy_action", query);
  assert.equal(prepared.compilation.typedValue.intent, expectedIntent, query);
  for (const [key, value] of Object.entries(expectedArgs)) {
    assert.equal(prepared.compilation.typedValue[key], value, query);
  }
}

console.log("deterministic command catalog parameterized action tests passed.");
