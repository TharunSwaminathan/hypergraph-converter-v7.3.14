export const DATASET_TYPES = new Set([
  "single_file_hypergraph",
  "single_file_graph_edges",
  "multi_file_hypergraph",
  "multi_file_graph_edges",
  "matrix_coordinate_graph",
  "cornell_snap",
  "csr",
  "csc",
  "metadata_only",
  "unknown",
]);

export const MAPPING_FILE_ROLES = new Set([
  "hyperedge_list",
  "vertex_list",
  "membership",
  "incidence",
  "edge_list",
  "matrix_coordinate_list",
  "hyperedge_metadata",
  "vertex_metadata",
  "edge_metadata",
  "weights",
  "timestamps",
  "labels",
  "csr",
  "csc",
  "cornell_nverts",
  "cornell_simplices",
  "cornell_times",
  "validation_expected_output",
  "ignored",
  "unknown",
]);

export const EXPECTED_OUTPUT_NAME = /^(?:expected(?:[-_ ]?output)?|targets?|answers?|validation|ground[-_ ]?truth|truth|gold|reference(?:[-_ ]?output)?)(?:[._-].*)?\.(?:json|txt|csv)$/i;

const FILE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["fileName", "role", "useAsInput"],
  properties: {
    fileName: { type: "string" },
    role: { type: "string", enum: [...MAPPING_FILE_ROLES] },
    useAsInput: { type: "boolean" },
    primaryKey: { type: ["string", "null"] },
    join: {
      type: ["object", "null"],
      additionalProperties: false,
      required: ["leftFile", "leftKey", "rightFile", "rightKey"],
      properties: {
        leftFile: { type: "string" },
        leftKey: { type: "string" },
        rightFile: { type: "string" },
        rightKey: { type: "string" },
      },
    },
    columns: {
      type: "object",
      additionalProperties: false,
      properties: {
        hyperedgeId: { type: ["string", "null"] },
        vertexId: { type: ["string", "null"] },
        source: { type: ["string", "null"] },
        target: { type: ["string", "null"] },
        rowIndex: { type: ["string", "null"] },
        columnIndex: { type: ["string", "null"] },
        time: { type: ["string", "null"] },
        weight: { type: ["string", "null"] },
        attributes: { type: "array", items: { type: "string" } },
      },
    },
  },
};

