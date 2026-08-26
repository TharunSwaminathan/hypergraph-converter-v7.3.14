import assert from "node:assert/strict";
import { analyzeDeterministicNlu } from "../src/agent/deterministicNlu/deterministicNlu.js";
import { compileDeterministicAction } from "../src/agent/deterministicNlu/compileDeterministicAction.js";
import { GRAPH_MUTATION_OPS } from "../src/graph/graphMutationSchema.js";
import { buildCompilerContexts } from "./helpers/evaluateDeterministicNluCorpus.mjs";

const contexts = await buildCompilerContexts("graph-basic");
const query = 'add vertex "a vertex 6" to h2';
const nlu = analyzeDeterministicNlu(query, contexts.analysisContext);
const compiled = compileDeterministicAction(nlu, contexts.compileContext);

const vertexEntities = nlu.entities.filter(entity => entity.type === "vertex");
assert.deepEqual(vertexEntities.map(entity => entity.normalizedValue ?? entity.value), ["a vertex 6"]);
assert.equal(vertexEntities[0].quoted, true);
assert.ok(!vertexEntities.some(entity => entity.value === "6"), "quoted literal must not leak an unquoted numeric vertex entity");

const operations = compiled.compiled.plan.operations;
assert.deepEqual(operations, [{
  type: GRAPH_MUTATION_OPS.ADD_INCIDENCE,
  hyperedgeId: "h2",
  vertexId: "a vertex 6",
}]);
assert.ok(compiled.diagnostics.resolvedEntities.includes("vertex:a vertex 6"));
assert.ok(!compiled.diagnostics.resolvedEntities.includes("vertex:6"));

console.log("deterministic help quoted diagnostics tests passed.");
