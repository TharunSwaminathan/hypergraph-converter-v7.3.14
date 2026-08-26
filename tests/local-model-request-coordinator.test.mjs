import assert from "node:assert/strict";
import { createLocalModelRequestCoordinator } from "../src/agent/localModelRequestCoordinator.js";

let id = 0;
const coordinator = createLocalModelRequestCoordinator({
  idFactory: () => `req-${++id}`,
  now: () => "2026-07-27T00:00:00.000Z",
});

const firstAbort = new AbortController();
const first = coordinator.begin({ task: "conversation", abortController: firstAbort });
assert.equal(first.ok, true);
assert.equal(first.request.requestId, "req-1");
assert.equal(coordinator.isBusy(), true);
assert.equal(coordinator.getSnapshot().active.task, "conversation");

const second = coordinator.begin({ task: "graph_mutation_planner" });
assert.equal(second.ok, false);
assert.equal(second.reason, "busy");
assert.equal(coordinator.getSnapshot().active.requestId, "req-1");

assert.equal(coordinator.finish("not-owner").ok, false);
assert.equal(coordinator.isBusy(), true);

const abort = coordinator.abortActive("request_aborted");
assert.equal(abort.ok, true);
assert.equal(firstAbort.signal.aborted, true);

const finished = coordinator.finish("req-1", "aborted");
assert.equal(finished.ok, true);
assert.equal(coordinator.isBusy(), false);

const background = coordinator.begin({ task: "summarization", priority: "background" });
assert.equal(background.ok, true);
assert.equal(coordinator.begin({ task: "conversation", priority: "interactive" }).ok, false);
assert.equal(coordinator.finish(background.request.requestId, "skipped").ok, true);

console.log("local model request coordinator tests passed.");
