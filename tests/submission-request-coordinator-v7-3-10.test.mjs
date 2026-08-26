import assert from "node:assert/strict";
import {
  createSubmissionRequestCoordinator,
  deriveSubmissionRuntimeContext,
} from "../src/agent/submissionRequestCoordinator.js";

let id = 0;
const coordinator = createSubmissionRequestCoordinator({ idFactory: () => `request-${++id}` });
const original = coordinator.begin({ kind: "action" });
assert.equal(original.ok, true);
assert.equal(coordinator.count(), 1);

const blocked = coordinator.begin({ kind: "action" });
assert.equal(blocked.ok, false);
assert.equal(blocked.reason, "busy");
assert.equal(coordinator.count(), 1);

const help = coordinator.begin({ kind: "read_only", allowConcurrent: true });
assert.equal(help.ok, true);
assert.equal(coordinator.count(), 2);
assert.equal(coordinator.finish(help.requestId).ok, true);
assert.equal(coordinator.isBusy(), true, "finishing Help must not clear the original action");
assert.equal(coordinator.has(original.requestId), true);

const stop = coordinator.begin({ kind: "runtime_stop", allowConcurrent: true });
assert.equal(stop.ok, true);
assert.equal(coordinator.finish("not-an-owner").reason, "not_owner");
assert.equal(coordinator.count(), 2);
assert.equal(coordinator.finish(stop.requestId).ok, true);
assert.equal(coordinator.isBusy(), true, "finishing Stop must not clear the original action");

assert.equal(coordinator.finish(original.requestId).ok, true);
assert.equal(coordinator.isBusy(), false);
assert.equal(coordinator.count(), 0);

const baseState = { marker: "preserved", localModel: { request: { busy: false } } };
assert.deepEqual(
  deriveSubmissionRuntimeContext(baseState, { coordinatorCount: 1, currentSubmissionCount: 1 }),
  {
    ...baseState,
    activeRequestCount: 0,
    activeCancellableWork: false,
  },
  "the current routing submission must not count as cancellable work",
);

assert.equal(
  deriveSubmissionRuntimeContext(baseState, { coordinatorCount: 2, currentSubmissionCount: 1 }).activeCancellableWork,
  true,
  "another coordinator-owned request is cancellable work",
);
assert.equal(
  deriveSubmissionRuntimeContext(baseState, { coordinatorCount: 2, currentSubmissionCount: 1 }).activeRequestCount,
  1,
);
assert.equal(
  deriveSubmissionRuntimeContext(baseState, { coordinatorCount: 1, currentSubmissionCount: 1, streaming: true }).activeCancellableWork,
  true,
  "an active stream is cancellable work",
);
assert.equal(
  deriveSubmissionRuntimeContext({ localModel: { request: { busy: true } } }, { coordinatorCount: 1 }).activeCancellableWork,
  true,
  "an active local-model request is cancellable work",
);
assert.equal(
  deriveSubmissionRuntimeContext({ localModelRequestActive: true }, { coordinatorCount: 1 }).activeCancellableWork,
  true,
  "the legacy local-model activity flag is still honored",
);

console.log("v7.3.10 submission request coordinator tests passed.");
