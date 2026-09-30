import assert from "node:assert/strict";
import { GRAPH_TYPES } from "../src/candy/contracts/graphTypes.js";
import { CANDY_ERROR_CODES } from "../src/candy/contracts/errorClasses.js";
import { createConfirmationSnapshot } from "../src/agent/confirmationState.js";
import { createMutationPlan } from "../src/graph/graphMutationValidator.js";
import { commitGraphState, createGraphState, graphIdentityFromState } from "../src/graph/graphState.js";
import {
  APPLY_PENDING_HYPERGRAPH_UPDATE_ACTION,
  PENDING_HYPERGRAPH_UPDATE_STATUS,
  applyPendingHypergraphUpdate,
  createPendingHypergraphUpdateController,
  createPendingHypergraphUpdateDraft,
  createPendingHypergraphUpdateSession,
  discardPendingHypergraphUpdate,
  validatePendingHypergraphUpdate,
} from "../src/graph/pendingHypergraphUpdate.js";

const initialHypergraph = createGraphState([edge("h1", ["a", "b"]), edge("h2", ["b", "c"])]);
let graphState = commitGraphState(initialHypergraph, initialHypergraph.hyperedges, { graphType: GRAPH_TYPES.DYNAMIC_HYPERGRAPH });
let commitCount = 0;
let runtimeJobCount = 0;
const controller = createPendingHypergraphUpdateController({
  getGraphState: () => graphState,
  commit: (hyperedges, options) => {
    commitCount += 1;
    assert.equal(options.source, "pending_dynamic_hypergraph_update");
    graphState = commitGraphState(graphState, hyperedges, { graphType: options.graphType });
    return graphState;
  },
});

// A01/U01: staging produces one validated preview and never commits the graph.
const beforeStage = graphState;
const firstPlan = planFor(graphState, [{ type: "ADD_HYPEREDGE", hyperedgeId: "h3", vertices: ["c", "d"] }], "Insert h3");
const firstResult = await controller.stage(firstPlan);
const first = firstResult.pendingUpdate;
assert.equal(first.status, PENDING_HYPERGRAPH_UPDATE_STATUS.VALIDATED);
assert.equal(first.graphType, GRAPH_TYPES.DYNAMIC_HYPERGRAPH);
assert.equal(first.baseGraphRef.graphId, graphState.graphId);
assert.equal(first.nextGraphVersion, graphState.graphVersion + 1);
assert.match(first.updateDigest, /^sha256:[a-f0-9]{64}$/);
assert.equal(first.motifImpact, "CHANGED");
assert.equal(graphState, beforeStage, "draft and validation must not commit");
assert.equal(commitCount, 0);

// U19: revalidating the same current ID and digest is idempotent, not duplicate authority.
const same = await validatePendingHypergraphUpdate({ session: controller.session, pendingUpdate: first, graphState });
assert.equal(same.pendingUpdate.updateId, first.updateId);
assert.equal(same.pendingUpdate.updateDigest, first.updateDigest);
const substitutedDigest = { ...same.pendingUpdate, updateDigest: `sha256:${"0".repeat(64)}` };
await assert.rejects(
  applyPendingHypergraphUpdate({
    session: controller.session,
    pendingUpdate: substitutedDigest,
    graphState,
    confirmation: applyConfirmation(graphState, substitutedDigest),
  }),
  error => error?.code === CANDY_ERROR_CODES.INVALID_UPDATE_BATCH,
);

// U18/U20/U21: a material edit mints a fresh revision/ID/digest and supersedes the old revision.
const editedPlan = planFor(graphState, [{ type: "REMOVE_HYPEREDGE", hyperedgeId: "h1" }], "Delete h1 instead");
const edited = (await controller.stage(editedPlan)).pendingUpdate;
assert.equal(edited.revision, first.revision + 1);
assert.notEqual(edited.updateId, first.updateId);
assert.notEqual(edited.updateDigest, first.updateDigest);
await assert.rejects(
  validatePendingHypergraphUpdate({ session: controller.session, pendingUpdate: first, graphState }),
  error => error?.code === CANDY_ERROR_CODES.INVALID_UPDATE_BATCH,
);

