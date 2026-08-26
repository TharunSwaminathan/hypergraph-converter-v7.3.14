// Batch-update mini-language: ADD_HYPEREDGE, ADD_VERTEX, REMOVE_VERTEX, UPDATE_WEIGHT, UPDATE_TIME, SET_ATTR.

import { cleanToken, extractMeta, tok } from "./parsers.js";
import { applyGraphMutationPlan } from "../graph/graphMutationEngine.js";
import { createMutationPlan } from "../graph/graphMutationValidator.js";

export function parseBatchUpdates(text) {
  const updates = [];
  const lines = String(text || "").split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith("#"));
  for (const line of lines) {
    const tryCmd = (prefix, op, handler) => {
      if (!line.startsWith(prefix)) return false;
      const body = line.slice(prefix.length).trim();
      handler(body, op);
      return true;
    };
    if (tryCmd("ADD_HYPEREDGE ", "ADD_HYPEREDGE", (body) => {
      const ci = body.indexOf(":"); if (ci === -1) { updates.push({ op: "UNKNOWN", warning: "Missing colon: " + line }); return; }
      updates.push({ op: "ADD_HYPEREDGE", id: body.slice(0, ci).trim(), vertices: body.slice(ci + 1).split(",").map(v => v.trim()).filter(Boolean) });
    })) continue;
    if (tryCmd("REMOVE_HYPEREDGE ", "REMOVE_HYPEREDGE", (body) => { updates.push({ op: "REMOVE_HYPEREDGE", id: body.trim() }); })) continue;
    if (tryCmd("ADD_VERTEX ", "ADD_VERTEX", (body) => {
      const ci = body.indexOf(":"); if (ci === -1) { updates.push({ op: "UNKNOWN", warning: "Missing colon: " + line }); return; }
      updates.push({ op: "ADD_VERTEX", id: body.slice(0, ci).trim(), vertex: body.slice(ci + 1).trim() });
    })) continue;
    if (tryCmd("REMOVE_VERTEX ", "REMOVE_VERTEX", (body) => {
      const ci = body.indexOf(":"); if (ci === -1) { updates.push({ op: "UNKNOWN", warning: "Missing colon: " + line }); return; }
      updates.push({ op: "REMOVE_VERTEX", id: body.slice(0, ci).trim(), vertex: body.slice(ci + 1).trim() });
    })) continue;
    if (tryCmd("UPDATE_WEIGHT ", "UPDATE_WEIGHT", (body) => {
      const ci = body.indexOf(":"); if (ci === -1) { updates.push({ op: "UNKNOWN", warning: "Missing colon: " + line }); return; }
      updates.push({ op: "UPDATE_WEIGHT", id: body.slice(0, ci).trim(), weight: Number(body.slice(ci + 1).trim()) });
    })) continue;
    if (tryCmd("UPDATE_TIME ", "UPDATE_TIME", (body) => {
      const ci = body.indexOf(":"); if (ci === -1) { updates.push({ op: "UNKNOWN", warning: "Missing colon: " + line }); return; }
      updates.push({ op: "UPDATE_TIME", id: body.slice(0, ci).trim(), time: body.slice(ci + 1).trim() });
    })) continue;
    if (tryCmd("SET_ATTR ", "SET_ATTR", (body) => {
      const ci = body.indexOf(":"); if (ci === -1) { updates.push({ op: "UNKNOWN", warning: "Missing colon: " + line }); return; }
      const attr = body.slice(ci + 1).trim(); const ei = attr.indexOf("=");
      if (ei === -1) { updates.push({ op: "UNKNOWN", warning: "Missing = in SET_ATTR: " + line }); return; }
      updates.push({ op: "SET_ATTR", id: body.slice(0, ci).trim(), key: attr.slice(0, ei).trim(), value: attr.slice(ei + 1).trim() });
    })) continue;
    // Legacy: ADD / UPDATE / DELETE
    const upper = line.toUpperCase();
    if (upper.startsWith("DELETE ")) { updates.push({ op: "REMOVE_HYPEREDGE", id: line.slice(7).trim() }); continue; }
    if (upper.startsWith("ADD ") || upper.startsWith("UPDATE ")) {
      const rest = line.slice(upper.startsWith("ADD") ? 4 : 7);
      const { line: cl, meta } = extractMeta(rest);
      const ci = cl.indexOf(":"); if (ci === -1) { updates.push({ op: "UNKNOWN", warning: "Missing colon: " + line }); continue; }
      const id = cleanToken(cl.slice(0, ci));
      const vertices = cl.slice(ci + 1).trim().split(/[\s,]+/).map(tok).filter(v => v !== "");
      updates.push({ op: upper.startsWith("UPDATE") ? "_UPDATE_REPLACE" : "ADD_HYPEREDGE", id, vertices, time: meta.time ?? null, weight: Number(meta.weight ?? 1) });
      continue;
    }
    updates.push({ op: "UNKNOWN", warning: "Unknown command: " + line });
  }
  return updates;
}

