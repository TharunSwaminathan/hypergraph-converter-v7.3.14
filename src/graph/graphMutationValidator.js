import { EMPTY_HYPEREDGE_POLICIES, GRAPH_MUTATION_OPS, PROTOTYPE_POLLUTION_KEYS, isSupportedGraphMutationOp } from "./graphMutationSchema.js";
import { graphFingerprint, stableStringify } from "./graphFingerprint.js";

export function mutationPlanHash(plan) {
  return graphFingerprint([{ id: "plan", vertices: [stableStringify(plan?.operations ?? [])], attributes: { schemaVersion: plan?.schemaVersion ?? 1 } }]);
}

export function createMutationPlan({
  operations = [],
  source = "manual",
  summary = "Graph mutation",
  graphIdentity = {},
  metadata = {},
  createdAt = new Date().toISOString(),
} = {}) {
  const plan = {
    schemaVersion: 1,
    planId: metadata.planId ?? createPlanId(),
    source,
    summary,
    createdAt,
    expectedGraphId: graphIdentity.graphId ?? null,
    expectedGraphVersion: graphIdentity.graphVersion ?? 0,
    expectedGraphFingerprint: graphIdentity.graphFingerprint ?? graphFingerprint([]),
    operations,
    metadata,
  };
  return { ...plan, planHash: mutationPlanHash(plan) };
}

let planCounter = 0;
function createPlanId() {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) return `mutation-${cryptoApi.randomUUID()}`;
  planCounter += 1;
  return `mutation-${Date.now().toString(36)}-${planCounter.toString(36)}`;
}

export function validateMutationPlan(plan, hyperedges, graphIdentity = {}) {
  const errors = [];
  const warnings = [];
  if (!plan || typeof plan !== "object") errors.push("Plan is missing.");
  if (!Array.isArray(plan?.operations) || plan.operations.length === 0) errors.push("Plan must contain at least one operation.");
  if (plan?.expectedGraphId && graphIdentity.graphId && plan.expectedGraphId !== graphIdentity.graphId) errors.push("STALE_GRAPH_ID");
  if (Number.isInteger(plan?.expectedGraphVersion) && Number.isInteger(graphIdentity.graphVersion) && plan.expectedGraphVersion !== graphIdentity.graphVersion) errors.push("STALE_GRAPH_VERSION");
  if (plan?.expectedGraphFingerprint && graphIdentity.graphFingerprint && plan.expectedGraphFingerprint !== graphIdentity.graphFingerprint) errors.push("STALE_GRAPH_FINGERPRINT");
  if (plan?.planHash && plan.planHash !== mutationPlanHash(plan)) errors.push("STALE_PLAN_HASH");
  for (const [index, operation] of (plan?.operations ?? []).entries()) {
    validateOperationShape(operation, index, errors, warnings);
  }
  return { ok: errors.length === 0, errors, warnings };
}

export function validateOperationShape(operation, index = 0, errors = [], warnings = []) {
  const path = `operations[${index}]`;
  if (!operation || typeof operation !== "object") {
    errors.push(`${path} must be an object.`);
    return;
  }
  if (!isSupportedGraphMutationOp(operation.type)) errors.push(`${path} has unsupported type ${operation.type ?? "(missing)"}.`);
  const requireString = (field) => {
    if (!String(operation[field] ?? "").trim()) errors.push(`${path}.${field} is required.`);
  };
  const requireEmptyPolicy = () => {
    if (!Object.values(EMPTY_HYPEREDGE_POLICIES).includes(operation.emptyHyperedgePolicy)) {
      errors.push(`${path}.emptyHyperedgePolicy must be keep_empty, remove_empty, or ask.`);
    } else if (operation.emptyHyperedgePolicy === EMPTY_HYPEREDGE_POLICIES.ASK) {
      errors.push(`${path}.emptyHyperedgePolicy requires clarification before execution.`);
    }
  };

  if (operation.type === GRAPH_MUTATION_OPS.ADD_HYPEREDGE) {
    requireString("hyperedgeId");
    if (!Array.isArray(operation.vertices) || operation.vertices.length === 0) errors.push(`${path}.vertices must be a non-empty array.`);
  }
  if ([GRAPH_MUTATION_OPS.REMOVE_HYPEREDGE, GRAPH_MUTATION_OPS.SET_HYPEREDGE_WEIGHT, GRAPH_MUTATION_OPS.SET_HYPEREDGE_TIME, GRAPH_MUTATION_OPS.REMOVE_HYPEREDGE_ATTRIBUTE].includes(operation.type)) {
    requireString("hyperedgeId");
  }
  if ([GRAPH_MUTATION_OPS.ADD_INCIDENCE, GRAPH_MUTATION_OPS.REMOVE_INCIDENCE].includes(operation.type)) {
    requireString("hyperedgeId");
    requireString("vertexId");
    if (operation.type === GRAPH_MUTATION_OPS.REMOVE_INCIDENCE) requireEmptyPolicy();
  }
  if (operation.type === GRAPH_MUTATION_OPS.RENAME_HYPEREDGE) {
    requireString("hyperedgeId");
    requireString("newHyperedgeId");
  }
  if (operation.type === GRAPH_MUTATION_OPS.RENAME_VERTEX) {
    requireString("vertexId");
    requireString("newVertexId");
  }
  if (operation.type === GRAPH_MUTATION_OPS.REMOVE_VERTEX_GLOBAL) {
    requireString("vertexId");
    requireEmptyPolicy();
  }
  if (operation.type === GRAPH_MUTATION_OPS.SET_HYPEREDGE_WEIGHT && !Number.isFinite(Number(operation.weight))) errors.push(`${path}.weight must be finite.`);
  if (operation.type === GRAPH_MUTATION_OPS.SET_HYPEREDGE_ATTRIBUTE) {
    requireString("hyperedgeId");
    requireString("key");
    if (PROTOTYPE_POLLUTION_KEYS.has(String(operation.key))) errors.push(`${path}.key is blocked.`);
    if (!isJsonSerializable(operation.value)) errors.push(`${path}.value must be JSON-serializable.`);
  }
  if (operation.type === GRAPH_MUTATION_OPS.REMOVE_HYPEREDGE_ATTRIBUTE) {
    requireString("key");
    if (PROTOTYPE_POLLUTION_KEYS.has(String(operation.key))) errors.push(`${path}.key is blocked.`);
  }
  if (operation.type === GRAPH_MUTATION_OPS.COMMIT_BATCH_UPDATES) {
    if (!Array.isArray(operation.operations) || !operation.operations.length) errors.push(`${path}.operations must contain normalized batch mutation operations.`);
    for (const [childIndex, child] of (operation.operations ?? []).entries()) validateOperationShape(child, `${index}.operations[${childIndex}]`, errors, warnings);
  }
  if (operation.type === GRAPH_MUTATION_OPS.SET_HYPEREDGE_TIME && !isJsonSerializable(operation.time)) errors.push(`${path}.time must be JSON-serializable.`);
}

export function isJsonSerializable(value) {
  try {
    JSON.stringify(value);
    return typeof value !== "function" && typeof value !== "symbol" && typeof value !== "undefined";
  } catch {
    return false;
  }
}

