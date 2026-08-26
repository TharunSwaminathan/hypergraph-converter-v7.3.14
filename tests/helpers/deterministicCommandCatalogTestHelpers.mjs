import { isDeepStrictEqual } from "node:util";
import { analyzeDeterministicNlu } from "../../src/agent/deterministicNlu/deterministicNlu.js";
import { compileDeterministicAction } from "../../src/agent/deterministicNlu/compileDeterministicAction.js";
import { prepareDeterministicTurn } from "../../src/agent/deterministicNlu/prepareDeterministicTurn.js";
import {
  buildCompilerContexts,
  extractCanonicalOperations,
  extractOperationTypes,
} from "./evaluateDeterministicNluCorpus.mjs";

export const CATALOG_FIXTURE_MAP = Object.freeze({
  empty: "dashboard-workspace",
  "dashboard.basic": "dashboard-workspace",
  "graph.basic": "graph-basic",
  "graph.researchers": "graph-researchers",
  "graph.researchersWithAlice": "graph-researchers-with-alice",
  "graph.named": "graph-named",
  "graph.history": "graph-with-history",
  "mapping.authorship": "three-table-authorship",
  "mapping.monthly": "catalog-monthly-datasets",
  "mapping.ambiguous": "ambiguous-paper-files",
  "parser.plan_ready": "parser-plan-ready",
  "parser.generated": "parser-generated",
  "parser.result_ready": "parser-result-ready",
});

export function fixtureNameForExample(example = {}) {
  return CATALOG_FIXTURE_MAP[example.fixture ?? "empty"] ?? example.fixture ?? "dashboard-workspace";
}

export async function compileCatalogExample(example = {}) {
  const contexts = await buildCompilerContexts(fixtureNameForExample(example));
  const nlu = analyzeDeterministicNlu(example.text, contexts.analysisContext);
  const compilation = compileDeterministicAction(nlu, contexts.compileContext);
  return {
    contexts,
    nlu,
    compilation,
    operationTypes: extractOperationTypes(compilation),
    canonicalOperations: extractCanonicalOperations(compilation),
    intent: actualIntent(nlu, compilation),
    speechAct: compilation.speechAct ?? nlu.speechAct ?? "unknown",
    sideEffect: compilation.sideEffectClass ?? "read_only",
    typedKind: compilation.typedKind ?? null,
    domain: compilation.domain ?? nlu.primaryDomain,
    slots: compilation.compiled?.slots ?? compilation.typedValue?.slots ?? {},
    clarification: Boolean(
      compilation.compiled?.needsClarification
      || compilation.compiled?.draft?.classification === "clarification"
      || compilation.compiled?.classification === "clarification"
    ),
  };
}

export async function prepareCatalogExample(example = {}) {
  const contexts = await buildCompilerContexts(fixtureNameForExample(example));
  const prepared = prepareDeterministicTurn({
    query: example.text,
    analysisContext: contexts.analysisContext,
    compileContext: contexts.compileContext,
  });
  return { contexts, prepared };
}

export function compareExpectedExample({ entry, example, compiled }) {
  const failures = [];
  const checks = [];
  if (example.expectedDomain) checks.push(["domain", compiled.domain, example.expectedDomain]);
  if (example.expectedTypedKind) checks.push(["typedKind", compiled.typedKind, example.expectedTypedKind]);
  if (example.expectedSpeechAct) checks.push(["speechAct", compiled.speechAct, example.expectedSpeechAct]);
  if (example.expectedSideEffect) checks.push(["sideEffect", compiled.sideEffect, example.expectedSideEffect]);
  if (example.expectedIntent) checks.push(["intent", compiled.intent, example.expectedIntent]);
  for (const [field, actual, expected] of checks) {
    if (actual !== expected) failures.push(formatFailure(entry, example, field, actual, expected));
  }
  if (example.expectedOperationTypes && !isDeepStrictEqual(compiled.operationTypes, example.expectedOperationTypes)) {
    failures.push(formatFailure(entry, example, "operationTypes", compiled.operationTypes, example.expectedOperationTypes));
  }
  if (example.expectedOperations && !isDeepStrictEqual(compiled.canonicalOperations, example.expectedOperations)) {
    failures.push(formatFailure(entry, example, "operations", compiled.canonicalOperations, example.expectedOperations));
  }
  if (example.expectedSlots) {
    for (const [key, expected] of Object.entries(example.expectedSlots)) {
      if (compiled.slots[key] !== expected) {
        failures.push(formatFailure(entry, example, `slot:${key}`, compiled.slots[key], expected));
      }
    }
  }
  if (typeof example.expectsClarification === "boolean" && compiled.clarification !== example.expectsClarification) {
    failures.push(formatFailure(entry, example, "clarification", compiled.clarification, example.expectsClarification));
  }
  for (const forbidden of example.forbiddenOperationTypes ?? []) {
    if (compiled.operationTypes.includes(forbidden)) {
      failures.push(formatFailure(entry, example, "forbiddenOperation", compiled.operationTypes, `no ${forbidden}`));
    }
  }
  return failures;
}

export function actualIntent(nlu, compilation) {
  return compilation.compiled?.canonicalIntent
    ?? compilation.typedValue?.canonicalIntent
    ?? compilation.intent
    ?? nlu.primaryIntent;
}

function formatFailure(entry, example, field, actual, expected) {
  return {
    entryId: entry.id,
    example: example.text,
    field,
    actual,
    expected,
  };
}
