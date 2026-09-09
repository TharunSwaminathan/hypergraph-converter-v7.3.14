import { CANDY_ERROR_CODES, failCandy } from "../contracts/errorClasses.js";
import { validateAlgorithmGraphCompatibility, isOrdinaryGraphType } from "../contracts/graphTypes.js";
import { MAX_NATIVE_EDGES, MAX_NATIVE_VERTICES, MAX_NATIVE_WEIGHT } from "../contracts/algorithmSchemas.js";
import { createVertexMapping } from "./vertexMapping.js";

const DEFAULT_LIMITS = Object.freeze({ maxVertices: 1_000_000, maxEdges: 10_000_000 });

export function validateNativeWeight(weight) {
  if (!Number.isSafeInteger(weight) || weight < 0 || weight > MAX_NATIVE_WEIGHT) {
    failCandy(CANDY_ERROR_CODES.UNSUPPORTED_WEIGHT_MODEL, "Edge weights must be integers from 0 through INT32_MAX.", { weight, max: MAX_NATIVE_WEIGHT });
  }
  return weight;
}

export function canonicalOrdinaryGraphToCsr(graph, policies = {}) {
  if (graph == null || typeof graph !== "object" || Array.isArray(graph)) failCandy(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA, "Canonical graph must be an object.");
  if (!isOrdinaryGraphType(graph.graphType)) {
    validateAlgorithmGraphCompatibility("SSSP", graph.graphType, "STATIC");
  }
  if (graph.directed !== true) failCandy(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA, "Scope 1 CSR adapter accepts directed graphs only.");
  if (!Array.isArray(graph.vertices) || !Array.isArray(graph.edges)) failCandy(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA, "Canonical graph requires vertices and edges arrays.");
  const limits = { ...DEFAULT_LIMITS, ...(policies.limits ?? {}) };
  const duplicatePolicy = policies.duplicatePolicy ?? "REJECT";
  const selfLoopPolicy = policies.selfLoopPolicy ?? "ALLOW";
  if (duplicatePolicy !== "REJECT") failCandy(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA, "Scope 1 duplicate-edge policy must be REJECT.");
  if (!["ALLOW", "REJECT"].includes(selfLoopPolicy)) failCandy(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA, "selfLoopPolicy must be ALLOW or REJECT.");
  if (graph.vertices.length > Math.min(limits.maxVertices, MAX_NATIVE_VERTICES)) failCandy(CANDY_ERROR_CODES.RESOURCE_LIMIT, "Graph exceeds configured vertex limit.");
  if (graph.edges.length > Math.min(limits.maxEdges, MAX_NATIVE_EDGES)) failCandy(CANDY_ERROR_CODES.RESOURCE_LIMIT, "Graph exceeds configured edge limit.");

  const mapping = createVertexMapping(graph.vertices);
  const normalized = graph.edges.map((edge, inputIndex) => {
    if (edge == null || typeof edge !== "object" || Array.isArray(edge)) failCandy(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA, "Each edge must be an object.", { inputIndex });
    const unknown = Object.keys(edge).filter(key => !["source", "target", "weight"].includes(key));
    if (unknown.length || !Object.hasOwn(edge, "source") || !Object.hasOwn(edge, "target") || !Object.hasOwn(edge, "weight")) failCandy(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA, "Edge has missing or unknown fields.", { inputIndex, unknown });
    const source = mapping.toNative(edge.source);
    const target = mapping.toNative(edge.target);
    if (source === target && selfLoopPolicy === "REJECT") failCandy(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA, "Self loops are rejected by the selected policy.", { inputIndex });
    return { source, target, weight: validateNativeWeight(edge.weight), inputIndex };
  });

  normalized.sort((a, b) => a.source - b.source || a.target - b.target || a.weight - b.weight || a.inputIndex - b.inputIndex);
  for (let index = 1; index < normalized.length; index += 1) {
    const previous = normalized[index - 1];
    const current = normalized[index];
    if (previous.source === current.source && previous.target === current.target) {
      failCandy(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA, "Duplicate directed edge rejected.", { sourceNativeIndex: current.source, targetNativeIndex: current.target });
    }
  }

  const rowOffsets = new Array(mapping.entries.length + 1).fill(0);
  for (const edge of normalized) rowOffsets[edge.source + 1] += 1;
  for (let index = 1; index < rowOffsets.length; index += 1) rowOffsets[index] += rowOffsets[index - 1];
  return Object.freeze({
    vertexCount: mapping.entries.length,
    edgeCount: normalized.length,
    directed: true,
    duplicatePolicy,
    selfLoopPolicy,
    rowOffsets: Object.freeze(rowOffsets),
    columnIndices: Object.freeze(normalized.map(edge => edge.target)),
    weights: Object.freeze(normalized.map(edge => edge.weight)),
    mapping,
  });
}
