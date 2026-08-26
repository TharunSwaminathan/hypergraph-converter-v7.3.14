export const DATASET_MAPPING_SPEC_V2_VERSION = 2;

export const DATASET_MAPPING_V2_FILE_ROLES = Object.freeze([
  "vertex_table",
  "hyperedge_table",
  "membership",
  "incidence",
  "edge_list",
  "hyperedge_list",
  "matrix_coordinate_list",
  "hyperedge_metadata",
  "vertex_metadata",
  "edge_metadata",
  "lookup",
  "weights",
  "timestamps",
  "labels",
  "csr",
  "csc",
  "cornell_nverts",
  "cornell_simplices",
  "cornell_times",
  "validation_expected_output",
  "update_stream",
  "ignored",
  "unknown",
]);

export const DATASET_MAPPING_V2_POLICIES = Object.freeze({
  duplicateMembership: ["deduplicate"],
  missingHyperedgeReference: ["warn_skip", "error", "create_raw"],
  missingVertexReference: ["warn_use_raw_id", "warn_skip", "error"],
  unmatchedHyperedgeRows: ["drop", "preserve_empty", "error"],
  emptyHyperedges: ["keep", "drop", "error"],
  invalidNumericWeight: ["default_one", "warn_default_one", "error"],
  invalidTime: ["preserve_raw", "null_with_warning", "error"],
});

export const DEFAULT_DATASET_MAPPING_V2_POLICIES = Object.freeze({
  duplicateMembership: "deduplicate",
  missingHyperedgeReference: "warn_skip",
  missingVertexReference: "warn_use_raw_id",
  unmatchedHyperedgeRows: "drop",
  emptyHyperedges: "drop",
  invalidNumericWeight: "warn_default_one",
  invalidTime: "preserve_raw",
});

export const DATASET_MAPPING_SPEC_V2_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: [
    "version",
    "batchId",
    "batchVersion",
    "groupingRevision",
    "mappingRevision",
    "datasetType",
    "parseMode",
    "confidence",
    "summary",
    "activeGroupId",
    "groups",
    "files",
    "entities",
    "relationships",
    "filters",
    "policies",
    "output",
    "evidence",
    "warnings",
    "questionsForUser",
    "assumptions",
  ],
  properties: {
    version: { type: "integer", enum: [2] },
    parseMode: { type: "string", enum: ["together", "separate", "grouped", "unknown"] },
    output: { type: "object", additionalProperties: false, required: ["format"], properties: { format: { enum: ["canonicalHyperedges"] } } },
  },
});

export function defaultIdRule(overrides = {}) {
  return {
    trim: true,
    case: "preserve",
    separator: "::",
    prefix: null,
    includeColumns: [],
    ...overrides,
  };
}

export function createDatasetMappingSpecV2({
  batchId = "",
  batchVersion = 1,
  groupingRevision = 0,
  mappingRevision = 0,
  datasetType = "unknown",
  parseMode = "unknown",
  confidence = 0.5,
  summary = "Dataset mapping requires review.",
  activeGroupId = "group-main",
  groups = [],
  files = [],
  entities = { vertices: [], hyperedges: [] },
  relationships = [],
  filters = [],
  policies = DEFAULT_DATASET_MAPPING_V2_POLICIES,
  evidence = [],
  warnings = [],
  questionsForUser = [],
  assumptions = [],
} = {}) {
  return {
    version: DATASET_MAPPING_SPEC_V2_VERSION,
    batchId,
    batchVersion,
    groupingRevision,
    mappingRevision,
    datasetType,
    parseMode,
    confidence,
    summary,
    activeGroupId,
    groups,
    files,
    entities,
    relationships,
    filters,
    policies: { ...DEFAULT_DATASET_MAPPING_V2_POLICIES, ...policies },
    output: { format: "canonicalHyperedges" },
    evidence,
    warnings,
    questionsForUser,
    assumptions,
  };
}

export function canonicalMappingString(spec) {
  return JSON.stringify(spec, Object.keys(JSON.parse(JSON.stringify(spec))).sort());
}

export function mappingFingerprint(spec) {
  const text = JSON.stringify(spec ?? {});
  let hash = 2166136261;
  for (const char of text) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `mapping-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
