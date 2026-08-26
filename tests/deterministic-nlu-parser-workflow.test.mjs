import assert from "node:assert/strict";
import { analyzeDeterministicNlu } from "../src/agent/deterministicNlu/deterministicNlu.js";
import { compileParserWorkflowGrammar } from "../src/agent/deterministicNlu/domains/parserWorkflowGrammar.js";

const state = {
  activeBatch: {
    mappingSpecStatus: "valid",
    transformationPlan: null,
    generatedParserFromMapping: "",
  },
  customResultId: null,
};

let nlu = analyzeDeterministicNlu("Continue.", { parserWorkflow: { mappingStatus: "valid", planStatus: "none", parserStatus: "none" } });
let compiled = compileParserWorkflowGrammar("Continue.", { nlu, state });
assert.equal(compiled.operations[0].type, "GENERATE_TRANSFORMATION_PLAN");

nlu = analyzeDeterministicNlu("Generate the plan and then create the parser, but do not run it.", { parserWorkflow: {} });
compiled = compileParserWorkflowGrammar("Generate the plan and then create the parser, but do not run it.", { nlu, state });
assert(compiled.operations.some(operation => operation.type === "GENERATE_TRANSFORMATION_PLAN"));
assert(compiled.operations.some(operation => operation.type === "GENERATE_PARSER_FROM_MAPPING"));
assert(!compiled.operations.some(operation => operation.type === "RUN_CUSTOM_PARSER_CONFIRMATION"));
assert.equal(compiled.negatedRun, true);

nlu = analyzeDeterministicNlu("Run it.", { parserWorkflow: { parserStatus: "inserted" } });
compiled = compileParserWorkflowGrammar("Run it.", { nlu, state: { activeBatch: { mappingSpecStatus: "valid", transformationPlan: {} }, customResultId: null } });
assert.equal(compiled.operations[0].type, "RUN_CUSTOM_PARSER_CONFIRMATION");

console.log("deterministic NLU parser workflow tests passed.");
