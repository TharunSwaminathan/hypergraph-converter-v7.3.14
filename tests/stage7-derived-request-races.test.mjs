import assert from "node:assert/strict";
import { createDerivedRequestCoordinator } from "../src/derived/derivedRequestCoordinator.js";

const rejectionEvents = [];
const onUnhandled = reason => rejectionEvents.push(reason);
process.on("unhandledRejection", onUnhandled);

try {
  await graphReplacementRace();
  await graphEditRace();
  await switchAwayRace();
  await rapidSwitchRace();
  await statsGraphChangeRace();
  await exportCancellationRace();
  await outOfOrderRace();
  await workerFailureRace();
  await unmountRace();
  await flush();
  assert.deepEqual(rejectionEvents, []);
  console.log("Stage 7 derived request race/cancellation/stale-result gates passed (9 deterministic scenarios).");
} finally {
  process.off("unhandledRejection", onUnhandled);
}

async function graphReplacementRace() {
  const coordinator = createDerivedRequestCoordinator();
  const old = deferredExecution();
  const request = coordinator.request(spec("projection", 1, {}, old.execute));
  coordinator.activateGraph(2, {});
  assert.equal((await request.promise).status, "cancelled");
  old.resolve({ status: "computed", edges: ["stale"] });
  await flush();
  assert.equal(coordinator.getSnapshot().active.length, 0);
  assert.ok(coordinator.getSnapshot().staleRejected >= 1);
}

async function graphEditRace() {
  const coordinator = createDerivedRequestCoordinator();
  const work = deferredExecution();
  const identity = {};
  const request = coordinator.request(spec("projection", 3, identity, work.execute));
  coordinator.activateGraph(3, {});
  assert.equal((await request.promise).reason, "graph_changed");
  work.resolve({ status: "computed", edges: ["old-edit"] });
  await flush();
  assert.ok(coordinator.getSnapshot().staleRejected >= 1);
}

async function switchAwayRace() {
  const coordinator = createDerivedRequestCoordinator();
  const work = deferredExecution();
  const request = coordinator.request(spec("line_graph", 4, {}, work.execute));
  assert.equal(coordinator.cancel("line_graph", "view_switched"), true);
  assert.equal((await request.promise).status, "cancelled");
  work.resolve({ status: "computed", edges: ["late"] });
  await flush();
  assert.equal(coordinator.getSnapshot().active.length, 0);
}

async function rapidSwitchRace() {
  const coordinator = createDerivedRequestCoordinator();
  const graph = {};
  const works = Array.from({ length: 4 }, deferredExecution);
  const requests = works.map(work => coordinator.request(spec("line_graph", 5, graph, work.execute)));
  works.slice(0, -1).forEach(work => work.resolve({ status: "computed", edges: ["stale"] }));
  works.at(-1).resolve({ status: "computed", edges: ["current"] });
  const outcomes = await Promise.all(requests.map(request => request.promise));
  assert.deepEqual(outcomes.map(outcome => outcome.status), ["cancelled", "cancelled", "cancelled", "completed"]);
  assert.deepEqual(outcomes.at(-1).value.edges, ["current"]);
}

async function statsGraphChangeRace() {
  const coordinator = createDerivedRequestCoordinator();
  const work = deferredExecution();
  const request = coordinator.request(spec("stats", 6, {}, work.execute));
  coordinator.activateGraph(7, {});
  work.resolve({ status: "computed", value: { vertices: 99 } });
  assert.equal((await request.promise).status, "cancelled");
}

async function exportCancellationRace() {
  const coordinator = createDerivedRequestCoordinator();
  const work = deferredExecution();
  const request = coordinator.request(spec("export", 8, {}, work.execute));
  request.cancel("user_cancelled_export");
  const outcome = await request.promise;
  assert.equal(outcome.status, "cancelled");
  assert.equal(outcome.value, null);
  assert.equal(work.cancelCount(), 1);
}

async function outOfOrderRace() {
  const coordinator = createDerivedRequestCoordinator();
  const graph = {};
  const first = deferredExecution();
  const second = deferredExecution();
  const requestA = coordinator.request(spec("projection", 9, graph, first.execute));
  const requestB = coordinator.request(spec("projection", 9, graph, second.execute));
  second.resolve({ status: "computed", edges: ["B"] });
  first.resolve({ status: "computed", edges: ["A"] });
  assert.equal((await requestA.promise).status, "cancelled");
  assert.deepEqual((await requestB.promise).value.edges, ["B"]);
  await flush();
  assert.ok(coordinator.getSnapshot().staleRejected >= 1);
}

async function workerFailureRace() {
  const coordinator = createDerivedRequestCoordinator();
  const request = coordinator.request(spec("matrix", 10, {}, () => Promise.reject(new Error("worker terminated"))));
  const outcome = await request.promise;
  assert.equal(outcome.status, "failed");
  assert.equal(outcome.error.name, "Error");
  assert.match(outcome.reason, /worker terminated/);
  assert.equal(coordinator.getSnapshot().active.length, 0);
}

async function unmountRace() {
  const coordinator = createDerivedRequestCoordinator();
  const work = deferredExecution();
  const request = coordinator.request(spec("h2h", 11, {}, work.execute));
  request.cancel("component_cleanup");
  work.resolve({ status: "computed", value: ["late"] });
  assert.equal((await request.promise).reason, "component_cleanup");
  await flush();
  assert.equal(coordinator.getSnapshot().active.length, 0);
}

function spec(operationType, graphVersion, graphIdentity, execute) {
  return { channel: operationType, graphVersion, graphIdentity, operationType, options: {}, execute };
}

function deferredExecution() {
  let resolve;
  let reject;
  let cancelled = 0;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return {
    execute: () => ({ promise, cancel() { cancelled += 1; } }),
    resolve,
    reject,
    cancelCount: () => cancelled,
  };
}

function flush() { return new Promise(resolve => setTimeout(resolve, 0)); }
