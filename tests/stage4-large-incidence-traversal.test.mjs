import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { runBFS } from "../src/algorithms/bfs.js";
import { runConnectedComponents } from "../src/algorithms/connectedComponents.js";
import { runDFS } from "../src/algorithms/dfs.js";
import { DuplicateOverlap, LargeSparse } from "./fixtures/v7.3.14/stage0-regression-fixtures.mjs";

const projectRoot = process.cwd();
const algorithmSource = ["bfs.js", "dfs.js", "connectedComponents.js", "traversal.js"]
  .map(file => readFileSync(join(projectRoot, "src", "algorithms", file), "utf8"))
  .join("\n");
assert.doesNotMatch(algorithmSource, /from\s+["'][^"']*(?:projection|graphModel)[^"']*["']/i);
assert.doesNotMatch(algorithmSource, /\b(?:buildAdjacencyList|buildTwoSectionProjectionSafely|buildTwoSectionProjection|buildV2VBounded)\s*\(/);
assert.match(algorithmSource, /buildIncidenceIndex\(/);

const evidence = {};
for (const size of [1_000, 5_000]) {
  evidence[size] = {};
  for (const algorithm of ["cc", "bfs", "dfs"]) {
    const result = runCase(algorithm, size);
    evidence[size][algorithm] = result;
    assert.equal(result.visitCount, size);
    if (algorithm === "cc") {
      assert.equal(result.count, 1);
      assert.equal(result.largestComponentSize, size);
      assert.equal(result.stepCount, 0);
    } else {
      assert.equal(result.reached, size);
      assert.equal(result.treeEdgeCount, size - 1);
      assert.equal(result.distanceCount, size);
      assert.equal(result.stepCount, size);
      assert.equal(result.maxDistance, algorithm === "bfs" ? 1 : size - 1);
    }
  }
}

const duplicateOverlap = DuplicateOverlap();
assert.equal(runConnectedComponents(duplicateOverlap).components[0].size, 46);
assert.equal(runBFS(duplicateOverlap, "v0").reached, 46);
assert.equal(runDFS(duplicateOverlap, "v0").reached, 46);
const largeSparseComponents = runConnectedComponents(LargeSparse());
assert.equal(largeSparseComponents.count, 1);
assert.equal(largeSparseComponents.components[0].size, 10_001);

assert.equal(evidence[1_000].bfs.frontierTraceReferences, 499_500);
assert.equal(evidence[1_000].dfs.frontierTraceReferences, 499_500);
assert.equal(evidence[5_000].bfs.frontierTraceReferences, 12_497_500);
assert.equal(evidence[5_000].dfs.frontierTraceReferences, 12_497_500);
assert.equal(evidence[5_000].dfs.newlyDiscoveredTraceReferences, 12_497_500);

console.log(`v7.3.14 Stage 4 large incidence traversal passed: ${JSON.stringify(evidence)}.`);

function runCase(algorithm, size) {
  const child = spawnSync(process.execPath, [
    "--max-old-space-size=4096",
    "scripts/run-v7-3-14-stage4-traversal-case.mjs",
    algorithm,
    String(size),
  ], {
    cwd: projectRoot,
    encoding: "utf8",
    maxBuffer: 1_000_000,
  });
  assert.equal(child.status, 0, child.stderr || child.stdout);
  return JSON.parse(child.stdout.trim());
}
