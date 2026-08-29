import assert from "node:assert/strict";
import {
  buildVisualCoMembershipOverlay,
  PREVIEW_RENDER_BUDGETS,
  selectLineGraphVisualEdges,
} from "../src/visualization/previewRenderBudget.js";
import {
  DuplicateOverlap,
  OneHugeEdge1K,
  OneHugeEdge5K,
  TinyBasic,
} from "./fixtures/v7.3.14/stage0-regression-fixtures.mjs";

const tiny = buildVisualCoMembershipOverlay(TinyBasic);
assert.equal(tiny.complete, true);
assert.equal(tiny.status, "complete");
assert.equal(tiny.usage.totalCandidateRelations, 4);
assert.equal(tiny.edges.length, 4);

const huge = buildVisualCoMembershipOverlay(OneHugeEdge1K());
assert.equal(huge.complete, false);
assert.equal(huge.status, "sampled");
assert.equal(huge.usage.totalCandidateRelations, 499_500);
assert.ok(huge.edges.length <= PREVIEW_RENDER_BUDGETS.maxPerHyperedgeVisualEdges);
assert.ok(huge.edges.length < 499_500);
assert.equal(JSON.stringify(huge), JSON.stringify(buildVisualCoMembershipOverlay(OneHugeEdge1K())), "sampling must be deterministic");

const huge5k = buildVisualCoMembershipOverlay(OneHugeEdge5K());
assert.equal(huge5k.usage.totalCandidateRelations, 12_497_500);
assert.ok(huge5k.edges.length <= PREVIEW_RENDER_BUDGETS.maxPerHyperedgeVisualEdges);

const overlap = buildVisualCoMembershipOverlay(DuplicateOverlap());
assert.equal(overlap.sampled, true);
assert.ok(overlap.edges.length <= PREVIEW_RENDER_BUDGETS.maxHypergraphVisualEdges);
assert.ok(overlap.edges.some(edge => edge.hyperedgeIndex > 0), "bounded sampling must not reserve all visual work for the first hyperedge");

const disjoint = buildVisualCoMembershipOverlay(Array.from({ length: 200 }, (_, hyperedgeIndex) => ({
  id: `h${hyperedgeIndex}`,
  vertices: Array.from({ length: 20 }, (_, vertexIndex) => `h${hyperedgeIndex}-v${vertexIndex}`),
})));
assert.ok(disjoint.edges.some(edge => edge.hyperedgeIndex === 199), "fair-share sampling must preserve the final visible hyperedge");

const exactAnalyticalEdges = Array.from({ length: 5_500 }, (_, index) => ({ src: `v${index}`, dst: `v${index + 1}`, weight: 1 }));
const visual = selectLineGraphVisualEdges(exactAnalyticalEdges);
assert.equal(visual.status, "lod");
assert.equal(visual.complete, false);
assert.equal(visual.analyticalEdgeCount, 5_500);
assert.equal(visual.renderedEdgeCount, PREVIEW_RENDER_BUDGETS.maxDynamicLineEdges);
assert.equal(exactAnalyticalEdges.length, 5_500, "Preview LOD must not truncate the analytical/export result");
assert.match(visual.reason, /computed exactly/i);

const completeLine = selectLineGraphVisualEdges(exactAnalyticalEdges.slice(0, 40));
assert.equal(completeLine.status, "complete");
assert.equal(completeLine.edges.length, 40);

console.log("v7.3.14 Stage 5 visual co-membership and Line Graph render-budget tests passed.");
