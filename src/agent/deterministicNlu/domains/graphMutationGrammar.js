import { buildGraphEntityIndex, resolveHyperedgeReference, resolveVertexReference, selectionFingerprint } from "../../../graph/entityResolver.js";
import { EMPTY_HYPEREDGE_POLICIES, GRAPH_MUTATION_OPS } from "../../../graph/graphMutationSchema.js";
import { createMutationPlan } from "../../../graph/graphMutationValidator.js";
import { GRAPH_MUTATION_DRAFT_TASK } from "../../graphMutationDraftSchema.js";
import {
  isQuotedGraphIdentifier,
  normalizeGraphEntityReference,
  splitGraphEntityList,
  validateGraphOperationIdentifiers,
} from "./graphIdentifierNormalizer.js";

const NO_MATCH = Object.freeze({ ok: false, noMatch: true });

const TRAILING_CONVERSATIONAL_MODIFIERS = [
  "and remove empty hyperedge",
  "and delete empty hyperedge",
  "and drop empty hyperedge",
  "and keep empty hyperedge",
  "remove empty hyperedge",
  "delete empty hyperedge",
  "drop empty hyperedge",
  "keep empty hyperedge",
  "as well",
  "this time",
  "again",
  "instead",
  "too",
  "please",
  "now",
];

