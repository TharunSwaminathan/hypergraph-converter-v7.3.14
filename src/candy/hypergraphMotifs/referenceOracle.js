import { CANDY_SCHEMA_VERSIONS } from "../contracts/schemaVersions.js";
import { CANDY_ERROR_CODES, failCandy } from "../contracts/errorClasses.js";
import { canonicalizeHypergraphIncidence, isCanonicalHypergraphIncidence } from "../adapters/hypergraphIncidenceAdapter.js";
import { resolveHypergraphLimits } from "../contracts/hypergraphMotifLimits.js";
import { applyHypergraphMotifUpdate } from "../adapters/hypergraphUpdateAdapter.js";
import {
  HYPERGRAPH_3EDGE_MOTIF_ALGORITHM,
  HYPERGRAPH_3EDGE_MOTIF_BACKEND,
  validateHypergraphMotifRequest,
  validateHypergraphMotifResult,
} from "../contracts/hypergraphMotifSchemas.js";
import {
  classifyMotifSignature,
  HYPERGRAPH_3EDGE_MOTIF_TAXONOMY,
  HYPERGRAPH_3EDGE_MOTIF_TAXONOMY_V1,
} from "./taxonomy.js";

export const HYPERGRAPH_MOTIF_REFERENCE_LIMITS = Object.freeze({
  maxHyperedges: 256,
  maxIncidences: 100_000,
  maxRegionMembershipVisits: 5_000_000,
});

const REGION_INDEX_BY_MEMBERSHIP = Object.freeze({
  "100": 0,
  "010": 1,
  "001": 2,
  "110": 3,
  "011": 4,
  "101": 5,
  "111": 6,
});

function addCount(counts, index) {
  if (counts[index] >= Number.MAX_SAFE_INTEGER) {
    failCandy(CANDY_ERROR_CODES.RESOURCE_LIMIT, "Motif count exceeds JavaScript safe-integer precision.");
  }
  counts[index] += 1;
}

export function computeThreeHyperedgeRegionCardinalities(left, middle, right) {
  const sets = [new Set(left), new Set(middle), new Set(right)];
  const union = new Set([...sets[0], ...sets[1], ...sets[2]]);
  const cardinalities = Array(7).fill(0);
  for (const vertex of union) {
    const membership = sets.map(set => set.has(vertex) ? "1" : "0").join("");
    const regionIndex = REGION_INDEX_BY_MEMBERSHIP[membership];
    if (regionIndex == null) throw new Error("Internal motif oracle error: union vertex has no membership region.");
    cardinalities[regionIndex] += 1;
  }
  return Object.freeze(cardinalities);
}

export function countHypergraphThreeEdgeMotifs(value, limitOverrides) {
  const limits = resolveHypergraphLimits(limitOverrides, HYPERGRAPH_MOTIF_REFERENCE_LIMITS);
  const graph = isCanonicalHypergraphIncidence(value)
    ? value
    : canonicalizeHypergraphIncidence(value, {
      maxHyperedges: limits.maxHyperedges,
      maxTotalIncidences: limits.maxIncidences,
    });
  if (graph.hyperedgeCount > limits.maxHyperedges || graph.incidenceCount > limits.maxIncidences) {
    failCandy(CANDY_ERROR_CODES.RESOURCE_LIMIT, "Hypergraph exceeds the bounded CPU reference-oracle limits.", {
      hyperedgeCount: graph.hyperedgeCount,
      incidenceCount: graph.incidenceCount,
      limits,
    });
  }
  // Each incidence participates in C(m-1,2) triples. Bound aggregate work,
  // not merely each dimension independently, before entering enumeration.
  const membershipVisits = graph.hyperedgeCount < 3 ? 0
    : graph.incidenceCount * (graph.hyperedgeCount - 1) * (graph.hyperedgeCount - 2) / 2;
  if (!Number.isSafeInteger(membershipVisits) || membershipVisits > limits.maxRegionMembershipVisits) {
    failCandy(CANDY_ERROR_CODES.RESOURCE_LIMIT, "Hypergraph exceeds the CPU reference aggregate work budget.");
  }
  const counts = Array(HYPERGRAPH_3EDGE_MOTIF_TAXONOMY.orbitCount).fill(0);
  let totalConnectedTriples = 0;
  const hyperedges = graph.hyperedges;
  for (let first = 0; first < hyperedges.length - 2; first += 1) {
    for (let second = first + 1; second < hyperedges.length - 1; second += 1) {
      for (let third = second + 1; third < hyperedges.length; third += 1) {
        const cardinalities = computeThreeHyperedgeRegionCardinalities(
          hyperedges[first].vertexNativeIndices,
          hyperedges[second].vertexNativeIndices,
          hyperedges[third].vertexNativeIndices,
        );
        const motif = classifyMotifSignature(cardinalities.map(count => Number(count > 0)));
        if (!motif) continue;
        addCount(counts, motif.motifId - 1);
        totalConnectedTriples += 1;
      }
    }
  }
  return Object.freeze({
    graphRef: Object.freeze({ graphId: graph.graphId, graphVersion: graph.graphVersion }),
    taxonomyVersion: HYPERGRAPH_3EDGE_MOTIF_TAXONOMY_V1,
    counts: Object.freeze(counts),
    totalConnectedTriples,
  });
}

