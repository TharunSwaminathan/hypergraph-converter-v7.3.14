import assert from "node:assert/strict";
import { COMMAND_CATALOG } from "../src/agent/deterministicNlu/commandCatalog.js";
import { CONFIRMATION, REQUIRED_CONTEXT, SIDE_EFFECT } from "../src/agent/deterministicNlu/commandCatalogSchema.js";
import { GRAPH_MUTATION_OPS } from "../src/graph/graphMutationSchema.js";

const byId = new Map(COMMAND_CATALOG.map(entry => [entry.id, entry]));
const expected = [
  ["correction.replace-interpretation", "correction", SIDE_EFFECT.CONFIRMATION_CONTROL, CONFIRMATION.DEPENDS_ON_REPLACEMENT, REQUIRED_CONTEXT.MATCHING_PENDING_OR_RECENT_INTERPRETATION],
  ["runtime.stop", "runtime_stop", SIDE_EFFECT.RUNTIME_CONTROL, CONFIRMATION.RUNTIME_CONTROL, REQUIRED_CONTEXT.ACTIVE_CANCELLABLE_WORK],
  ["pending.cancel", "pending_cancel", SIDE_EFFECT.CONFIRMATION_CONTROL, CONFIRMATION.PENDING_CONTROL, REQUIRED_CONTEXT.PENDING_ACTION],
  ["pending.confirm", "pending_confirm", SIDE_EFFECT.CONFIRMATION_CONTROL, CONFIRMATION.PENDING_CONTROL, REQUIRED_CONTEXT.COMPATIBLE_PENDING_CONFIRMATION],
];

for (const [id, intent, sideEffect, confirmation, requiredContext] of expected) {
  const entry = byId.get(id);
  assert.ok(entry, `missing ${id}`);
  assert.equal(entry.intent, intent, id);
  assert.equal(entry.sideEffect, sideEffect, id);
  assert.equal(entry.confirmation, confirmation, id);
  assert.ok(entry.requiredContext.includes(requiredContext), `${id} context`);
}

const parserApply = byId.get("parser.apply-result");
assert.ok(parserApply, "parser.apply-result must remain a separate entry");
assert.ok(parserApply.operationTypes.includes("APPLY_CUSTOM_PARSER_RESULT_CONFIRMATION"));
assert.ok(parserApply.requiredContext.includes(REQUIRED_CONTEXT.PARSER_RESULT_READY), "parser apply needs parser-result-ready context");

const graphUndo = byId.get("graph.undo-last-mutation");
assert.ok(graphUndo, "graph.undo-last-mutation must remain a separate entry");
assert.ok(graphUndo.operationTypes.includes(GRAPH_MUTATION_OPS.UNDO_LAST_MUTATION));
assert.ok(graphUndo.requiredContext.includes(REQUIRED_CONTEXT.REVERSIBLE_COMMITTED_HISTORY), "undo needs reversible committed history");

assert.notEqual(byId.get("pending.cancel")?.id, byId.get("pending.confirm")?.id);
assert.notEqual(byId.get("runtime.stop")?.id, byId.get("correction.replace-interpretation")?.id);

console.log("deterministic command catalog control entry tests passed.");
