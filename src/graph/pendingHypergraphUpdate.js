import { GRAPH_TYPES } from "../candy/contracts/graphTypes.js";
import { CANDY_ERROR_CODES, failCandy } from "../candy/contracts/errorClasses.js";
import { deriveHypergraphMotifUpdate } from "../candy/adapters/graphMutationToHypergraphUpdate.js";
import { graphFingerprint, stableStringify } from "./graphFingerprint.js";
import { commitGraphState, graphIdentityFromState } from "./graphState.js";
import { previewGraphMutation } from "./graphMutationPreview.js";
import { mutationPlanHash, validateMutationPlan } from "./graphMutationValidator.js";

export const PENDING_HYPERGRAPH_UPDATE_STATUS = Object.freeze({
  DRAFT: "DRAFT",
  VALIDATED: "VALIDATED",
  STALE: "STALE",
  APPLIED: "APPLIED",
  DISCARDED: "DISCARDED",
});

export const APPLY_PENDING_HYPERGRAPH_UPDATE_ACTION = "apply_pending_hypergraph_update";

const SESSION_LEDGER_LIMIT = 256;
const SESSION_STATE = new WeakMap();
let fallbackUpdateId = 0;

export function createPendingHypergraphUpdateSession() {
  const session = Object.freeze({ kind: "PendingDynamicHypergraphUpdateSession" });
  SESSION_STATE.set(session, { nextRevision: 0, currentUpdateId: null, records: new Map() });
  return session;
}

export function createPendingHypergraphUpdateDraft({ session, graphState, plan, previousPending = null } = {}) {
  requireDynamicGraph(graphState);
  const ledger = requireSession(session);
  const validation = validateMutationPlan(plan, graphState.hyperedges ?? [], graphIdentityFromState(graphState));
  if (!validation.ok) failCandy(CANDY_ERROR_CODES.INVALID_UPDATE_BATCH, "GraphMutationPlan cannot become a pending update draft.", { errors: validation.errors });
  if (plan.planHash !== mutationPlanHash(plan)) failCandy(CANDY_ERROR_CODES.INVALID_UPDATE_BATCH, "GraphMutationPlan hash is stale.");

  if (previousPending && ledger.currentUpdateId && previousPending.updateId !== ledger.currentUpdateId) {
    failCandy(CANDY_ERROR_CODES.INVALID_UPDATE_BATCH, "Only the current pending update may be edited.");
  }
  if (ledger.currentUpdateId) {
    const current = ledger.records.get(ledger.currentUpdateId);
    if (current) current.lifecycle = "superseded";
  }

  const revision = ++ledger.nextRevision;
  const updateId = createUpdateId();
  ledger.currentUpdateId = updateId;
  ledger.records.set(updateId, { revision, lifecycle: "draft", digest: null });
  trimLedger(ledger);

  return freezePending({
    updateId,
    revision,
    status: PENDING_HYPERGRAPH_UPDATE_STATUS.DRAFT,
    baseGraphRef: { graphId: graphState.graphId, graphVersion: graphState.graphVersion },
    baseGraphFingerprint: graphState.graphFingerprint,
    graphType: GRAPH_TYPES.DYNAMIC_HYPERGRAPH,
    plan: cloneValue(plan),
    planHash: plan.planHash,
    preview: null,
    proposedGraphFingerprint: null,
    nextGraphVersion: graphState.graphVersion + 1,
    motifUpdate: null,
    motifImpact: null,
    updateDigest: null,
    staleReason: null,
  });
}

export async function validatePendingHypergraphUpdate({ session, pendingUpdate, graphState, history = [] } = {}) {
  const ledger = assertCurrentRecord(session, pendingUpdate, ["draft", "validated"]);
  const derived = await deriveValidatedContent(pendingUpdate, graphState, history);
  assertCurrentRecord(session, pendingUpdate, ["draft", "validated"]);
  if (derived.noOp) {
    ledger.lifecycle = "discarded";
    requireSession(session).currentUpdateId = null;
    return Object.freeze({ ok: true, noOp: true, pendingUpdate: null, reason: "FULL_GRAPH_NO_OP" });
  }
  if (ledger.digest && ledger.digest !== derived.updateDigest) {
    failCandy(CANDY_ERROR_CODES.INVALID_UPDATE_BATCH, "The same updateId cannot authorize different content.");
  }
  ledger.digest = derived.updateDigest;
  ledger.lifecycle = "validated";
  const validated = freezePending({
    ...pendingUpdate,
    status: PENDING_HYPERGRAPH_UPDATE_STATUS.VALIDATED,
    preview: derived.preview,
    proposedGraphFingerprint: derived.proposedGraphFingerprint,
    motifUpdate: derived.motifUpdate,
    motifImpact: derived.motifImpact,
    updateDigest: derived.updateDigest,
    staleReason: null,
  });
  return Object.freeze({ ok: true, noOp: false, pendingUpdate: validated });
}

