import assert from "node:assert/strict";
import { interpretCustomParserConversation } from "../src/agent/customParserConversation.js";
import { interpretGraphMutationRequest } from "../src/agent/graphMutationConversation.js";
import { createGraphIdentity } from "../src/graph/graphIdentity.js";

const v2Mapping = { version: 2, files: [], groups: [], entities: { vertices: [], hyperedges: [] }, relationships: [] };
const mapping = interpretCustomParserConversation("Use authors.csv as vertices.", v2Mapping, null);
assert.equal(mapping.noMatch, true);
assert.equal(mapping.diagnostics.legacyParserCalled, false);

const graph = [{ id: "h0", vertices: ["Alice"], attributes: {} }];
const graphResult = interpretGraphMutationRequest("Add Bob to h0.", graph, createGraphIdentity(graph, null, { replace: true }));
assert.equal(graphResult.ok, true);
assert.equal(graphResult.diagnostics.authoritativeCompiler, "graph_mutation_v1");
assert.equal(graphResult.diagnostics.legacyParserCalled, false);
assert.equal(graphResult.plan.operations[0].type, "ADD_INCIDENCE");

console.log("deterministic NLU legacy adapter tests passed.");