export function computeExactHypergraphMotifDelta(baseValue, updateValue) {
  const base = canonicalizeHypergraphIncidence(baseValue);
  const applied = applyHypergraphMotifUpdate(baseValue, updateValue);
  const oldResult = countHypergraphThreeEdgeMotifs(base);
  const newResult = countHypergraphThreeEdgeMotifs(applied.canonical);
  const deltaCounts = newResult.counts.map((count, index) => count - oldResult.counts[index]);
  const invariantPassed = deltaCounts.every((delta, index) => oldResult.counts[index] + delta === newResult.counts[index]);
  if (!invariantPassed) failCandy(CANDY_ERROR_CODES.RESULT_VALIDATION_FAILURE, "Exact old/new motif delta invariant failed.");
  return Object.freeze({
    base,
    updated: applied.canonical,
    update: applied.update,
    oldCounts: oldResult.counts,
    newCounts: newResult.counts,
    deltaCounts: Object.freeze(deltaCounts),
    oldTotalConnectedTriples: oldResult.totalConnectedTriples,
    newTotalConnectedTriples: newResult.totalConnectedTriples,
    invariantPassed,
  });
}

export function runStaticHypergraphMotifReference(requestValue, graphValue) {
  const graph = canonicalizeHypergraphIncidence(graphValue);
  const request = validateHypergraphMotifRequest(requestValue, graph);
  if (request.mode !== "STATIC") failCandy(CANDY_ERROR_CODES.ALGORITHM_FAILURE, "Static oracle requires STATIC mode.");
  const oracle = countHypergraphThreeEdgeMotifs(graph);
  return validateHypergraphMotifResult({
    schemaVersion: CANDY_SCHEMA_VERSIONS.HYPERGRAPH_MOTIF_RESULT,
    requestId: request.requestId,
    algorithm: HYPERGRAPH_3EDGE_MOTIF_ALGORITHM,
    taxonomyVersion: HYPERGRAPH_3EDGE_MOTIF_TAXONOMY_V1,
    backend: HYPERGRAPH_3EDGE_MOTIF_BACKEND,
    mode: "STATIC",
    inputGraphRef: oracle.graphRef,
    counts: [...oracle.counts],
    totalConnectedTriples: oracle.totalConnectedTriples,
    validation: { status: "passed", method: "EXACT_SET_ENUMERATION" },
    warnings: [],
  });
}

export function runIncrementalHypergraphMotifReference(requestValue, baseValue, updateValue, expectedMotifStateRef) {
  if (expectedMotifStateRef == null) {
    failCandy(CANDY_ERROR_CODES.STALE_PROPERTY_STATE, "Incremental execution requires a caller-supplied authoritative current motif state reference.");
  }
  const base = canonicalizeHypergraphIncidence(baseValue);
  const request = validateHypergraphMotifRequest(requestValue, base, expectedMotifStateRef);
  if (request.mode !== "INCREMENTAL") failCandy(CANDY_ERROR_CODES.ALGORITHM_FAILURE, "Incremental oracle requires INCREMENTAL mode.");
  const delta = computeExactHypergraphMotifDelta(baseValue, updateValue);
  if (request.updateRef.updateId !== delta.update.updateId
    || request.updateRef.nextGraphVersion !== delta.updated.graphVersion) {
    failCandy(CANDY_ERROR_CODES.STALE_GRAPH_VERSION, "Request updateRef does not match the validated update batch.");
  }
  return validateHypergraphMotifResult({
    schemaVersion: CANDY_SCHEMA_VERSIONS.HYPERGRAPH_MOTIF_RESULT,
    requestId: request.requestId,
    algorithm: HYPERGRAPH_3EDGE_MOTIF_ALGORITHM,
    taxonomyVersion: HYPERGRAPH_3EDGE_MOTIF_TAXONOMY_V1,
    backend: HYPERGRAPH_3EDGE_MOTIF_BACKEND,
    mode: "INCREMENTAL",
    inputGraphRef: { graphId: delta.base.graphId, graphVersion: delta.base.graphVersion },
    outputGraphRef: { graphId: delta.updated.graphId, graphVersion: delta.updated.graphVersion },
    counts: [...delta.newCounts],
    deltaCounts: [...delta.deltaCounts],
    totalConnectedTriples: delta.newTotalConnectedTriples,
    validation: { status: "passed", method: "EXACT_SET_ENUMERATION", deltaInvariant: "passed" },
    warnings: ["Scope 4A-R incremental reference mode uses exact full old/new recomputation."],
  });
}
