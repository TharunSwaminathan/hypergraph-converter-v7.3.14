import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { GRAPH_TYPES } from "../src/candy/contracts/graphTypes.js";
import { motifStatisticsAvailability } from "../src/candy/motifStatisticsAvailability.js";
import { motifQueryPolicy } from "../src/agent/motifQueryPolicy.js";
import { createConfirmationSnapshot, isConfirmationStale } from "../src/agent/confirmationState.js";
import { buildAuthoritativeOrchestratorObservation } from "../src/agent/orchestratorObservation.js";
import { createGraphHistoryEvent } from "../src/graph/graphHistory.js";
import { previewGraphMutation } from "../src/graph/graphMutationPreview.js";
import { createMutationPlan } from "../src/graph/graphMutationValidator.js";
import {
  APPLICATION_GRAPH_TYPES,
  commitGraphState,
  createGraphState,
  graphIdentityFromState,
} from "../src/graph/graphState.js";

const baseHyperedges = [
  { id: "h0", vertices: ["A", "B"], time: null, weight: 1, attributes: {} },
  { id: "h1", vertices: ["B", "C"], time: null, weight: 1, attributes: {} },
];

// G02: existing application/import behavior defaults to Hypergraph.
const initial = createGraphState(baseHyperedges);
assert.equal(initial.graphType, GRAPH_TYPES.HYPERGRAPH);
assert.equal(initial.graphVersion, 1);
assert.equal(initial.explicitVertices, null, "Scope 5A reserves but does not introduce isolated-vertex semantics");
assert.deepEqual(APPLICATION_GRAPH_TYPES, [GRAPH_TYPES.HYPERGRAPH, GRAPH_TYPES.DYNAMIC_HYPERGRAPH]);

// G01/G03: an explicit type-only transition is authoritative without changing content or graph ID.
const confirmationState = {
  graphId: initial.graphId,
  graphVersion: initial.graphVersion,
  graphType: initial.graphType,
  graphFingerprint: initial.graphFingerprint,
};
const confirmation = createConfirmationSnapshot("apply_graph_mutation", confirmationState);
const dynamic = commitGraphState(initial, initial.hyperedges, { graphType: GRAPH_TYPES.DYNAMIC_HYPERGRAPH });
assert.equal(dynamic.graphType, GRAPH_TYPES.DYNAMIC_HYPERGRAPH);
assert.equal(dynamic.graphId, initial.graphId);
assert.equal(dynamic.graphVersion, initial.graphVersion + 1);
assert.notEqual(dynamic.graphFingerprint, initial.graphFingerprint);
assert.deepEqual(dynamic.hyperedges, initial.hyperedges);
assert.equal(isConfirmationStale(confirmation, {
  ...confirmationState,
  graphVersion: dynamic.graphVersion,
  graphType: dynamic.graphType,
  graphFingerprint: dynamic.graphFingerprint,
}), true, "type-only authority changes invalidate confirmations");

const repeatedType = commitGraphState(dynamic, dynamic.hyperedges, { graphType: GRAPH_TYPES.DYNAMIC_HYPERGRAPH });
assert.equal(repeatedType.graphVersion, dynamic.graphVersion, "selecting the current type is a no-op");
assert.equal(repeatedType.graphFingerprint, dynamic.graphFingerprint);

// Empty-graph type transitions are still type-only authority changes, not replacements.
const empty = createGraphState();
const emptyDynamic = commitGraphState(empty, null, { graphType: GRAPH_TYPES.DYNAMIC_HYPERGRAPH });
assert.equal(emptyDynamic.graphId, empty.graphId);
assert.equal(emptyDynamic.graphVersion, 1);
assert.notEqual(emptyDynamic.graphFingerprint, empty.graphFingerprint);

// Content never promotes a graph type, and application ordinary-graph states remain out of scope.
const editedHypergraph = commitGraphState(initial, [...baseHyperedges, { id: "h2", vertices: ["D"], time: null, weight: 1, attributes: {} }]);
assert.equal(editedHypergraph.graphType, GRAPH_TYPES.HYPERGRAPH);
assert.throws(() => createGraphState(baseHyperedges, { graphType: GRAPH_TYPES.ORDINARY }), /Unsupported application graph type/);
assert.throws(() => createGraphState(baseHyperedges, { graphType: GRAPH_TYPES.DYNAMIC_ORDINARY }), /Unsupported application graph type/);

// G04: parser/import replacement gets a new ID, a monotonic version, and the default Hypergraph type.
const replacement = commitGraphState(dynamic, [{ id: "replacement", vertices: ["X"], time: null, weight: 1, attributes: {} }], { replacement: true });
assert.notEqual(replacement.graphId, dynamic.graphId);
assert.equal(replacement.graphVersion, dynamic.graphVersion + 1);
assert.equal(replacement.graphType, GRAPH_TYPES.HYPERGRAPH);

// Clear remains a replacement-like committed transition while preserving the explicitly selected type.
const cleared = commitGraphState(dynamic, [], { clear: true });
assert.notEqual(cleared.graphId, dynamic.graphId);
assert.equal(cleared.graphVersion, dynamic.graphVersion + 1);
assert.equal(cleared.graphType, GRAPH_TYPES.DYNAMIC_HYPERGRAPH);
assert.equal(cleared.hyperedges, null);

