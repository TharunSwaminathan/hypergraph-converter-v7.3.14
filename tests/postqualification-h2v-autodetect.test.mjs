import assert from "node:assert/strict";
import {
  autoDetect,
  normalizeParsedHyperedges,
  parseInputFormat,
} from "../src/utils/parsers.js";

const BUILT_IN_H2V = `h0 [t=10]: 1, 2, 3
h1 [t=15]: 2, 4 @weight=2
h2 [t=21]: 1, 3, 4, 5`;

function summarize(format) {
  const parsed = normalizeParsedHyperedges(
    format,
    parseInputFormat(format, { text: BUILT_IN_H2V }),
  ).hyperedges;
  return {
    hyperedges: parsed.length,
    vertices: new Set(parsed.flatMap(edge => edge.vertices.map(String))).size,
    incidences: parsed.reduce((sum, edge) => sum + edge.vertices.length, 0),
    hyperedgeIds: parsed.map(edge => edge.id),
    vertexIds: [...new Set(parsed.flatMap(edge => edge.vertices.map(String)))],
  };
}

// Pre-change characterization at b9159e2: this assertion deliberately records
// the defective parent behavior. The production corrective will change the
// expected route to "simple" while retaining this end-to-end count oracle.
const detectedFormat = autoDetect(BUILT_IN_H2V);
assert.equal(detectedFormat, "adjlist");

const expectedH2V = summarize("simple");
const detectedRoute = summarize(detectedFormat);
assert.deepEqual(
  { hyperedges: expectedH2V.hyperedges, vertices: expectedH2V.vertices, incidences: expectedH2V.incidences },
  { hyperedges: 3, vertices: 5, incidences: 9 },
);
assert.deepEqual(
  { hyperedges: detectedRoute.hyperedges, vertices: detectedRoute.vertices, incidences: detectedRoute.incidences },
  { hyperedges: 10, vertices: 9, incidences: 20 },
);
assert.notDeepEqual(detectedRoute, expectedH2V);
assert.ok(detectedRoute.vertexIds.includes("h0 [t=10]"));
assert.ok(detectedRoute.vertexIds.includes("@weight=2"));

console.log("v7.3.14 post-qualification Corrective A pre-change characterization passed.");
