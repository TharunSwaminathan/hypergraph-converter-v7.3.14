import assert from "node:assert/strict";
import { estimateProjectionPairCount, buildTwoSectionProjectionSafely, buildTwoSectionProjectionSample, PROJECTION_BUDGETS } from "../src/algorithms/projection.js";
import { computeStats, buildV2V, buildV2VBounded, buildH2H } from "../src/utils/mappings.js";

// V7310-D03: a hyperedge of size k contributes up to k*(k-1)/2 candidate V2V
// pairs. Building the full projection without a budget check can hang the
// tab or exhaust memory long before the *input itself* looks unreasonably
// large. These budgets turn that into a clear, bounded refusal.

// 1. estimateProjectionPairCount is O(H) and overflow-safe — must not throw
// or hang even for an absurdly large declared hyperedge.
{
  const { estimatedPairs, overBudget } = estimateProjectionPairCount([{ id: "h0", vertices: { length: 10_000_000 } }]);
  assert.equal(overBudget, true);
  assert.ok(Number.isFinite(estimatedPairs));
}

// 2. computeStats() must return near-instantly (not build the full
// projection) for a single hyperedge whose exact pair count (499,500 for
// 1,000 vertices) is well past the "runs on every graph load regardless of
// active tab" eager budget — this is the exact repro from the spec.
{
  const oneBigHyperedge = [{ id: "h0", vertices: Array.from({ length: 1000 }, (_, i) => `v${i}`) }];
  const start = performance.now();
  const stats = computeStats(oneBigHyperedge);
  const elapsedMs = performance.now() - start;
  assert.ok(elapsedMs < 200, `computeStats on a 1,000-vertex hyperedge must stay fast on every load; took ${elapsedMs}ms`);
  assert.equal(stats.v2vProjectionDensity, null, "over the eager budget must refuse (null), not silently compute");
  // Non-projection stats must still be exact and unaffected by the refusal.
  assert.equal(stats.E, 1);
  assert.equal(stats.V, 1000);
}

// 3. A hyperedge past the larger "explicit view" budget must be refused by
// buildV2V/buildV2VBounded too, not just the eager stats path — and must
// return quickly rather than attempting to build first.
{
  const huge = [{ id: "h0", vertices: Array.from({ length: 3000 }, (_, i) => `v${i}`) }]; // 4,498,500 pairs
  const start = performance.now();
  const bounded = buildV2VBounded(huge);
  const elapsedMs = performance.now() - start;
  assert.ok(elapsedMs < 200, `buildV2VBounded must refuse quickly rather than build; took ${elapsedMs}ms`);
  assert.equal(bounded.ok, false);
  assert.equal(bounded.estimatedPairs, 4_498_500);
  assert.deepEqual(buildV2V(huge), [], "the legacy array-returning buildV2V must return empty rather than throw/hang when over budget");
}

// 4. A moderate hyperedge within the larger explicit-view budget (e.g. what
// the Mappings tab uses) must still compute the exact, correct projection —
// budgets must not silently corrupt in-budget output.
{
  const moderate = [{ id: "h0", vertices: ["A", "B", "C"] }]; // 3 pairs
  const result = buildTwoSectionProjectionSafely(moderate);
  assert.equal(result.ok, true);
  assert.equal(result.projection.edges.length, 3);
}

// 5. A bounded sample is explicitly labeled as a sample and never silently
// presented as the complete projection.
{
  const many = Array.from({ length: 10 }, (_, i) => ({ id: `h${i}`, vertices: [`v${i}`, `v${i + 1}`] }));
  const sample = buildTwoSectionProjectionSample(many, { sampleSize: 3 });
  assert.equal(sample.isSample, true);
  assert.equal(sample.sampledHyperedgeCount, 3);
  assert.equal(sample.totalHyperedgeCount, 10);
}

// 6. buildH2H must stay roughly linear (no accidental O(H^2) neighbor
// lookup) — a moderately large graph must resolve well under a second.
{
  const chain = [];
  for (let i = 0; i < 5000; i++) chain.push({ id: `h${i}`, vertices: [`v${i}`, `v${i + 1}`] });
  const start = performance.now();
  const h2h = buildH2H(chain);
  const elapsedMs = performance.now() - start;
  assert.ok(elapsedMs < 2000, `buildH2H on a 5,000-hyperedge chain must stay well under a second; took ${elapsedMs}ms`);
  assert.equal(h2h.length, 5000);
}

assert.ok(PROJECTION_BUDGETS.maxEstimatedPairs > 0);

console.log("v7.3.11 projection budget/lazy-materialization safety passed.");
