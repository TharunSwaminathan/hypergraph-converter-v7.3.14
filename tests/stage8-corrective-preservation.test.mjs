import test from "node:test";
import assert from "node:assert/strict";
import { runCorrectivePreservationCorpora } from "../scripts/stage8CorrectiveHarness.mjs";
import { compileGraphMutationGrammar } from "../src/agent/deterministicNlu/domains/graphMutationGrammar.js";

test("Stage 8 corrective preserves read-only, positive, and pending corpora", async () => {
  const result = await runCorrectivePreservationCorpora();
  assert.equal(result.existingReadOnly.cases, 9_840);
  assert.equal(result.existingReadOnly.unsafeOutcomes, 0);
  assert.equal(result.independentReadOnly.cases, 6_560);
  assert.equal(result.independentReadOnly.unsafeOutcomes, 0);
  assert.equal(result.positiveAuthorization.cases, 492);
  assert.equal(result.positiveAuthorization.wrongBlocks, 0);
  assert.equal(result.pending.readOnlyCases, 30);
  assert.equal(result.pending.unwantedGraphReplacements, 0);
  assert.equal(result.pending.missedRealCorrections, 0);
});

test("Stage 8 corrective materializes a typed pending graph-field replacement", () => {
  const graph = [
    { id: "h0", vertices: ["Alice", "Bob"] },
    { id: "h1", vertices: ["Bob", "Charlie"] },
  ];
  const pendingAction = {
    actionType: "apply_graph_mutation",
    plan: { operations: [{ type: "ADD_HYPEREDGE", hyperedgeId: "h2", vertices: ["6"] }] },
  };
  const result = compileGraphMutationGrammar("Change the pending vertex from 6 to 7.", {
    nlu: { primaryDomain: "graph_mutation", confidence: { score: 1, reasons: [] } },
    hyperedges: graph,
    graphIdentity: { graphId: "stage8-browser", graphVersion: 1, graphFingerprint: "stage8-browser" },
    pendingAction,
  });
  assert.equal(result.ok, true);
  assert.equal(result.plan.metadata.pendingPlanReplaced, true);
  assert.deepEqual(result.plan.operations, [{ type: "ADD_HYPEREDGE", hyperedgeId: "h2", vertices: ["7"] }]);
});
