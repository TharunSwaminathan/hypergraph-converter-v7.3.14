import assert from "node:assert/strict";
import { chooseDerivedExecutionPolicy, DERIVED_WORKER_THRESHOLDS } from "../src/derived/derivedWorkerClient.js";

const tiny = [{ id: "h0", vertices: ["a", "b"], time: null, weight: 1, attributes: {} }];
assert.equal(chooseDerivedExecutionPolicy("v2v", tiny).useWorker, false);
assert.equal(chooseDerivedExecutionPolicy("h2h", tiny).useWorker, false);
assert.equal(chooseDerivedExecutionPolicy("matrix", tiny).useWorker, false);

const largeProjection = [{ id: "huge", vertices: Array.from({ length: 400 }, (_, index) => `v${index}`) }];
const projectionPolicy = chooseDerivedExecutionPolicy("line_graph", largeProjection);
assert.equal(projectionPolicy.useWorker, true);
assert.ok(projectionPolicy.estimate > DERIVED_WORKER_THRESHOLDS.v2vCandidatePairs);

const denseMatrix = Array.from({ length: 300 }, (_, edgeIndex) => ({
  id: `h${edgeIndex}`,
  vertices: Array.from({ length: 300 }, (_, vertexIndex) => `v${vertexIndex}`),
}));
assert.equal(chooseDerivedExecutionPolicy("matrix", denseMatrix).useWorker, true);

const h2hHeavy = Array.from({ length: 240 }, (_, index) => ({ id: `h${index}`, vertices: ["shared", `v${index}`] }));
assert.equal(chooseDerivedExecutionPolicy("h2h", h2hHeavy).useWorker, true);

console.log("Stage 7 measured worker policy gate passed: tiny operations stay deferred-local; demonstrated heavy operations select workers.");
