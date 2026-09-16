import { CANDY_SCHEMA_VERSIONS } from "../contracts/schemaVersions.js";
import { canonicalIdentifierKey } from "./identifierMapping.js";
import { canonicalizeHypergraphIncidence, isCanonicalHypergraphIncidence } from "./hypergraphIncidenceAdapter.js";
import { validateHypergraphMotifUpdate } from "../contracts/hypergraphMotifSchemas.js";

export function applyHypergraphMotifUpdate(baseValue, updateValue) {
  const base = isCanonicalHypergraphIncidence(baseValue)
    ? baseValue
    : canonicalizeHypergraphIncidence(baseValue);
  const update = validateHypergraphMotifUpdate(updateValue, base);
  const deletedKeys = new Set(update.deletions.map(id => canonicalIdentifierKey(id)));
  const baseHyperedges = base.hyperedges
    .filter(hyperedge => !deletedKeys.has(canonicalIdentifierKey(hyperedge.canonicalId)))
    .map(hyperedge => ({
      id: hyperedge.canonicalId,
      vertices: hyperedge.vertexNativeIndices.map(base.vertexMapping.toCanonical),
    }));
  const insertions = update.insertions.map(insertion => ({
    id: insertion.id,
    vertices: [...insertion.vertices],
  }));
  const verticesByKey = new Map(base.vertexMapping.entries.map(entry => [entry.key, entry.canonicalId]));
  for (const insertion of insertions) {
    for (const vertexId of insertion.vertices) verticesByKey.set(canonicalIdentifierKey(vertexId), vertexId);
  }
  const updatedValue = {
    schemaVersion: CANDY_SCHEMA_VERSIONS.HYPERGRAPH_INCIDENCE,
    graphId: base.graphId,
    graphVersion: update.nextGraphVersion,
    graphType: base.graphType,
    vertices: Object.freeze([...verticesByKey.values()]),
    hyperedges: Object.freeze([...baseHyperedges, ...insertions].map(hyperedge => Object.freeze({
      id: hyperedge.id,
      vertices: Object.freeze(hyperedge.vertices),
    }))),
    provenance: Object.freeze({
      sourceGraphRef: Object.freeze({ graphId: base.graphId, graphVersion: base.graphVersion }),
      updateId: update.updateId,
      ordering: update.ordering,
    }),
  };
  return Object.freeze({
    update,
    value: Object.freeze(updatedValue),
    canonical: canonicalizeHypergraphIncidence(updatedValue),
  });
}