export const DATASET_MAPPING_SPEC_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["version", "datasetType", "parseMode", "confidence", "summary", "files", "output", "warnings", "questionsForUser", "assumptions"],
  properties: {
    version: { type: "integer", enum: [1] },
    datasetType: { type: "string", enum: [...DATASET_TYPES] },
    parseMode: { type: "string", enum: ["together", "separate", "unknown"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    summary: { type: "string" },
    files: { type: "array", items: FILE_SCHEMA },
    output: {
      type: "object",
      additionalProperties: false,
      required: ["format"],
      properties: {
        format: { type: "string", enum: ["canonicalHyperedges"] },
        hyperedgeMode: { type: "string" },
        hyperedgeId: {
          type: ["object", "null"],
          additionalProperties: false,
          properties: {
            sourceFile: { type: "string" },
            column: { type: "string" },
          },
        },
        vertices: {
          type: ["object", "array"],
          additionalProperties: false,
          properties: {
            sourceFile: { type: "string" },
            column: { type: "string" },
            groupBy: { type: "string" },
          },
          items: {
            type: "object",
            additionalProperties: false,
            required: ["sourceFile", "lookupColumn", "keyColumn", "fromFile", "fromColumn"],
            properties: {
              sourceFile: { type: "string" },
              lookupColumn: { type: "string" },
              keyColumn: { type: "string" },
              fromFile: { type: "string" },
              fromColumn: { type: "string", enum: ["rowIndex", "columnIndex"] },
            },
          },
        },
        time: {
          type: ["object", "null"],
          additionalProperties: false,
          properties: {
            sourceFile: { type: "string" },
            column: { type: ["string", "null"] },
          },
        },
        weight: {
          type: ["object", "null"],
          additionalProperties: false,
          properties: {
            type: { type: "string" },
            sourceFile: { type: "string" },
            column: { type: ["string", "null"] },
            map: { type: "object", additionalProperties: { type: "number" } },
            default: { type: "number" },
          },
        },
        attributes: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["sourceFile", "columns"],
            properties: {
              sourceFile: { type: "string" },
              columns: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
    },
    warnings: { type: "array", items: { type: "string" } },
    questionsForUser: { type: "array", items: { type: "string" } },
    assumptions: { type: "array", items: { type: "string" } },
  },
};

export function isExpectedOutputFileName(fileName) {
  return EXPECTED_OUTPUT_NAME.test(String(fileName ?? "").toLowerCase());
}

function findHeader(headers, patterns) {
  return headers.find(header => patterns.some(pattern => pattern.test(String(header)))) ?? null;
}

export function buildDeterministicMappingSpec(batch, preview) {
  const previews = preview?.files ?? [];
  const expectedNames = new Set(previews.filter(file => isExpectedOutputFileName(file.fileName)).map(file => file.fileName));
  const matrix = previews.find(file => /\.mtx$/i.test(file.fileName) || file.deterministicRoleGuess === "matrix");
  const rowLabels = previews.find(file => /row.*(?:node|label|vert)/i.test(file.fileName));
  const colLabels = previews.find(file => /col.*(?:node|label|vert)/i.test(file.fileName));

  if (matrix && rowLabels && colLabels) {
    return {
      version: 1,
      datasetType: "matrix_coordinate_graph",
      parseMode: "together",
      confidence: 0.95,
      summary: `${matrix.fileName} defines matrix coordinates; row and column files map one-based indices to vertex labels.`,
      files: previews.map(file => ({
        fileName: file.fileName,
        role: file.fileName === matrix.fileName
          ? "matrix_coordinate_list"
          : file.fileName === rowLabels.fileName || file.fileName === colLabels.fileName
            ? "vertex_metadata"
            : expectedNames.has(file.fileName) ? "validation_expected_output" : "ignored",
        useAsInput: !expectedNames.has(file.fileName),
        columns: file.fileName === matrix.fileName
          ? { rowIndex: "rowIndex", columnIndex: "columnIndex", weight: "weight", attributes: [] }
          : { attributes: [] },
      })),
      output: {
        format: "canonicalHyperedges",
        hyperedgeMode: "one_per_matrix_entry",
        vertices: [
          { sourceFile: rowLabels.fileName, lookupColumn: "label", keyColumn: "index", fromFile: matrix.fileName, fromColumn: "rowIndex" },
          { sourceFile: colLabels.fileName, lookupColumn: "label", keyColumn: "index", fromFile: matrix.fileName, fromColumn: "columnIndex" },
        ],
        weight: { sourceFile: matrix.fileName, column: "weight" },
        attributes: [],
      },
      warnings: [],
      questionsForUser: [],
      assumptions: ["Matrix indices are one-based."],
    };
  }

  const candidates = previews.filter(file => !expectedNames.has(file.fileName));
  const membership = candidates.find(file => {
    const headers = file.headers ?? [];
    return findHeader(headers, [/edge/i, /event/i, /group/i, /hyper/i])
      && findHeader(headers, [/vertex/i, /participant/i, /member/i, /node/i]);
  });
  if (membership) {
    const edgeColumn = findHeader(membership.headers ?? [], [/^edge$/i, /event.*id/i, /group.*id/i, /hyper.*id/i, /edge.*id/i]) ?? membership.headers?.[0];
    const vertexColumn = findHeader(membership.headers ?? [], [/vertex.*id/i, /participant.*id/i, /member.*id/i, /node.*id/i]) ?? membership.headers?.[1];
    const metadata = candidates.find(file => file.fileName !== membership.fileName && (file.headers ?? []).includes(edgeColumn));
    return {
      version: 1,
      datasetType: candidates.length > 1 ? "multi_file_hypergraph" : "single_file_hypergraph",
      parseMode: batch?.parseMode ?? "together",
      confidence: metadata ? 0.9 : 0.82,
      summary: metadata
        ? `${membership.fileName} defines membership and ${metadata.fileName} defines hyperedge metadata joined by ${edgeColumn}.`
        : `${membership.fileName} defines hyperedge membership.`,
      files: previews.map(file => {
        if (expectedNames.has(file.fileName)) return { fileName: file.fileName, role: "validation_expected_output", useAsInput: false };
        if (file.fileName === membership.fileName) {
          return {
            fileName: file.fileName,
            role: "membership",
            useAsInput: true,
            join: metadata ? { leftFile: file.fileName, leftKey: edgeColumn, rightFile: metadata.fileName, rightKey: edgeColumn } : null,
            columns: { hyperedgeId: edgeColumn, vertexId: vertexColumn, attributes: (file.headers ?? []).filter(header => ![edgeColumn, vertexColumn].includes(header)) },
          };
        }
        if (metadata && file.fileName === metadata.fileName) {
          return {
            fileName: file.fileName,
            role: "hyperedge_metadata",
            useAsInput: true,
            primaryKey: edgeColumn,
            columns: {
              hyperedgeId: edgeColumn,
              time: findHeader(file.headers ?? [], [/time/i, /year/i, /date/i]),
              weight: findHeader(file.headers ?? [], [/weight/i]),
              attributes: (file.headers ?? []).filter(header => header !== edgeColumn),
            },
          };
        }
        return { fileName: file.fileName, role: "unknown", useAsInput: false };
      }),
      output: {
        format: "canonicalHyperedges",
        hyperedgeId: { sourceFile: membership.fileName, column: edgeColumn },
        vertices: { sourceFile: membership.fileName, column: vertexColumn, groupBy: edgeColumn },
        time: metadata ? { sourceFile: metadata.fileName, column: findHeader(metadata.headers ?? [], [/time/i, /year/i, /date/i]) } : null,
        weight: metadata ? { sourceFile: metadata.fileName, column: findHeader(metadata.headers ?? [], [/weight/i]) } : null,
        attributes: metadata ? [{ sourceFile: metadata.fileName, columns: (metadata.headers ?? []).filter(header => header !== edgeColumn) }] : [],
      },
      warnings: [],
      questionsForUser: [],
      assumptions: metadata ? [`${edgeColumn} joins membership and metadata files.`] : [],
    };
  }

  return {
    version: 1,
    datasetType: candidates.length === 1 ? "single_file_hypergraph" : "unknown",
    parseMode: batch?.parseMode ?? "unknown",
    confidence: 0.35,
    summary: "The deterministic detector could not infer a complete generalized mapping.",
    files: previews.map(file => ({
      fileName: file.fileName,
      role: expectedNames.has(file.fileName) ? "validation_expected_output" : "unknown",
      useAsInput: !expectedNames.has(file.fileName),
    })),
    output: { format: "canonicalHyperedges", attributes: [] },
    warnings: ["Review file roles and column mappings before generating a parser."],
    questionsForUser: ["Which columns identify hyperedges and vertices?"],
    assumptions: [],
  };
}
