import assert from "node:assert/strict";
import { createDerivedProductCache } from "../src/derived/derivedProductCache.js";
import { createDerivedRequestCoordinator } from "../src/derived/derivedRequestCoordinator.js";

const graphA = Object.freeze({ name: "Graph A" });
const graphB = Object.freeze({ name: "Graph B" });
const aValue = computedV2V("A_ONLY_1", "A_ONLY_2");
const bValue = computedV2V("B_ONLY_1", "B_ONLY_2");

await staleRequestCannotPoisonNewContext();
validCurrentWriteIsAccepted();
sameVersionDifferentIdentityIsRejected();
sameIdentityDifferentVersionIsRejected();
incompleteValuesAreRejected();
allAsyncOperationKeysShareTheContract();
graphBAfterStaleAComputesNormally();

console.log("Stage 7 corrective cache-context contract passed (S7-N01 A-G)." );

async function staleRequestCannotPoisonNewContext() {
  const cache = createDerivedProductCache();
  const coordinator = createDerivedRequestCoordinator();
  const work = deferredExecution();
  cache.activateGraph(41, graphA);
  const request = coordinator.request({
    channel: "v2v",
    graphVersion: 41,
    graphIdentity: graphA,
    operationType: "v2v",
    options: {},
    execute: work.execute,
  });

  // Reproduce App render selecting B before the old passive effect advances
  // its coordinator. The coordinator still considers A current here.
  cache.activateGraph(42, graphB);
  work.resolve(aValue);
  const outcome = await request.promise;
  assert.equal(outcome.status, "completed");
  const accepted = contextBoundWrite(cache, outcome.metadata.graphVersion, graphA, "v2v", {}, outcome.value);

  assert.equal(accepted, false, "late A completion must be rejected at the cache boundary");
  assert.equal(cache.activateGraph(42, graphB), false, "B is already the ambient cache context");
  assert.equal(cache.peek("v2v", {}), undefined, "B lookup must not observe A");
  assert.equal(cache.getSnapshot().contextRejectedWrites, 1);
}

function validCurrentWriteIsAccepted() {
  const cache = createDerivedProductCache();
  cache.activateGraph(42, graphB);
  assert.equal(contextBoundWrite(cache, 42, graphB, "v2v", {}, bValue), true);
  assert.strictEqual(cache.peek("v2v", {}), bValue);
}

function sameVersionDifferentIdentityIsRejected() {
  const cache = createDerivedProductCache();
  const previewA = {};
  const previewB = {};
  cache.activateGraph(55, previewA);
  cache.activateGraph(55, previewB);
  assert.equal(contextBoundWrite(cache, 55, previewA, "matrix", {}, computedMatrix("A_ONLY_MATRIX")), false);
  assert.equal(cache.peek("matrix", {}), undefined);
}

function sameIdentityDifferentVersionIsRejected() {
  const cache = createDerivedProductCache();
  const graph = {};
  cache.activateGraph(70, graph);
  cache.activateGraph(71, graph);
  assert.equal(contextBoundWrite(cache, 70, graph, "h2h", {}, computedH2H("A_ONLY_H")), false);
  assert.equal(cache.peek("h2h", {}), undefined);
}

function incompleteValuesAreRejected() {
  const cache = createDerivedProductCache();
  cache.activateGraph(80, graphB);
  for (const status of ["cancelled", "error", "over_budget", "computing", "not_requested"]) {
    assert.equal(contextBoundWrite(cache, 80, graphB, `status:${status}`, {}, { status, value: null }), false, status);
  }
  assert.equal(cache.getSnapshot().entryCount, 0);
  assert.equal(cache.getSnapshot().refusedWrites, 5);
}

function allAsyncOperationKeysShareTheContract() {
  const values = {
    h2h: computedH2H("A_ONLY_H"),
    v2v: aValue,
    matrix: computedMatrix("A_ONLY_MATRIX"),
    line_graph: aValue,
  };
  for (const [operationType, value] of Object.entries(values)) {
    const cache = createDerivedProductCache();
    cache.activateGraph(90, graphA);
    cache.activateGraph(91, graphB);
    assert.equal(contextBoundWrite(cache, 90, graphA, operationType, {}, value), false, operationType);
    assert.equal(cache.peek(operationType, {}), undefined, operationType);
  }
}

function graphBAfterStaleAComputesNormally() {
  const cache = createDerivedProductCache();
  cache.activateGraph(100, graphA);
  cache.activateGraph(101, graphB);
  assert.equal(contextBoundWrite(cache, 100, graphA, "v2v", {}, aValue), false);
  assert.equal(contextBoundWrite(cache, 101, graphB, "v2v", {}, bValue), true);
  assert.strictEqual(cache.peek("v2v", {}), bValue);
  assert.doesNotMatch(JSON.stringify(cache.peek("v2v", {})), /A_ONLY/);
}

function contextBoundWrite(cache, graphVersion, graphIdentity, operationType, options, value) {
  // This fallback intentionally exercises the vulnerable pre-fix API. The
  // same permanent test switches to the context-bound API after correction.
  return typeof cache.setCompleteForGraph === "function"
    ? cache.setCompleteForGraph(graphVersion, graphIdentity, operationType, options, value)
    : cache.setComplete(operationType, options, value);
}

function deferredExecution() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { execute: () => ({ promise, cancel() {} }), resolve };
}

function computedV2V(src, dst) {
  return Object.freeze({ status: "computed", edges: Object.freeze([{ src, dst, hyperedges: ["h"], weight: 1 }]) });
}

function computedMatrix(text) {
  return Object.freeze({ status: "computed", text, value: text });
}

function computedH2H(id) {
  return Object.freeze({ status: "computed", value: Object.freeze([{ hid: id, neighbors: [], sharedVertices: [] }]) });
}
