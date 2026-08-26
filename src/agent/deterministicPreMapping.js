import { buildDeterministicMappingSpec, isExpectedOutputFileName } from "./datasetMappingSpec.js";

const GROUP_COLUMN_PATTERNS = [
  /^id$/i,
  /^event_id$/i,
  /^edge_id$/i,
  /^hyperedge_id$/i,
  /^group_id$/i,
  /^team_id$/i,
  /^cluster_id$/i,
  /^community_id$/i,
  /^basket_id$/i,
  /^transaction_id$/i,
  /^paper_id$/i,
  /^publication_id$/i,
  /^case_id$/i,
  /^record_id$/i,
  /^session_id$/i,
  /^source_id$/i,
];

const MEMBER_COLUMN_PATTERNS = [
  /^participant_id$/i,
  /^member_id$/i,
  /^vertex_id$/i,
  /^node_id$/i,
  /^person_id$/i,
  /^author_id$/i,
  /^item_id$/i,
  /^product_id$/i,
  /^entity_id$/i,
  /^target_id$/i,
];

const TIME_COLUMN_PATTERNS = [/^time$/i, /timestamp/i, /date/i, /year/i];
const WEIGHT_COLUMN_PATTERNS = [/^weight$/i, /severity/i, /score/i, /strength/i];
const SOURCE_COLUMN_PATTERNS = [/^source$/i, /^from$/i, /^u$/i];
const TARGET_COLUMN_PATTERNS = [/^target$/i, /^to$/i, /^v$/i];

function findHeader(headers, patterns) {
  return (headers ?? []).find(header => patterns.some(pattern => pattern.test(String(header).trim()))) ?? null;
}

function validationEntry(fileName) {
  return { fileName, role: "validation_expected_output", useAsInput: false };
}

export function detectValidationFiles(preview) {
  return (preview?.files ?? [])
    .filter(file => isExpectedOutputFileName(file.fileName))
    .map(file => ({
      fileName: file.fileName,
      role: "validation_expected_output",
      useAsInput: false,
      reason: "Filename matches a deterministic expected-output, validation, truth, gold, or reference pattern.",
    }));
}

export function detectSharedKeys(preview, validationNames = new Set()) {
  const files = (preview?.files ?? []).filter(file => !validationNames.has(file.fileName));
  const shared = [];
  for (let leftIndex = 0; leftIndex < files.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < files.length; rightIndex += 1) {
      const rightHeaders = new Set(files[rightIndex].headers ?? []);
      const columns = (files[leftIndex].headers ?? []).filter(header => rightHeaders.has(header));
      for (const column of columns) {
        const idLike = GROUP_COLUMN_PATTERNS.some(pattern => pattern.test(column));
        shared.push({
          leftFile: files[leftIndex].fileName,
          rightFile: files[rightIndex].fileName,
          column,
          idLike,
        });
      }
    }
  }
  return shared.sort((left, right) => Number(right.idLike) - Number(left.idLike));
}

function matrixDraft(batch, preview, validationFiles) {
  const files = preview.files ?? [];
  const matrix = files.find(file => /\.mtx$/i.test(file.fileName) || /matrix market/i.test((file.firstLines ?? [])[0] ?? ""));
  const rowLabels = files.find(file => /row.*(?:node|label|vert)/i.test(file.fileName));
  const columnLabels = files.find(file => /col.*(?:node|label|vert)/i.test(file.fileName));
  if (!matrix || !rowLabels || !columnLabels) return null;
  const validationNames = new Set(validationFiles.map(file => file.fileName));
  return {
    version: 1,
    datasetType: "matrix_coordinate_graph",
    parseMode: batch?.parseMode ?? "together",
    confidence: 0.96,
    summary: `${matrix.fileName} defines Matrix Market coordinates; ${rowLabels.fileName} and ${columnLabels.fileName} map one-based row and column indices to vertex labels.`,
    files: files.map(file => {
      if (validationNames.has(file.fileName)) return validationEntry(file.fileName);
      if (file.fileName === matrix.fileName) {
        return {
          fileName: file.fileName,
          role: "matrix_coordinate_list",
          useAsInput: true,
          columns: { rowIndex: "rowIndex", columnIndex: "columnIndex", weight: "weight", attributes: [] },
        };
      }
      if ([rowLabels.fileName, columnLabels.fileName].includes(file.fileName)) {
        return { fileName: file.fileName, role: "vertex_metadata", useAsInput: true, columns: { attributes: [] } };
      }
      return { fileName: file.fileName, role: "ignored", useAsInput: false };
    }),
    output: {
      format: "canonicalHyperedges",
      hyperedgeMode: "one_per_matrix_entry",
      vertices: [
        { sourceFile: rowLabels.fileName, lookupColumn: "label", keyColumn: "index", fromFile: matrix.fileName, fromColumn: "rowIndex" },
        { sourceFile: columnLabels.fileName, lookupColumn: "label", keyColumn: "index", fromFile: matrix.fileName, fromColumn: "columnIndex" },
      ],
      weight: { sourceFile: matrix.fileName, column: "weight" },
      attributes: [],
    },
    warnings: [],
    questionsForUser: [],
    assumptions: ["Matrix coordinate indices are one-based."],
  };
}

