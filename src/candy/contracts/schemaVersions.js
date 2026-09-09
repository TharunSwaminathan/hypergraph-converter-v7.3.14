export const CANDY_SCHEMA_VERSIONS = Object.freeze({
  GRAPH_SNAPSHOT: "candy.graph-snapshot/1",
  GRAPH_UPDATE_BATCH: "candy.graph-update-batch/1",
  ALGORITHM_REQUEST: "candy.algorithm-request/1",
  ALGORITHM_RESULT: "candy.algorithm-result/1",
  ALGORITHM_ERROR: "candy.algorithm-error/1",
  VERTEX_MAPPING: "candy.vertex-mapping/1",
  NATIVE_REQUEST: "candy.native-sssp-request/1",
  NATIVE_RESULT: "candy.native-sssp-result/1",
});

export function isKnownSchemaVersion(value) {
  return Object.values(CANDY_SCHEMA_VERSIONS).includes(value);
}