export function looksLikeGraphMutationRequest(text = "") {
  const q = String(text ?? "").toLowerCase();
  if (!q.trim()) return false;
  if (/\bwhat\s+(?:is|are)\b.*\b(?:hyperedge|vertex|graph|incidence)\b/.test(q)) return false;
  if (/\b(export|download|show stats|visuali[sz]e|route|tab|upload|parse)\b/.test(q) && !/\b(add|remove|delete|rename|undo|clear|set|change|detach|connect)\b/.test(q)) return false;
  if (/\bwhat would happen if\b/.test(q) && !/\bpreview|show impact|without applying\b/.test(q)) return false;
  if (/\b(?:remove|delete)\s+all\s+hyperedges\b/.test(q)) return true;
  if (/\b(?:add|include|put|insert)\b[\s\S]{1,120}\b(?:to|in|into|inside|within)\b/.test(q)) return true;
  if (/\b(?:take|remove|delete|detach)\b[\s\S]{1,120}\b(?:from|out of)\b/.test(q)) return true;
  return /\b(add|create|remove|delete|rename|undo|clear|set|change|include|put|insert|detach|connect|needs|belongs|belong|should|make|call|take)\b/.test(q)
    && (/\b(graph|hyperedge|edge|group|vertex|incidence|weight|time|attribute|attr|everywhere|last mutation|previous mutation|mutation|that|selected)\b/.test(q)
      || /\b(?:to|from|of|in|into|inside|within)\s+h[\w.-]*\b/.test(q)
      || /\b(?:to|from|of|in|into|inside|within)\s+["'`]/.test(q)
      || /\bh[\w.-]*\s+(?:to|as|needs|should|include|contain|have)\b/.test(q));
}

export function compileGraphMutationGrammar(text = "", {
  nlu = null,
  hyperedges = null,
  graphIdentity = {},
  graphHistory = [],
  selectedEntity = null,
  recentReferences = {},
  pendingAction = null,
} = {}) {
  const originalRaw = String(text ?? "").trim();
  const raw = stripActionPreamble(originalRaw);
  if (!raw || !looksLikeGraphMutationRequest(raw)) return NO_MATCH;
  if (nlu?.primaryDomain && nlu.primaryDomain !== "graph_mutation" && !/\bh[A-Za-z0-9_.:-]*\b/i.test(raw)) return NO_MATCH;

  if (!Array.isArray(hyperedges)) {
    return {
      ok: true,
      needsResolution: true,
      domain: "graph_mutation",
      intent: graphIntent(raw),
      typedKind: "GraphMutationDraft",
      diagnostics: diagnostics(nlu, graphIntent(raw)),
    };
  }

  return compileResolvedGraphMutation(raw, {
    nlu,
    hyperedges,
    graphIdentity,
    graphHistory,
    selectedEntity,
    recentReferences,
    pendingAction,
  });
}

function compileResolvedGraphMutation(raw, {
  nlu,
  hyperedges,
  graphIdentity,
  graphHistory,
  selectedEntity,
  recentReferences,
  pendingAction,
}) {
  const q = raw.toLowerCase();
  const index = buildGraphEntityIndex(hyperedges);
  const metadata = {
    rawText: raw,
    selectionFingerprint: selectionFingerprint(selectedEntity),
    authoritativeCompiler: "graph_mutation_v1",
    legacyParserCalled: false,
  };
  const common = { nlu, hyperedges, graphIdentity, selectedEntity, recentReferences, metadata };

  if (pendingAction?.actionType === "apply_graph_mutation") {
    const correction = compilePendingCorrection(raw, pendingAction, common);
    if (correction.ok || correction.needsClarification || correction.noMatch === false) return correction;
  }

  const compound = raw.match(/^(.+?)\s+and\s+((?:add|include|put|insert|remove|delete|take|detach|rename|set|change)\b.+)$/i);
  if (compound) {
    const left = compileResolvedGraphMutation(compound[1].trim(), { nlu, hyperedges, graphIdentity, graphHistory, selectedEntity, recentReferences, pendingAction: null });
    const right = compileResolvedGraphMutation(compound[2].trim(), { nlu, hyperedges, graphIdentity, graphHistory, selectedEntity, recentReferences, pendingAction: null });
    if (left?.ok && right?.ok && left.plan?.operations?.length && right.plan?.operations?.length) {
      return planResult({
        operations: [...left.plan.operations, ...right.plan.operations],
        summary: `${left.plan.summary} ${right.plan.summary}`,
        intent: "compound_graph_mutation",
        graphIdentity,
        metadata,
        nlu,
      });
    }
  }

  const earlyGlobalRemoval = raw.match(/\b(?:remove|delete)\s+(?:vertex\s+)?(.+?)\s+(?:everywhere|globally|from\s+(?:the\s+)?(?:entire\s+)?graph|from\s+(?:the\s+)?(?:entire\s+)?hypergraph)\s*[.?!]?$/i);
  if (earlyGlobalRemoval) {
    const vertexRef = normalizeGraphEntityReference(earlyGlobalRemoval[1], { kind: "vertex" });
    const resolvedVertex = resolveVertexReference(vertexRef, hyperedges, selectedEntity, { recentIds: recentReferences.vertices ?? [] });
    if (!resolvedVertex.ok) return clarification(resolvedVertex.error ?? `I could not resolve vertex "${vertexRef}".`, nlu, "remove_vertex_global");
    const empties = hyperedges.filter(h => (h.vertices ?? []).map(String).includes(resolvedVertex.id) && (h.vertices ?? []).length <= 1);
    if (empties.length && !/\b(?:remove|delete|drop|keep)\s+(?:the\s+)?empty\b/i.test(raw)) {
      return clarification(`Removing "${resolvedVertex.id}" everywhere would empty ${empties.length} hyperedge${empties.length === 1 ? "" : "s"} (${empties.map(h => h.id).join(", ")}). Tell me whether to remove empty hyperedges or keep them.`, nlu, "remove_vertex_global");
    }
    return planResult({
      operations: [{ type: GRAPH_MUTATION_OPS.REMOVE_VERTEX_GLOBAL, vertexId: resolvedVertex.id, emptyHyperedgePolicy: emptyPolicy(raw) }],
      summary: `Remove vertex "${resolvedVertex.id}" from every hyperedge.`,
      intent: "remove_vertex_global",
      graphIdentity,
      metadata,
      nlu,
      correction: correctionFlags(raw, pendingAction),
    });
  }

  if (/\bundo\b|\brevert\b/.test(q) && /\b(last|previous|mutation|change|edit)\b/.test(q)) {
    if (!graphHistory.length) return clarification("There is no committed graph mutation in history to undo yet.", nlu, "undo_last_mutation");
    return planResult({
      operations: [{ type: GRAPH_MUTATION_OPS.UNDO_LAST_MUTATION }],
      summary: "Undo the last committed graph mutation.",
      intent: "undo_last_mutation",
      graphIdentity,
      metadata,
      nlu,
    });
  }

  if (/\bclear\b/.test(q) && /\b(graph|hypergraph|current graph)\b/.test(q)) {
    if (!hyperedges.length) return clarification("No graph is loaded, so there is nothing to clear.", nlu, "clear_graph");
    return planResult({
      operations: [{ type: GRAPH_MUTATION_OPS.CLEAR_GRAPH }],
      summary: "Clear the committed graph.",
      intent: "clear_graph",
      graphIdentity,
      metadata,
      nlu,
    });
  }

  if (/\b(?:remove|delete)\s+all\s+hyperedges\b/i.test(raw)) {
    if (!hyperedges.length) return clarification("No graph is loaded, so there are no hyperedges to remove.", nlu, "clear_graph");
    return planResult({
      operations: [{ type: GRAPH_MUTATION_OPS.CLEAR_GRAPH }],
      summary: "Clear every hyperedge from the committed graph.",
      intent: "clear_graph",
      graphIdentity,
      metadata,
      nlu,
    });
  }

  const standaloneVertex = raw.match(/\b(?:add|create)\s+(?:a\s+)?(?:new\s+)?vertex(?:\s+(?:called|named))?\s+(.+)$/i);
  if (standaloneVertex && !/\b(to|in|into|inside|within)\b/i.test(raw)) {
    const vertex = normalizeGraphEntityReference(standaloneVertex[1], { kind: "vertex" });
    return clarification(`A standalone vertex is ambiguous in this app because the canonical graph stores vertices through hyperedge membership. Tell me which hyperedge should contain "${vertex}", for example: "add ${vertex} to h2".`, nlu, "add_vertex_needs_hyperedge");
  }

  const addHyperedge = raw.match(/\b(?:add|create|make)\s+(?:a\s+)?(?:new\s+)?(?:hyperedge|edge|group)\s+(?:called\s+|named\s+)?([^:,]+?)(?:\s*(?:with|containing|that contains|:)\s*(.+))?$/i);
  if (addHyperedge) {
    const hyperedgeId = normalizeGraphEntityReference(addHyperedge[1], { kind: "hyperedge" });
    const vertices = splitGraphEntityList(addHyperedge[2] ?? "", { kind: "vertex" });
    if (!hyperedgeId) return clarification("Name the new hyperedge ID.", nlu, "add_hyperedge");
    if (!vertices.length) return clarification(`Which vertices should hyperedge "${hyperedgeId}" contain?`, nlu, "add_hyperedge");
    if (index.hyperedgesById.has(hyperedgeId)) return clarification(`Hyperedge "${hyperedgeId}" already exists. Use a different ID or ask me to add vertices to it.`, nlu, "add_hyperedge");
    return planResult({
      operations: [{ type: GRAPH_MUTATION_OPS.ADD_HYPEREDGE, hyperedgeId, vertices }],
      summary: `Create hyperedge "${hyperedgeId}" with ${vertices.length} vertices.`,
      intent: "add_hyperedge",
      graphIdentity,
      metadata,
      nlu,
    });
  }

  const weight = compileWeight(raw, common);
  if (weight) return weight;
  const time = compileTime(raw, common);
  if (time) return time;
  const attr = compileAttribute(raw, common);
  if (attr) return attr;

  const addPatterns = [
    { match: raw.match(/\b(?:add|include|put|insert)\s+(?:vertex\s+)?(.+?)\s+(?:to|in|into|inside|within)\s+(?:the\s+)?(?:selected\s+)?(?:hyperedge|edge)?\s*(.+)$/i), vertex: 1, hyperedge: 2 },
    { match: raw.match(/^(?:again,\s*|now\s+|this time,\s*|please\s+|could you\s+|would you please\s+|make sure\s+)?(?:the\s+)?(?:selected\s+)?(?:hyperedge|edge)?\s*(.+?)\s+needs\s+(?:vertex\s+)?(.+?)(?:\s+(?:again|too|as well|please|now|this time))?$/i), vertex: 2, hyperedge: 1 },
    { match: raw.match(/^(?:again,\s*|now\s+|this time,\s*|please\s+|could you\s+|would you please\s+|make sure\s+)?(?:the\s+)?(?:selected\s+)?(?:hyperedge|edge)?\s*(.+?)\s+should\s+(?:also\s+)?(?:include|contain|have)\s+(?:vertex\s+)?(.+?)(?:\s+(?:again|too|as well|please|now|this time))?$/i), vertex: 2, hyperedge: 1 },
    { match: raw.match(/^(?:again,\s*|now\s+|this time,\s*|please\s+|could you\s+|would you please\s+|make sure\s+)?(?:vertex\s+)?(.+?)\s+(?:belongs\s+to|should\s+be\s+in|should\s+belong\s+to|is\s+part\s+of)\s+(?:the\s+)?(?:selected\s+)?(?:hyperedge|edge)?\s*(.+?)(?:\s+(?:again|too|as well|please|now|this time))?$/i), vertex: 1, hyperedge: 2 },
    { match: raw.match(/\b(?:make|connect)\s+(?:vertex\s+)?(.+?)\s+(?:part\s+of|to)\s+(?:the\s+)?(?:selected\s+)?(?:hyperedge|edge)?\s*(.+?)(?:\s+(?:again|too|as well|please|now|this time))?$/i), vertex: 1, hyperedge: 2 },
  ];
  for (const item of addPatterns) {
    if (!item.match) continue;
    const hyperedgeCapture = item.match[item.hyperedge];
    return addIncidencePlan({
      vertexIds: splitVertexCapture(item.match[item.vertex], hyperedges, selectedEntity),
      hyperedgeRef: selectedHyperedgeRequested(raw, hyperedgeCapture)
        ? "selected"
        : normalizeReferenceCapture(hyperedgeCapture, "hyperedge", hyperedges, selectedEntity) || "that",
      graphIdentity,
      nlu,
      ...common,
    });
  }

  const removeFromSelected = raw.match(/\b(?:remove|delete|take|detach)\s+(?:vertex\s+)?(.+?)\s+(?:from|out\s+of)\s+(?:the\s+)?selected\s+(?:hyperedge|edge)(?:\s+and\s+(?:keep|remove|delete|drop)\s+(?:the\s+)?empty\s+hyperedge)?\s*[.?!]?$/i);
  if (removeFromSelected) {
    return removeIncidencePlan({
      vertexRef: normalizeGraphEntityReference(removeFromSelected[1], { kind: "vertex" }),
      hyperedgeRef: "selected",
      raw,
      nlu,
      ...common,
    });
  }

  const removePatterns = [
    raw.match(/\b(?:remove|delete)\s+(?:vertex\s+)?(.+?)\s+from\s+(?:the\s+)?(?:selected\s+)?(?:hyperedge|edge)?\s*(.+?)(?=\s+and\s+(?:keep|remove|delete|drop)\s+(?:the\s+)?empty\s+hyperedge|$)/i),
    raw.match(/\b(?:take|detach)\s+(?:vertex\s+)?(.+?)\s+(?:out\s+of|from)\s+(?:the\s+)?(?:selected\s+)?(?:hyperedge|edge)?\s*(.+?)(?=,?\s+but\b|$)/i),
    raw.match(/^(?:vertex\s+)?(.+?)\s+should\s+no\s+longer\s+(?:belong\s+to|be\s+in)\s+(?:the\s+)?(?:selected\s+)?(?:hyperedge|edge)?\s*(.+)$/i),
  ];
  for (const match of removePatterns) {
    if (!match) continue;
    return removeIncidencePlan({
      vertexRef: normalizeGraphEntityReference(match[1], { kind: "vertex" }),
      hyperedgeRef: normalizeReferenceCapture(match[2], "hyperedge", hyperedges, selectedEntity) || "that",
      raw,
      nlu,
      ...common,
    });
  }

  const removeVertexGlobal = raw.match(/\b(?:remove|delete)\s+(?:vertex\s+)?(.+?)\s+(?:everywhere|globally|from\s+(?:the\s+)?(?:entire\s+)?graph|from\s+(?:the\s+)?(?:entire\s+)?hypergraph)\s*[.?!]?$/i);
  if (removeVertexGlobal) {
    const vertexRef = normalizeGraphEntityReference(removeVertexGlobal[1], { kind: "vertex" });
    const resolvedVertex = resolveVertexReference(vertexRef, hyperedges, selectedEntity, { recentIds: recentReferences.vertices ?? [] });
    if (!resolvedVertex.ok) return clarification(resolvedVertex.error ?? `I could not resolve vertex "${vertexRef}".`, nlu, "remove_vertex_global");
    const empties = hyperedges.filter(h => (h.vertices ?? []).map(String).includes(resolvedVertex.id) && (h.vertices ?? []).length <= 1);
    if (empties.length && !/\b(?:remove|delete|drop|keep)\s+(?:the\s+)?empty\b/i.test(raw)) {
      return clarification(`Removing "${resolvedVertex.id}" everywhere would empty ${empties.length} hyperedge${empties.length === 1 ? "" : "s"} (${empties.map(h => h.id).join(", ")}). Tell me whether to remove empty hyperedges or keep them.`, nlu, "remove_vertex_global");
    }
    return planResult({
      operations: [{ type: GRAPH_MUTATION_OPS.REMOVE_VERTEX_GLOBAL, vertexId: resolvedVertex.id, emptyHyperedgePolicy: emptyPolicy(raw) }],
      summary: `Remove vertex "${resolvedVertex.id}" from every hyperedge.`,
      intent: "remove_vertex_global",
      graphIdentity,
      metadata,
      nlu,
      correction: correctionFlags(raw, pendingAction),
    });
  }

  const rename = compileRename(raw, common);
  if (rename) return rename;

  if (/\b(?:remove|delete)\s+(?:the\s+)?selected\s+(?:hyperedge|edge)(?:\s+the other one)?\s*[.?!]?$/i.test(raw)) {
    const resolved = resolveHyperedgeReference("selected", hyperedges, selectedEntity, { recentIds: recentReferences.hyperedges ?? [] });
    if (!resolved.ok) return clarification(resolved.error ?? "I could not resolve the selected hyperedge.", nlu, "remove_hyperedge");
    return planResult({
      operations: [{ type: GRAPH_MUTATION_OPS.REMOVE_HYPEREDGE, hyperedgeId: resolved.id }],
      summary: `Remove hyperedge "${resolved.id}".`,
      intent: "remove_hyperedge",
      graphIdentity,
      metadata,
      nlu,
    });
  }

  const removeHyperedge = raw.match(/\b(?:remove|delete)\s+(?:the\s+)?(?:selected\s+)?(?:hyperedge|edge)\s*(.+)$/i);
  if (removeHyperedge) {
    const ref = normalizeReferenceCapture(removeHyperedge[1], "hyperedge", hyperedges, selectedEntity) || "that";
    const resolved = resolveHyperedgeReference(ref, hyperedges, selectedEntity, { recentIds: recentReferences.hyperedges ?? [] });
    if (!resolved.ok) return clarification(resolved.error ?? `I could not resolve hyperedge "${ref}".`, nlu, "remove_hyperedge");
    return planResult({
      operations: [{ type: GRAPH_MUTATION_OPS.REMOVE_HYPEREDGE, hyperedgeId: resolved.id }],
      summary: `Remove hyperedge "${resolved.id}".`,
      intent: "remove_hyperedge",
      graphIdentity,
      metadata,
      nlu,
    });
  }

  return NO_MATCH;
}

function compilePendingCorrection(raw, pendingAction, common) {
  if (/\b(never mind|cancel)\b/i.test(raw)) {
    return { ok: false, needsClarification: true, message: "I can cancel the pending graph edit if you confirm cancellation.", draft: graphDraft({ classification: "clarification", intentSummary: raw, confidence: "medium", correction: { isCorrection: true, replacePendingPlan: true } }), diagnostics: diagnostics(common.nlu, "cancel_pending_graph_mutation") };
  }
  const previous = pendingAction?.plan?.operations?.[0] ?? null;
  if (!previous) return NO_MATCH;
  const onlyFrom = raw.match(/\b(?:no,?\s*)?(?:actually,?\s*)?(?:only|just)\s+(?:remove\s+)?(?:it|that|them|[A-Za-z0-9_.:-]+)?\s*(?:from|out\s+of)\s+(?:hyperedge\s+)?(.+)$/i);
  if (onlyFrom && [GRAPH_MUTATION_OPS.REMOVE_VERTEX_GLOBAL, GRAPH_MUTATION_OPS.REMOVE_INCIDENCE].includes(previous.type)) {
    const vertexRef = previous.vertexId;
    return removeIncidencePlan({
      vertexRef,
      hyperedgeRef: normalizeGraphEntityReference(onlyFrom[1], { kind: "hyperedge" }),
      raw,
      correction: { isCorrection: true, replacePendingPlan: true },
      ...common,
    });
  }
  const meantHyperedge = raw.match(/\b(?:no,?\s*)?(?:actually,?\s*)?i meant\s+(h[A-Za-z0-9_.:-]+|[^.]+)$/i);
  if (meantHyperedge && previous.type === GRAPH_MUTATION_OPS.RENAME_HYPEREDGE) {
    const hyperedgeId = normalizeGraphEntityReference(meantHyperedge[1], { kind: "hyperedge" });
    return planResult({
      operations: [{ ...previous, hyperedgeId }],
      summary: `Revise the pending rename to target "${hyperedgeId}".`,
      intent: "correction",
      graphIdentity: common.graphIdentity,
      metadata: common.metadata,
      nlu: common.nlu,
      correction: { isCorrection: true, replacePendingPlan: true },
    });
  }
  return NO_MATCH;
}

function compileRename(raw, common) {
  const renameMatch = raw.match(/\b(?:rename|change)\s+(?:the\s+)?(?:(hyperedge|edge|vertex)\s+)?(.+?)\s+(?:to|as)\s+(.+)$/i);
  const callMatch = raw.match(/\bcall\s+(?:the\s+)?(?:(hyperedge|edge|vertex)\s+)?(.+?)\s+(.+?)(?:\s+instead)?$/i);
  const match = renameMatch ?? callMatch;
  if (!match) return null;
  const kind = (match[1] ?? "").toLowerCase();
  const fromKind = kind === "vertex" ? "vertex" : kind === "hyperedge" || kind === "edge" ? "hyperedge" : "entity";
  const from = normalizeGraphEntityReference(match[2], { kind: fromKind });
  const toKind = kind === "vertex" ? "vertex" : kind === "hyperedge" || kind === "edge" ? "hyperedge" : "entity";
  const to = cleanNewIdentifier(match[3], toKind);
  if (!from || !to) return clarification("Give both the current ID/name and the new ID/name.", common.nlu, "rename");
  const asHyperedge = kind === "hyperedge" || kind === "edge" || !kind;
  if (asHyperedge) {
    const resolved = resolveHyperedgeReference(from, common.hyperedges, common.selectedEntity, { recentIds: common.recentReferences.hyperedges ?? [] });
    if (resolved.ok) {
      return planResult({
        operations: [{ type: GRAPH_MUTATION_OPS.RENAME_HYPEREDGE, hyperedgeId: resolved.id, newHyperedgeId: to }],
        summary: `Rename hyperedge "${resolved.id}" to "${to}".`,
        intent: "rename_hyperedge",
        graphIdentity: common.graphIdentity,
        metadata: common.metadata,
        nlu: common.nlu,
      });
    }
    if (kind) return clarification(resolved.error ?? `I could not resolve hyperedge "${from}".`, common.nlu, "rename_hyperedge");
  }
  const resolvedVertex = resolveVertexReference(from, common.hyperedges, common.selectedEntity, { recentIds: common.recentReferences.vertices ?? [] });
  if (resolvedVertex.ok) {
    return planResult({
      operations: [{ type: GRAPH_MUTATION_OPS.RENAME_VERTEX, vertexId: resolvedVertex.id, newVertexId: to }],
      summary: `Rename vertex "${resolvedVertex.id}" to "${to}" everywhere.`,
      intent: "rename_vertex",
      graphIdentity: common.graphIdentity,
      metadata: common.metadata,
      nlu: common.nlu,
    });
  }
  return clarification(`I could not resolve "${from}" as a unique hyperedge or vertex.`, common.nlu, "rename");
}

function compileWeight(raw, common) {
  const match = raw.match(/\b(?:set|change)\s+(?:the\s+)?weight\s+(?:of|for|on)\s+(?:the\s+)?(?:selected\s+)?(?:hyperedge|edge)?\s*(.+?)\s+(?:to|=)\s+([-+]?\d+(?:\.\d+)?)\b/i)
    ?? raw.match(/\b(?:set|change|make)\s+(?:the\s+)?(?:weight\s+of\s+(.+?)|(.+?)['’]s\s+weight)\s+(?:to\s+)?([-+]?\d+(?:\.\d+)?)\b/i);
  if (!match) return null;
  const ref = match[1] ?? match[2];
  const weight = Number(match[3] ?? match[2]);
  const resolved = resolveHyperedgeReference(normalizeReferenceCapture(ref, "hyperedge", common.hyperedges, common.selectedEntity) || "that", common.hyperedges, common.selectedEntity, { recentIds: common.recentReferences.hyperedges ?? [] });
  if (!resolved.ok) return clarification(resolved.error ?? "I could not resolve the target hyperedge.", common.nlu, "set_hyperedge_weight");
  return planResult({
    operations: [{ type: GRAPH_MUTATION_OPS.SET_HYPEREDGE_WEIGHT, hyperedgeId: resolved.id, weight }],
    summary: `Set hyperedge "${resolved.id}" weight to ${weight}.`,
    intent: "set_hyperedge_weight",
    graphIdentity: common.graphIdentity,
    metadata: common.metadata,
    nlu: common.nlu,
  });
}

function compileTime(raw, common) {
  const match = raw.match(/\b(?:set|change)\s+(?:the\s+)?time\s+(?:of|for|on)\s+(?:the\s+)?(?:selected\s+)?(?:hyperedge|edge)?\s*(.+?)\s+(?:to|=)\s+(.+)$/i)
    ?? raw.match(/\b(?:set|change)\s+(?:the\s+)?(.+?)['’]\s*s\s+time\s+(?:to|=)\s+(.+)$/i);
  if (!match) return null;
  const resolved = resolveHyperedgeReference(normalizeReferenceCapture(match[1], "hyperedge", common.hyperedges, common.selectedEntity) || "that", common.hyperedges, common.selectedEntity, { recentIds: common.recentReferences.hyperedges ?? [] });
  if (!resolved.ok) return clarification(resolved.error ?? "I could not resolve the target hyperedge.", common.nlu, "set_hyperedge_time");
  return planResult({
    operations: [{ type: GRAPH_MUTATION_OPS.SET_HYPEREDGE_TIME, hyperedgeId: resolved.id, time: parseLiteral(match[2]) }],
    summary: `Set hyperedge "${resolved.id}" time.`,
    intent: "set_hyperedge_time",
    graphIdentity: common.graphIdentity,
    metadata: common.metadata,
    nlu: common.nlu,
  });
}

function compileAttribute(raw, common) {
  const setAttr = raw.match(/\b(?:set|change)\s+(?:the\s+)?(?:attribute|attr)\s+([A-Za-z_][\w.-]*)\s+(?:of|for|on)\s+(?:the\s+)?(?:selected\s+)?(?:hyperedge|edge)?\s*(.+?)\s+(?:to|=)\s+(.+)$/i);
  if (setAttr) {
    const resolved = resolveHyperedgeReference(normalizeReferenceCapture(setAttr[2], "hyperedge", common.hyperedges, common.selectedEntity) || "that", common.hyperedges, common.selectedEntity, { recentIds: common.recentReferences.hyperedges ?? [] });
    if (!resolved.ok) return clarification(resolved.error ?? "I could not resolve the target hyperedge.", common.nlu, "set_hyperedge_attribute");
    return planResult({
      operations: [{ type: GRAPH_MUTATION_OPS.SET_HYPEREDGE_ATTRIBUTE, hyperedgeId: resolved.id, key: setAttr[1], value: parseLiteral(setAttr[3]) }],
      summary: `Set attribute "${setAttr[1]}" on hyperedge "${resolved.id}".`,
      intent: "set_hyperedge_attribute",
      graphIdentity: common.graphIdentity,
      metadata: common.metadata,
      nlu: common.nlu,
    });
  }
  const possessiveSetAttr = raw.match(/\b(?:set|change)\s+(?:the\s+)?(.+?)['’]\s*s\s+([A-Za-z_][\w.-]*)\s+(?:attribute|attr)\s+(?:to|=)\s+(.+)$/i);
  if (possessiveSetAttr) {
    const resolved = resolveHyperedgeReference(normalizeReferenceCapture(possessiveSetAttr[1], "hyperedge", common.hyperedges, common.selectedEntity) || "that", common.hyperedges, common.selectedEntity, { recentIds: common.recentReferences.hyperedges ?? [] });
    if (!resolved.ok) return clarification(resolved.error ?? "I could not resolve the target hyperedge.", common.nlu, "set_hyperedge_attribute");
    return planResult({
      operations: [{ type: GRAPH_MUTATION_OPS.SET_HYPEREDGE_ATTRIBUTE, hyperedgeId: resolved.id, key: possessiveSetAttr[2], value: parseLiteral(possessiveSetAttr[3]) }],
      summary: `Set attribute "${possessiveSetAttr[2]}" on hyperedge "${resolved.id}".`,
      intent: "set_hyperedge_attribute",
      graphIdentity: common.graphIdentity,
      metadata: common.metadata,
      nlu: common.nlu,
    });
  }
  const removeAttr = raw.match(/\b(?:remove|delete)\s+(?:the\s+)?(?:attribute|attr)\s+([A-Za-z_][\w.-]*)\s+(?:of|from|on)\s+(?:the\s+)?(?:selected\s+)?(?:hyperedge|edge)?\s*(.+)$/i)
    ?? raw.match(/\b(?:remove|delete)\s+(?:the\s+)?([A-Za-z_][\w.-]*)\s+(?:attribute|attr)\s+(?:of|from|on)\s+(?:the\s+)?(?:selected\s+)?(?:hyperedge|edge)?\s*(.+)$/i);
  if (!removeAttr) return null;
  const resolved = resolveHyperedgeReference(normalizeReferenceCapture(removeAttr[2], "hyperedge", common.hyperedges, common.selectedEntity) || "that", common.hyperedges, common.selectedEntity, { recentIds: common.recentReferences.hyperedges ?? [] });
  if (!resolved.ok) return clarification(resolved.error ?? "I could not resolve the target hyperedge.", common.nlu, "remove_hyperedge_attribute");
  return planResult({
    operations: [{ type: GRAPH_MUTATION_OPS.REMOVE_HYPEREDGE_ATTRIBUTE, hyperedgeId: resolved.id, key: removeAttr[1] }],
    summary: `Remove attribute "${removeAttr[1]}" from hyperedge "${resolved.id}".`,
    intent: "remove_hyperedge_attribute",
    graphIdentity: common.graphIdentity,
    metadata: common.metadata,
    nlu: common.nlu,
  });
}

function addIncidencePlan({ vertexId = null, vertexIds = null, hyperedgeRef, hyperedges, selectedEntity, graphIdentity, metadata, recentReferences = {}, nlu }) {
  const resolved = resolveHyperedgeReference(hyperedgeRef, hyperedges, selectedEntity, { recentIds: recentReferences.hyperedges ?? [] });
  const vertices = (vertexIds?.length ? vertexIds : [vertexId]).filter(Boolean);
  if (!vertices.length) return clarification("Name the vertex to add.", nlu, "add_incidence");
  if (!resolved.ok) return clarification(resolved.error ?? `I could not resolve hyperedge "${hyperedgeRef}".`, nlu, "add_incidence");
  return planResult({
    operations: vertices.map(vertex => ({ type: GRAPH_MUTATION_OPS.ADD_INCIDENCE, hyperedgeId: resolved.id, vertexId: vertex })),
    summary: vertices.length === 1
      ? `Add vertex "${vertices[0]}" to hyperedge "${resolved.id}".`
      : `Add ${vertices.length} vertices to hyperedge "${resolved.id}".`,
    intent: "add_incidence",
    graphIdentity,
    metadata,
    nlu,
  });
}

function removeIncidencePlan({ vertexRef, hyperedgeRef, hyperedges, selectedEntity, graphIdentity, metadata, raw, recentReferences = {}, nlu, correction = correctionFlags(raw) }) {
  const resolvedHyperedge = resolveHyperedgeReference(hyperedgeRef, hyperedges, selectedEntity, { recentIds: recentReferences.hyperedges ?? [] });
  if (!resolvedHyperedge.ok) return clarification(resolvedHyperedge.error ?? `I could not resolve hyperedge "${hyperedgeRef}".`, nlu, "remove_incidence");
  const hyperedge = hyperedges.find(item => String(item.id) === resolvedHyperedge.id);
  const resolvedVertex = resolveVertexReference(vertexRef, hyperedges, selectedEntity, { recentIds: recentReferences.vertices ?? [] });
  const vertexId = resolvedVertex.ok ? resolvedVertex.id : vertexRef;
  if (!hyperedge?.vertices?.map(String).includes(vertexId)) return clarification(`Vertex "${vertexId}" is not in hyperedge "${resolvedHyperedge.id}".`, nlu, "remove_incidence");
  if (hyperedge.vertices.length <= 1 && !/\b(?:remove|delete|drop|keep)\s+(?:the\s+)?empty\b/i.test(raw)) {
    return clarification(`Removing "${vertexId}" would make hyperedge "${resolvedHyperedge.id}" empty. Say "remove ${vertexId} from ${resolvedHyperedge.id} and remove empty hyperedge" or "keep empty hyperedge".`, nlu, "remove_incidence");
  }
  return planResult({
    operations: [{ type: GRAPH_MUTATION_OPS.REMOVE_INCIDENCE, hyperedgeId: resolvedHyperedge.id, vertexId, emptyHyperedgePolicy: emptyPolicy(raw) }],
    summary: `Remove vertex "${vertexId}" from hyperedge "${resolvedHyperedge.id}".`,
    intent: "remove_incidence",
    graphIdentity,
    metadata,
    nlu,
    correction,
  });
}

function planResult({ operations, summary, intent, graphIdentity, metadata, nlu, correction = correctionFlags(metadata?.rawText ?? "") }) {
  const identifierSanity = validateGraphOperationIdentifiers(operations);
  if (!identifierSanity.ok) {
    return clarification(identifierSanity.errors[0], nlu, intent);
  }
  const plan = createMutationPlan({
    operations,
    summary,
    source: "deterministic_nlu",
    graphIdentity,
    metadata: {
      ...metadata,
      pendingPlanReplaced: Boolean(correction.replacePendingPlan),
    },
  });
  return {
    ok: true,
    intent: "graph_mutation",
    authoritativeIntent: intent,
    requiresConfirmation: true,
    typedKind: "GraphMutationPlan",
    draft: graphDraft({
      classification: "mutation",
      intentSummary: summary,
      operations,
      correction,
      confidence: nlu?.confidence?.level === "low" ? "medium" : "high",
    }),
    plan,
    diagnostics: {
      ...diagnostics(nlu, intent),
      typedKind: "GraphMutationPlan",
      operationTypes: operations.map(operation => operation.type),
      resolvedEntities: resolvedEntityList(operations),
      semanticConfidence: semanticConfidence(nlu, operations.length),
      validatorStatus: "pending_preview",
    },
  };
}

function clarification(message, nlu, intent = "clarification") {
  return {
    ok: false,
    needsClarification: true,
    message,
    draft: graphDraft({ classification: "clarification", intentSummary: message, clarificationQuestion: message, confidence: "medium" }),
    diagnostics: {
      ...diagnostics(nlu, intent),
      semanticConfidence: { score: 0.45, level: "medium", reasons: ["clarification required"] },
      validatorStatus: "not_run",
    },
  };
}

function graphDraft({
  classification = "not_mutation",
  intentSummary = "",
  operations = [],
  clarificationQuestion = null,
  correction = { isCorrection: false, replacePendingPlan: false },
  previewOnly = false,
  acknowledgement = "",
  confidence = "low",
} = {}) {
  return {
    task: GRAPH_MUTATION_DRAFT_TASK,
    classification,
    intentSummary,
    operations,
    clarificationQuestion,
    correction,
    previewOnly,
    acknowledgement,
    confidence,
  };
}

function stripActionPreamble(text = "") {
  return String(text ?? "").trim().replace(
    /^(?:for\s+(?:the\s+)?current\s+(?:task|graph),?\s*|go\s+ahead\s+and\s+|i\s+want\s+you\s+to\s+|please\s+|now,?\s*|this\s+time,?\s*)/i,
    "",
  ).trim();
}

function diagnostics(nlu, intent) {
  return {
    plannerPath: "deterministic_nlu",
    nluDomain: "graph_mutation",
    nluIntent: intent,
    nluConfidence: nlu?.confidence,
    nluTrace: nlu?.trace,
    authoritativeCompiler: "graph_mutation_v1",
    legacyParserCalled: false,
    modelCalled: false,
    genericActionPlannerCalled: false,
  };
}

function semanticConfidence(nlu, operationCount) {
  const base = Number(nlu?.confidence?.score ?? 0.7);
  const score = Math.min(0.99, base + (operationCount > 0 ? 0.18 : 0));
  return {
    score: Number(score.toFixed(2)),
    level: score >= 0.8 ? "high" : score >= 0.45 ? "medium" : "low",
    reasons: [
      ...(nlu?.confidence?.reasons ?? []),
      operationCount > 0 ? "typed graph operation resolved" : "no typed operation",
    ],
  };
}

function graphIntent(raw) {
  if (/\bundo|revert\b/i.test(raw)) return "undo_last_mutation";
  if (/\bclear\b/i.test(raw)) return "clear_graph";
  if (/\bremove|delete|take|detach|no longer\b/i.test(raw)) return "remove_incidence";
  if (/\brename|call\b/i.test(raw)) return "rename";
  if (/\bweight\b/i.test(raw)) return "set_hyperedge_weight";
  if (/\btime\b/i.test(raw)) return "set_hyperedge_time";
  if (/\battribute|attr\b/i.test(raw)) return "set_hyperedge_attribute";
  if (/\badd|include|put|insert|needs|belongs|connect|part of\b/i.test(raw)) return "add_incidence";
  return "graph_mutation";
}

function resolvedEntityList(operations) {
  return [...new Set(operations.flatMap(operation => [
    operation.hyperedgeId ? `hyperedge:${operation.hyperedgeId}` : null,
    operation.vertexId ? `vertex:${operation.vertexId}` : null,
    operation.newHyperedgeId ? `hyperedge:${operation.newHyperedgeId}` : null,
    operation.newVertexId ? `vertex:${operation.newVertexId}` : null,
  ].filter(Boolean)))];
}

function correctionFlags(raw = "", pendingAction = null) {
  const isCorrection = /\b(actually|instead|rather than|i meant|no,|no\b|only|just)\b/i.test(raw);
  return { isCorrection, replacePendingPlan: Boolean(isCorrection && pendingAction) };
}

function emptyPolicy(raw = "") {
  return /\bkeep empty\b/i.test(raw) ? EMPTY_HYPEREDGE_POLICIES.KEEP_EMPTY : EMPTY_HYPEREDGE_POLICIES.REMOVE_EMPTY;
}

function normalizeReferenceCapture(value, type, hyperedges, selectedEntity) {
  const cleaned = normalizeGraphEntityReference(value, { kind: type });
  if (!cleaned) return cleaned;
  if (resolveReferenceByType(cleaned, type, hyperedges, selectedEntity).ok) return cleaned;
  if (isQuotedCapture(value)) return cleaned;
  for (const suffix of TRAILING_CONVERSATIONAL_MODIFIERS) {
    const pattern = new RegExp(`[\\s,]+${escapeRegExp(suffix)}$`, "i");
    if (!pattern.test(cleaned)) continue;
    const candidate = normalizeGraphEntityReference(cleaned.replace(pattern, ""), { kind: type });
    if (candidate && resolveReferenceByType(candidate, type, hyperedges, selectedEntity).ok) return candidate;
  }
  return cleaned;
}

function selectedHyperedgeRequested(raw = "", captured = "") {
  return /\bselected\s+(?:hyperedge|edge)\b/i.test(raw)
    && /^(?:the\s+)?(?:selected\s+)?(?:hyperedge|edge)?\s*[.?!]?\s*$/i.test(String(captured ?? "").trim());
}

function normalizeVertexCapture(value, hyperedges, selectedEntity) {
  const cleaned = normalizeGraphEntityReference(value, { kind: "vertex" });
  if (!cleaned) return cleaned;
  if (resolveVertexReference(cleaned, hyperedges, selectedEntity).ok) return cleaned;
  if (isQuotedCapture(value)) return cleaned;
  for (const suffix of TRAILING_CONVERSATIONAL_MODIFIERS) {
    const pattern = new RegExp(`[\\s,]+${escapeRegExp(suffix)}$`, "i");
    if (!pattern.test(cleaned)) continue;
    const candidate = normalizeGraphEntityReference(cleaned.replace(pattern, ""), { kind: "vertex" });
    if (candidate) return candidate;
  }
  return cleaned;
}

function splitVertexCapture(value, hyperedges, selectedEntity) {
  const vertices = splitGraphEntityList(value, { kind: "vertex" });
  if (vertices.length > 1) return vertices;
  const single = normalizeVertexCapture(value, hyperedges, selectedEntity);
  return single ? [single] : [];
}

function resolveReferenceByType(reference, type, hyperedges, selectedEntity) {
  return type === "vertex"
    ? resolveVertexReference(reference, hyperedges, selectedEntity)
    : resolveHyperedgeReference(reference, hyperedges, selectedEntity);
}

function cleanNewIdentifier(value, kind = "entity") {
  const cleaned = normalizeGraphEntityReference(value, { kind });
  if (!cleaned || isQuotedCapture(value)) return cleaned;
  for (const suffix of ["instead", "please", "now", "this time"]) {
    const pattern = new RegExp(`[\\s,]+${escapeRegExp(suffix)}$`, "i");
    if (pattern.test(cleaned)) return normalizeGraphEntityReference(cleaned.replace(pattern, ""), { kind });
  }
  return cleaned;
}

function isQuotedCapture(value) {
  return isQuotedGraphIdentifier(value);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanEntityName(value) {
  return normalizeGraphEntityReference(value, { kind: "entity" });
}

function parseLiteral(value) {
  const cleaned = cleanEntityName(value);
  if (/^-?\d+(?:\.\d+)?$/.test(cleaned)) return Number(cleaned);
  if (/^(true|false)$/i.test(cleaned)) return /^true$/i.test(cleaned);
  try {
    return JSON.parse(cleaned);
  } catch {
    return cleaned;
  }
}
