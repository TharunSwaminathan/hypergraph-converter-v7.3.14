import assert from "node:assert/strict";
import {
  countTriadsBounded,
  DERIVED_STATUS,
  notRequestedDerived,
} from "../src/utils/mappings.js";
import {
  computedDerived,
  failedDerived,
  invalidInputDerived,
  resourceLimitedDerived,
} from "../src/utils/derivedResults.js";
import { ManySingletons2001 } from "./fixtures/v7.3.14/stage0-regression-fixtures.mjs";

assert.equal(computedDerived("count", 0).status, DERIVED_STATUS.COMPUTED);
assert.equal(computedDerived("count", 0).value, 0);
assert.throws(() => computedDerived("count", null), /computed.*present|present.*computed/i);
assert.throws(() => computedDerived("count", undefined), /computed.*present|present.*computed/i);
assert.throws(() => computedDerived("count", Number.NaN), /computed.*finite|finite.*computed/i);
assert.throws(() => computedDerived("count", Infinity), /computed.*finite|finite.*computed/i);

const limited = resourceLimitedDerived("triads", {
  estimate: { references: 1 },
  limits: { maxNeighborRefs: 0 },
  reason: "test resource limit",
});
assert.equal(limited.status, DERIVED_STATUS.OVER_BUDGET);
assert.equal(limited.value, null);
assert.match(limited.reason, /resource limit/);

const notRequested = notRequestedDerived("triads");
const failed = failedDerived("triads", { reason: "test failure" });
const invalid = invalidInputDerived("triads", { reason: "test invalid input" });
assert.equal(notRequested.status, DERIVED_STATUS.NOT_REQUESTED);
assert.equal(failed.status, DERIVED_STATUS.ERROR);
assert.equal(invalid.status, DERIVED_STATUS.INVALID_INPUT);
assert.notEqual(notRequested.status, failed.status);
assert.notEqual(invalid.status, failed.status);

const boundedTriads = countTriadsBounded(ManySingletons2001());
assert.equal(boundedTriads.status, DERIVED_STATUS.COMPUTED, "Stage 6 work-based policy permits zero-work singleton triads");
assert.equal(boundedTriads.value, 0);
assert.ok(Number.isFinite(boundedTriads.value));

const renderDerivedCount = result => result.status === DERIVED_STATUS.COMPUTED
  ? result.value.toLocaleString()
  : `Not computed — ${result.reason}`;
assert.equal(renderDerivedCount(computedDerived("triads", 0)), "0");
assert.equal(renderDerivedCount(boundedTriads), "0");
assert.match(renderDerivedCount(notRequested), /^Not computed/);
assert.match(renderDerivedCount(failed), /^Not computed/);

console.log("v7.3.14 Stage 1 result-state contract passed.");
