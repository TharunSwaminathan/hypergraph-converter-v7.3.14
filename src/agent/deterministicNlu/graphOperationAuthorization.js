import { GRAPH_MUTATION_OPS } from "../../graph/graphMutationSchema.js";
import {
  normalizeGraphEntityReference,
  splitGraphEntityList,
} from "./domains/graphIdentifierNormalizer.js";

const TYPE_ALIASES = Object.freeze({
  CREATE_HYPEREDGE: GRAPH_MUTATION_OPS.ADD_HYPEREDGE,
  DELETE_HYPEREDGE: GRAPH_MUTATION_OPS.REMOVE_HYPEREDGE,
  DELETE_INCIDENCE: GRAPH_MUTATION_OPS.REMOVE_INCIDENCE,
  DELETE_VERTEX_GLOBAL: GRAPH_MUTATION_OPS.REMOVE_VERTEX_GLOBAL,
  ADD_VERTEX_TO_HYPEREDGE: GRAPH_MUTATION_OPS.ADD_INCIDENCE,
  REMOVE_VERTEX_FROM_HYPEREDGE: GRAPH_MUTATION_OPS.REMOVE_INCIDENCE,
});

const ACTION_BOUNDARY_RE = /\s+(?:and\s+)?(?:then\s+)?(?=(?:please\s+)?(?:add|create|make|include|put|insert|remove|delete|take|detach|rename|change|set|clear|undo|revert)\b)/i;

/**
 * Derive graph-operation capabilities only from clauses the deterministic
 * authorization analyzer has already classified as affirmative. The result
 * is intentionally independent of any model/prepared plan.
 */
export function deriveAuthorizedGraphOperations(clauses = []) {
  return clauses.flatMap(clause => deriveClauseGraphOperations(clause.text, clause.id));
}

export function deriveClauseGraphOperations(text = "", sourceClauseId = null) {
  const active = stripDirectivePreamble(text);
  if (!active) return [];
  const parts = splitCompoundActions(active);
  return parts.flatMap(part => parseOperation(part, sourceClauseId));
}

export function authorizeGraphMutationOperations({
  authorization = null,
  actualOperations = [],
  pendingOperations = [],
  selectedEntity = null,
} = {}) {
  const actual = Array.isArray(actualOperations) ? actualOperations : [];
  if (!actual.length) {
    return {
      allowed: false,
      reason: "graph_operation_binding_missing_actual_operations",
      authorizedOperations: authorization?.authorizedGraphOperations ?? [],
      unmatchedOperations: [],
    };
  }
  const authorized = Array.isArray(authorization?.authorizedGraphOperations)
    ? authorization.authorizedGraphOperations
    : deriveAuthorizedGraphOperations(authorization?.authorizedClauses ?? []);
  if (!authorized.length) {
    return {
      allowed: false,
      reason: "graph_operation_binding_missing_authorized_operation",
      authorizedOperations: [],
      unmatchedOperations: actual.map(canonicalizeActualOperation),
    };
  }

  const unused = authorized.map((descriptor, index) => ({ descriptor, index }));
  const unmatchedOperations = [];
  const matches = [];
  for (const operation of actual) {
    const canonical = canonicalizeActualOperation(operation);
    const matchIndex = unused.findIndex(item => operationMatchesDescriptor(canonical, item.descriptor, pendingOperations, selectedEntity));
    if (matchIndex < 0) {
      unmatchedOperations.push(canonical);
      continue;
    }
    const [matched] = unused.splice(matchIndex, 1);
    matches.push({ actual: canonical, authorized: matched.descriptor });
  }
  if (unmatchedOperations.length) {
    return {
      allowed: false,
      reason: "graph_operation_not_authorized",
      authorizedOperations: authorized,
      unmatchedOperations,
      matches,
    };
  }
  return {
    allowed: true,
    reason: "graph_operations_match_positive_clauses",
    authorizedOperations: authorized,
    unmatchedOperations: [],
    matches,
  };
}

