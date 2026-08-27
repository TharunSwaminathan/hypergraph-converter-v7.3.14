import { writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildH2H, computeStats, expH2H, expIncidence } from "../src/utils/mappings.js";
import {
  autoDetect,
  normalizeParsedHyperedges,
  parseAdjList,
  parseCSVFmt,
  parseH2HText,
  parseIncidence,
} from "../src/utils/parsers.js";
import {
  IncidenceConflict,
  MalformedAdjacency,
  MalformedH2H,
  WhitespaceRows,
} from "../tests/fixtures/v7.3.14/stage0-regression-fixtures.mjs";

const scriptRoot = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(scriptRoot);
const outputArgument = process.argv.find(argument => argument.startsWith("--output="));
const outputPath = resolve(outputArgument?.slice("--output=".length) ?? join(projectRoot, "artifacts", "v7.3.14-stage2-oracle.json"));

const checks = [];
const verify = (id, title, fixed, evidence) => checks.push({ id, title, fixed: Boolean(fixed), evidence });
const captureError = operation => {
  try { operation(); return null; } catch (error) { return error.message; }
};

const whitespace = parseCSVFmt(WhitespaceRows.text);
const whitespaceStats = computeStats(whitespace);
verify(
  "HG713-R03",
  "Legacy whitespace rows produce one multi-vertex hyperedge per row",
  JSON.stringify(whitespace.map(edge => edge.vertices)) === JSON.stringify(WhitespaceRows.expected.map(edge => edge.vertices))
    && whitespaceStats?.E === 3
    && whitespaceStats?.V === 5
    && whitespace.reduce((sum, edge) => sum + edge.vertices.length, 0) === 9,
  {
    detectedAs: autoDetect(WhitespaceRows.text),
    memberships: whitespace.map(edge => edge.vertices),
    hyperedges: whitespaceStats?.E,
    vertices: whitespaceStats?.V,
    incidences: whitespace.reduce((sum, edge) => sum + edge.vertices.length, 0),
  },
);

const mixedRows = "1 2\n2 3 4\n5";
verify(
  "STAGE2-AUTO-DETECT",
  "Auto Detect considers the document structure instead of only the first row",
  autoDetect(mixedRows) === "csv"
    && autoDetect("1 2\n3 4") === "edgelist"
    && autoDetect("h1,a\nh2,b") === "csv"
    && autoDetect("h1,a,t1,2\nh1,b,t1,2") === "incidence"
    && autoDetect("h1: h2[shared: a] trailing") === "h2h",
  {
    mixedWhitespace: autoDetect(mixedRows),
    twoColumnWhitespace: autoDetect("1 2\n3 4"),
    ordinaryCommaRows: autoDetect("h1,a\nh2,b"),
    repeatedHeaderlessIncidence: autoDetect("h1,a,t1,2\nh1,b,t1,2"),
    malformedH2HMarker: autoDetect("h1: h2[shared: a] trailing"),
  },
);

const incidenceWeightError = captureError(() => parseIncidence(IncidenceConflict.weight));
const incidenceTimeError = captureError(() => parseIncidence(IncidenceConflict.time));
const incidenceConsistent = parseIncidence("hyperedge_id,vertex_id,time,weight\nh1,a,,\nh1,b,t1,2\nh1,c,t1,2.0")[0];
verify(
  "HG713-C07",
  "Incidence metadata conflicts reject the complete graph with provenance",
  /row 3.*weight 3.*weight 2.*row 2/i.test(incidenceWeightError ?? "")
    && /row 3.*time "t2".*time "t1".*row 2/i.test(incidenceTimeError ?? "")
    && incidenceConsistent.time === "t1"
    && incidenceConsistent.weight === 2
    && incidenceConsistent.vertices.length === 3,
  { incidenceWeightError, incidenceTimeError, acceptedConsistentEdge: incidenceConsistent },
);

const h2hErrors = MalformedH2H.map(value => captureError(() => parseH2HText(value)));
const adjacencyErrors = MalformedAdjacency.map(value => captureError(() => parseAdjList(value)));
verify(
  "HG713-C08",
  "H2H and adjacency grammars reject unconsumed malformed input",
  h2hErrors.every(error => /H2H line/.test(error ?? ""))
    && adjacencyErrors.every(error => /Adjacency line/.test(error ?? "")),
  { h2hErrors, adjacencyErrors },
);

const payloadSource = [{
  id: "  edge,one  ",
  vertices: ["  vertex one  ", 'quote"vertex', "line 1\nline 2", "日本語", "🎉"],
  time: "  time value  ",
  weight: 0,
}];
const payloadIncidence = parseIncidence(expIncidence(payloadSource));
const canonicalPayloadIncidence = normalizeParsedHyperedges("incidence", payloadIncidence).hyperedges;
const rowPayloads = ["  spaced identifier  ", "comma,value", 'quote"value', "日本語", "🎉"];
const parsedRowPayloads = parseCSVFmt(rowPayloads.map(value => `"${String(value).replaceAll('"', '""')}"`).join(","))[0].vertices;
verify(
  "S2-N01",
  "RFC-decoded quoted identifier payload remains intact in row and incidence parsers",
  JSON.stringify(parsedRowPayloads) === JSON.stringify(rowPayloads)
    && JSON.stringify(payloadIncidence) === JSON.stringify(payloadSource)
    && canonicalPayloadIncidence[0].id === payloadSource[0].id
    && JSON.stringify(canonicalPayloadIncidence[0].vertices) === JSON.stringify(payloadSource[0].vertices),
  { rowPayloads: parsedRowPayloads, incidenceRoundTrip: payloadIncidence, canonicalIncidence: canonicalPayloadIncidence },
);

const h2hSource = [
  { id: "edge-A", vertices: ["shared"], time: null, weight: 1 },
  { id: "__proto__", vertices: ["shared"], time: null, weight: 1 },
  { id: "edge with spaces", vertices: ["shared"], time: null, weight: 1 },
];
const h2hText = expH2H(buildH2H(h2hSource));
const h2hRoundTrip = parseH2HText(h2hText);
const canonicalH2hRoundTrip = normalizeParsedHyperedges("h2h", h2hRoundTrip).hyperedges;
verify(
  "S2-N02",
  "H2H import preserves exporter hyperedge IDs without synthesizing prefixes",
  JSON.stringify(h2hRoundTrip.map(edge => edge.id).sort()) === JSON.stringify(h2hSource.map(edge => edge.id).sort())
    && canonicalH2hRoundTrip.every(edge => edge.vertices.includes("shared")),
  { exported: h2hText, ids: canonicalH2hRoundTrip.map(edge => edge.id) },
);

const fixedCount = checks.filter(check => check.fixed).length;
const artifact = {
  stage: 2,
  scope: "parser_and_auto_detection_correctness",
  parentCommit: "1c2f8e5fbb030d22c0728e29fef123b519c04b18",
  historicalStage0Evidence: "artifacts/v7.3.14-stage0-oracle.json",
  prechangeCharacterization: "artifacts/v7.3.14-stage2-prechange-characterization.json",
  fixedCount,
  total: checks.length,
  checks,
};
await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");

console.log(`Stage 2 corrected-behavior oracle: ${fixedCount}/${checks.length} issue families fixed.`);
console.log(`Evidence: ${outputPath}`);
for (const check of checks) console.log(`${check.fixed ? "FIXED" : "FAILED"} ${check.id} — ${check.title}`);
if (fixedCount !== checks.length) process.exitCode = 1;