// G05: history records type, and undo restores it as a new committed transition.
const typeEvent = createGraphHistoryEvent({
  graphIdentity: dynamic,
  beforeGraphType: initial.graphType,
  afterGraphType: dynamic.graphType,
  beforeHyperedges: initial.hyperedges,
  afterHyperedges: dynamic.hyperedges,
  plan: { summary: "Select DynamicHypergraph" },
  source: "graph_type",
});
const undoPlan = createMutationPlan({
  graphIdentity: graphIdentityFromState(dynamic),
  operations: [{ type: "UNDO_LAST_MUTATION" }],
  summary: "Undo graph type selection",
});
const undoPreview = previewGraphMutation(dynamic.hyperedges, undoPlan, graphIdentityFromState(dynamic), [typeEvent]);
assert.equal(undoPreview.ok, true);
assert.equal(undoPreview.graphChanged, true, "type-only undo is an authority change even with identical hyperedges");
assert.equal(undoPreview.graphType, GRAPH_TYPES.HYPERGRAPH);
assert.equal(dynamic.graphType, GRAPH_TYPES.DYNAMIC_HYPERGRAPH, "preview never mutates authoritative state");
const undone = commitGraphState(dynamic, undoPreview.hyperedges, { graphType: undoPreview.graphType });
assert.equal(undone.graphVersion, dynamic.graphVersion + 1);
assert.equal(undone.graphId, dynamic.graphId);
assert.equal(undone.graphType, GRAPH_TYPES.HYPERGRAPH);

// STATIC remains available for both first-class hypergraph types.
const staticCapability = { backend: "CUDA_STATIC", modes: ["STATIC"], devices: [{ id: 0 }] };
for (const graphType of APPLICATION_GRAPH_TYPES) {
  const availability = motifStatisticsAvailability({
    featureEnabled: true,
    authorized: true,
    graphType,
    capabilities: [staticCapability],
  });
  assert.equal(availability.ready, true, `STATIC remains available for ${graphType}`);
  assert.equal(availability.capability.backend, "CUDA_STATIC");
}

// DynamicHypergraph alone never authorizes incremental execution or fallback.
const incrementalCapability = { backend: "CUDA_INCREMENTAL", modes: ["INCREMENTAL"], devices: [{ id: 0 }] };
const noPending = motifQueryPolicy("Run incremental motif analysis.", {
  graph: { available: true, graphType: GRAPH_TYPES.DYNAMIC_HYPERGRAPH },
  candy: { featureEnabled: true, authorized: true, capabilities: [incrementalCapability] },
});
assert.equal(noPending.ok, false);
assert.equal(noPending.classification, "INVALID_UPDATE_BATCH");
assert.match(noPending.message, /No authoritative pending qualified update/);

const noProjection = motifQueryPolicy("Run incremental motif analysis.", {
  graph: { available: true, graphType: GRAPH_TYPES.ORDINARY },
  candy: { featureEnabled: true, authorized: true, capabilities: [incrementalCapability] },
});
assert.equal(noProjection.classification, "INVALID_GRAPH_TYPE");
assert.match(noProjection.message, /no implicit projection|No implicit projection/i);

// Assistant observation reads the application authority and gains no type-mutation capability.
const observation = buildAuthoritativeOrchestratorObservation({
  state: {
    hasGraph: true,
    graphId: dynamic.graphId,
    graphVersion: dynamic.graphVersion,
    graphType: dynamic.graphType,
    graphFingerprint: dynamic.graphFingerprint,
    vertexCount: 3,
    candy: { featureEnabled: false, graphType: dynamic.graphType, capabilities: [], jobs: [] },
  },
});
assert.equal(observation.graph.graphType, GRAPH_TYPES.DYNAMIC_HYPERGRAPH);
assert.equal(observation.graph.fingerprint, dynamic.graphFingerprint);
assert.equal(observation.availableCapabilities.some(capability => /GRAPH_TYPE|DYNAMIC_HYPERGRAPH/.test(capability)), false);

// App wiring preserves 5A type authority; 5C observes the existing 5B owner.
const appSource = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
assert.match(appSource, /const \[graphState, setGraphState\] = useState\(\(\) => createGraphState\(\)\)/);
assert.doesNotMatch(appSource, /\[hes, setHes\]/);
assert.doesNotMatch(appSource, /\[graphIdentity, setGraphIdentity\]/);
assert.match(appSource, /aria-label="Committed graph type"/);
assert.match(appSource, /graphVersion, graphType: graphState\.graphType/);
const runtimeCall = appSource.slice(appSource.indexOf("const candyRuntime = useCandyRuntime"), appSource.indexOf("function requestStaticMotifFromStatistics"));
assert.match(runtimeCall, /pendingController: pendingHypergraphUpdateControllerRef\.current/);
assert.match(runtimeCall, /graphType: graphState\.graphType/);

console.log("CANDY Scope 5A first-class graph-state tests passed.");
