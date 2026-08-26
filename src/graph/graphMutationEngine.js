import { EMPTY_HYPEREDGE_POLICIES, GRAPH_MUTATION_OPS, PROTOTYPE_POLLUTION_KEYS } from "./graphMutationSchema.js";
import { validateMutationPlan } from "./graphMutationValidator.js";
import { graphFingerprint } from "./graphFingerprint.js";

function cloneHyperedge(hyperedge) {
  return {
    id: String(hyperedge.id),
    vertices: [...(hyperedge.vertices ?? [])],
    time: hyperedge.time ?? null,
    weight: Number.isFinite(Number(hyperedge.weight)) ? Number(hyperedge.weight) : 1,
    attributes: hyperedge.attributes && typeof hyperedge.attributes === "object" && !Array.isArray(hyperedge.attributes)
      ? { ...hyperedge.attributes }
      : {},
  };
}

export function applyGraphMutationPlan(baseHyperedges = [], plan, graphIdentity = {}, history = []) {
  const validation = validateMutationPlan(plan, baseHyperedges, graphIdentity);
  if (!validation.ok) return { ok: false, errors: validation.errors, warnings: validation.warnings, hyperedges: baseHyperedges };
  const working = new Map((baseHyperedges ?? []).map(hyperedge => [String(hyperedge.id), cloneHyperedge(hyperedge)]));
  const warnings = [...validation.warnings];
  const affected = { hyperedges: new Set(), vertices: new Set() };
  const stats = { addedHyperedges: 0, removedHyperedges: 0, addedIncidences: 0, removedIncidences: 0, renamedHyperedges: 0, renamedVertices: 0, attributeChanges: 0 };
  const errors = [];

  const applyOne = operation => {
    if (operation.type === GRAPH_MUTATION_OPS.COMMIT_BATCH_UPDATES) {
      for (const child of operation.operations ?? []) applyOne(child);
      return;
    }
    if (operation.type === GRAPH_MUTATION_OPS.UNDO_LAST_MUTATION) {
      const event = history[history.length - 1];
      if (!event?.beforeHyperedges) {
        errors.push("No graph history entry is available to undo.");
        return;
      }
      working.clear();
      for (const hyperedge of event.beforeHyperedges) working.set(String(hyperedge.id), cloneHyperedge(hyperedge));
      warnings.push(`Undo restores graph before: ${event.summary ?? event.planSummary ?? "last mutation"}.`);
      return;
    }
    if (operation.type === GRAPH_MUTATION_OPS.CLEAR_GRAPH) {
      stats.removedHyperedges += working.size;
      for (const hyperedge of working.values()) {
        affected.hyperedges.add(hyperedge.id);
        for (const vertex of hyperedge.vertices) affected.vertices.add(String(vertex));
      }
      working.clear();
      return;
    }

    const id = String(operation.hyperedgeId ?? "").trim();
    if (operation.type === GRAPH_MUTATION_OPS.ADD_HYPEREDGE) {
      if (working.has(String(operation.hyperedgeId))) {
        errors.push(`Hyperedge "${operation.hyperedgeId}" already exists.`);
        return;
      }
      const vertices = uniqueVertices(operation.vertices);
      working.set(String(operation.hyperedgeId), {
        id: String(operation.hyperedgeId),
        vertices,
        time: operation.time ?? null,
        weight: Number.isFinite(Number(operation.weight)) ? Number(operation.weight) : 1,
        attributes: plainObject(operation.attributes),
      });
      stats.addedHyperedges += 1;
      stats.addedIncidences += vertices.length;
      affected.hyperedges.add(String(operation.hyperedgeId));
      vertices.forEach(vertex => affected.vertices.add(String(vertex)));
      return;
    }

    const hyperedge = working.get(id);
    if (!hyperedge && [
      GRAPH_MUTATION_OPS.REMOVE_HYPEREDGE,
      GRAPH_MUTATION_OPS.ADD_INCIDENCE,
      GRAPH_MUTATION_OPS.REMOVE_INCIDENCE,
      GRAPH_MUTATION_OPS.SET_HYPEREDGE_WEIGHT,
      GRAPH_MUTATION_OPS.SET_HYPEREDGE_TIME,
      GRAPH_MUTATION_OPS.SET_HYPEREDGE_ATTRIBUTE,
      GRAPH_MUTATION_OPS.REMOVE_HYPEREDGE_ATTRIBUTE,
    ].includes(operation.type)) {
      errors.push(`Hyperedge "${id}" does not exist.`);
      return;
    }

    if (operation.type === GRAPH_MUTATION_OPS.REMOVE_HYPEREDGE) {
      working.delete(id);
      stats.removedHyperedges += 1;
      stats.removedIncidences += hyperedge.vertices.length;
      affected.hyperedges.add(id);
      hyperedge.vertices.forEach(vertex => affected.vertices.add(String(vertex)));
      return;
    }
    if (operation.type === GRAPH_MUTATION_OPS.ADD_INCIDENCE) {
      const vertexId = String(operation.vertexId).trim();
      if (hyperedge.vertices.map(String).includes(vertexId)) {
        warnings.push(`Vertex "${vertexId}" is already in hyperedge "${id}"; no duplicate incidence was added.`);
        affected.hyperedges.add(id);
        affected.vertices.add(vertexId);
        return;
      }
      hyperedge.vertices.push(vertexId);
      stats.addedIncidences += 1;
      affected.hyperedges.add(id);
      affected.vertices.add(vertexId);
      return;
    }
    if (operation.type === GRAPH_MUTATION_OPS.REMOVE_INCIDENCE) {
      const vertexId = String(operation.vertexId).trim();
      const before = hyperedge.vertices.length;
      hyperedge.vertices = hyperedge.vertices.filter(vertex => String(vertex) !== vertexId);
      if (hyperedge.vertices.length === before) {
        errors.push(`Vertex "${vertexId}" is not in hyperedge "${id}".`);
        return;
      }
      stats.removedIncidences += before - hyperedge.vertices.length;
      affected.hyperedges.add(id);
      affected.vertices.add(vertexId);
      handleEmptyHyperedge(working, hyperedge, operation.emptyHyperedgePolicy, warnings, stats);
      return;
    }
    if (operation.type === GRAPH_MUTATION_OPS.RENAME_HYPEREDGE) {
      const nextId = String(operation.newHyperedgeId).trim();
      if (working.has(nextId)) {
        errors.push(`Hyperedge "${nextId}" already exists.`);
        return;
      }
      working.delete(id);
      hyperedge.id = nextId;
      working.set(nextId, hyperedge);
      stats.renamedHyperedges += 1;
      affected.hyperedges.add(id);
      affected.hyperedges.add(nextId);
      return;
    }
    if (operation.type === GRAPH_MUTATION_OPS.RENAME_VERTEX) {
      const oldId = String(operation.vertexId).trim();
      const newId = String(operation.newVertexId).trim();
      if (!newId) {
        errors.push("New vertex ID cannot be empty.");
        return;
      }
      let touched = 0;
      for (const h of working.values()) {
        if (!h.vertices.map(String).includes(oldId)) continue;
        h.vertices = uniqueVertices(h.vertices.map(vertex => String(vertex) === oldId ? newId : vertex));
        affected.hyperedges.add(h.id);
        touched += 1;
      }
      if (!touched) {
        errors.push(`Vertex "${oldId}" does not exist.`);
        return;
      }
      stats.renamedVertices += 1;
      affected.vertices.add(oldId);
      affected.vertices.add(newId);
      return;
    }
    if (operation.type === GRAPH_MUTATION_OPS.REMOVE_VERTEX_GLOBAL) {
      const vertexId = String(operation.vertexId).trim();
      let touched = 0;
      for (const h of [...working.values()]) {
        const before = h.vertices.length;
        h.vertices = h.vertices.filter(vertex => String(vertex) !== vertexId);
        if (h.vertices.length === before) continue;
        touched += 1;
        stats.removedIncidences += before - h.vertices.length;
        affected.hyperedges.add(h.id);
        handleEmptyHyperedge(working, h, operation.emptyHyperedgePolicy, warnings, stats);
      }
      if (!touched) {
        errors.push(`Vertex "${vertexId}" does not exist.`);
        return;
      }
      affected.vertices.add(vertexId);
      return;
    }
    if (operation.type === GRAPH_MUTATION_OPS.SET_HYPEREDGE_WEIGHT) {
      hyperedge.weight = Number(operation.weight);
      stats.attributeChanges += 1;
      affected.hyperedges.add(id);
      return;
    }
    if (operation.type === GRAPH_MUTATION_OPS.SET_HYPEREDGE_TIME) {
      hyperedge.time = operation.time ?? null;
      stats.attributeChanges += 1;
      affected.hyperedges.add(id);
      return;
    }
    if (operation.type === GRAPH_MUTATION_OPS.SET_HYPEREDGE_ATTRIBUTE) {
      const key = String(operation.key).trim();
      if (PROTOTYPE_POLLUTION_KEYS.has(key)) {
        errors.push(`Attribute key "${key}" is blocked.`);
        return;
      }
      hyperedge.attributes = { ...(hyperedge.attributes ?? {}), [key]: operation.value };
      stats.attributeChanges += 1;
      affected.hyperedges.add(id);
      return;
    }
    if (operation.type === GRAPH_MUTATION_OPS.REMOVE_HYPEREDGE_ATTRIBUTE) {
      const key = String(operation.key).trim();
      if (!Object.prototype.hasOwnProperty.call(hyperedge.attributes ?? {}, key)) {
        warnings.push(`Attribute "${key}" is not present on hyperedge "${id}".`);
        return;
      }
      const nextAttributes = { ...(hyperedge.attributes ?? {}) };
      delete nextAttributes[key];
      hyperedge.attributes = nextAttributes;
      stats.attributeChanges += 1;
      affected.hyperedges.add(id);
    }
  };

  for (const operation of plan.operations) {
    if (errors.length) break;
    applyOne(operation);
  }
  if (errors.length) return { ok: false, errors, warnings, hyperedges: baseHyperedges };
  const hyperedges = [...working.values()].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: "base" }));
  return {
    ok: true,
    hyperedges,
    warnings,
    errors: [],
    stats,
    affected: {
      hyperedges: [...affected.hyperedges].sort(),
      vertices: [...affected.vertices].sort(),
    },
    beforeFingerprint: graphFingerprint(baseHyperedges),
    afterFingerprint: graphFingerprint(hyperedges),
  };
}

function uniqueVertices(vertices) {
  const seen = new Set();
  const out = [];
  for (const vertex of vertices ?? []) {
    const key = String(vertex).trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(typeof vertex === "number" ? vertex : key);
  }
  return out;
}

function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...value } : {};
}

function handleEmptyHyperedge(working, hyperedge, policy, warnings, stats) {
  if (hyperedge.vertices.length > 0) return;
  if (policy === EMPTY_HYPEREDGE_POLICIES.REMOVE_EMPTY) {
    working.delete(hyperedge.id);
    stats.removedHyperedges += 1;
    warnings.push(`Hyperedge "${hyperedge.id}" became empty and was removed by policy.`);
  } else if (policy === EMPTY_HYPEREDGE_POLICIES.KEEP_EMPTY) {
    warnings.push(`Hyperedge "${hyperedge.id}" is now empty and was kept by policy.`);
  }
}