function knownSparseDraft(batch, preview, validationFiles) {
  const files = preview.files ?? [];
  const validationNames = new Set(validationFiles.map(file => file.fileName));
  const active = files.filter(file => !validationNames.has(file.fileName));
  const nverts = active.find(file => /nverts/i.test(file.fileName));
  const simplices = active.find(file => /simplices/i.test(file.fileName));
  if (nverts && simplices) {
    const times = active.find(file => /times?/i.test(file.fileName));
    return {
      version: 1,
      datasetType: "cornell_snap",
      parseMode: "together",
      confidence: 0.98,
      summary: "Detected a Cornell/SNAP nverts and simplices bundle.",
      files: files.map(file => validationNames.has(file.fileName)
        ? validationEntry(file.fileName)
        : {
          fileName: file.fileName,
          role: file.fileName === nverts.fileName
            ? "cornell_nverts"
            : file.fileName === simplices.fileName
              ? "cornell_simplices"
              : file.fileName === times?.fileName ? "cornell_times" : "ignored",
          useAsInput: [nverts.fileName, simplices.fileName, times?.fileName].includes(file.fileName),
        }),
      output: { format: "canonicalHyperedges", attributes: [] },
      warnings: ["Use the existing Cornell/SNAP route for parsing."],
      questionsForUser: [],
      assumptions: [],
    };
  }
  const csr = active.find(file => /csr/i.test(file.fileName) || file.deterministicRoleGuess === "csr");
  const csc = active.find(file => /csc/i.test(file.fileName) || file.deterministicRoleGuess === "csc");
  if (!csr && !csc) return null;
  const selected = csr ?? csc;
  const datasetType = csc ? "csc" : "csr";
  return {
    version: 1,
    datasetType,
    parseMode: batch?.parseMode ?? "together",
    confidence: 0.9,
    summary: `Detected ${datasetType.toUpperCase()} sparse data in ${selected.fileName}.`,
    files: files.map(file => validationNames.has(file.fileName)
      ? validationEntry(file.fileName)
      : { fileName: file.fileName, role: file.fileName === selected.fileName ? datasetType : "ignored", useAsInput: file.fileName === selected.fileName }),
    output: { format: "canonicalHyperedges", attributes: [] },
    warnings: [`Use the existing ${datasetType.toUpperCase()} route for parsing.`],
    questionsForUser: [],
    assumptions: [],
  };
}

