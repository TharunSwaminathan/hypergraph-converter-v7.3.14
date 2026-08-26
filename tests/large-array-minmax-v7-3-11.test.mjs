import assert from "node:assert/strict";
import { arrayMin, arrayMax, arrayMinMax } from "../src/utils/numeric.js";
import { runDegreeDistribution } from "../src/algorithms/degreeDistribution.js";

// V7310-D04: Math.min(...arr)/Math.max(...arr) push every array element onto
// the call stack as individual arguments, which throws RangeError well
// before an array is actually "too large" (V8's argument-count limit is in
// the ~65k-125k range depending on engine/build, far below what a large
// hypergraph's degree list can reach). One-pass helpers must handle
// million-element inputs without incident, and given the empty/single-value
// edge cases, produce the same results a correct spread-based call would.

// 1. A large array must not throw and must produce the correct min/max.
const big = new Array(1_000_000);
for (let i = 0; i < big.length; i++) big[i] = i % 997; // bounded value range, still 1e6 elements
assert.doesNotThrow(() => arrayMin(big));
assert.doesNotThrow(() => arrayMax(big));
assert.equal(arrayMin(big), 0);
assert.equal(arrayMax(big), 996);
const [mn, mx] = arrayMinMax(big);
assert.equal(mn, 0);
assert.equal(mx, 996);

// 2. Negative values and zero are preserved correctly (not just truthy checks).
assert.equal(arrayMin([-5, 0, 3]), -5);
assert.equal(arrayMax([-5, 0, 3]), 3);
assert.equal(arrayMin([0]), 0);
assert.equal(arrayMax([0]), 0);

// 3. Empty-array convention matches what Math.min()/Math.max() with no
// arguments already returned (+Infinity / -Infinity) — callers that want a
// different empty convention (0, null) check length themselves, as the
// existing call sites in mappings.js/degreeDistribution.js/datasetProfiler.js do.
assert.equal(arrayMin([]), Infinity);
assert.equal(arrayMax([]), -Infinity);

// 4. A degree distribution over a very large vertex set must not throw and
// must produce correct min/max/mean.
const hyperedges = [];
for (let i = 0; i < 200_000; i++) {
  // Each hyperedge touches two consecutive vertices, so vertex i and i+1
  // both gain one degree — this creates a large, non-trivial degree list
  // without needing an enormous edge count.
  hyperedges.push({ id: `h${i}`, vertices: [i, i + 1] });
}
let result;
assert.doesNotThrow(() => { result = runDegreeDistribution(hyperedges); });
assert.equal(result.min, 1, "endpoint vertices have degree 1");
assert.equal(result.max, 2, "interior vertices have degree 2");
assert.ok(result.totalVertices >= 200_000);

console.log("v7.3.11 large-array min/max safety passed (1,000,000-element array, 200,000-hyperedge degree distribution).");
