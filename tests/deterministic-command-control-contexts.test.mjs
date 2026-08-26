import assert from "node:assert/strict";
import { COMMAND_CATALOG } from "../src/agent/deterministicNlu/commandCatalog.js";
import { CONFIRMATION, REQUIRED_CONTEXT, SIDE_EFFECT } from "../src/agent/deterministicNlu/commandCatalogSchema.js";

const byId = new Map(COMMAND_CATALOG.map(entry => [entry.id, entry]));

const expectations = [
  ["pending.confirm", REQUIRED_CONTEXT.COMPATIBLE_PENDING_CONFIRMATION, SIDE_EFFECT.CONFIRMATION_CONTROL, CONFIRMATION.PENDING_CONTROL],
  ["pending.cancel", REQUIRED_CONTEXT.PENDING_ACTION, SIDE_EFFECT.CONFIRMATION_CONTROL, CONFIRMATION.PENDING_CONTROL],
  ["runtime.stop", REQUIRED_CONTEXT.ACTIVE_CANCELLABLE_WORK, SIDE_EFFECT.RUNTIME_CONTROL, CONFIRMATION.RUNTIME_CONTROL],
  ["parser.apply-result", REQUIRED_CONTEXT.PARSER_RESULT_READY, SIDE_EFFECT.GRAPH_APPLY_CONFIRMATION, CONFIRMATION.APPLY_CONFIRMATION],
  ["graph.undo-last-mutation", REQUIRED_CONTEXT.REVERSIBLE_COMMITTED_HISTORY, SIDE_EFFECT.GRAPH_EDIT_PREVIEW, CONFIRMATION.PREVIEW_CONFIRMATION],
  ["correction.replace-interpretation", REQUIRED_CONTEXT.MATCHING_PENDING_OR_RECENT_INTERPRETATION, SIDE_EFFECT.CONFIRMATION_CONTROL, CONFIRMATION.DEPENDS_ON_REPLACEMENT],
];

for (const [id, context, sideEffect, confirmation] of expectations) {
  const entry = byId.get(id);
  assert.ok(entry, `missing ${id}`);
  assert.ok(entry.requiredContext.includes(context), `${id} required context`);
  assert.equal(entry.sideEffect, sideEffect, `${id} side effect`);
  assert.equal(entry.confirmation, confirmation, `${id} confirmation`);
}

assert.notEqual(byId.get("pending.confirm")?.requiredContext[0], REQUIRED_CONTEXT.PENDING_ACTION, "confirm needs compatible confirmation, not any pending action");
assert.notEqual(byId.get("runtime.stop")?.requiredContext[0], REQUIRED_CONTEXT.ACTIVE_MODEL_WORK, "runtime stop needs active cancellable work");

console.log("deterministic command control context tests passed.");