function tabularDraft(batch, preview, validationFiles, sharedKeys) {
  const validationNames = new Set(validationFiles.map(file => file.fileName));
  const active = (preview.files ?? []).filter(file => !validationNames.has(file.fileName));
  const membershipCandidates = active.map(file => ({
    file,
    groupColumn: findHeader(file.headers, GROUP_COLUMN_PATTERNS),
    memberColumn: findHeader(file.headers, MEMBER_COLUMN_PATTERNS),
  })).filter(candidate => candidate.groupColumn && candidate.memberColumn);
  const membership = membershipCandidates[0];

  if (membership) {
    const shared = sharedKeys.find(item => item.column === membership.groupColumn
      && [item.leftFile, item.rightFile].includes(membership.file.fileName));
    const metadata = shared
      ? active.find(file => file.fileName === (shared.leftFile === membership.file.fileName ? shared.rightFile : shared.leftFile))
      : active.find(file => file.fileName !== membership.file.fileName && (file.headers ?? []).includes(membership.groupColumn));
    const timeColumn = findHeader(metadata?.headers, TIME_COLUMN_PATTERNS);
    const weightColumn = findHeader(metadata?.headers, WEIGHT_COLUMN_PATTERNS);
    const metadataAttributes = (metadata?.headers ?? []).filter(header => header !== membership.groupColumn);
    const membershipAttributes = (membership.file.headers ?? []).filter(header => ![membership.groupColumn, membership.memberColumn].includes(header));
    const graphInputCount = metadata ? 2 : 1;
    const severityWeight = weightColumn && /severity/i.test(weightColumn);
    return {
      version: 1,
      datasetType: graphInputCount > 1 ? "multi_file_hypergraph" : "single_file_hypergraph",
      parseMode: batch?.parseMode ?? "together",
      confidence: metadata ? 0.9 : 0.84,
      summary: metadata
        ? `${metadata.fileName} appears to define hyperedge metadata, ${membership.file.fileName} defines membership, and validation files are excluded from graph input.`
        : `${membership.file.fileName} appears to define hyperedge membership; validation files are excluded from graph input.`,
      files: (preview.files ?? []).map(file => {
        if (validationNames.has(file.fileName)) return validationEntry(file.fileName);
        if (file.fileName === membership.file.fileName) {
          return {
            fileName: file.fileName,
            role: /^(edge|hyperedge)_id$/i.test(membership.groupColumn) && /^(node|vertex)_id$/i.test(membership.memberColumn) ? "incidence" : "membership",
            useAsInput: true,
            join: metadata ? {
              leftFile: file.fileName,
              leftKey: membership.groupColumn,
              rightFile: metadata.fileName,
              rightKey: membership.groupColumn,
            } : null,
            columns: {
              hyperedgeId: membership.groupColumn,
              vertexId: membership.memberColumn,
              attributes: membershipAttributes,
            },
          };
        }
        if (metadata && file.fileName === metadata.fileName) {
          return {
            fileName: file.fileName,
            role: "hyperedge_metadata",
            useAsInput: true,
            primaryKey: membership.groupColumn,
            columns: {
              hyperedgeId: membership.groupColumn,
              time: timeColumn,
              weight: severityWeight ? null : weightColumn,
              attributes: metadataAttributes,
            },
          };
        }
        return { fileName: file.fileName, role: "ignored", useAsInput: false };
      }),
      output: {
        format: "canonicalHyperedges",
        hyperedgeId: { sourceFile: metadata?.fileName ?? membership.file.fileName, column: membership.groupColumn },
        vertices: { sourceFile: membership.file.fileName, column: membership.memberColumn, groupBy: membership.groupColumn },
        time: timeColumn ? { sourceFile: metadata.fileName, column: timeColumn } : null,
        weight: severityWeight
          ? {
            type: "mapping",
            sourceFile: metadata.fileName,
            column: weightColumn,
            map: { low: 0.5, medium: 1, high: 2, critical: 3 },
            default: 1,
          }
          : weightColumn ? { sourceFile: metadata.fileName, column: weightColumn } : null,
        attributes: metadata ? [{ sourceFile: metadata.fileName, columns: metadataAttributes }] : [],
      },
      warnings: severityWeight ? [`Weight mapping was inferred from ${metadata.fileName}.${weightColumn}.`] : [],
      questionsForUser: [],
      assumptions: metadata ? [`${membership.file.fileName}.${membership.groupColumn} joins ${metadata.fileName}.${membership.groupColumn}.`] : [],
    };
  }

  const edgeList = active.find(file => findHeader(file.headers, SOURCE_COLUMN_PATTERNS) && findHeader(file.headers, TARGET_COLUMN_PATTERNS));
  if (edgeList) {
    const source = findHeader(edgeList.headers, SOURCE_COLUMN_PATTERNS);
    const target = findHeader(edgeList.headers, TARGET_COLUMN_PATTERNS);
    const time = findHeader(edgeList.headers, TIME_COLUMN_PATTERNS);
    const weight = findHeader(edgeList.headers, WEIGHT_COLUMN_PATTERNS);
    return {
      version: 1,
      datasetType: "single_file_graph_edges",
      parseMode: batch?.parseMode ?? "together",
      confidence: 0.88,
      summary: `${edgeList.fileName} appears to be a pairwise edge list.`,
      files: (preview.files ?? []).map(file => validationNames.has(file.fileName)
        ? validationEntry(file.fileName)
        : file.fileName === edgeList.fileName
          ? { fileName: file.fileName, role: "edge_list", useAsInput: true, columns: { source, target, time, weight, attributes: [] } }
          : { fileName: file.fileName, role: "ignored", useAsInput: false }),
      output: { format: "canonicalHyperedges", attributes: [] },
      warnings: [],
      questionsForUser: [],
      assumptions: ["Each edge-list row becomes one size-2 hyperedge."],
    };
  }
  return null;
}

export function buildDeterministicPreMapping(batch, preview) {
  const validationFiles = detectValidationFiles(preview);
  const validationNames = new Set(validationFiles.map(file => file.fileName));
  const sharedKeys = detectSharedKeys(preview, validationNames);
  const spec = matrixDraft(batch, preview, validationFiles)
    ?? knownSparseDraft(batch, preview, validationFiles)
    ?? tabularDraft(batch, preview, validationFiles, sharedKeys)
    ?? buildDeterministicMappingSpec(batch, preview);
  return {
    spec,
    diagnostics: {
      validationFiles,
      sharedKeys,
      roleGuesses: (preview?.files ?? []).map(file => ({ fileName: file.fileName, role: file.deterministicRoleGuess ?? "unknown" })),
      previewIsPartial: Boolean(preview?.previewIsPartial),
    },
  };
}
