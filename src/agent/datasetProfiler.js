import { detectDelimiter, parseDelimited, splitLines } from "../utils/delimitedText.js";
import { arrayMin, arrayMax } from "../utils/numeric.js";

export const DATASET_PROFILE_LIMITS = Object.freeze({
  maxFiles: 50,
  maxExactProfileBytes: 2_000_000,
  maxSampleRows: 2000,
  maxSampleChars: 250_000,
  maxColumns: 100,
  maxSampleValuesPerColumn: 12,
  maxCompositeKeyWidth: 3,
});

const NULL_VALUES = new Set(["", "null", "undefined", "na", "n/a", "nan"]);

function stableHash(value = "") {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function extensionOf(fileName = "") {
  const match = String(fileName).match(/\.([^.]+)$/);
  return match ? match[1].toLowerCase() : "";
}

function inferFormat(fileName, text) {
  const extension = extensionOf(fileName);
  if (extension === "json") return "json";
  if (extension === "mtx" || /^%%MatrixMarket/i.test(String(text).trimStart())) return "matrix_market";
  if (["csv", "tsv", "txt", "dat", "edges"].includes(extension)) return "delimited";
  if (String(text).includes(",") || String(text).includes("\t") || String(text).includes("|")) return "delimited";
  return "line_based";
}

function inferType(values) {
  const nonNull = values.filter(value => !NULL_VALUES.has(String(value).trim().toLowerCase()));
  if (!nonNull.length) return "empty";
  const isInteger = nonNull.every(value => /^[-+]?\d+$/.test(String(value).trim()));
  if (isInteger) return "integer";
  const isNumber = nonNull.every(value => /^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(String(value).trim()));
  if (isNumber) return "number";
  const isBool = nonNull.every(value => /^(true|false|yes|no|0|1)$/i.test(String(value).trim()));
  if (isBool) return "boolean";
  const isDate = nonNull.every(value => /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(String(value).trim()) || /^\d{4}$/.test(String(value).trim()));
  if (isDate) return nonNull.every(value => /^\d{4}$/.test(String(value).trim())) ? "integer" : "date";
  const hasNumbers = nonNull.some(value => /^[-+]?\d/.test(String(value).trim()));
  const hasText = nonNull.some(value => /[A-Za-z]/.test(String(value)));
  return hasNumbers && hasText ? "mixed" : "string";
}

function listDelimiter(values) {
  const candidates = [";", "|", ","];
  return candidates.find(delimiter => values.filter(value => String(value).includes(delimiter)).length >= (values.length < 3 ? 1 : Math.max(2, Math.ceil(values.length * 0.4)))) ?? null;
}

function profileColumn(name, index, rows, rowCountExact, limits) {
  const values = rows.map(row => row[index] ?? "");
  const nonNullValues = values.filter(value => !NULL_VALUES.has(String(value).trim().toLowerCase()));
  const distinct = new Set(nonNullValues.map(String));
  const lengths = nonNullValues.map(value => String(value).length);
  const samples = [];
  for (const value of nonNullValues) {
    const text = String(value);
    if (!samples.includes(text)) samples.push(text);
    if (samples.length >= limits.maxSampleValuesPerColumn) break;
  }
  const nonNullCount = nonNullValues.length;
  const nullCount = values.length - nonNullCount;
  const distinctCount = distinct.size;
  const uniquenessRatio = nonNullCount ? distinctCount / nonNullCount : 0;
  const delimiter = listDelimiter(nonNullValues);
  const inferredType = inferType(nonNullValues);
  return {
    name,
    index,
    inferredType,
    nonNullCount,
    nullCount,
    distinctCount,
    distinctCountExact: rowCountExact,
    uniquenessRatio,
    duplicateCount: Math.max(0, nonNullCount - distinctCount),
    sampleValues: samples,
    min: inferredType === "integer" || inferredType === "number" ? (nonNullValues.length ? arrayMin(nonNullValues.map(Number)) : null) : null,
    max: inferredType === "integer" || inferredType === "number" ? (nonNullValues.length ? arrayMax(nonNullValues.map(Number)) : null) : null,
    minLength: lengths.length ? arrayMin(lengths) : 0,
    maxLength: lengths.length ? arrayMax(lengths) : 0,
    idLike: /(^id$|_id$|id_|uuid|key|code|source|target|vertex|node|edge|paper|author|event|participant)/i.test(name),
    listLike: Boolean(delimiter),
    listDelimiter: delimiter,
  };
}

function candidateKeys(columns, sampledRowCount, rowCountExact, limits) {
  const shortlist = columns
    .filter(column => column.nonNullCount > 0 && (column.idLike || column.uniquenessRatio >= 0.75))
    .sort((left, right) => right.uniquenessRatio - left.uniquenessRatio)
    .slice(0, 8);
  const keys = [];
  for (const column of shortlist) {
    const nullRatio = sampledRowCount ? column.nullCount / sampledRowCount : 1;
    if (column.uniquenessRatio >= 0.98 && nullRatio <= 0.02) {
      keys.push({
        columns: [column.name],
        uniquenessRatio: column.uniquenessRatio,
        nullRatio,
        confidence: column.uniquenessRatio >= 1 ? 0.99 : 0.86,
        exact: rowCountExact && column.distinctCountExact,
        reason: column.uniquenessRatio >= 1 ? "Unique non-null identifier." : "Near-unique ID-like column.",
      });
    }
  }
  for (let i = 0; i < shortlist.length; i += 1) {
    for (let j = i + 1; j < shortlist.length && keys.length < 12; j += 1) {
      keys.push({
        columns: [shortlist[i].name, shortlist[j].name].slice(0, limits.maxCompositeKeyWidth),
        uniquenessRatio: Math.min(1, Math.max(shortlist[i].uniquenessRatio, shortlist[j].uniquenessRatio)),
        nullRatio: 0,
        confidence: 0.72,
        exact: rowCountExact,
        reason: "Composite key candidate from ID-like columns.",
      });
    }
  }
  return keys.slice(0, 12);
}

export function profileDatasetFile(file, limits = DATASET_PROFILE_LIMITS) {
  const fileName = String(file?.name ?? file?.fileName ?? "file");
  const text = String(file?.text ?? "");
  const sizeBytes = Number.isFinite(Number(file?.size)) ? Number(file.size) : text.length;
  const partial = text.length > limits.maxSampleChars || sizeBytes > limits.maxExactProfileBytes;
  const sampleText = text.slice(0, limits.maxSampleChars);
  const format = inferFormat(fileName, sampleText);
  const extension = extensionOf(fileName);
  const warnings = [];
  let delimiter = null;
  let hasHeader = false;
  let headerConfidence = 0;
  let rowCount = splitLines(sampleText).length;
  let rowCountExact = !partial;
  let sampledRowCount = rowCount;
  let rowWidth = { expected: 0, inconsistentRows: 0 };
  let columns = [];
  if (format === "delimited") {
    delimiter = extension === "tsv" ? "\t" : detectDelimiter(sampleText);
    const parsed = parseDelimited(sampleText, { delimiter, hasHeader: "auto", maxRows: limits.maxSampleRows });
    hasHeader = parsed.hasHeader;
    headerConfidence = hasHeader ? 0.96 : 0.35;
    rowCount = partial ? parsed.rowCount : parsed.rowCount;
    rowCountExact = !partial && !parsed.truncated;
    sampledRowCount = parsed.sampledRowCount;
    rowWidth = parsed.rowWidth;
    const headers = parsed.headers.slice(0, limits.maxColumns);
    columns = headers.map((name, index) => profileColumn(name, index, parsed.rows, rowCountExact, limits));
  }
  return {
    fileId: String(file?.id ?? stableHash(fileName)),
    fileName,
    extension,
    sizeBytes,
    format,
    delimiter,
    hasHeader,
    headerConfidence,
    rowCount,
    rowCountExact,
    sampledRowCount,
    rowWidth,
    columns,
    candidateKeys: candidateKeys(columns, sampledRowCount, rowCountExact, limits),
    listLikeColumns: columns.filter(column => column.listLike).map(column => ({
      column: column.name,
      delimiter: column.listDelimiter,
      confidence: 0.75,
      sampleValues: column.sampleValues.slice(0, 3),
    })),
    warnings,
    partial,
    headerFingerprint: stableHash(columns.map(column => column.name.toLowerCase()).join("|")),
  };
}

export function profileDatasetFiles(files = [], limits = DATASET_PROFILE_LIMITS) {
  const selected = (files ?? []).slice(0, limits.maxFiles);
  const profiles = selected.map(file => profileDatasetFile(file, limits));
  return {
    version: 1,
    profileId: `profile-${stableHash(profiles.map(file => `${file.fileName}:${file.headerFingerprint}:${file.sizeBytes}`).join("|"))}`,
    fileCount: profiles.length,
    files: profiles,
    limits,
    partial: profiles.some(file => file.partial) || (files ?? []).length > limits.maxFiles,
    warnings: (files ?? []).length > limits.maxFiles ? [`Only the first ${limits.maxFiles} files were profiled.`] : [],
  };
}
