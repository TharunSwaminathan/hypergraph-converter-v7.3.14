const FORMAT_DETAILS = {
  simple: { routeId: "h2v", label: "H2V / Simple" },
  cornell: { routeId: "cornell", label: "Cornell / SNAP" },
  incidence: { routeId: "incidence", label: "Incidence Edge List" },
  csv: { routeId: "csv", label: "CSV" },
  edgelist: { routeId: "edge_list", label: "Graph Edge List" },
  json: { routeId: "json", label: "JSON" },
  v2h: { routeId: "v2h", label: "V2H" },
  h2h: { routeId: "h2h", label: "H2H Projection" },
  csr_json: { routeId: "csr", label: "CSR JSON" },
  csr_csv: { routeId: "csc_csv", label: "CSR / CSC CSV" },
  adjlist: { routeId: "adjlist", label: "Adjacency List" },
  freeform: { routeId: "freeform", label: "Freeform / NLP" },
  custom: { routeId: "custom_parser", label: "Custom Parser" },
};

export const MAX_DETECTION_LINES = 50;
export const MAX_CHAT_PREVIEW_CHARS = 5000;
export const MAX_FILE_LIST_DISPLAY = 10;

const GRAPH_ROLES = new Set(["edges", "incidence", "hyperedges", "csr", "csc", "json", "cornell_simplices"]);
const METADATA_ROLES = new Set(["nodes", "metadata", "weights", "timestamps", "labels", "cornell_nverts", "cornell_times"]);

export async function readUploadedTextFiles(files, uploadNonce = Date.now(), { signal } = {}) {
  const list = validateSelectedFiles(files ?? []);
  return mapWithConcurrency(list, UPLOAD_POLICY.readConcurrency, async (file, index) => {
    const detectionSampleText = await readFileDetectionSample(file, { signal });
    const text = await readFileText(file, { signal });
    const dataRowCount = countDataRows(text);
    return {
      id: `${file.name}:${file.size}:${file.lastModified ?? 0}:${uploadNonce}:${index}`,
      uploadNonce,
      name: file.name,
      text,
      detectionSampleText,
      dataRowCount,
      size: file.size,
      type: file.type,
      extension: file.name.includes(".") ? file.name.split(".").pop().toLowerCase() : "",
      lastModified: file.lastModified ?? 0,
    };
  }, { signal });
}

function detectionLines(file) {
  return String(file.detectionSampleText ?? file.text ?? "").split(/\r?\n/).slice(0, MAX_DETECTION_LINES);
}

function countDataRows(text) {
  return String(text ?? "").split(/\r?\n/).filter(line => line.trim() && !line.trim().startsWith("#")).length;
}

function firstDataLine(file) {
  return detectionLines(file).find(line => line.trim() && !line.trim().startsWith("#"))?.trim() ?? "";
}

function detectFileRole(file) {
  const name = file.name.toLowerCase();
  const firstLines = detectionLines(file);
  const first = firstDataLine(file);
  const lowerFirst = first.toLowerCase();
  const header = lowerFirst.split(/[,\t;]/).map(cell => cell.trim());

  if (name.includes("nverts")) return "cornell_nverts";
  if (name.includes("simplices")) return "cornell_simplices";
  if (name.includes("times") || name.includes("timestamp")) return name.includes("cornell") ? "cornell_times" : "timestamps";
  if (name.includes("weight")) return "weights";
  if (name.includes("label")) return "labels";
  if ((header.some(cell => /event|hyperedge|edge/.test(cell)) && header.some(cell => /participant|vertex|node/.test(cell)))
    || (name.includes("participant") && header.some(cell => /event|hyperedge|edge/.test(cell)))) return "incidence";
  if (name.includes("metadata") || name.includes("attributes") || name.includes("layer")
    || (name.includes("events") && header.some(cell => /event/.test(cell)))) return "metadata";
  if (name.includes("node") || name.includes("vertex")) return "nodes";
  if (name.includes("incidence") || (header.some(cell => /hyperedge|edge/.test(cell)) && header.some(cell => /vertex|node/.test(cell)))) return "incidence";
  if (name.includes("hyperedge") || name.includes("membership")) return "hyperedges";
  if (name.includes("csr") || /^(vertexids|rowoffsets),/.test(lowerFirst)) return "csr";
  if (name.includes("csc") || /^columnpointers,/.test(lowerFirst)) return "csc";
  if (file.extension === "json" || first.startsWith("{") || first.startsWith("[")) return "json";
  if (name.includes("edge") || name.includes("adjacency") || file.extension === "mtx" || (header.includes("source") && header.includes("target"))) return "edges";

  const operationLines = firstLines.filter(line => line.trim() && !line.trim().startsWith("#")).slice(0, 10);
  if (operationLines.some(line => /^(?:\d{4}[-/]\d{1,2}[-/]\d{1,2}\s+)?(?:ADD|DELETE|REMOVE|UPDATE|INSERT|DEL)\b/i.test(line.trim()))) {
    return "unknown";
  }
  return "unknown";
}

