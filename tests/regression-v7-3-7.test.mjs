import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { analyzeDeterministicNlu } from "../src/agent/deterministicNlu/deterministicNlu.js";
import { compileDeterministicAction } from "../src/agent/deterministicNlu/compileDeterministicAction.js";
import { COMMAND_CATALOG, UNSUPPORTED_EXAMPLES_REJECTED } from "../src/agent/deterministicNlu/commandCatalog.js";
import { searchCommandCatalog } from "../src/agent/deterministicNlu/commandCatalogSearch.js";
import { buildCompilerContexts, extractOperationTypes } from "./helpers/evaluateDeterministicNluCorpus.mjs";

const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
assert.equal(pkg.name, "hypergraph-converter-studio");
assert.equal(pkg.version, "7.3.14");

const graphCtx = await buildCompilerContexts("graph-basic");
const includeNlu = analyzeDeterministicNlu("Include vertices 6 and 7 in h2", graphCtx.analysisContext);
const includeCompiled = compileDeterministicAction(includeNlu, graphCtx.compileContext);
assert.deepEqual(includeCompiled.compiled.plan.operations.map(operation => operation.vertexId), ["6", "7"]);
assert.deepEqual(extractOperationTypes(includeCompiled), ["ADD_INCIDENCE", "ADD_INCIDENCE"]);

const mappingCtx = await buildCompilerContexts("three-table-authorship");
const keepNlu = analyzeDeterministicNlu("Keep papers with no authors", mappingCtx.analysisContext);
const keepCompiled = compileDeterministicAction(keepNlu, mappingCtx.compileContext);
assert.equal(keepCompiled.typedKind, "DatasetMappingPatch");
assert.deepEqual(extractOperationTypes(keepCompiled), ["SET_POLICY", "SET_POLICY"]);
assert.ok(!extractOperationTypes(keepCompiled).includes("MOVE_FILE_TO_GROUP"), "policy wording must not become a grouping move");

const doNotRunNlu = analyzeDeterministicNlu("Do not run it; just show the transformation plan", mappingCtx.analysisContext);
const doNotRunCompiled = compileDeterministicAction(doNotRunNlu, mappingCtx.compileContext);
assert.equal(doNotRunCompiled.typedKind, "ParserWorkflowOperation");
assert.ok(!extractOperationTypes(doNotRunCompiled).includes("RUN_CUSTOM_PARSER_CONFIRMATION"));

const bfsNlu = analyzeDeterministicNlu("Can the chatbot run BFS?", graphCtx.analysisContext);
const bfsCompiled = compileDeterministicAction(bfsNlu, graphCtx.compileContext);
assert.equal(bfsCompiled.typedKind, "DeterministicHelpQuery");
assert.equal(bfsCompiled.typedValue.intent, "EXPLAIN_PANEL_ONLY_FEATURE");
assert.ok(UNSUPPORTED_EXAMPLES_REJECTED.includes("Run BFS from vertex 1"));
assert.ok(searchCommandCatalog({ query: "BFS", availability: "panel_only" }).some(entry => entry.category === "algorithms"));

assert.ok(COMMAND_CATALOG.some(entry => entry.id === "quoted.identifiers"));
assert.ok(COMMAND_CATALOG.some(entry => entry.id === "questions.question-action-contrast"));

console.log("v7.3.7 deterministic command catalog regression tests passed.");
