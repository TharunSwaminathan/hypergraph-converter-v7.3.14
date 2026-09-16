export const CANDY_SCHEMA_VERSIONS = Object.freeze({
  GRAPH_SNAPSHOT: "candy.graph-snapshot/1",
  GRAPH_UPDATE_BATCH: "candy.graph-update-batch/1",
  ALGORITHM_REQUEST: "candy.algorithm-request/1",
  ALGORITHM_RESULT: "candy.algorithm-result/1",
  ALGORITHM_ERROR: "candy.algorithm-error/1",
  VERTEX_MAPPING: "candy.vertex-mapping/1",
  NATIVE_REQUEST: "candy.native-sssp-request/1",
  NATIVE_RESULT: "candy.native-sssp-result/1",
  HYPERGRAPH_INCIDENCE: "candy.hypergraph-incidence/1",
  HYPEREDGE_MAPPING: "candy.hyperedge-mapping/1",
  HYPERGRAPH_MOTIF_REQUEST: "candy.hypergraph-3edge-motif-request/1",
  HYPERGRAPH_MOTIF_UPDATE: "candy.hypergraph-3edge-motif-update/1",
  HYPERGRAPH_MOTIF_STATE: "candy.hypergraph-3edge-motif-state/1",
  HYPERGRAPH_MOTIF_RESULT: "candy.hypergraph-3edge-motif-result/1",
});

export function isKnownSchemaVersion(value) {
  return Object.values(CANDY_SCHEMA_VERSIONS).includes(value);
}