// A forged previous revision cannot supersede the live authority as a side effect.
const guardedSession = createPendingHypergraphUpdateSession();
const guardedDraft = createPendingHypergraphUpdateDraft({
  session: guardedSession,
  graphState,
  plan: planFor(graphState, [{ type: "ADD_HYPEREDGE", hyperedgeId: "guarded", vertices: ["g"] }]),
});
await assert.rejects(
  Promise.resolve().then(() => createPendingHypergraphUpdateDraft({
    session: guardedSession,
    graphState,
    plan: planFor(graphState, [{ type: "ADD_HYPEREDGE", hyperedgeId: "forged", vertices: ["f"] }]),
    previousPending: { ...guardedDraft, updateId: "forged-update-id" },
  })),
  error => error?.code === CANDY_ERROR_CODES.INVALID_UPDATE_BATCH,
);
assert.equal(
  (await validatePendingHypergraphUpdate({ session: guardedSession, pendingUpdate: guardedDraft, graphState })).pendingUpdate.status,
  PENDING_HYPERGRAPH_UPDATE_STATUS.VALIDATED,
);

// A03/A05/A11/A12: a distinct Apply confirmation commits exact proposed state once and never runs Runtime.
const confirmation = applyConfirmation(graphState, edited);
const applyPromise = controller.apply(confirmation);
await assert.rejects(controller.apply(confirmation), error => error?.code === CANDY_ERROR_CODES.INVALID_UPDATE_BATCH);
const applied = await applyPromise;
assert.equal(commitCount, 1);
assert.equal(runtimeJobCount, 0);
assert.equal(applied.graphState.graphVersion, edited.nextGraphVersion);
assert.equal(applied.graphState.graphFingerprint, edited.proposedGraphFingerprint);
assert.equal(applied.appliedUpdate.status, PENDING_HYPERGRAPH_UPDATE_STATUS.APPLIED);
assert.equal(controller.getCurrent(), null);
await assert.rejects(
  applyPendingHypergraphUpdate({ session: controller.session, pendingUpdate: edited, graphState: beforeStage, confirmation }),
  error => error?.code === CANDY_ERROR_CODES.INVALID_UPDATE_BATCH,
);

// U07: metadata-only change is valid, applies independently, and fabricates no motif delta.
const metadataController = controllerFor(graphState);
const metadataPlan = planFor(graphState, [{ type: "SET_HYPEREDGE_WEIGHT", hyperedgeId: "h2", weight: 9 }], "Weight only");
const metadata = (await metadataController.stage(metadataPlan)).pendingUpdate;
assert.equal(metadata.motifImpact, "NONE");
assert.deepEqual(metadata.motifUpdate.deletions, []);
assert.deepEqual(metadata.motifUpdate.insertions, []);
assert.equal(Object.hasOwn(metadata, "deltaCounts"), false);

// U08: a full graph no-op produces no authoritative pending update or version transition.
const noOpController = controllerFor(graphState);
const noOpPlan = planFor(graphState, [{ type: "ADD_INCIDENCE", hyperedgeId: "h2", vertexId: "b" }], "Existing incidence");
const noOp = await noOpController.stage(noOpPlan);
assert.equal(noOp.noOp, true);
assert.equal(noOpController.getCurrent(), null);

// U17/A08: any committed graph transition makes the old pending revision stale.
const staleController = controllerFor(graphState);
const stalePending = (await staleController.stage(planFor(graphState, [{ type: "ADD_HYPEREDGE", hyperedgeId: "stale", vertices: ["x"] }]))).pendingUpdate;
const staleConfirmation = applyConfirmation(graphState, stalePending);
graphState = commitGraphState(graphState, [...graphState.hyperedges, edge("outside", ["q"])], { graphType: GRAPH_TYPES.DYNAMIC_HYPERGRAPH });
const stale = staleController.onGraphTransition(graphState, "OTHER_GRAPH_MUTATION");
assert.equal(stale.status, PENDING_HYPERGRAPH_UPDATE_STATUS.STALE);
await assert.rejects(staleController.apply(staleConfirmation), error => error?.code === CANDY_ERROR_CODES.INVALID_UPDATE_BATCH);

// A graph transition during asynchronous Apply stales the in-flight revision before commit.
let raceState = graphState;
let raceCommitCount = 0;
const raceController = createPendingHypergraphUpdateController({
  getGraphState: () => raceState,
  commit: hyperedges => {
    raceCommitCount += 1;
    raceState = commitGraphState(raceState, hyperedges, { graphType: GRAPH_TYPES.DYNAMIC_HYPERGRAPH });
    return raceState;
  },
});
const racePending = (await raceController.stage(
  planFor(raceState, [{ type: "ADD_HYPEREDGE", hyperedgeId: "raced", vertices: ["r"] }]),
)).pendingUpdate;
const racedApply = raceController.apply(applyConfirmation(raceState, racePending));
raceState = commitGraphState(raceState, [...raceState.hyperedges, edge("concurrent", ["c"])], {
  graphType: GRAPH_TYPES.DYNAMIC_HYPERGRAPH,
});
assert.equal(raceController.onGraphTransition(raceState, "CONCURRENT_GRAPH_TRANSITION").status, PENDING_HYPERGRAPH_UPDATE_STATUS.STALE);
await assert.rejects(racedApply, error => error?.code === CANDY_ERROR_CODES.STALE_GRAPH_VERSION);
assert.equal(raceCommitCount, 0);