export function stalePendingHypergraphUpdate({ session, pendingUpdate, graphState, reason = "COMMITTED_GRAPH_CHANGED" } = {}) {
  if (pendingUpdate?.status === PENDING_HYPERGRAPH_UPDATE_STATUS.STALE) return pendingUpdate;
  const ledger = assertCurrentRecord(session, pendingUpdate, ["draft", "validated", "applying"]);
  if (matchesBaseGraph(pendingUpdate, graphState)) return pendingUpdate;
  ledger.lifecycle = "stale";
  return freezePending({ ...pendingUpdate, status: PENDING_HYPERGRAPH_UPDATE_STATUS.STALE, staleReason: String(reason) });
}

export function discardPendingHypergraphUpdate({ session, pendingUpdate } = {}) {
  const ledger = assertCurrentRecord(session, pendingUpdate, ["draft", "validated", "stale"]);
  ledger.lifecycle = "discarded";
  requireSession(session).currentUpdateId = null;
  return freezePending({ ...pendingUpdate, status: PENDING_HYPERGRAPH_UPDATE_STATUS.DISCARDED, staleReason: null });
}

export function pendingApplyConfirmationBinding(pendingUpdate) {
  if (pendingUpdate?.status !== PENDING_HYPERGRAPH_UPDATE_STATUS.VALIDATED) {
    failCandy(CANDY_ERROR_CODES.INVALID_UPDATE_BATCH, "Apply confirmation requires a validated pending update.");
  }
  return Object.freeze({
    updateId: pendingUpdate.updateId,
    revision: pendingUpdate.revision,
    updateDigest: pendingUpdate.updateDigest,
    proposedGraphFingerprint: pendingUpdate.proposedGraphFingerprint,
    nextGraphVersion: pendingUpdate.nextGraphVersion,
    graphId: pendingUpdate.baseGraphRef.graphId,
    graphVersion: pendingUpdate.baseGraphRef.graphVersion,
    graphFingerprint: pendingUpdate.baseGraphFingerprint,
    graphType: pendingUpdate.graphType,
    planId: pendingUpdate.plan.planId,
    planHash: pendingUpdate.planHash,
  });
}

export async function applyPendingHypergraphUpdate({
  session,
  pendingUpdate,
  graphState,
  confirmation,
  history = [],
  commit,
  getCurrentGraphState,
} = {}) {
  const ledger = assertCurrentRecord(session, pendingUpdate, ["validated"]);
  if (!ledger.digest || ledger.digest !== pendingUpdate.updateDigest) {
    failCandy(CANDY_ERROR_CODES.INVALID_UPDATE_BATCH, "Pending update digest does not match its validated session authority.");
  }
  requireApplyConfirmation(confirmation, pendingUpdate);
  requireExactBase(pendingUpdate, graphState);
  ledger.lifecycle = "applying";

  let derived;
  try {
    derived = await deriveValidatedContent(pendingUpdate, graphState, history);
    if (derived.noOp
      || derived.updateDigest !== pendingUpdate.updateDigest
      || derived.proposedGraphFingerprint !== pendingUpdate.proposedGraphFingerprint
      || stableStringify(derived.preview.hyperedges) !== stableStringify(pendingUpdate.preview?.hyperedges)
      || stableStringify(derived.motifUpdate) !== stableStringify(pendingUpdate.motifUpdate)) {
      failCandy(CANDY_ERROR_CODES.INVALID_UPDATE_BATCH, "Pending update content no longer matches its validated authority binding.");
    }
    const currentGraphState = typeof getCurrentGraphState === "function" ? getCurrentGraphState() : graphState;
    requireExactBase(pendingUpdate, currentGraphState);
    if (ledger.lifecycle !== "applying") {
      failCandy(CANDY_ERROR_CODES.STALE_GRAPH_VERSION, "Pending update became stale before commit.");
    }
  } catch (error) {
    if (ledger.lifecycle === "applying") ledger.lifecycle = "validated";
    throw error;
  }

  let committed;
  try {
    const commitController = typeof commit === "function"
      ? commit
      : (hyperedges, options) => commitGraphState(graphState, hyperedges, { graphType: options.graphType });
    committed = await commitController(derived.preview.hyperedges, {
      graphType: GRAPH_TYPES.DYNAMIC_HYPERGRAPH,
      source: "pending_dynamic_hypergraph_update",
      summary: pendingUpdate.plan.summary ?? "Apply pending DynamicHypergraph update",
      plan: pendingUpdate.plan,
      preview: derived.preview,
    });
  } catch (error) {
    if (ledger.lifecycle === "applying") ledger.lifecycle = "validated";
    throw error;
  }

  if (committed?.graphId !== pendingUpdate.baseGraphRef.graphId
    || committed?.graphVersion !== pendingUpdate.nextGraphVersion
    || committed?.graphType !== GRAPH_TYPES.DYNAMIC_HYPERGRAPH
    || committed?.graphFingerprint !== pendingUpdate.proposedGraphFingerprint) {
    ledger.lifecycle = "applied";
    requireSession(session).currentUpdateId = null;
    failCandy(CANDY_ERROR_CODES.RESULT_VALIDATION_FAILURE, "Committed graph does not match the exact retained proposed state.");
  }

  ledger.lifecycle = "applied";
  requireSession(session).currentUpdateId = null;
  const appliedUpdate = freezePending({ ...pendingUpdate, status: PENDING_HYPERGRAPH_UPDATE_STATUS.APPLIED, staleReason: null });
  return Object.freeze({ ok: true, graphState: committed, pendingUpdate: null, appliedUpdate, runtimeJobCreated: false });
}