function parseOperation(text, sourceClauseId) {
  const value = stripDirectivePreamble(text).replace(/[.?!]+$/g, "").trim();
  if (!value) return [];
  const descriptor = operation => [{ ...operation, sourceClauseId }];

  const pendingFieldChange = value.match(/^(?:change|update|correct|fix|revise)\s+(?:the\s+)?pending\s+(vertex|hyperedge|edge)\s+from\s+(.+?)\s+to\s+(.+)$/i);
  if (pendingFieldChange) {
    const field = /^vertex$/i.test(pendingFieldChange[1]) ? "vertex" : "hyperedge";
    return descriptor({
      type: "PENDING_GRAPH_FIELD_CORRECTION",
      field,
      from: entity(pendingFieldChange[2], field),
      to: entity(pendingFieldChange[3], field),
    });
  }
  const pendingInstead = value.match(/^use\s+(.+?)\s+instead\s+of\s+(.+?)\s+in\s+(?:the\s+)?pending\s+graph\s+edit$/i);
  if (pendingInstead) {
    return descriptor({
      type: "PENDING_GRAPH_FIELD_CORRECTION",
      field: "hyperedge",
      from: entity(pendingInstead[2], "hyperedge"),
      to: entity(pendingInstead[1], "hyperedge"),
    });
  }

  if (/^(?:clear|empty|reset)\s+(?:the\s+)?(?:current\s+)?(?:graph|hypergraph)$/i.test(value)
    || /^(?:remove|delete)\s+(?:all|every)\s+hyperedges?$/i.test(value)) {
    return descriptor({ type: GRAPH_MUTATION_OPS.CLEAR_GRAPH });
  }
  if (/^(?:undo|revert)\s+(?:the\s+)?(?:last|previous)?\s*(?:graph\s+)?(?:mutation|change|edit)?$/i.test(value)) {
    return descriptor({ type: GRAPH_MUTATION_OPS.UNDO_LAST_MUTATION });
  }

  const addHyperedge = value.match(/^(?:add|create|make)\s+(?:a\s+)?(?:new\s+)?(?:hyperedge|edge|group)?\s*(?:called\s+|named\s+)?([^:,]+?)\s*(?:with|containing|that\s+contains|:)\s*(.+)$/i);
  if (addHyperedge && /\b(?:hyperedge|edge|group|vertices?|nodes?|members?)\b/i.test(value)) {
    const hyperedgeId = entity(addHyperedge[1], "hyperedge");
    const vertices = splitGraphEntityList(addHyperedge[2], { kind: "vertex" });
    if (hyperedgeId && vertices.length) return descriptor({ type: GRAPH_MUTATION_OPS.ADD_HYPEREDGE, hyperedgeId, vertices: canonicalList(vertices) });
  }

  // Global removal must be recognized before the incidence form because
  // "from the entire graph" is a graph scope, not a hyperedge identifier.
  const removeVertex = value.match(/^(?:remove|delete)\s+(?:the\s+)?(?:vertex|node)?\s*(.+?)\s+(?:everywhere|globally|from\s+(?:the\s+)?(?:entire\s+)?(?:graph|hypergraph))$/i);
  if (removeVertex) {
    const vertexId = entity(removeVertex[1], "vertex");
    if (vertexId) return descriptor({ type: GRAPH_MUTATION_OPS.REMOVE_VERTEX_GLOBAL, vertexId });
  }

  const removeIncidence = value.match(/^(?:remove|delete|take|detach)\s+(?:the\s+)?(?:incidence\s+for\s+|vertex\s+|node\s+)?(.+?)\s+(?:from|out\s+of)\s+(?:the\s+)?(?:hyperedge|edge)?\s*(.+?)(?:\s+and\s+(?:keep|remove|delete|drop)\s+(?:the\s+)?empty\s+hyperedge)?$/i);
  if (removeIncidence && !/\b(?:attribute|attr)\b/i.test(value)) {
    const vertexId = entity(removeIncidence[1], "vertex");
    const hyperedgeId = targetEntity(removeIncidence[2], "hyperedge");
    if (vertexId && hyperedgeId) {
      const emptyHyperedgePolicy = /\bkeep\s+empty\b/i.test(value) ? "keep_empty"
        : /\b(?:remove|delete|drop)\s+(?:the\s+)?empty\b/i.test(value) ? "remove_empty" : undefined;
      return descriptor(compact({ type: GRAPH_MUTATION_OPS.REMOVE_INCIDENCE, hyperedgeId, vertexId, emptyHyperedgePolicy }));
    }
  }

  const addIncidence = value.match(/^(?:add|include|put|insert|connect)\s+(?:the\s+|a\s+)?(?:incidence\s+for\s+|vertices?\s+|nodes?\s+)?(.+?)\s+(?:to|in|into|inside|within)\s+(?:the\s+)?(?:hyperedge|edge)?\s*(.+)$/i);
  if (addIncidence) {
    const vertices = splitGraphEntityList(addIncidence[1], { kind: "vertex" });
    const hyperedgeId = targetEntity(addIncidence[2], "hyperedge");
    if (vertices.length && hyperedgeId) return vertices.map(vertexId => ({ type: GRAPH_MUTATION_OPS.ADD_INCIDENCE, hyperedgeId, vertexId, sourceClauseId }));
  }

  const needsIncidence = value.match(/^(?:the\s+)?(?:selected\s+)?(?:hyperedge|edge)?\s*(.+?)\s+(?:needs|should\s+(?:also\s+)?(?:include|contain|have))\s+(?:vertices?\s+|nodes?\s+)?(.+?)(?:\s+(?:again|too|as\s+well|please|now|this\s+time))?$/i);
  if (needsIncidence) {
    const hyperedgeId = targetEntity(needsIncidence[1], "hyperedge");
    const vertices = splitGraphEntityList(needsIncidence[2], { kind: "vertex" });
    if (vertices.length && hyperedgeId) return vertices.map(vertexId => ({ type: GRAPH_MUTATION_OPS.ADD_INCIDENCE, hyperedgeId, vertexId, sourceClauseId }));
  }

  const belongsIncidence = value.match(/^(?:vertices?\s+|nodes?\s+)?(.+?)\s+(?:belongs\s+to|should\s+be\s+in|should\s+belong\s+to|is\s+part\s+of)\s+(?:the\s+)?(?:selected\s+)?(?:hyperedge|edge)?\s*(.+?)(?:\s+(?:again|too|as\s+well|please|now|this\s+time))?$/i);
  if (belongsIncidence) {
    const vertices = splitGraphEntityList(belongsIncidence[1], { kind: "vertex" });
    const hyperedgeId = targetEntity(belongsIncidence[2], "hyperedge");
    if (vertices.length && hyperedgeId) return vertices.map(vertexId => ({ type: GRAPH_MUTATION_OPS.ADD_INCIDENCE, hyperedgeId, vertexId, sourceClauseId }));
  }

  const makeIncidence = value.match(/^(?:make|connect)\s+(?:vertices?\s+|nodes?\s+)?(.+?)\s+(?:part\s+of|to)\s+(?:the\s+)?(?:selected\s+)?(?:hyperedge|edge)?\s*(.+?)(?:\s+(?:again|too|as\s+well|please|now|this\s+time))?$/i);
  if (makeIncidence) {
    const vertices = splitGraphEntityList(makeIncidence[1], { kind: "vertex" });
    const hyperedgeId = targetEntity(makeIncidence[2], "hyperedge");
    if (vertices.length && hyperedgeId) return vertices.map(vertexId => ({ type: GRAPH_MUTATION_OPS.ADD_INCIDENCE, hyperedgeId, vertexId, sourceClauseId }));
  }

  const noLongerIncidence = value.match(/^(?:vertices?\s+|nodes?\s+)?(.+?)\s+should\s+no\s+longer\s+(?:belong\s+to|be\s+in)\s+(?:the\s+)?(?:selected\s+)?(?:hyperedge|edge)?\s*(.+)$/i);
  if (noLongerIncidence) {
    const vertexId = entity(noLongerIncidence[1], "vertex");
    const hyperedgeId = targetEntity(noLongerIncidence[2], "hyperedge");
    if (vertexId && hyperedgeId) return descriptor({ type: GRAPH_MUTATION_OPS.REMOVE_INCIDENCE, hyperedgeId, vertexId });
  }

  const rename = value.match(/^(?:rename|change)\s+(?:the\s+)?(?:(hyperedge|edge|vertex|node)\s+)?(.+?)\s+(?:to|as)\s+(.+)$/i);
  if (rename && !/^(?:set|change)\b[\s\S]*\b(?:weight|time|attribute|attr)\b/i.test(value)) {
    const explicitKind = rename[1] ?? "";
    const isVertex = /^(?:vertex|node)$/i.test(explicitKind);
    const from = targetEntity(rename[2], isVertex ? "vertex" : "hyperedge");
    const to = entity(rename[3], isVertex ? "vertex" : "hyperedge");
    if (from && to) {
      if (!explicitKind) return descriptor({ type: "RENAME_ENTITY", entityId: from, newEntityId: to });
      return descriptor(isVertex
        ? { type: GRAPH_MUTATION_OPS.RENAME_VERTEX, vertexId: from, newVertexId: to }
        : { type: GRAPH_MUTATION_OPS.RENAME_HYPEREDGE, hyperedgeId: from, newHyperedgeId: to });
    }
  }

  const weight = value.match(/^(?:set|change)\s+(?:the\s+)?weight\s+(?:of|for|on)\s+(?:the\s+)?(?:hyperedge|edge)?\s*(.+?)\s+(?:to|=)\s*([-+]?\d+(?:\.\d+)?)\b/i)
    ?? value.match(/^(?:set|change|make)\s+(?:the\s+)?(.+?)['’]s\s+weight\s+(?:to\s+)?([-+]?\d+(?:\.\d+)?)\b/i);
  if (weight) {
    const hyperedgeId = entity(weight[1], "hyperedge");
    if (hyperedgeId) return descriptor({ type: GRAPH_MUTATION_OPS.SET_HYPEREDGE_WEIGHT, hyperedgeId, weight: Number(weight[2]) });
  }

  const time = value.match(/^(?:set|change)\s+(?:the\s+)?time\s+(?:of|for|on)\s+(?:the\s+)?(?:hyperedge|edge)?\s*(.+?)\s+(?:to|=)\s*(.+)$/i)
    ?? value.match(/^(?:set|change)\s+(?:the\s+)?(.+?)['’]s\s+time\s+(?:to|=)\s*(.+)$/i);
  if (time) {
    const hyperedgeId = entity(time[1], "hyperedge");
    if (hyperedgeId) return descriptor({ type: GRAPH_MUTATION_OPS.SET_HYPEREDGE_TIME, hyperedgeId, time: literal(time[2]) });
  }

  const setAttribute = value.match(/^(?:set|change)\s+(?:the\s+)?(?:attribute|attr)\s+([A-Za-z_][\w.-]*)\s+(?:of|for|on)\s+(?:the\s+)?(?:hyperedge|edge)?\s*(.+?)\s+(?:to|=)\s*(.+)$/i);
  if (setAttribute) {
    const hyperedgeId = entity(setAttribute[2], "hyperedge");
    if (hyperedgeId) return descriptor({ type: GRAPH_MUTATION_OPS.SET_HYPEREDGE_ATTRIBUTE, hyperedgeId, key: setAttribute[1], value: literal(setAttribute[3]) });
  }

  const possessiveAttribute = value.match(/^(?:set|change)\s+(?:the\s+)?(.+?)['’]s\s+([A-Za-z_][\w.-]*)\s+(?:attribute|attr)\s+(?:to|=)\s*(.+)$/i);
  if (possessiveAttribute) {
    const hyperedgeId = entity(possessiveAttribute[1], "hyperedge");
    if (hyperedgeId) return descriptor({
      type: GRAPH_MUTATION_OPS.SET_HYPEREDGE_ATTRIBUTE,
      hyperedgeId,
      key: possessiveAttribute[2],
      value: literal(possessiveAttribute[3]),
    });
  }

  const removeAttribute = value.match(/^(?:remove|delete)\s+(?:the\s+)?(?:attribute|attr)\s+([A-Za-z_][\w.-]*)\s+(?:of|from|on)\s+(?:the\s+)?(?:hyperedge|edge)?\s*(.+)$/i)
    ?? value.match(/^(?:remove|delete)\s+(?:the\s+)?([A-Za-z_][\w.-]*)\s+(?:attribute|attr)\s+(?:of|from|on)\s+(?:the\s+)?(?:hyperedge|edge)?\s*(.+)$/i);
  if (removeAttribute) {
    const hyperedgeId = entity(removeAttribute[2], "hyperedge");
    if (hyperedgeId) return descriptor({ type: GRAPH_MUTATION_OPS.REMOVE_HYPEREDGE_ATTRIBUTE, hyperedgeId, key: removeAttribute[1] });
  }

  if (/^(?:remove|delete|drop)\s+(?:the\s+)?selected\s+(?:hyperedge|edge)(?:\s+the\s+other\s+one)?$/i.test(value)) {
    return descriptor({ type: GRAPH_MUTATION_OPS.REMOVE_HYPEREDGE, hyperedgeId: "$selected" });
  }
  const removeHyperedge = value.match(/^(?:remove|delete|drop)\s+(?:the\s+)?(?:selected\s+)?(?:hyperedge|edge|group)?\s*(.+?)(?:\s+(?:please|now))?$/i);
  if (removeHyperedge) {
    const hyperedgeId = entity(removeHyperedge[1], "hyperedge");
    if (hyperedgeId && (/\b(?:hyperedge|edge|group)\b/i.test(value) || /^h[A-Za-z0-9_.:-]*$/i.test(hyperedgeId))) {
      return descriptor({ type: GRAPH_MUTATION_OPS.REMOVE_HYPEREDGE, hyperedgeId });
    }
  }
  return [];
}

function operationMatchesDescriptor(actual, descriptor, pendingOperations = [], selectedEntity = null) {
  if (descriptor?.type === "PENDING_GRAPH_FIELD_CORRECTION") {
    return pendingCorrectionMatches(actual, descriptor, pendingOperations);
  }
  if (descriptor?.type === "RENAME_ENTITY") {
    return (actual?.type === GRAPH_MUTATION_OPS.RENAME_HYPEREDGE
      && targetMatches(actual.hyperedgeId, descriptor.entityId, selectedEntity, "hyperedge")
      && actual.newHyperedgeId === descriptor.newEntityId)
      || (actual?.type === GRAPH_MUTATION_OPS.RENAME_VERTEX
        && targetMatches(actual.vertexId, descriptor.entityId, selectedEntity, "vertex")
        && actual.newVertexId === descriptor.newEntityId);
  }
  if (!actual || !descriptor || actual.type !== descriptor.type) return false;
  return Object.entries(descriptor).every(([key, expected]) => {
    if (key === "sourceClauseId") return true;
    const received = actual[key];
    if (expected === "$selected") {
      const kind = /vertex/i.test(key) ? "vertex" : "hyperedge";
      return targetMatches(received, expected, selectedEntity, kind);
    }
    if (Array.isArray(expected)) return arraysEqual(canonicalList(received ?? []), canonicalList(expected));
    if (["hyperedgeId", "vertexId", "entityId"].includes(key)) return identifierMatches(received, expected);
    return Object.is(received, expected);
  });
}

function pendingCorrectionMatches(actual, descriptor, pendingOperations) {
  if (!actual || !descriptor.from || !descriptor.to) return false;
  return (Array.isArray(pendingOperations) ? pendingOperations : []).some(operation => {
    const previous = canonicalizeActualOperation(operation);
    let expected = null;
    if (descriptor.field === "vertex") {
      if (Array.isArray(previous.vertices) && previous.vertices.includes(descriptor.from)) {
        expected = { ...previous, vertices: canonicalList(previous.vertices.map(value => value === descriptor.from ? descriptor.to : value)) };
      } else if (previous.vertexId === descriptor.from) expected = { ...previous, vertexId: descriptor.to };
      else if (previous.newVertexId === descriptor.from) expected = { ...previous, newVertexId: descriptor.to };
    } else if (previous.hyperedgeId === descriptor.from) expected = { ...previous, hyperedgeId: descriptor.to };
    else if (previous.newHyperedgeId === descriptor.from) expected = { ...previous, newHyperedgeId: descriptor.to };
    return expected ? materialOperationEqual(actual, expected) : false;
  });
}

function materialOperationEqual(a, b) {
  const keys = [...new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])]
    .filter(key => !["requestId", "timestamp", "createdAt", "updatedAt", "planId", "planHash", "sourceClauseId"].includes(key))
    .sort();
  return keys.every(key => {
    const left = a?.[key];
    const right = b?.[key];
    if (Array.isArray(left) || Array.isArray(right)) return arraysEqual(canonicalList(left ?? []), canonicalList(right ?? []));
    return Object.is(left, right);
  });
}

function canonicalizeActualOperation(operation = {}) {
  const type = TYPE_ALIASES[operation.type] ?? operation.type ?? null;
  const result = { ...operation, type };
  for (const key of ["hyperedgeId", "vertexId", "newHyperedgeId", "newVertexId"]) {
    if (result[key] !== undefined && result[key] !== null) result[key] = String(result[key]);
  }
  if (Array.isArray(result.vertices)) result.vertices = canonicalList(result.vertices);
  return result;
}

function splitCompoundActions(text) {
  const parts = [];
  let remaining = text;
  while (remaining) {
    const match = ACTION_BOUNDARY_RE.exec(remaining);
    if (!match || match.index <= 0) {
      parts.push(remaining);
      break;
    }
    parts.push(remaining.slice(0, match.index));
    remaining = remaining.slice(match.index + match[0].length);
  }
  return parts.map(part => part.trim()).filter(Boolean);
}

function stripDirectivePreamble(text) {
  return String(text ?? "").trim()
    .replace(/^(?:please\s+|actually\s*,?\s*|no\s*,?\s*|i\s+meant\s+|now\s*,?\s*|then\s+|after\s+that\s+|for\s+(?:the\s+)?(?:current\s+task|pending\s+correction)\s*,?\s*|go\s+ahead\s+and\s+|i\s+want\s+you\s+to\s+|(?:can|could|would|will)\s+you\s+(?:please\s+)?)/i, "")
    .replace(/\s+now\s*[.?!]?$/i, "")
    .trim();
}

function entity(value, kind) {
  return normalizeGraphEntityReference(String(value ?? "")
    .replace(/,?\s+but\s+(?:leave|keep|preserve)\b[\s\S]*$/i, "")
    .replace(/,?\s+but\s+(?:do\s+not|don['’]?t)\s+apply\b[\s\S]*$/i, "")
    .replace(/\s+(?:this\s+time|instead|now|earlier|again)$/i, ""), { kind });
}

function targetEntity(value, kind) {
  const raw = String(value ?? "").trim();
  if (/^(?:(?:the\s+)?selected(?:\s+(?:hyperedge|edge|vertex|node))?|(?:that|this)\s+(?:hyperedge|edge|vertex|node))$/i.test(raw)) return "$selected";
  return entity(raw, kind);
}

function targetMatches(received, expected, selectedEntity, kind) {
  if (expected !== "$selected") return identifierMatches(received, expected);
  const selectedType = String(selectedEntity?.type ?? "").toLowerCase();
  if (selectedType && kind === "hyperedge" && !/(?:hyperedge|edge)/.test(selectedType)) return false;
  if (selectedType && kind === "vertex" && !/(?:vertex|node)/.test(selectedType)) return false;
  return Boolean(selectedEntity?.id) && String(received) === String(selectedEntity.id);
}

function identifierMatches(received, expected) {
  if (Object.is(received, expected)) return true;
  if (received === null || received === undefined || expected === null || expected === undefined) return false;
  return String(received).toLocaleLowerCase() === String(expected).toLocaleLowerCase();
}

function canonicalList(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(value => String(value)))].sort((a, b) => a.localeCompare(b));
}

function arraysEqual(a, b) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function literal(value) {
  const cleaned = String(value ?? "").trim().replace(/[.?!]+$/g, "");
  if (/^-?\d+(?:\.\d+)?$/.test(cleaned)) return Number(cleaned);
  if (/^(?:true|false)$/i.test(cleaned)) return /^true$/i.test(cleaned);
  try {
    return JSON.parse(cleaned);
  } catch {
    return normalizeGraphEntityReference(cleaned, { kind: "entity" });
  }
}

function compact(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}