// Discard consumes authority without changing committed graph or version.
const discardBase = graphState;
const discardSession = createPendingHypergraphUpdateSession();
const discardDraft = createPendingHypergraphUpdateDraft({
  session: discardSession,
  graphState,
  plan: planFor(graphState, [{ type: "ADD_HYPEREDGE", hyperedgeId: "discarded", vertices: ["r"] }]),
});
const discardValidated = (await validatePendingHypergraphUpdate({ session: discardSession, pendingUpdate: discardDraft, graphState })).pendingUpdate;
const discarded = discardPendingHypergraphUpdate({ session: discardSession, pendingUpdate: discardValidated });
assert.equal(discarded.status, PENDING_HYPERGRAPH_UPDATE_STATUS.DISCARDED);
assert.equal(graphState, discardBase);
await assert.rejects(
  applyPendingHypergraphUpdate({ session: discardSession, pendingUpdate: discarded, graphState, confirmation: applyConfirmation(graphState, discardValidated) }),
  error => error?.code === CANDY_ERROR_CODES.INVALID_UPDATE_BATCH,
);

// Pending authority is DynamicHypergraph-only.
const staticGraph = createGraphState([edge("s", ["a"])]);
assert.throws(() => createPendingHypergraphUpdateDraft({
  session: createPendingHypergraphUpdateSession(),
  graphState: staticGraph,
  plan: planFor(staticGraph, [{ type: "ADD_HYPEREDGE", hyperedgeId: "x", vertices: ["x"] }]),
}), error => error?.code === CANDY_ERROR_CODES.INVALID_GRAPH_TYPE);

// A13: a failed commit leaves graph authority unchanged and the revision retryable as validated.
const failureBase = graphState;
const failureController = createPendingHypergraphUpdateController({
  getGraphState: () => graphState,
  commit: () => { throw new Error("injected commit failure"); },
});
const failurePending = (await failureController.stage(planFor(graphState, [{ type: "ADD_HYPEREDGE", hyperedgeId: "failure", vertices: ["f"] }]))).pendingUpdate;
await assert.rejects(failureController.apply(applyConfirmation(graphState, failurePending)), /injected commit failure/);
assert.equal(graphState, failureBase);
assert.equal(failureController.getCurrent().status, PENDING_HYPERGRAPH_UPDATE_STATUS.VALIDATED);

// A post-commit authority mismatch is consumed and cannot leave executable pending authority behind.
let mismatchState = graphState;
const mismatchController = createPendingHypergraphUpdateController({
  getGraphState: () => mismatchState,
  commit: hyperedges => {
    mismatchState = commitGraphState(mismatchState, hyperedges, { graphType: GRAPH_TYPES.DYNAMIC_HYPERGRAPH });
    return { ...mismatchState, graphFingerprint: "tampered-commit-result" };
  },
});
const mismatchPending = (await mismatchController.stage(
  planFor(mismatchState, [{ type: "ADD_HYPEREDGE", hyperedgeId: "mismatch", vertices: ["m"] }]),
)).pendingUpdate;
await assert.rejects(
  mismatchController.apply(applyConfirmation(mismatchState, mismatchPending)),
  error => error?.code === CANDY_ERROR_CODES.RESULT_VALIDATION_FAILURE,
);
assert.equal(mismatchController.getCurrent(), null);

function controllerFor(state) {
  return createPendingHypergraphUpdateController({
    getGraphState: () => state,
    commit: hyperedges => commitGraphState(state, hyperedges, { graphType: GRAPH_TYPES.DYNAMIC_HYPERGRAPH }),
  });
}

function planFor(state, operations, summary = "Pending update") {
  return createMutationPlan({ graphIdentity: graphIdentityFromState(state), operations, summary });
}

function applyConfirmation(state, pendingUpdate) {
  return createConfirmationSnapshot(APPLY_PENDING_HYPERGRAPH_UPDATE_ACTION, {
    graphId: state.graphId,
    graphVersion: state.graphVersion,
    graphType: state.graphType,
    graphFingerprint: state.graphFingerprint,
    pendingDynamicUpdate: pendingUpdate,
  }, { mutationPlan: pendingUpdate.plan, pendingUpdate });
}

function edge(id, vertices) {
  return { id, vertices, time: null, weight: 1, attributes: {} };
}

console.log("CANDY Scope 5B pending-update lifecycle tests passed.");
