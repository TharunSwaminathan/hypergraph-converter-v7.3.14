import { buildGraphEntityIndex, resolveHyperedgeReference, resolveVertexReference, selectionFingerprint } from "../graph/entityResolver.js";
import { EMPTY_HYPEREDGE_POLICIES, GRAPH_MUTATION_OPS, PROTOTYPE_POLLUTION_KEYS } from "../graph/graphMutationSchema.js";
import { createMutationPlan } from "../graph/graphMutationValidator.js";
import { classifyLocalModelError, generateWithLocalModel } from "./localModelClient.js";
import { GRAPH_MUTATION_PLANNER_NUM_PREDICT, LOCAL_MODEL_TASK_TIMEOUTS } from "./localModelSettings.js";
import { rawResponsePreview } from "./modelReliability.js";
import { GRAPH_MUTATION_DRAFT_SCHEMA, GRAPH_MUTATION_DRAFT_TASK } from "./graphMutationDraftSchema.js";
import { draftValidationStatus, validateGraphMutationDraft } from "./graphMutationDraftValidator.js";
import { buildGraphMutationPlannerPrompt } from "./prompts/graphMutationPlannerPrompt.js";

const GRAPH_MUTATION_LANGUAGE = [
  /\b(add|create|include|put|insert|remove|delete|rename|undo|clear|set|change|detach|connect)\b/i,
  /\b(?:should|needs?|belongs?|part of|membership|incidence|everywhere)\b/i,
  /\bwhat would happen if\b/i,
  /\b(show|preview|check)\b.*\b(impact|without applying|without changing|do not change|don't change)\b/i,
  /\b(actually|no,?\s*i meant|instead|only|just|never mind|cancel)\b/i,
];

const NOT_MUTATION_HINTS = [
  /\bwhat is\b.*\b(?:hyperedge|vertex|graph|incidence)\b/i,
  /\bexplain\b.*\b(?:format|h2v|v2h|csr|csc|json|export|parser|mapping)\b/i,
  /\b(export|download|show stats|visuali[sz]e|route|tab|upload|parse)\b/i,
  /\bconceptually\b/i,
];

const TYPED_PENDING_CORRECTION_PATTERNS = [
  // "Change the pending vertex from 6 to 7."
  /\b(?:change|update|correct|fix|revise)\b[\s\S]{0,60}\bpending\b[\s\S]{0,80}\bfrom\b[\s\S]{1,60}\bto\b/i,
  // "Use h3 instead of h2 in the pending graph edit." / "...for the pending mutation"
  /\b(?:use|make\s+it)\b[\s\S]{1,60}\binstead\s+of\b[\s\S]{1,60}\b(?:in|for)\s+the\s+pending\b/i,
  // "Replace author_id with researcher_id in the pending mapping."
  /\breplace\b[\s\S]{1,80}\bwith\b[\s\S]{1,60}\b(?:in|for)\s+the\s+pending\b/i,
  // General: an explicit change-verb naming "the pending X" together with a
  // to/with/instead-of clause supplying the new value.
  /\b(?:change|replace|update|correct|fix|set|rename|use)\b[\s\S]{0,60}\bthe\s+pending\b[\s\S]{0,100}\b(?:to|with|instead\s+of)\b/i,
  /\bthe\s+pending\b[\s\S]{0,80}\b(?:should\s+be|instead\s+of|change(?:d)?\s+to)\b/i,
  // "No, call it Artemis instead." / "Actually, only remove Alice from h0." —
  // a leading correction cue (actually/no,/instead of what I said) combined
  // with a concrete replacement verb, when a graph mutation is already
  // pending (the pendingAction context is required by the caller below).
  /^\s*(?:actually|no[,;:]|instead)\b[\s\S]*\b(?:call\s+it|use|rename|only\s+remove|only\s+add)\b/i,
  /^\s*(?:actually|no[,;:]|instead)\b[\s\S]{0,80}\b(?:add|remove|delete|set|change|rename|create|include|put|insert)\b[\s\S]{0,120}\b(?:instead|to|from|in|into)\b/i,
];

export function isTypedPendingGraphCorrection(raw) {
  return TYPED_PENDING_CORRECTION_PATTERNS.some(pattern => pattern.test(raw));
}

export function isPlausibleGraphMutationText(text = "", { pendingAction = null } = {}) {
  const raw = String(text ?? "").trim();
  if (!raw) return false;
  // A pending-graph-mutation replacement must be a *typed* correction: it
  // names the pending operation and supplies a concrete field/operand plus a
  // new value (V7310-D02). Generic single-word candidacy ("only", "use",
  // "it", "that", "cancel" appearing anywhere) previously caused ordinary
  // read-only questions during a pending state to be misread as
  // replacements; the read-only classifier in requestSemantics.js already
  // has first refusal via routePendingSubmission, so this only needs to
  // recognize genuine, explicit corrections.
  if (pendingAction?.actionType === "apply_graph_mutation" && isTypedPendingGraphCorrection(raw)) {
    return true;
  }
  if (pendingAction?.actionType === "apply_graph_mutation") {
    // Not a typed correction: don't fall through to the general "propose a
    // brand-new mutation" matcher below. Its final clause used to grant an
    // automatic pass whenever any mutation was pending, regardless of entity
    // wording, which let unrelated graph-shaped questions ("What is the best
    // way to add vertex 6 to h2?") get treated as replacement candidates.
    return false;
  }
  if (NOT_MUTATION_HINTS.some(pattern => pattern.test(raw)) && !/\b(add|remove|delete|rename|undo|clear|set|change|detach|connect|what would happen if|preview)\b/i.test(raw)) {
    return false;
  }
  return GRAPH_MUTATION_LANGUAGE.some(pattern => pattern.test(raw))
    && (/\b(hyperedge|edge|vertex|graph|incidence|weight|time|attribute|attr|everywhere|h[\w.-]*|selected|that|this|it|to|from|into|in)\b/i.test(raw)
      || pendingAction?.actionType === "apply_graph_mutation");
}

function buildGraphMutationRepairRequest(originalRequest, {
  rawResponse,
  validationErrors = [],
} = {}) {
  const repairText = [
    "Your previous response was rejected by deterministic GraphMutationDraft validation.",
    "Return one corrected JSON object only. No markdown, no prose, no code fences.",
    "Match the attached GraphMutationDraft response format exactly.",
    "Never add executable fields or prose.",
    "Validation errors:",
    ...validationErrors.slice(0, 8).map(error => `- ${error}`),
  ].join("\n");
  const messages = [
    ...originalRequest.messages,
    { role: "assistant", content: rawResponsePreview(rawResponse, 1500) },
    { role: "user", content: repairText },
  ];
  return {
    ...originalRequest,
    messages,
    responseSchema: GRAPH_MUTATION_DRAFT_SCHEMA,
    promptChars: messages.reduce((sum, message) => sum + message.content.length, 0),
    schemaChars: JSON.stringify(GRAPH_MUTATION_DRAFT_SCHEMA).length,
    repairPromptChars: repairText.length,
    numPredict: GRAPH_MUTATION_PLANNER_NUM_PREDICT,
    repairAttempt: 1,
  };
}

function remainingMs(deadline) {
  return Math.max(0, deadline - performance.now());
}

function attemptTimeoutMs(deadline, preferred) {
  return Math.max(1, Math.min(Number(preferred) || 1, remainingMs(deadline) || 1));
}

export async function planGraphMutationWithModel({
  config,
  userQuery = "",
  hyperedges = [],
  graphIdentity = {},
  graphHistory = [],
  selectedEntity = null,
  pendingAction = null,
  conversation = [],
  recentReferences = {},
  signal = null,
  timeoutMs = LOCAL_MODEL_TASK_TIMEOUTS.graph_mutation_planner_total,
  onMetrics = null,
  generate = generateWithLocalModel,
} = {}) {
  const request = buildGraphMutationPlannerPrompt({
    userQuery,
    hyperedges,
    graphIdentity,
    selectedEntity,
    pendingAction,
    conversation,
    recentReferences,
  });
  const attempts = [];
  const metrics = [];
  const started = performance.now();
  const totalBudgetMs = Number(timeoutMs || LOCAL_MODEL_TASK_TIMEOUTS.graph_mutation_planner_total);
  const deadline = started + totalBudgetMs;
  let rawResponse;
  let validation;
  let finalRequest = request;

  try {
    rawResponse = await generate(config, request, {
      signal,
      timeoutMs: attemptTimeoutMs(deadline, LOCAL_MODEL_TASK_TIMEOUTS.graph_mutation_planner_first_attempt),
      onMetrics: metric => {
        const item = { attempt: 1, task: GRAPH_MUTATION_DRAFT_TASK, ...metric };
        metrics.push(item);
        onMetrics?.(item);
      },
    });
    validation = validateGraphMutationDraft(rawResponse);
    attempts.push({
      task: GRAPH_MUTATION_DRAFT_TASK,
      attempt: 1,
      status: draftValidationStatus(validation),
      validationErrors: validation.errors ?? [],
      rawResponsePreview: rawResponsePreview(rawResponse),
    });
    if (!validation.ok) {
      finalRequest = buildGraphMutationRepairRequest(request, {
        rawResponse,
        validationErrors: validation.errors ?? [],
      });
      if (remainingMs(deadline) < LOCAL_MODEL_TASK_TIMEOUTS.graph_mutation_planner_repair_minimum) {
        attempts.push({
          task: `${GRAPH_MUTATION_DRAFT_TASK}_repair`,
          attempt: 2,
          status: "skipped_insufficient_budget",
          validationErrors: validation.errors ?? [],
          repaired: false,
        });
      } else {
        rawResponse = await generate(config, finalRequest, {
          signal,
          timeoutMs: attemptTimeoutMs(deadline, remainingMs(deadline)),
          onMetrics: metric => {
            const item = { attempt: 2, task: `${GRAPH_MUTATION_DRAFT_TASK}_repair`, ...metric };
            metrics.push(item);
            onMetrics?.(item);
          },
        });
        validation = validateGraphMutationDraft(rawResponse);
        attempts.push({
          task: `${GRAPH_MUTATION_DRAFT_TASK}_repair`,
          attempt: 2,
          status: draftValidationStatus(validation, validation.ok),
          validationErrors: validation.errors ?? [],
          rawResponsePreview: rawResponsePreview(rawResponse),
          repaired: validation.ok,
        });
      }
    }
  } catch (error) {
    const classification = classifyLocalModelError(error);
    return {
      ok: false,
      plannerPath: classification === "request_aborted" ? "aborted" : "deterministic_nlu_fallback",
      aborted: classification === "request_aborted",
      fallbackAllowed: classification !== "request_aborted",
      classification,
      fallbackReason: error instanceof Error ? error.message : String(error),
      attempts,
      metrics,
      request,
      graphHistoryLength: graphHistory?.length ?? 0,
      elapsedMs: Math.round(performance.now() - started),
    };
  }

  if (!validation?.ok) {
    return {
      ok: false,
      plannerPath: "deterministic_nlu_fallback",
      fallbackReason: validation?.message ?? "GraphMutationDraft validation failed.",
      validation,
      attempts,
      metrics,
      rawResponse,
      request: finalRequest,
      graphHistoryLength: graphHistory?.length ?? 0,
      elapsedMs: Math.round(performance.now() - started),
    };
  }

  return {
    ok: true,
    plannerPath: "model",
    draft: validation.data,
    validation,
    attempts,
    metrics,
    rawResponse,
    request: finalRequest,
    graphHistoryLength: graphHistory?.length ?? 0,
    elapsedMs: Math.round(performance.now() - started),
  };
}

function cleanModelSurface(value) {
  return String(value ?? "")
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .trim();
}

function referenceText(reference, selectedWord = "that") {
  const surface = cleanModelSurface(reference?.surfaceText);
  if (reference?.referenceKind === "selected" || reference?.referenceKind === "pronoun") {
    if (!surface || /^(that|this|it|one|selected|that hyperedge|this hyperedge|selected hyperedge|that vertex|this vertex|selected vertex)$/i.test(surface)) {
      return selectedWord;
    }
  }
  return surface;
}

function resolutionMessage(kind, reference, resolution) {
  const label = cleanModelSurface(reference?.surfaceText) || "that";
  if (resolution?.reason === "ambiguous_reference" && resolution.candidates?.length) {
    return `I found more than one ${kind} that could match "${label}": ${resolution.candidates.map(item => item.id).join(", ")}. Which one should I use?`;
  }
  if (resolution?.reason === "missing_reference") return `Which ${kind} should I use?`;
  if (reference?.referenceKind === "selected" || reference?.referenceKind === "pronoun") {
    return `I need you to select a ${kind} first, or name it explicitly.`;
  }
  return `I could not resolve ${kind} "${label}".`;
}

function resolveHyperedgeDraftReference(reference, hyperedges, selectedEntity, recentReferences = {}) {
  const resolved = resolveHyperedgeReference(referenceText(reference, "that"), hyperedges, selectedEntity, {
    recentIds: recentReferences.hyperedges ?? [],
  });
  return resolved.ok
    ? { ok: true, id: resolved.id, selectionFingerprint: resolved.selectionFingerprint ?? null }
    : { ok: false, message: resolutionMessage("hyperedge", reference, resolved), resolution: resolved };
}

function resolveVertexDraftReference(reference, hyperedges, selectedEntity, { allowNew = false, recentReferences = {} } = {}) {
  const surface = referenceText(reference, "that");
  if (allowNew && reference?.referenceKind === "literal") {
    if (!surface) return { ok: false, message: "Name the vertex." };
    return { ok: true, id: surface, selectionFingerprint: null, newLiteral: true };
  }
  const resolved = resolveVertexReference(surface, hyperedges, selectedEntity, {
    recentIds: recentReferences.vertices ?? [],
  });
  return resolved.ok
    ? { ok: true, id: resolved.id, selectionFingerprint: resolved.selectionFingerprint ?? null }
    : { ok: false, message: resolutionMessage("vertex", reference, resolved), resolution: resolved };
}

function policyForRemoveIncidence(operation, hyperedge, vertexId) {
  const rawPolicy = operation.emptyHyperedgePolicy ?? EMPTY_HYPEREDGE_POLICIES.ASK;
  if (rawPolicy !== EMPTY_HYPEREDGE_POLICIES.ASK) return { ok: true, policy: rawPolicy };
  const existingVertices = (hyperedge?.vertices ?? []).map(String);
  const wouldEmpty = existingVertices.includes(String(vertexId)) && existingVertices.length <= 1;
  if (wouldEmpty) {
    return {
      ok: false,
      message: `Removing "${vertexId}" would make hyperedge "${hyperedge.id}" empty. Should I remove the empty hyperedge or keep it?`,
    };
  }
  return { ok: true, policy: EMPTY_HYPEREDGE_POLICIES.REMOVE_EMPTY };
}

function policyForRemoveVertexGlobal(operation, hyperedges, vertexId) {
  const rawPolicy = operation.emptyHyperedgePolicy ?? EMPTY_HYPEREDGE_POLICIES.ASK;
  if (rawPolicy !== EMPTY_HYPEREDGE_POLICIES.ASK) return { ok: true, policy: rawPolicy };
  const empties = hyperedges.filter(hyperedge => (hyperedge.vertices ?? []).map(String).includes(String(vertexId)) && (hyperedge.vertices ?? []).length <= 1);
  if (empties.length) {
    return {
      ok: false,
      message: `Removing "${vertexId}" everywhere would empty ${empties.length} hyperedge${empties.length === 1 ? "" : "s"} (${empties.map(h => h.id).join(", ")}). Should I remove empty hyperedges or keep them?`,
    };
  }
  return { ok: true, policy: EMPTY_HYPEREDGE_POLICIES.REMOVE_EMPTY };
}

function requiredHyperedge(hyperedgeId, hyperedges) {
  return (hyperedges ?? []).find(hyperedge => String(hyperedge.id) === String(hyperedgeId));
}

function collectSelectionFingerprints(results) {
  const fingerprints = results
    .map(result => result?.selectionFingerprint)
    .filter(Boolean);
  return fingerprints.length ? fingerprints.join("|") : null;
}

function mutationSummary(operation) {
  switch (operation.type) {
    case GRAPH_MUTATION_OPS.ADD_HYPEREDGE:
      return `Create hyperedge "${operation.hyperedgeId}" with ${operation.vertices.length} vertices.`;
    case GRAPH_MUTATION_OPS.REMOVE_HYPEREDGE:
      return `Remove hyperedge "${operation.hyperedgeId}".`;
    case GRAPH_MUTATION_OPS.ADD_INCIDENCE:
      return `Add vertex "${operation.vertexId}" to hyperedge "${operation.hyperedgeId}".`;
    case GRAPH_MUTATION_OPS.REMOVE_INCIDENCE:
      return `Remove vertex "${operation.vertexId}" from hyperedge "${operation.hyperedgeId}".`;
    case GRAPH_MUTATION_OPS.RENAME_HYPEREDGE:
      return `Rename hyperedge "${operation.hyperedgeId}" to "${operation.newHyperedgeId}".`;
    case GRAPH_MUTATION_OPS.RENAME_VERTEX:
      return `Rename vertex "${operation.vertexId}" to "${operation.newVertexId}" everywhere.`;
    case GRAPH_MUTATION_OPS.REMOVE_VERTEX_GLOBAL:
      return `Remove vertex "${operation.vertexId}" from every hyperedge.`;
    case GRAPH_MUTATION_OPS.SET_HYPEREDGE_WEIGHT:
      return `Set hyperedge "${operation.hyperedgeId}" weight to ${operation.weight}.`;
    case GRAPH_MUTATION_OPS.SET_HYPEREDGE_TIME:
      return `Set hyperedge "${operation.hyperedgeId}" time.`;
    case GRAPH_MUTATION_OPS.SET_HYPEREDGE_ATTRIBUTE:
      return `Set attribute "${operation.key}" on hyperedge "${operation.hyperedgeId}".`;
    case GRAPH_MUTATION_OPS.REMOVE_HYPEREDGE_ATTRIBUTE:
      return `Remove attribute "${operation.key}" from hyperedge "${operation.hyperedgeId}".`;
    case GRAPH_MUTATION_OPS.CLEAR_GRAPH:
      return "Clear the committed graph.";
    case GRAPH_MUTATION_OPS.UNDO_LAST_MUTATION:
      return "Undo the last committed graph mutation.";
    default:
      return "Graph mutation.";
  }
}

export function resolveGraphMutationDraftToPlan({
  draft,
  hyperedges = [],
  graphIdentity = {},
  graphHistory = [],
  selectedEntity = null,
  pendingAction = null,
  recentReferences = {},
} = {}) {
  if (!draft || typeof draft !== "object") {
    return { ok: false, error: "GraphMutationDraft is missing." };
  }
  if (draft.classification === "not_mutation") {
    return { ok: false, noMatch: true, plannerPath: "model", draft };
  }
  if (draft.classification === "clarification") {
    return {
      ok: false,
      needsClarification: true,
      message: draft.clarificationQuestion || "I need one more detail before preparing that graph edit.",
      plannerPath: "model",
      draft,
    };
  }
  if (draft.classification === "unsupported") {
    return {
      ok: false,
      needsClarification: true,
      unsupported: true,
      message: draft.clarificationQuestion || draft.acknowledgement || "That graph edit is outside the supported mutation operations.",
      plannerPath: "model",
      draft,
    };
  }

  const index = buildGraphEntityIndex(hyperedges);
  const operations = [];
  const resolutionDetails = [];
  const selectionResolutions = [];

  for (const [draftIndex, operation] of draft.operations.entries()) {
    if (operation.type === GRAPH_MUTATION_OPS.ADD_HYPEREDGE) {
      const hyperedgeId = cleanModelSurface(operation.newHyperedgeId);
      if (!hyperedgeId) return targetedClarification("Name the new hyperedge ID.", draft);
      if (index.hyperedgesById.has(hyperedgeId)) return targetedClarification(`Hyperedge "${hyperedgeId}" already exists. Use a different ID or add vertices to the existing hyperedge.`, draft);
      const vertexResults = [];
      const vertices = [];
      for (const vertexReference of operation.vertexReferences ?? []) {
        const resolved = resolveVertexDraftReference(vertexReference, hyperedges, selectedEntity, { allowNew: vertexReference.referenceKind === "literal", recentReferences });
        vertexResults.push(resolved);
        if (!resolved.ok) return targetedClarification(resolved.message, draft, { draftIndex });
        vertices.push(resolved.id);
      }
      operations.push({ type: GRAPH_MUTATION_OPS.ADD_HYPEREDGE, hyperedgeId, vertices });
      resolutionDetails.push({ draftIndex, type: operation.type, hyperedgeId, vertices });
      selectionResolutions.push(...vertexResults);
      continue;
    }

    if (operation.type === GRAPH_MUTATION_OPS.REMOVE_HYPEREDGE) {
      const hyperedge = resolveHyperedgeDraftReference(operation.hyperedgeReference, hyperedges, selectedEntity, recentReferences);
      if (!hyperedge.ok) return targetedClarification(hyperedge.message, draft, { draftIndex });
      operations.push({ type: GRAPH_MUTATION_OPS.REMOVE_HYPEREDGE, hyperedgeId: hyperedge.id });
      resolutionDetails.push({ draftIndex, type: operation.type, hyperedgeId: hyperedge.id });
      selectionResolutions.push(hyperedge);
      continue;
    }

    if (operation.type === GRAPH_MUTATION_OPS.ADD_INCIDENCE) {
      const hyperedge = resolveHyperedgeDraftReference(operation.hyperedgeReference, hyperedges, selectedEntity, recentReferences);
      if (!hyperedge.ok) return targetedClarification(hyperedge.message, draft, { draftIndex });
      const vertex = resolveVertexDraftReference(operation.vertexReference, hyperedges, selectedEntity, { allowNew: operation.vertexReference.referenceKind === "literal", recentReferences });
      if (!vertex.ok) return targetedClarification(vertex.message, draft, { draftIndex });
      operations.push({ type: GRAPH_MUTATION_OPS.ADD_INCIDENCE, hyperedgeId: hyperedge.id, vertexId: vertex.id });
      resolutionDetails.push({ draftIndex, type: operation.type, hyperedgeId: hyperedge.id, vertexId: vertex.id });
      selectionResolutions.push(hyperedge, vertex);
      continue;
    }

    if (operation.type === GRAPH_MUTATION_OPS.REMOVE_INCIDENCE) {
      const hyperedge = resolveHyperedgeDraftReference(operation.hyperedgeReference, hyperedges, selectedEntity, recentReferences);
      if (!hyperedge.ok) return targetedClarification(hyperedge.message, draft, { draftIndex });
      const vertex = resolveVertexDraftReference(operation.vertexReference, hyperedges, selectedEntity, { recentReferences });
      if (!vertex.ok) return targetedClarification(vertex.message, draft, { draftIndex });
      const target = requiredHyperedge(hyperedge.id, hyperedges);
      if (!target?.vertices?.map(String).includes(vertex.id)) {
        return targetedClarification(`Vertex "${vertex.id}" is not in hyperedge "${hyperedge.id}".`, draft, { draftIndex });
      }
      const policy = policyForRemoveIncidence(operation, target, vertex.id);
      if (!policy.ok) return targetedClarification(policy.message, draft, { draftIndex });
      operations.push({ type: GRAPH_MUTATION_OPS.REMOVE_INCIDENCE, hyperedgeId: hyperedge.id, vertexId: vertex.id, emptyHyperedgePolicy: policy.policy });
      resolutionDetails.push({ draftIndex, type: operation.type, hyperedgeId: hyperedge.id, vertexId: vertex.id, emptyHyperedgePolicy: policy.policy });
      selectionResolutions.push(hyperedge, vertex);
      continue;
    }

    if (operation.type === GRAPH_MUTATION_OPS.RENAME_HYPEREDGE) {
      const hyperedge = resolveHyperedgeDraftReference(operation.hyperedgeReference, hyperedges, selectedEntity, recentReferences);
      if (!hyperedge.ok) return targetedClarification(hyperedge.message, draft, { draftIndex });
      const newHyperedgeId = cleanModelSurface(operation.newHyperedgeId);
      if (!newHyperedgeId) return targetedClarification("Give the new hyperedge ID.", draft, { draftIndex });
      operations.push({ type: GRAPH_MUTATION_OPS.RENAME_HYPEREDGE, hyperedgeId: hyperedge.id, newHyperedgeId });
      resolutionDetails.push({ draftIndex, type: operation.type, hyperedgeId: hyperedge.id, newHyperedgeId });
      selectionResolutions.push(hyperedge);
      continue;
    }

    if (operation.type === GRAPH_MUTATION_OPS.RENAME_VERTEX) {
      const vertex = resolveVertexDraftReference(operation.vertexReference, hyperedges, selectedEntity, { recentReferences });
      if (!vertex.ok) return targetedClarification(vertex.message, draft, { draftIndex });
      const newVertexId = cleanModelSurface(operation.newVertexId);
      if (!newVertexId) return targetedClarification("Give the new vertex ID.", draft, { draftIndex });
      operations.push({ type: GRAPH_MUTATION_OPS.RENAME_VERTEX, vertexId: vertex.id, newVertexId });
      resolutionDetails.push({ draftIndex, type: operation.type, vertexId: vertex.id, newVertexId });
      selectionResolutions.push(vertex);
      continue;
    }

    if (operation.type === GRAPH_MUTATION_OPS.REMOVE_VERTEX_GLOBAL) {
      const vertex = resolveVertexDraftReference(operation.vertexReference, hyperedges, selectedEntity, { recentReferences });
      if (!vertex.ok) return targetedClarification(vertex.message, draft, { draftIndex });
      const policy = policyForRemoveVertexGlobal(operation, hyperedges, vertex.id);
      if (!policy.ok) return targetedClarification(policy.message, draft, { draftIndex });
      operations.push({ type: GRAPH_MUTATION_OPS.REMOVE_VERTEX_GLOBAL, vertexId: vertex.id, emptyHyperedgePolicy: policy.policy });
      resolutionDetails.push({ draftIndex, type: operation.type, vertexId: vertex.id, emptyHyperedgePolicy: policy.policy });
      selectionResolutions.push(vertex);
      continue;
    }

    if (operation.type === GRAPH_MUTATION_OPS.SET_HYPEREDGE_WEIGHT) {
      const hyperedge = resolveHyperedgeDraftReference(operation.hyperedgeReference, hyperedges, selectedEntity, recentReferences);
      if (!hyperedge.ok) return targetedClarification(hyperedge.message, draft, { draftIndex });
      operations.push({ type: GRAPH_MUTATION_OPS.SET_HYPEREDGE_WEIGHT, hyperedgeId: hyperedge.id, weight: Number(operation.weight) });
      resolutionDetails.push({ draftIndex, type: operation.type, hyperedgeId: hyperedge.id, weight: Number(operation.weight) });
      selectionResolutions.push(hyperedge);
      continue;
    }

    if (operation.type === GRAPH_MUTATION_OPS.SET_HYPEREDGE_TIME) {
      const hyperedge = resolveHyperedgeDraftReference(operation.hyperedgeReference, hyperedges, selectedEntity, recentReferences);
      if (!hyperedge.ok) return targetedClarification(hyperedge.message, draft, { draftIndex });
      operations.push({ type: GRAPH_MUTATION_OPS.SET_HYPEREDGE_TIME, hyperedgeId: hyperedge.id, time: operation.time ?? null });
      resolutionDetails.push({ draftIndex, type: operation.type, hyperedgeId: hyperedge.id });
      selectionResolutions.push(hyperedge);
      continue;
    }

    if (operation.type === GRAPH_MUTATION_OPS.SET_HYPEREDGE_ATTRIBUTE) {
      const hyperedge = resolveHyperedgeDraftReference(operation.hyperedgeReference, hyperedges, selectedEntity, recentReferences);
      if (!hyperedge.ok) return targetedClarification(hyperedge.message, draft, { draftIndex });
      const key = cleanModelSurface(operation.key);
      if (PROTOTYPE_POLLUTION_KEYS.has(key)) return targetedClarification(`Attribute key "${key}" is blocked.`, draft, { draftIndex });
      operations.push({ type: GRAPH_MUTATION_OPS.SET_HYPEREDGE_ATTRIBUTE, hyperedgeId: hyperedge.id, key, value: operation.value });
      resolutionDetails.push({ draftIndex, type: operation.type, hyperedgeId: hyperedge.id, key });
      selectionResolutions.push(hyperedge);
      continue;
    }

    if (operation.type === GRAPH_MUTATION_OPS.REMOVE_HYPEREDGE_ATTRIBUTE) {
      const hyperedge = resolveHyperedgeDraftReference(operation.hyperedgeReference, hyperedges, selectedEntity, recentReferences);
      if (!hyperedge.ok) return targetedClarification(hyperedge.message, draft, { draftIndex });
      const key = cleanModelSurface(operation.key);
      if (PROTOTYPE_POLLUTION_KEYS.has(key)) return targetedClarification(`Attribute key "${key}" is blocked.`, draft, { draftIndex });
      operations.push({ type: GRAPH_MUTATION_OPS.REMOVE_HYPEREDGE_ATTRIBUTE, hyperedgeId: hyperedge.id, key });
      resolutionDetails.push({ draftIndex, type: operation.type, hyperedgeId: hyperedge.id, key });
      selectionResolutions.push(hyperedge);
      continue;
    }

    if (operation.type === GRAPH_MUTATION_OPS.CLEAR_GRAPH) {
      if (!hyperedges.length) return targetedClarification("No graph is loaded, so there is nothing to clear.", draft, { draftIndex });
      operations.push({ type: GRAPH_MUTATION_OPS.CLEAR_GRAPH });
      resolutionDetails.push({ draftIndex, type: operation.type });
      continue;
    }

    if (operation.type === GRAPH_MUTATION_OPS.UNDO_LAST_MUTATION) {
      if (!graphHistory.length) return targetedClarification("There is no committed graph mutation in history to undo yet.", draft, { draftIndex });
      operations.push({ type: GRAPH_MUTATION_OPS.UNDO_LAST_MUTATION });
      resolutionDetails.push({ draftIndex, type: operation.type });
    }
  }

  if (!operations.length) {
    return targetedClarification("I understood this as a graph edit, but I need one supported operation before preparing it.", draft);
  }

  const summary = operations.length === 1
    ? mutationSummary(operations[0])
    : `Prepare ${operations.length} graph mutation operations.`;
  const plan = createMutationPlan({
    operations,
    source: "conversation_model_planner",
    summary,
    graphIdentity,
    metadata: {
      rawText: draft.intentSummary,
      plannerPath: "model",
      modelTask: GRAPH_MUTATION_DRAFT_TASK,
      draftClassification: draft.classification,
      draftConfidence: draft.confidence,
      previewOnly: Boolean(draft.previewOnly),
      acknowledgement: draft.acknowledgement,
      pendingPlanReplaced: Boolean(pendingAction?.actionType === "apply_graph_mutation" && draft.correction?.replacePendingPlan),
      selectionFingerprint: collectSelectionFingerprints(selectionResolutions) ?? selectionFingerprint(selectedEntity),
      resolutionDetails,
    },
  });
  return {
    ok: true,
    plannerPath: "model",
    plan,
    draft,
    summary,
    resolutionStatus: "resolved",
  };
}

function targetedClarification(message, draft, extra = {}) {
  return {
    ok: false,
    needsClarification: true,
    message,
    plannerPath: "model",
    draft,
    resolutionStatus: "clarification",
    ...extra,
  };
}
