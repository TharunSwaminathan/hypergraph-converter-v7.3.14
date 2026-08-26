import assert from "node:assert/strict";
import { prepareDeterministicTurn } from "../src/agent/deterministicNlu/prepareDeterministicTurn.js";
import { SIDE_EFFECT } from "../src/agent/deterministicNlu/commandCatalogSchema.js";
import { buildCompilerContexts } from "./helpers/evaluateDeterministicNluCorpus.mjs";

const contexts = await buildCompilerContexts("dashboard-workspace");

const cases = [
  {
    query: "How do I clear the active batch?",
    speechAct: "help_seeking_question",
    domain: "help_query",
    typedKind: "DeterministicHelpQuery",
    intent: "EXPLAIN_ACTION_COMMAND",
    sideEffect: SIDE_EFFECT.READ_ONLY,
  },
  {
    query: "Could you clear the active batch?",
    speechAct: "polite_interrogative_request",
    domain: "legacy_action",
    typedKind: "LegacyActionIntent",
    intent: "clear_uploaded_files",
    sideEffect: SIDE_EFFECT.DESTRUCTIVE_BATCH_STATE,
  },
  {
    query: "Clear the active batch",
    speechAct: "imperative_request",
    domain: "legacy_action",
    typedKind: "LegacyActionIntent",
    intent: "clear_uploaded_files",
    sideEffect: SIDE_EFFECT.DESTRUCTIVE_BATCH_STATE,
  },
  {
    query: "How do I validate the mapping?",
    speechAct: "help_seeking_question",
    domain: "help_query",
    typedKind: "DeterministicHelpQuery",
    intent: "EXPLAIN_ACTION_COMMAND",
    sideEffect: SIDE_EFFECT.READ_ONLY,
  },
  {
    query: "Can you validate the mapping?",
    speechAct: "polite_interrogative_request",
    domain: "legacy_action",
    typedKind: "LegacyActionIntent",
    intent: "validate_mapping",
    sideEffect: SIDE_EFFECT.WORKFLOW_PREPARATION,
  },
  {
    query: "Validate the mapping",
    speechAct: "imperative_request",
    domain: "legacy_action",
    typedKind: "LegacyActionIntent",
    intent: "validate_mapping",
    sideEffect: SIDE_EFFECT.WORKFLOW_PREPARATION,
  },
];

for (const expected of cases) {
  const prepared = prepareDeterministicTurn({
    query: expected.query,
    analysisContext: contexts.analysisContext,
    compileContext: contexts.compileContext,
  });
  assert.equal(prepared.nlu.speechAct, expected.speechAct, expected.query);
  assert.equal(prepared.compilation.domain, expected.domain, expected.query);
  assert.equal(prepared.compilation.typedKind, expected.typedKind, expected.query);
  assert.equal(prepared.compilation.typedValue.intent, expected.intent, expected.query);
  assert.equal(prepared.compilation.sideEffectClass, expected.sideEffect, expected.query);
}

console.log("deterministic help politeness distinction tests passed.");
