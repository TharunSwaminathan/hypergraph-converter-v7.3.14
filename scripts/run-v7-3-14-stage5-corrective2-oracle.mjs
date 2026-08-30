import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildPreviewTopology,
  createInitialNodePositions,
  stepHypergraphForce,
} from "../src/visualization/hypergraphLayout.js";
import {
  buildVisualCoMembershipOverlay,
  selectLineGraphVisualEdges,
} from "../src/visualization/previewRenderBudget.js";

const parentCommit = "d688b065dd284207b679a432d0f18147f2acce8d";
const outputPath = resolve("artifacts/v7.3.14-stage5-corrective2-oracle.json");
const prechange = JSON.parse(readFileSync("artifacts/v7.3.14-stage5-corrective2-prechange.json", "utf8"));
const vizSource = readFileSync("src/components/Viz.jsx", "utf8");
const testSource = readFileSync("tests/stage5-corrective2-gesture-termination.test.mjs", "utf8");
const checks = [];

check("pre-fix stale pan reproduction", () => {
  assert.equal(prechange.parentCommit, parentCommit);
  assert.equal(prechange.stalePan.reproduced, true);
  assert.equal(prechange.stalePan.postReleaseMovement, 50);
  return `buttons-zero movement changed translation by ${prechange.stalePan.postReleaseMovement}px`;
});

check("pre-fix stale drag reproduction", () => {
  assert.equal(prechange.staleDrag.selectionCommitted, true);
  assert.equal(prechange.staleDrag.reproduced, true);
  assert.ok(prechange.staleDrag.postReleaseMovement > 72);
  return `buttons-zero movement changed node position by ${prechange.staleDrag.postReleaseMovement}px`;
});

const correctiveOutput = run("tests/stage5-corrective2-gesture-termination.test.mjs");
check("buttons-zero pan self-heal", () => {
  assert.match(correctiveOutput, /fail-closed gesture termination passed/);
  assert.match(vizSource, /isMouseMove && e\.buttons === 0 && \(s\.drag \|\| s\.pan\)/);
  assert.match(testSource, /buttons-zero movement must not continue stale pan/);
  return "buttons-zero mousemove cleared stale pan before transform mutation";
});

check("buttons-zero drag self-heal", () => {
  assert.match(testSource, /buttons-zero movement must not continue stale drag/);
  return "buttons-zero mousemove cleared stale drag before node mutation";
});

check("global mouseup termination", () => {
  assert.match(vizSource, /window\.addEventListener\("mouseup", onUp\)/);
  assert.match(testSource, /window mouseup must terminate pan/);
  assert.match(testSource, /window mouseup must terminate drag/);
  return "one stable window mouseup listener terminates either transient gesture";
});

check("window blur termination", () => {
  assert.match(vizSource, /window\.addEventListener\("blur", onUp\)/);
  assert.match(testSource, /window blur must terminate pan/);
  assert.match(testSource, /window blur must terminate drag/);
  return "window focus loss clears drag/pan without resetting world state";
});

check("mouseleave preservation", () => {
  assert.match(vizSource, /onMouseLeave=\{\(\) => \{ onUp\(\)/);
  assert.match(testSource, /canvas mouseleave must still terminate pan/);
  return "canvas-local mouseleave remains a direct termination path";
});

check("touchend and touchcancel termination", () => {
  assert.match(vizSource, /onTouchEnd=\{onUp\}/);
  assert.match(vizSource, /onTouchCancel=\{onUp\}/);
  assert.match(testSource, /touchend must terminate pan/);
  assert.match(testSource, /touchcancel must terminate pan/);
  return "touch termination remains independent of MouseEvent.buttons";
});

check("RAF idle after termination", () => {
  assert.match(testSource, /all static termination paths must finish at RAF idle/);
  assert.match(vizSource, /forceActive \|\| Boolean\(s\.drag\) \|\| Boolean\(s\.pan\)/);
  return "each static termination path drains the deterministic RAF queue";
});

const s5n01Output = run("tests/stage5-corrective-interaction.test.mjs");
check("S5-N01 rerender-survival preserved", () => {
  assert.match(s5n01Output, /interaction lifecycle passed/);
  assert.match(vizSource, /const drag = interactionCompatible/);
  assert.match(vizSource, /const pan = interactionCompatible \? prev\.pan : null/);
  return "compatible drag/pan carry-forward and replacement cancellation remain green";
});

const domOutput = run("tests/stage5-preview-dom-integration.test.mjs");
check("selection and ring behavior preserved", () => {
  assert.match(domOutput, /Preview integration passed/);
  assert.match(testSource, /ring selection remains wired/);
  assert.match(testSource, /node hit remains higher priority than ring hit/);
  return "ring selection, node priority, and empty-canvas selection clearing remain green";
});

check("Force/render/LOD architecture unchanged", () => {
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
  return "incidence Force topology, bounded visual overlay, exact analytical projection, and 4,000-edge LOD remain unchanged";
});

const passed = checks.filter(entry => entry.status === "PASS").length;
assert.equal(passed, 12);
const result = {
  stage: "5-corrective2",
  issue: "S5-N02",
  parentCommit,
  status: "PASS",
  summary: { passed, total: checks.length },
  checks,
};
writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));

function check(family, callback) {
  const evidence = callback();
  checks.push({ family, status: "PASS", evidence });
}

function run(path) {
  return execFileSync(process.execPath, [path], { cwd: process.cwd(), encoding: "utf8" }).trim();
}

function record(id, vertices) {
  return { id, vertices, time: null, weight: 1, attributes: {} };
}