function isBatchUpdateFile(file) {
  return detectionLines(file)
    .filter(line => line.trim() && !line.trim().startsWith("#"))
    .slice(0, 10)
    .some(line => /^(?:\d{4}[-/]\d{1,2}[-/]\d{1,2}\s+)?(?:ADD|DELETE|REMOVE|UPDATE|INSERT|DEL)\b/i.test(line.trim()));
}

function looksStandaloneGraph(file, role) {
  const name = file.name.toLowerCase();
  return /^graph[_-]|graph[_-]?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{4})/i.test(name)
    || (GRAPH_ROLES.has(role) && /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(name));
}

export function analyzeUploadBatch(files, detectTextFormat) {
  const fileSummaries = files.map(file => {
    const lines = detectionLines(file);
    const role = detectFileRole(file);
    const firstNonEmpty = lines.filter(line => line.trim()).slice(0, 4).join("\n");
    return {
      id: file.id,
      name: file.name,
      role,
      rowCount: Number.isInteger(file.dataRowCount) ? file.dataRowCount : countDataRows(file.text),
      columns: firstDataLine(file).split(/[,\t;]/).map(cell => cell.trim()).slice(0, 12),
      preview: firstNonEmpty.slice(0, MAX_CHAT_PREVIEW_CHARS),
    };
  });
  const detectedRoles = fileSummaries.map(summary => summary.role);
  const graphRoleCount = detectedRoles.filter(role => GRAPH_ROLES.has(role)).length;
  const metadataOnly = files.length > 0 && detectedRoles.every(role => METADATA_ROLES.has(role)) && graphRoleCount === 0;
  const batchUpdate = files.some(isBatchUpdateFile);
  const separateGraphFiles = files.length > 1 && files.every((file, index) => looksStandaloneGraph(file, detectedRoles[index]));
  const graphRoles = [...new Set(detectedRoles.filter(role => GRAPH_ROLES.has(role)))];
  const mixedFormats = files.length > 1
    && graphRoles.length > 1
    && !detectedRoles.some(role => ["nodes", "metadata", "weights", "timestamps", "labels"].includes(role));

  return {
    fileSummaries,
    detectedRoles,
    detectedFormat: detectUploadedFiles(files, detectTextFormat),
    metadataOnly,
    batchUpdate,
    separateGraphFiles,
    mixedFormats,
  };
}

export function findSuspiciousOutputWarnings(hyperedges, batch) {
  const warnings = [];
  const files = batch?.files ?? [];
  const summaries = batch?.fileSummaries ?? [];
  const graphRows = summaries
    .filter(summary => GRAPH_ROLES.has(summary.role))
    .reduce((sum, summary) => sum + summary.rowCount, 0);

  if (batch?.metadataOnly) warnings.push("No graph-defining edge, incidence, or hyperedge membership file was detected.");
  if (files.length > 1 && hyperedges.length === files.length) {
    warnings.push(`Only ${hyperedges.length} hyperedges were generated from ${files.length} files. The parser may have treated each file as one hyperedge instead of reading its rows.`);
  }
  if (hyperedges.length === 1 && hyperedges[0]?.vertices?.length >= 25) {
    warnings.push("All detected vertices were placed in one giant hyperedge. Check whether rows should become separate memberships or hyperedges.");
  }
  if (graphRows >= 20 && hyperedges.length <= Math.max(2, Math.floor(graphRows * 0.05))) {
    warnings.push(`Only ${hyperedges.length} hyperedges were generated from about ${graphRows} graph-defining rows.`);
  }
  const emptyCount = hyperedges.filter(hyperedge => !hyperedge.vertices?.length).length;
  if (emptyCount) warnings.push(`${emptyCount} empty hyperedge${emptyCount === 1 ? " was" : "s were"} produced.`);
  const signatures = hyperedges.map(hyperedge => [...(hyperedge.vertices ?? [])].map(String).sort().join("|"));
  const duplicateCount = signatures.length - new Set(signatures).size;
  if (duplicateCount && duplicateCount / Math.max(1, signatures.length) >= 0.25) {
    warnings.push(`${duplicateCount} hyperedges duplicate another hyperedge’s vertex membership.`);
  }
  return warnings;
}