export function createPendingHypergraphUpdateController({ getGraphState, commit, getHistory = () => [] } = {}) {
  if (typeof getGraphState !== "function") throw new TypeError("getGraphState is required.");
  const session = createPendingHypergraphUpdateSession();
  let current = null;
  const listeners = new Set();
  const publish = value => { current = value; for (const listener of listeners) listener(); };
  const controller = {
    session,
    getCurrent: () => current,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    createDraft(plan) {
      publish(createPendingHypergraphUpdateDraft({ session, graphState: getGraphState(), plan, previousPending: current }));
      return current;
    },
    async validate() {
      const validating = current;
      const result = await validatePendingHypergraphUpdate({ session, pendingUpdate: validating, graphState: getGraphState(), history: getHistory() });
      if (current !== validating) failCandy(CANDY_ERROR_CODES.STALE_GRAPH_VERSION, "Pending revision changed during validation.");
      requireExactBase(validating, getGraphState());
      publish(result.pendingUpdate);
      return result;
    },
    async stage(plan) {
      controller.createDraft(plan);
      return controller.validate();
    },
    discard() {
      const discarded = discardPendingHypergraphUpdate({ session, pendingUpdate: current });
      publish(null);
      return discarded;
    },
    onGraphTransition(nextGraphState, reason) {
      if (current) publish(stalePendingHypergraphUpdate({ session, pendingUpdate: current, graphState: nextGraphState, reason }));
      return current;
    },
    async apply(confirmation) {
      try {
        const result = await applyPendingHypergraphUpdate({
          session,
          pendingUpdate: current,
          graphState: getGraphState(),
          confirmation,
          history: getHistory(),
          commit,
          getCurrentGraphState: getGraphState,
        });
        publish(null);
        return result;
      } catch (error) {
        if (error?.code === CANDY_ERROR_CODES.RESULT_VALIDATION_FAILURE) publish(null);
        throw error;
      }
    },
  };
  return Object.freeze(controller);
}

async function deriveValidatedContent(pendingUpdate, graphState, history) {
  requireDynamicGraph(graphState);
  requireExactBase(pendingUpdate, graphState);
  if (pendingUpdate.graphType !== GRAPH_TYPES.DYNAMIC_HYPERGRAPH
    || pendingUpdate.nextGraphVersion !== graphState.graphVersion + 1
    || pendingUpdate.planHash !== pendingUpdate.plan?.planHash
    || pendingUpdate.planHash !== mutationPlanHash(pendingUpdate.plan)) {
    failCandy(CANDY_ERROR_CODES.INVALID_UPDATE_BATCH, "Pending update authority binding is invalid.");
  }
  const preview = previewGraphMutation(graphState.hyperedges ?? [], pendingUpdate.plan, graphIdentityFromState(graphState), history);
  if (!preview.ok) failCandy(CANDY_ERROR_CODES.INVALID_UPDATE_BATCH, "Pending update preview failed.", { errors: preview.errors });
  if (preview.graphType !== GRAPH_TYPES.DYNAMIC_HYPERGRAPH) {
    failCandy(CANDY_ERROR_CODES.INVALID_GRAPH_TYPE, "A pending update cannot change application graph type.");
  }
  if (!preview.graphChanged) return { noOp: true };
  const proposedGraphFingerprint = graphFingerprint(preview.hyperedges, {
    graphType: GRAPH_TYPES.DYNAMIC_HYPERGRAPH,
    explicitVertices: graphState.explicitVertices,
  });
  const projection = deriveHypergraphMotifUpdate({
    baseGraphState: graphState,
    proposedHyperedges: preview.hyperedges,
    updateId: pendingUpdate.updateId,
    nextGraphVersion: pendingUpdate.nextGraphVersion,
  });
  const content = {
    updateId: pendingUpdate.updateId,
    revision: pendingUpdate.revision,
    baseGraphRef: pendingUpdate.baseGraphRef,
    baseGraphFingerprint: pendingUpdate.baseGraphFingerprint,
    graphType: pendingUpdate.graphType,
    plan: pendingUpdate.plan,
    planHash: pendingUpdate.planHash,
    preview: cloneValue(preview),
    proposedGraphFingerprint,
    nextGraphVersion: pendingUpdate.nextGraphVersion,
    motifUpdate: projection.motifUpdate,
    motifImpact: projection.motifImpact,
  };
  return {
    ...content,
    updateDigest: await sha256(stableStringify(content)),
  };
}

