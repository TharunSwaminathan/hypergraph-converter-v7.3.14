import { CANDY_SCHEMA_VERSIONS } from "../../../src/candy/contracts/schemaVersions.js";
import { CANDY_ERROR_CODES, CandyContractError } from "../../../src/candy/contracts/errorClasses.js";

function vector(name, values, map = value => String(value)) {
  return `${name} ${values.length}${values.length ? ` ${values.map(map).join(" ")}` : ""}`;
}

export function serializeNativeSsspRequest({ request, graphSnapshot, csr, priorState = null, updates = null }) {
  const stateRequired = request.mode !== "STATIC";
  if (stateRequired && (!priorState || !updates)) throw new CandyContractError(CANDY_ERROR_CODES.STALE_PROPERTY_STATE, `${request.mode} requires immutable prior-state and update artifacts.`);
  const source = csr.mapping.toNative(request.parameters.sourceVertexId);
  const deletions = updates?.deletions ?? [];
  const insertions = updates?.insertions ?? [];
  const common = [
    `mode ${request.mode}`,
    `graph_type ${graphSnapshot.graphType}`,
    `projection_provenance_id ${graphSnapshot.graphType === "ProjectedOrdinaryGraph" ? graphSnapshot.provenance.projection.mappingArtifactRef.id : "-"}`,
    `graph_id ${graphSnapshot.graphId}`,
    `graph_version ${graphSnapshot.graphVersion}`,
    `state_graph_id ${stateRequired ? priorState.graphId : "-"}`,
    `state_graph_version ${stateRequired ? priorState.graphVersion : 0}`,
    `state_version ${stateRequired ? priorState.algorithmStateVersion : 0}`,
    `source ${source}`,
  ];
  const lines = request.backend === "LOCAL_CUDA" ? [
    "CANDY_SSSP_CUDA_REQUEST_V1",
    `backend ${request.backend}`,
    ...common,
    `cuda_device ${request.resourceHints.deviceId}`,
    `vertex_count ${csr.vertexCount}`,
    `edge_count ${csr.edgeCount}`,
    vector("row_offsets", csr.rowOffsets),
    vector("column_indices", csr.columnIndices),
    vector("weights", csr.weights),
    vector("prior_distances", priorState.distances, value => value == null ? "INF" : String(value)),
    vector("prior_parents", priorState.parents),
    `deletion_count ${deletions.length}`,
    ...deletions.map(edge => `d ${csr.mapping.toNative(edge.source)} ${csr.mapping.toNative(edge.target)}`),
    `insertion_count ${insertions.length}`,
    ...insertions.map(edge => `i ${csr.mapping.toNative(edge.source)} ${csr.mapping.toNative(edge.target)} ${edge.weight}`),
    "END",
  ] : [
    "CANDY_SSSP_REQUEST_V1",
    ...common,
    `threads ${request.resourceHints.threads}`,
    `vertex_count ${csr.vertexCount}`,
    `edge_count ${csr.edgeCount}`,
    vector("row_offsets", csr.rowOffsets),
    vector("column_indices", csr.columnIndices),
    vector("weights", csr.weights),
    vector("prior_distances", stateRequired ? priorState.distances : [], value => value == null ? "INF" : String(value)),
    vector("prior_parents", stateRequired ? priorState.parents : []),
    `deletion_count ${deletions.length}`,
    ...deletions.map(edge => `d ${csr.mapping.toNative(edge.source)} ${csr.mapping.toNative(edge.target)}`),
    `insertion_count ${insertions.length}`,
    ...insertions.map(edge => `i ${csr.mapping.toNative(edge.source)} ${csr.mapping.toNative(edge.target)} ${edge.weight}`),
    "END",
  ];
  return `${lines.join("\n")}\n`;
}

export function parseNativeResult(stdout) {
  let value;
  try {
    value = JSON.parse(String(stdout).trim());
  } catch {
    throw new CandyContractError(CANDY_ERROR_CODES.OUTPUT_PARSE_FAILURE, "Native SSSP output was not valid JSON.");
  }
  if (!value || value.schemaVersion !== CANDY_SCHEMA_VERSIONS.NATIVE_RESULT || typeof value.ok !== "boolean") {
    throw new CandyContractError(CANDY_ERROR_CODES.OUTPUT_PARSE_FAILURE, "Native SSSP output used an unknown or malformed schema.");
  }
  if (!value.ok) {
    const code = Object.hasOwn(CANDY_ERROR_CODES, value.error?.classification) ? value.error.classification : CANDY_ERROR_CODES.ALGORITHM_FAILURE;
    throw new CandyContractError(code, "Native SSSP rejected the request.");
  }
  const requiredArrays = Array.isArray(value.distances) && Array.isArray(value.parents);
  if (value.algorithm !== "SSSP" || !requiredArrays || value.distances.length !== value.vertexCount || value.parents.length !== value.vertexCount) {
    throw new CandyContractError(CANDY_ERROR_CODES.OUTPUT_PARSE_FAILURE, "Native SSSP result shape is invalid.");
  }
  return value;
}
