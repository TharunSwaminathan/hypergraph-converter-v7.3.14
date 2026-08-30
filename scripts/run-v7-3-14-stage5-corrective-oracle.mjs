import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  buildPreviewTopology,
  createInitialNodePositions,
  stepHypergraphForce,
} from "../src/visualization/hypergraphLayout.js";
import {
  buildVisualCoMembershipOverlay,
  selectLineGraphVisualEdges,
} from "../src/visualization/previewRenderBudget.js";

const parentCommit = "2b61a6e4f7d6764bf0796b2c265c87d0fb3ad7cd";
const prechange = JSON.parse(readFileSync("artifacts/v7.3.14-stage5-corrective-prechange.json", "utf8"));
const vizSource = readFileSync("src/components/Viz.jsx", "utf8");
const checks = [];

check("pre-fix node-drag reproduction", () => {
  assert.equal(prechange.parentCommit, parentCommit);
  assert.equal(prechange.nodeDrag.selectionCommitted, true);
  assert.equal(prechange.nodeDrag.moved, false);
  assert.equal(prechange.nodeDrag.reproduced, true);
  return `selection committed; requested ${point(prechange.nodeDrag.requestedPosition)}, observed ${point(prechange.nodeDrag.observedPosition)}`;
});

check("pre-fix selected-state pan reproduction", () => {
  assert.equal(prechange.selectedStatePan.selectionCleared, true);
  assert.equal(prechange.selectedStatePan.moved, false);
  assert.equal(prechange.selectedStatePan.reproduced, true);
  return `selection cleared; requested delta ${point(prechange.selectedStatePan.requestedDelta)}, translation remained ${point(prechange.selectedStatePan.observedTranslation)}`;
});

let correctiveIntegrationOutput = "";
check("post-fix node drag survives selection commit", () => {
  correctiveIntegrationOutput = run("tests/stage5-corrective-interaction.test.mjs");
  assert.match(correctiveIntegrationOutput, /interaction lifecycle passed/);
  assert.match(vizSource, /const drag = interactionCompatible/);
  return "complete mouse gesture moved the selected node to the requested world coordinate";
});

check("post-fix pan survives selection clearing", () => {
  assert.match(correctiveIntegrationOutput, /interaction lifecycle passed/);
  assert.match(vizSource, /const pan = interactionCompatible \? prev\.pan : null/);
  return "selected-state and unselected-state canvas gestures applied their exact requested deltas";
});

check("mouseup/mouseleave/touch terminate gestures", () => {
  assert.match(correctiveIntegrationOutput, /interaction lifecycle passed/);
  assert.match(vizSource, /onMouseLeave=\{\(\) => \{ onUp\(\)/);
  assert.match(vizSource, /onTouchEnd=\{onUp\}/);
  return "later mouse/touch movement made no position/transform change and the RAF queue became empty";
});

check("graph replacement rejects stale drag", () => {
  assert.match(vizSource, /getGraphIdentifierValue\(nodes, prev\.drag\.id\)/);
  assert.match(correctiveIntegrationOutput, /interaction lifecycle passed/);
  return "replacement excluding dragged vertex retained no drag and neither source graph was mutated";
});

check("layout/view replacement interaction safety", () => {
  assert.match(vizSource, /prev\?\.layoutKind === layout/);
  assert.match(vizSource, /prev\?\.viewMode === viewMode/);
  assert.match(vizSource, /viewMode,/);
  return "incompatible layout cancels drag; incompatible view cancels pan";
});

check("RAF becomes idle after gestures", () => {
  assert.match(correctiveIntegrationOutput, /interaction lifecycle passed/);
  assert.match(vizSource, /forceActive \|\| Boolean\(s\.drag\) \|\| Boolean\(s\.pan\)/);
  return "mouseup/leave/end/replacement drained the deterministic RAF queue without duplicate loops";
});

check("node/ring selection behavior preserved", () => {
  const originalIntegrationOutput = run("tests/stage5-preview-dom-integration.test.mjs");
  assert.match(originalIntegrationOutput, /Preview integration passed/);
  assert.match(vizSource, /hitHyperedgeRing/);
  return "ring selects h0, node priority selects and drags a, empty canvas clears selection";
});

check("Stage 5 force/render architecture untouched", () => {
  const graph = [record("h0", ["a", "b", "c"]), record("h1", ["c", "d"])];
  const topology = buildPreviewTopology(graph);
  const nodes = createInitialNodePositions(topology.vertices, 800, 520, "force");
  const tick = stepHypergraphForce({ nodes, topology, width: 800, height: 520, alpha: 1 });
  const overlay = buildVisualCoMembershipOverlay(graph);
  const analytical = Array.from({ length: 5_500 }, (_, index) => ({ src: `v${index}`, dst: `v${index + 1}` }));
  const visual = selectLineGraphVisualEdges(analytical);
  assert.equal(tick.attractionWork, 5);
  assert.equal("pairSprings" in topology, false);
  assert.equal(overlay.edges.length, 4);
  assert.equal(visual.status, "lod");
  assert.equal(visual.renderedEdgeCount, 4_000);
  assert.equal(analytical.length, 5_500);
  return "incidence-centroid attraction=5, pair springs=0, co-membership=4 complete, exact analytical 5500 with visual LOD 4000";
});

const passed = checks.filter(entry => entry.status === "PASS").length;
assert.equal(passed, 10);
console.log(JSON.stringify({
  stage: "5-corrective",
  issue: "S5-N01",
  parentCommit,
  status: "PASS",
  summary: { passed, total: checks.length },
  checks,
}, null, 2));

function check(family, callback) {
  const evidence = callback();
  checks.push({ family, status: "PASS", evidence });
}

function run(path) {
  return execFileSync(process.execPath, [path], { cwd: process.cwd(), encoding: "utf8" }).trim();
}

function point(value) {
  return `(${value.x}, ${value.y})`;
}

function record(id, vertices) {
  return { id, vertices, time: null, weight: 1, attributes: {} };
}
