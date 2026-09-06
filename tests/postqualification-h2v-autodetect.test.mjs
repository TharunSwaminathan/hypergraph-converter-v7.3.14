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
import { buildCorrectiveAFormatCorpus } from "./helpers/postqualificationCorrectiveACorpus.mjs";

const BUILT_IN_H2V = `h0 [t=10]: 1, 2, 3
h1 [t=15]: 2, 4 @weight=2
h2 [t=21]: 1, 3, 4, 5`;

function summarize(format, text = BUILT_IN_H2V) {
  const parsed = normalizeParsedHyperedges(
    format,
    parseInputFormat(format, { text }),
  ).hyperedges;
  return {
    hyperedges: parsed.length,
    vertices: new Set(parsed.flatMap(edge => edge.vertices.map(String))).size,
    incidences: parsed.reduce((sum, edge) => sum + edge.vertices.length, 0),
    hyperedgeIds: parsed.map(edge => edge.id),
    vertexIds: [...new Set(parsed.flatMap(edge => edge.vertices.map(String)))],
  };
}

// The pre-change commit recorded the defective "adjlist" result. This
// permanent regression now enforces the corrected Auto Detect route and the
// same end-to-end count oracle.
const detectedFormat = autoDetect(BUILT_IN_H2V);
assert.equal(detectedFormat, "simple");

const expectedH2V = summarize("simple");
const detectedRoute = summarize(detectedFormat);
assert.deepEqual(
  { hyperedges: expectedH2V.hyperedges, vertices: expectedH2V.vertices, incidences: expectedH2V.incidences },
  { hyperedges: 3, vertices: 5, incidences: 9 },
);
assert.deepEqual(detectedRoute, expectedH2V);

const arbitraryMetadata = `paperA [time=2026-09-05]: Alice, Bob
cohort.beta [weight=0]: Bob Carol @label=reviewed`;
assert.equal(autoDetect(arbitraryMetadata), "simple");
assert.deepEqual(summarize("simple", arbitraryMetadata).hyperedgeIds, ["paperA", "cohort.beta"]);
assert.equal(parseInputFormat("simple", { text: arbitraryMetadata })[1].weight, 0);

const reservedMetadata = `__proto__ [t=0]: a, b
constructor [weight=0]: b, c
toString [label=x]: c, d
hasOwnProperty @time=now: d, e`;
assert.equal(autoDetect(reservedMetadata), "simple");
const reserved = summarize("simple", reservedMetadata);
assert.deepEqual(reserved.hyperedgeIds, ["__proto__", "constructor", "toString", "hasOwnProperty"]);
assert.deepEqual(Object.getPrototypeOf(Object.fromEntries(reserved.hyperedgeIds.map(id => [id, true]))), Object.prototype);

const zeroIdentifier = "0 [t=0]: 0, 1\n1 [weight=0]: 1, 2";
assert.equal(autoDetect(zeroIdentifier), "simple");
assert.deepEqual(summarize("simple", zeroIdentifier).hyperedgeIds, ["0", "1"]);

const adjacency = "A: B C\nB: A C\nC: A B";
assert.equal(autoDetect(adjacency), "adjlist");
assert.doesNotThrow(() => parseInputFormat("adjlist", { text: adjacency }));

for (const ambiguous of ["A: B C", "paperA:Alice,Bob", "__proto__: a b", "0: 1 2"]) {
  const result = autoDetectDetails(ambiguous);
  assert.equal(result.formatId, null, ambiguous);
  assert.equal(result.confidence, "ambiguous", ambiguous);
  assert.deepEqual(result.candidates, ["simple", "adjlist"], ambiguous);
  assert.equal(autoDetect(ambiguous), null, ambiguous);
  assert.doesNotThrow(() => parseInputFormat("simple", { text: ambiguous }));
  assert.doesNotThrow(() => parseInputFormat("adjlist", { text: ambiguous }));
}

assert.equal(autoDetect("paperA,Alice,Bob\npaperB,Bob,Carol"), "csv");
assert.equal(autoDetect('"paper:A","Alice, Bob"\n"paper:B",Carol'), "csv");
assert.equal(autoDetect("urn:a,b\nurn:c,d"), "csv");
assert.equal(autoDetect("h1: h2[shared: a,b]\nh2: (none)"), "h2h");
assert.equal(autoDetect("alpha beta gamma\nbeta gamma"), "csv");

// Explicit parser choice remains authoritative for syntactically ambiguous
// input: Auto Detect declines to switch, while either manual parser remains
// available and produces its documented semantics.
assert.notDeepEqual(
  summarize("simple", "A: B C"),
  summarize("adjlist", "A: B C"),
);

for (const name of ["graph.edge", "graph.EDGE", "graph.EdGe", "graph.edges"]) {
  const extension = name.split(".").pop();
  const detection = detectUploadedFiles([{
    name,
    extension,
    text: "A B\nB C",
    size: 7,
  }], autoDetect);
  assert.equal(detection.formatId, "edgelist", `${name} must hint Graph Edge List`);
  assert.equal(isAcceptedUploadFileName(name), true);
  assert.equal(validateSelectedFiles([{ name, size: 7 }]).length, 1);
}
assert.equal(isAcceptedUploadFileName("graph.edg"), false);
assert.throws(() => validateSelectedFiles([{ name: "graph.edg", size: 7 }]), /Unsupported upload extension/);
assert.deepEqual(
  [UPLOAD_POLICY.maxFiles, UPLOAD_POLICY.maxSingleFileBytes, UPLOAD_POLICY.maxAggregateBytes],
  [50, 10 * 1024 * 1024, 50 * 1024 * 1024],
);

const corpus = buildCorrectiveAFormatCorpus();
assert.ok(corpus.length >= 100);
let wrongStrongEvidenceRoutes = 0;
let silentSemanticChanges = 0;
let ambiguousCasesHandledSafely = 0;
for (const item of corpus) {
  const detection = autoDetectDetails(item.text);
  if (item.ambiguous) {
    if (detection.formatId === null
      && detection.confidence === "ambiguous"
      && JSON.stringify(detection.candidates) === JSON.stringify(item.expectedCandidates)) {
      ambiguousCasesHandledSafely += 1;
    }
    continue;
  }
  if (detection.formatId !== item.expectedFormat) wrongStrongEvidenceRoutes += 1;
  if (!detection.formatId) {
    silentSemanticChanges += 1;
    continue;
  }
  const intended = summarize(item.expectedFormat, item.text);
  const routed = summarize(detection.formatId, item.text);
  if (JSON.stringify(intended) !== JSON.stringify(routed)) silentSemanticChanges += 1;
}
assert.equal(wrongStrongEvidenceRoutes, 0);
assert.equal(silentSemanticChanges, 0);
assert.equal(ambiguousCasesHandledSafely, corpus.filter(item => item.ambiguous).length);

console.log("v7.3.14 post-qualification Corrective A H2V Auto Detect regression passed.");
