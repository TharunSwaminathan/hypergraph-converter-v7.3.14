import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { buildIncidenceIndex, getIncidentHyperedgeIds, hasHyperedge, hasVertex } from "../src/graph/incidenceIndex.js";
import { createGraphHistoryEvent } from "../src/graph/graphHistory.js";
import { createGraphIdentity, nextCommittedGraphIdentity } from "../src/graph/graphIdentity.js";
import { applyGraphMutationPlan } from "../src/graph/graphMutationEngine.js";
import { createMutationPlan } from "../src/graph/graphMutationValidator.js";
import { normalizeHyperedges } from "../src/utils/parsers.js";
import {
  DuplicateOverlap,
  LargeSparse,
  OneHugeEdge1K,
  OneHugeEdge5K,
  TinyBasic,
} from "./fixtures/v7.3.14/stage0-regression-fixtures.mjs";

const canonical = graph => normalizeHyperedges(graph, { identifierMode: "structured" }).hyperedges;

function structuralMeasurement(name, graph) {
  const start = performance.now();
  const index = buildIncidenceIndex(graph);
  const elapsedMs = performance.now() - start;
  const vertexIncidenceEntries = [...index.vertexToHyperedges.values()].reduce((sum, ids) => sum + ids.size, 0);
  const hyperedgeIncidenceEntries = [...index.hyperedgeToVertices.values()].reduce((sum, ids) => sum + ids.size, 0);
  assert.equal(vertexIncidenceEntries, index.counts.incidences, `${name} vertex incidence count`);
  assert.equal(hyperedgeIncidenceEntries, index.counts.incidences, `${name} hyperedge incidence count`);
  assert.ok(elapsedMs < 5_000, `${name} should avoid catastrophic index construction; measured ${elapsedMs}ms`);
  return {
    name,
    elapsedMs,
    ...index.counts,
    mapEntries: index.hyperedgesById.size + index.vertexToHyperedges.size + index.hyperedgeToVertices.size,
    setEntries: vertexIncidenceEntries + hyperedgeIncidenceEntries,
  };
}

const measurements = [
  structuralMeasurement("TinyBasic", canonical(TinyBasic)),
  structuralMeasurement("LargeSparse", canonical(LargeSparse())),
  structuralMeasurement("OneHugeEdge1K", canonical(OneHugeEdge1K())),
  structuralMeasurement("OneHugeEdge5K", canonical(OneHugeEdge5K())),
  structuralMeasurement("DuplicateOverlap", canonical(DuplicateOverlap())),
];
const byName = new Map(measurements.map(item => [item.name, item]));
assert.deepEqual(
  { hyperedges: byName.get("OneHugeEdge5K").hyperedges, vertices: byName.get("OneHugeEdge5K").vertices, incidences: byName.get("OneHugeEdge5K").incidences },
  { hyperedges: 1, vertices: 5_000, incidences: 5_000 },
);
assert.equal(byName.get("OneHugeEdge5K").setEntries, 10_000);
assert.ok(byName.get("OneHugeEdge5K").setEntries < 12_497_500, "5K edge remains incidence-sized, not clique-sized");
assert.deepEqual(
  { hyperedges: byName.get("DuplicateOverlap").hyperedges, vertices: byName.get("DuplicateOverlap").vertices, incidences: byName.get("DuplicateOverlap").incidences },
  { hyperedges: 200, vertices: 46, incidences: 9_200 },
);
assert.equal(byName.get("DuplicateOverlap").setEntries, 18_400);
assert.ok(byName.get("DuplicateOverlap").setEntries < 207_000, "duplicate overlap does not construct candidate pairs");