function result(formatId, confidence, reason) {
  const details = FORMAT_DETAILS[formatId];
  return {
    formatId,
    routeId: details?.routeId ?? null,
    label: details?.label ?? "Unknown format",
    confidence,
    reason,
  };
}

function isCornellSet(files) {
  const names = files.map(file => file.name.toLowerCase());
  return names.some(name => name.includes("nverts"))
    && names.some(name => name.includes("simplices"));
}

function formatFromName(name, extension) {
  const value = name.toLowerCase();
  if (value.includes("incidence")) return "incidence";
  if (value.includes("h2v")) return "simple";
  if (value.includes("v2h")) return "v2h";
  if (value.includes("h2h")) return "h2h";
  if (value.includes("adjacency") || value.includes("adjlist")) return "adjlist";
  if (value.includes("edge-list") || value.includes("edgelist")) return "edgelist";
  if (value.includes("csr") || value.includes("csc")) return extension === "json" ? "csr_json" : "csr_csv";
  if (value.includes("canonical") && extension === "json") return "json";
  if (value.includes("freeform") || value.includes("nlp")) return "freeform";
  return null;
}

export function detectUploadedFiles(files, detectTextFormat) {
  if (!files?.length) {
    return { formatId: null, routeId: null, label: "No files", confidence: "none", reason: "Upload at least one file first." };
  }

  if (isCornellSet(files)) {
    return result("cornell", "high", "The filenames include both nverts and simplices, which match the Cornell / SNAP multi-file layout.");
  }

  if (files.length > 1) {
    return result("custom", "recommended", "Multiple files do not match a built-in grouped format confidently, so Custom Parser is the safest route.");
  }

  const file = files[0];
  const text = String(file.text ?? "").trim();
  const extension = String(file.extension ?? "").toLowerCase();
  if (!text) {
    return { formatId: null, routeId: null, label: "Unknown format", confidence: "none", reason: "The uploaded file is empty or could not be read as text." };
  }

  const namedFormat = formatFromName(file.name, extension);
  if (namedFormat) {
    return result(namedFormat, "high", `The filename “${file.name}” matches the ${FORMAT_DETAILS[namedFormat].label} naming pattern.`);
  }

  if (text.startsWith("{") || text.startsWith("[")) {
    try {
      const data = JSON.parse(text);
      if (data?.h2vCSR || data?.csr || (data?.vertexIds && (data?.rowOffsets || data?.columnIndices))) {
        return result("csr_json", "high", "The JSON contains CSR vertex and offset/index structures.");
      }
      return result("json", "high", "The file contains valid JSON matching the dashboard’s JSON route.");
    } catch {
      return { formatId: null, routeId: null, label: "Unknown format", confidence: "none", reason: "The file looks like JSON but is not valid JSON." };
    }
  }

  const firstLine = text.split(/\r?\n/).find(line => line.trim() && !line.trim().startsWith("#"))?.trim() ?? "";
  const lowerFirst = firstLine.toLowerCase();
  if (/^hyperedge(?:_id)?,\s*(vertex|node)(?:_id)?/.test(lowerFirst)) {
    return result("incidence", "high", "The header contains hyperedge and vertex/node columns.");
  }
  if (/^(vertexids|hyperedgeids|rowoffsets|columnpointers),/i.test(firstLine)) {
    return result("csr_csv", "high", "The labeled rows match the CSR / CSC CSV structure.");
  }

  const detected = detectTextFormat(text);
  if (detected === "simple" && firstLine.includes(":")) {
    return result("simple", "medium", "Colon-delimited rows look like hyperedge-to-vertex membership lists.");
  }
  if (detected === "v2h" || detected === "h2h" || detected === "edgelist" || detected === "csr_csv") {
    return result(detected, "medium", `The file structure matches the ${FORMAT_DETAILS[detected].label} route.`);
  }
  if (detected === "incidence" && (extension === "csv" || extension === "tsv")) {
    return result("incidence", "medium", "Comma-delimited rows look like edge/node incidence pairs.");
  }
  if (detected === "csv" && text.split(/\r?\n/).filter(Boolean).length > 1) {
    return result("csv", "low", "The file contains repeated delimited rows that can be tried with the CSV route.");
  }

  return {
    formatId: null,
    routeId: null,
    label: "Unknown format",
    confidence: "none",
    reason: "I could not confidently match this file to a built-in route. Use Custom Parser or AI Prompt guidance.",
  };
}

export function getFormatDetails(formatId) {
  return FORMAT_DETAILS[formatId] ?? null;
}

import { mapWithConcurrency, readFileDetectionSample, readFileText, UPLOAD_POLICY, validateSelectedFiles } from "./uploadPolicy.js";
