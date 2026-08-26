import assert from "node:assert/strict";
import { GRAPH_MUTATION_DRAFT_SCHEMA } from "../src/agent/graphMutationDraftSchema.js";
import { planGraphMutationWithModel } from "../src/agent/graphMutationModelPlanner.js";
import { buildGraphMutationPlannerPrompt } from "../src/agent/prompts/graphMutationPlannerPrompt.js";

const graph = [{ id: "h0", vertices: ["4", "5"] }];
const prompt = buildGraphMutationPlannerPrompt({
  userQuery: "Add vertex 4 to h0 again.",
  hyperedges: graph,
  graphIdentity: { graphId: "g", graphVersion: 1 },
  recentReferences: { vertices: ["4"], hyperedges: ["h0"] },
});

const serializedMessages = prompt.messages.map(message => message.content).join("\n");
assert.equal(serializedMessages.includes("responseSchema"), false, "planner prompt must not duplicate the schema field");
assert.equal(serializedMessages.includes(JSON.stringify(GRAPH_MUTATION_DRAFT_SCHEMA).slice(0, 120)), false, "planner prompt must not embed the full schema text");
assert.ok(prompt.promptChars <= 6000, `typical prompt too large: ${prompt.promptChars}`);
assert.ok(prompt.schemaChars <= 5000, `schema too large: ${prompt.schemaChars}`);
assert.equal(prompt.numPredict, 768);
assert.deepEqual(prompt.graphContext.recentVerifiedReferences.hyperedges, ["h0"]);

let calls = 0;
const planned = await planGraphMutationWithModel({
  config: {},
  userQuery: "Add vertex 4 to h0 again.",
  hyperedges: graph,
  graphIdentity: { graphId: "g", graphVersion: 1 },
  timeoutMs: 1,
  generate: async () => {
    calls += 1;
    return "{\"task\":\"wrong\"}";
  },
});

assert.equal(calls, 1, "repair should be skipped when total planner budget is exhausted");
assert.equal(planned.ok, false);
assert.equal(planned.attempts.some(attempt => attempt.status === "skipped_insufficient_budget"), true);

console.log("graph mutation planner budget tests passed.");