const indexSource = await readFile(new URL("../src/graph/incidenceIndex.js", import.meta.url), "utf8");
assert.doesNotMatch(indexSource, /from\s+["'][^"']*(?:projection|mappings|graphModel)[^"']*["']/i);
assert.doesNotMatch(indexSource, /\b(?:buildV2V|buildV2VBounded|buildTwoSectionProjectionSafely|buildH2H)\s*\(/);

function transition(state, identity, operation, history = []) {
  const plan = createMutationPlan({ graphIdentity: identity, operations: [operation], summary: operation.type });
  const result = applyGraphMutationPlan(state, plan, identity, history);
  assert.equal(result.ok, true, `${operation.type}: ${(result.errors ?? []).join(" ")}`);
  const nextIdentity = nextCommittedGraphIdentity(identity, result.hyperedges);
  return { state: result.hyperedges, identity: nextIdentity, plan, result };
}

let state = canonical(TinyBasic);
let identity = createGraphIdentity(state, null, { replace: true });
let index = buildIncidenceIndex(state);
assert.equal(hasHyperedge(index, "h0"), true);
assert.equal(identity.graphVersion, 1);

({ state, identity } = transition(state, identity, { type: "ADD_HYPEREDGE", hyperedgeId: "h2", vertices: ["e"], weight: 0 }));
index = buildIncidenceIndex(state);
assert.deepEqual(getIncidentHyperedgeIds(index, "e"), ["h2"]);

({ state, identity } = transition(state, identity, { type: "REMOVE_HYPEREDGE", hyperedgeId: "h1" }));
index = buildIncidenceIndex(state);
assert.equal(hasHyperedge(index, "h1"), false);
assert.equal(hasVertex(index, "d"), false);

({ state, identity } = transition(state, identity, { type: "ADD_INCIDENCE", hyperedgeId: "h0", vertexId: "e" }));
index = buildIncidenceIndex(state);
assert.deepEqual(getIncidentHyperedgeIds(index, "e"), ["h0", "h2"]);

({ state, identity } = transition(state, identity, { type: "REMOVE_INCIDENCE", hyperedgeId: "h0", vertexId: "a", emptyHyperedgePolicy: "keep_empty" }));
index = buildIncidenceIndex(state);
assert.equal(hasVertex(index, "a"), false);

({ state, identity } = transition(state, identity, { type: "RENAME_HYPEREDGE", hyperedgeId: "h0", newHyperedgeId: "renamed-edge" }));
index = buildIncidenceIndex(state);
assert.equal(hasHyperedge(index, "h0"), false);
assert.equal(hasHyperedge(index, "renamed-edge"), true);

({ state, identity } = transition(state, identity, { type: "RENAME_VERTEX", vertexId: "e", newVertexId: "renamed-vertex" }));
index = buildIncidenceIndex(state);
assert.equal(hasVertex(index, "e"), false);
assert.deepEqual(getIncidentHyperedgeIds(index, "renamed-vertex"), ["h2", "renamed-edge"]);

const beforeReplacementIdentity = identity;
state = [{ id: "replacement", vertices: ["fresh"], time: null, weight: 1, attributes: {} }];
identity = nextCommittedGraphIdentity(identity, state, { replacement: true });
index = buildIncidenceIndex(state);
assert.equal(identity.graphId === beforeReplacementIdentity.graphId, false);
assert.deepEqual(index.vertices, ["fresh"]);
assert.equal(hasVertex(index, "renamed-vertex"), false);

const beforeClearState = state;
const beforeClearIdentity = identity;
const clearTransition = transition(state, identity, { type: "CLEAR_GRAPH" });
state = clearTransition.state;
identity = clearTransition.identity;
index = buildIncidenceIndex(state);
assert.deepEqual(index.counts, { hyperedges: 0, vertices: 0, incidences: 0 });
const clearHistory = [createGraphHistoryEvent({
  graphIdentity: identity,
  beforeHyperedges: beforeClearState,
  afterHyperedges: state,
  plan: clearTransition.plan,
  preview: clearTransition.result,
  source: "test",
})];
({ state, identity } = transition(state, identity, { type: "UNDO_LAST_MUTATION" }, clearHistory));
index = buildIncidenceIndex(state);
assert.deepEqual(index.vertices, ["fresh"]);
assert.equal(hasHyperedge(index, "replacement"), true);
assert.ok(identity.graphVersion > beforeClearIdentity.graphVersion);

console.log("v7.3.14 Stage 3 incidence scaling/rebuild passed: " + JSON.stringify(measurements));
