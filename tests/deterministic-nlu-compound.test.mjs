import assert from "node:assert/strict";
import { analyzeDeterministicNlu } from "../src/agent/deterministicNlu/deterministicNlu.js";
import { compileParserWorkflowGrammar } from "../src/agent/deterministicNlu/domains/parserWorkflowGrammar.js";

const nlu = analyzeDeterministicNlu("Generate the parser and run it.", { parserWorkflow: { parserStatus: "none" } });
const compiled = compileParserWorkflowGrammar("Generate the parser and run it.", { nlu, state: { activeBatch: { mappingSpecStatus: "valid", transformationPlan: {} } } });
assert(compiled.operations.some(operation => operation.type === "GENERATE_PARSER_FROM_MAPPING"));
assert(compiled.operations.some(operation => operation.type === "RUN_CUSTOM_PARSER_CONFIRMATION"));

const negated = analyzeDeterministicNlu("Generate the parser but do not run it.", { parserWorkflow: { parserStatus: "none" } });
const negatedCompiled = compileParserWorkflowGrammar("Generate the parser but do not run it.", { nlu: negated, state: { activeBatch: { mappingSpecStatus: "valid", transformationPlan: {} } } });
assert(negatedCompiled.operations.some(operation => operation.type === "GENERATE_PARSER_FROM_MAPPING"));
assert(!negatedCompiled.operations.some(operation => operation.type === "RUN_CUSTOM_PARSER_CONFIRMATION"));

console.log("deterministic NLU compound tests passed.");