export function applyBatchUpdates(baseHyperedges, updates) {
  const warnings = [];
  const operations = batchUpdatesToMutationOperations(updates, { warnings, emptyHyperedgePolicy: "remove_empty" });
  const plan = createMutationPlan({ operations, source: "batch_preview", summary: "Batch update preview" });
  const result = applyGraphMutationPlan(baseHyperedges, plan, {});
  if (!result.ok) return { hyperedges: baseHyperedges, warnings: [...warnings, ...result.errors] };
  return { hyperedges: result.hyperedges, warnings: [...warnings, ...result.warnings] };
}

export function batchUpdatesToMutationOperations(updates, { warnings = [], emptyHyperedgePolicy = "ask" } = {}) {
  const operations = [];
  for (const update of updates ?? []) {
    if (update.op === "UNKNOWN") {
      warnings.push(update.warning);
      continue;
    }
    if (update.op === "ADD_HYPEREDGE") {
      operations.push({
        type: "ADD_HYPEREDGE",
        hyperedgeId: update.id,
        vertices: update.vertices,
        time: update.time ?? null,
        weight: Number(update.weight ?? 1),
      });
      continue;
    }
    if (update.op === "_UPDATE_REPLACE") {
      operations.push({ type: "REMOVE_HYPEREDGE", hyperedgeId: update.id });
      operations.push({
        type: "ADD_HYPEREDGE",
        hyperedgeId: update.id,
        vertices: update.vertices,
        time: update.time ?? null,
        weight: Number(update.weight ?? 1),
      });
      continue;
    }
    if (update.op === "REMOVE_HYPEREDGE") {
      operations.push({ type: "REMOVE_HYPEREDGE", hyperedgeId: update.id });
      continue;
    }
    if (update.op === "ADD_VERTEX") {
      operations.push({ type: "ADD_INCIDENCE", hyperedgeId: update.id, vertexId: update.vertex });
      continue;
    }
    if (update.op === "REMOVE_VERTEX") {
      operations.push({ type: "REMOVE_INCIDENCE", hyperedgeId: update.id, vertexId: update.vertex, emptyHyperedgePolicy });
      continue;
    }
    if (update.op === "UPDATE_WEIGHT") {
      operations.push({ type: "SET_HYPEREDGE_WEIGHT", hyperedgeId: update.id, weight: update.weight });
      continue;
    }
    if (update.op === "UPDATE_TIME") {
      operations.push({ type: "SET_HYPEREDGE_TIME", hyperedgeId: update.id, time: update.time });
      continue;
    }
    if (update.op === "SET_ATTR") {
      operations.push({ type: "SET_HYPEREDGE_ATTRIBUTE", hyperedgeId: update.id, key: update.key, value: update.value });
    }
  }
  return operations;
}

// Auto-detect