function requireApplyConfirmation(confirmation, pendingUpdate) {
  const binding = pendingApplyConfirmationBinding(pendingUpdate);
  if (!confirmation || confirmation.actionType !== APPLY_PENDING_HYPERGRAPH_UPDATE_ACTION
    || !Number.isFinite(confirmation.expiresAt) || Date.now() > confirmation.expiresAt) {
    failCandy(CANDY_ERROR_CODES.INVALID_UPDATE_BATCH, "A fresh, distinct Apply confirmation is required.");
  }
  const comparisons = {
    graphId: binding.graphId,
    graphVersion: binding.graphVersion,
    graphFingerprint: binding.graphFingerprint,
    graphType: binding.graphType,
    mutationPlanId: binding.planId,
    mutationPlanHash: binding.planHash,
    pendingUpdateId: binding.updateId,
    pendingUpdateRevision: binding.revision,
    pendingUpdateDigest: binding.updateDigest,
    proposedGraphFingerprint: binding.proposedGraphFingerprint,
    nextGraphVersion: binding.nextGraphVersion,
  };
  for (const [key, expected] of Object.entries(comparisons)) {
    if (confirmation[key] !== expected) failCandy(CANDY_ERROR_CODES.INVALID_UPDATE_BATCH, "Apply confirmation does not match the current pending revision.", { key });
  }
}

function requireDynamicGraph(graphState) {
  if (graphState?.graphType !== GRAPH_TYPES.DYNAMIC_HYPERGRAPH) {
    failCandy(CANDY_ERROR_CODES.INVALID_GRAPH_TYPE, "Pending DynamicHypergraph updates require an authoritative DynamicHypergraph.");
  }
}

function requireExactBase(pendingUpdate, graphState) {
  if (!matchesBaseGraph(pendingUpdate, graphState)) {
    failCandy(CANDY_ERROR_CODES.STALE_GRAPH_VERSION, "Pending update targets stale committed graph authority.");
  }
}

function matchesBaseGraph(pendingUpdate, graphState) {
  return pendingUpdate?.baseGraphRef?.graphId === graphState?.graphId
    && pendingUpdate?.baseGraphRef?.graphVersion === graphState?.graphVersion
    && pendingUpdate?.baseGraphFingerprint === graphState?.graphFingerprint
    && pendingUpdate?.graphType === graphState?.graphType;
}

function requireSession(session) {
  const value = SESSION_STATE.get(session);
  if (!value) throw new TypeError("A live pending-update browser session is required.");
  return value;
}

function assertCurrentRecord(session, pendingUpdate, allowedLifecycle) {
  const ledger = requireSession(session);
  const record = ledger.records.get(pendingUpdate?.updateId);
  if (!record || ledger.currentUpdateId !== pendingUpdate.updateId
    || record.revision !== pendingUpdate.revision || !allowedLifecycle.includes(record.lifecycle)) {
    failCandy(CANDY_ERROR_CODES.INVALID_UPDATE_BATCH, "Pending update revision is consumed, discarded, stale, or superseded.");
  }
  return record;
}

function trimLedger(ledger) {
  while (ledger.records.size > SESSION_LEDGER_LIMIT) {
    const oldest = ledger.records.keys().next().value;
    if (oldest === ledger.currentUpdateId) break;
    ledger.records.delete(oldest);
  }
}

function createUpdateId() {
  if (globalThis.crypto?.randomUUID) return `pending-${globalThis.crypto.randomUUID()}`;
  fallbackUpdateId += 1;
  return `pending-${Date.now().toString(36)}-${fallbackUpdateId.toString(36)}`;
}

async function sha256(text) {
  const bytes = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return `sha256:${[...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, "0")).join("")}`;
}

function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, cloneValue(child)]));
}

function freezePending(value) {
  return deepFreeze(cloneValue(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
