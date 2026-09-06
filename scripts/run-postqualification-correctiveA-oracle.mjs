import assert from "node:assert/strict";
import { detectUploadedFiles } from "../src/agent/fileDetection.js";
import {
  isAcceptedUploadFileName,
  UPLOAD_POLICY,
  validateSelectedFiles,
} from "../src/agent/uploadPolicy.js";
import {
  autoDetect,
  autoDetectDetails,
  normalizeParsedHyperedges,
  parseInputFormat,
} from "../src/utils/parsers.js";
import { buildCorrectiveAFormatCorpus } from "../tests/helpers/postqualificationCorrectiveACorpus.mjs";

const summarize = (format, text) => {
  try {
    const normalized = normalizeParsedHyperedges(format, parseInputFormat(format, { text }));
    const hyperedges = normalized.hyperedges;
    return {
      ok: true,
      hyperedges: hyperedges.length,
      vertices: new Set(hyperedges.flatMap(edge => edge.vertices.map(String))).size,
      incidences: hyperedges.reduce((sum, edge) => sum + edge.vertices.length, 0),
      identifiers: {
        hyperedges: hyperedges.map(edge => String(edge.id)),
        vertices: [...new Set(hyperedges.flatMap(edge => edge.vertices.map(String)))],
      },
      warnings: normalized.warnings,
      error: null,
    };
  } catch (error) {
    return { ok: false, hyperedges: null, vertices: null, incidences: null, identifiers: null, warnings: [], error: error.message };
  }
};

const corpus = buildCorrectiveAFormatCorpus();
let wrongStrongEvidenceRoutes = 0;
let silentSemanticChanges = 0;
let ambiguousCasesHandledSafely = 0;
const records = corpus.map(item => {
  const detection = autoDetectDetails(item.text);
  const candidate = detection.formatId ? summarize(detection.formatId, item.text) : null;
  const intended = item.expectedFormat ? summarize(item.expectedFormat, item.text) : null;
  const semanticMatch = item.ambiguous
    ? detection.formatId === null && detection.confidence === "ambiguous"
    : detection.formatId === item.expectedFormat && JSON.stringify(candidate) === JSON.stringify(intended);
  if (item.ambiguous) {
    if (semanticMatch) ambiguousCasesHandledSafely += 1;
  } else {
    if (detection.formatId !== item.expectedFormat) wrongStrongEvidenceRoutes += 1;
    if (!semanticMatch) silentSemanticChanges += 1;
  }
  return {
    id: item.id,
    family: item.family,
    detectorResult: detection,
    expectedFormat: item.expectedFormat,
    candidateParser: detection.formatId,
    parse: candidate,
    intendedParse: intended,
    semanticMatch,
  };
});

const extensions = ["graph.edge", "graph.EDGE", "graph.EdGe", "graph.edges", "graph.edg"].map(name => {
  const accepted = isAcceptedUploadFileName(name);
  let validation = "accepted";
  try { validateSelectedFiles([{ name, size: 7 }]); } catch (error) { validation = error.message; }
  const extension = name.split(".").pop();
  const routing = accepted
    ? detectUploadedFiles([{ name, extension, text: "A B\nB C", size: 7 }], autoDetect)
    : null;
  return { name, accepted, validation, routing };
});

const result = {
  version: "7.3.14",
  corrective: "postqualification-correctiveA",
  differential: {
    cases: corpus.length,
    strongEvidenceCases: corpus.filter(item => !item.ambiguous).length,
    ambiguousCases: corpus.filter(item => item.ambiguous).length,
    wrongStrongEvidenceRoutes,
    silentSemanticChanges,
    ambiguousCasesHandledSafely,
    records,
  },
  extensions,
  uploadPolicy: UPLOAD_POLICY,
};

assert.equal(wrongStrongEvidenceRoutes, 0);
assert.equal(silentSemanticChanges, 0);
assert.equal(ambiguousCasesHandledSafely, result.differential.ambiguousCases);
assert.equal(extensions.find(item => item.name === "graph.edg").accepted, false);

console.log(JSON.stringify(result, null, 2));
