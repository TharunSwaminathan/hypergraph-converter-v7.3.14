import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildH2H, expH2HResult } from "../src/utils/mappings.js";
import {
  autoDetect,
  parseCSRCsv,
  parseIncidence,
  parseInputFormat,
} from "../src/utils/parsers.js";

const scriptRoot = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(scriptRoot);
const outputArgument = process.argv.find(argument => argument.startsWith("--output="));
const outputPath = resolve(outputArgument?.slice("--output=".length)
  ?? join(projectRoot, "artifacts", "v7.3.14-stage2-corrective2-oracle.json"));
const appSource = await readFile(join(projectRoot, "src", "App.jsx"), "utf8");

const checks = [];
const verify = (id, title, fixed, evidence) => checks.push({
  id,
  title,
  fixed: Boolean(fixed),
  evidence,
});
const capture = operation => {
  try { return { ok: true, value: operation() }; }
  catch (error) { return { ok: false, error: error.message }; }
};
const edge = (id, vertices = ["shared"]) => ({ id, vertices, time: null, weight: 1 });

const incidenceText = '# comment "quoted"\nh1,a\nh1,b';
const csrText = [
  '# comment "quoted"',
  "vertexIds,v1",
  "hyperedgeIds,h1",
  "rowOffsets,0,1",
  "columnIndices,0",
].join("\n");
const cscText = [
  '   # comment "quoted", punctuation',
  "vertexIds,v1",
  "hyperedgeIds,h1",
  "columnPointers,0,1",
  "rowIndices,0",
].join("\r\n");
const incidenceDetected = autoDetect(incidenceText);
const csrDetected = autoDetect(csrText);
const cscDetected = autoDetect(cscText);
const incidenceParsed = capture(() => parseInputFormat(incidenceDetected, { text: incidenceText }));
const csrParsed = capture(() => parseInputFormat(csrDetected, { text: csrText }));
const cscParsed = capture(() => parseInputFormat(cscDetected, { text: cscText }));
verify(
  "S2-R03C",
  "Comment-aware RFC masking is shared by CSV, Incidence, and CSR/CSC routes",
  incidenceDetected === "incidence"
    && incidenceParsed.ok
    && incidenceParsed.value[0].vertices.join(",") === "a,b"
    && csrDetected === "csr_csv"
    && csrParsed.ok
    && csrParsed.value[0].vertices[0] === "v1"
    && cscDetected === "csr_csv"
    && cscParsed.ok
    && cscParsed.value[0].vertices[0] === "v1"
    && !capture(() => parseIncidence('h1,a"bad"')).ok
    && !capture(() => parseCSRCsv('vertexIds,v1"bad"\nhyperedgeIds,h1\nrowOffsets,0,1\ncolumnIndices,0')).ok,
  {
    incidenceDetected,
    incidenceParsed,
    csrDetected,
    csrParsed,
    cscDetected,
    cscParsed,
  },
);

const quoteDetection = {
  balancedQuotedSource: autoDetect('"quoted-edge": h2[shared: x]'),
  oddQuotedSource: autoDetect('"odd: h2[shared: x]'),
  oddQuotedNeighbor: autoDetect('h1: h2"odd[shared: x]'),
  balancedInternalQuoteSource: autoDetect('foo"bar"baz: h2[shared: x]'),
  oddQuotedSharedVertex: autoDetect('h1: h2[shared: "odd]'),
  validQuotedCsv: autoDetect('"h1: h2[shared: x]",other'),
  validMultilineQuotedCsv: autoDetect('"line 1\nh1: h2[shared: x]",other'),
  malformedQuotedCsvWithoutH2H: autoDetect('"unterminated CSV payload'),
};
const representableHyperedgeIds = [
  "plain",
  "internal space",
  "edge,comma",
  "edge]bracket",
  '"literal-quote"',
  '"odd',
  'odd"',
  'foo"bar"baz',
  "__proto__",
  "constructor",
  "toString",
  "null",
];
const roundTrips = representableHyperedgeIds.map(id => {
  const result = expH2HResult(buildH2H([edge(id), edge("other")]));
  const detectedAs = result.ok ? autoDetect(result.text) : null;
  const parsed = result.ok && detectedAs === "h2h"
    ? capture(() => parseInputFormat("h2h", { text: result.text }))
    : { ok: false, error: "Export or detection failed." };
  const exactIds = parsed.ok
    && parsed.value.map(item => item.id).sort().join("\0") === [id, "other"].sort().join("\0");
  return { id, exportOk: result.ok, detectedAs, parseOk: parsed.ok, exactIds };
});
verify(
  "S2-R03D",
  "Only lexically valid RFC quoting masks H2H structure",
  quoteDetection.balancedQuotedSource === "h2h"
    && quoteDetection.oddQuotedSource === "h2h"
    && quoteDetection.oddQuotedNeighbor === "h2h"
    && quoteDetection.balancedInternalQuoteSource === "h2h"
    && quoteDetection.oddQuotedSharedVertex === "h2h"
    && quoteDetection.validQuotedCsv === "csv"
    && quoteDetection.validMultilineQuotedCsv === "csv"
    && quoteDetection.malformedQuotedCsvWithoutH2H === "csv"
    && roundTrips.every(item => item.exportOk && item.detectedAs === "h2h" && item.parseOk && item.exactIds),
  { quoteDetection, successfulExportRoundTrips: roundTrips },
);

const validExport = expH2HResult(buildH2H([edge("h1"), edge("h2")]));
const refusedExport = expH2HResult(buildH2H([edge("edge:colon"), edge("other")]));
const downloadStart = appSource.indexOf("function downloadExportForAgent");
const downloadEnd = appSource.indexOf("function downloadCurrentExport", downloadStart);
const downloadBody = appSource.slice(downloadStart, downloadEnd);
const appContract = {
  h2hDescriptorUsesStructuredResult: /result:\s*\(\)\s*=>\s*h2hExportResult/.test(appSource),
  refusalReturnsBeforeDownload: /if\s*\(!resolved\.ok\)\s*return\s*\{\s*ok:\s*false/.test(downloadBody)
    && downloadBody.indexOf("if (!resolved.ok)") < downloadBody.indexOf("dl(selected.fn"),
  refusalHasNoFilename: !/filename/.test(downloadBody.match(/if \(!resolved\.ok\)[^\n]*/)?.[0] ?? ""),
  directUiDownloadRemoved: !/onClick=\{\(\)\s*=>\s*dl\(curExp\.fn,\s*exportContent\)\}/.test(appSource),
  guardedUiHandlerInstalled: /onClick=\{downloadCurrentExport\}/.test(appSource),
};
verify(
  "S2-N03B",
  "Unrepresentable H2H preview remains explanatory while data download fails closed",
  validExport.ok
    && validExport.reason == null
    && !validExport.text.startsWith("# H2H export not generated.")
    && !refusedExport.ok
    && /unrepresentable hyperedge identifier/i.test(refusedExport.reason)
    && refusedExport.text.startsWith("# H2H export not generated.")
    && Object.values(appContract).every(Boolean),
  { validExport, refusedExport, appContract },
);

const fixedCount = checks.filter(check => check.fixed).length;
const artifact = {
  stage: 2,
  kind: "corrective2_behavior_oracle",
  parentCorrectiveCommit: "90aa5a2a8066502f9a950ff8d062385602c5b613",
  fixedCount,
  total: checks.length,
  checks,
};
await writeFile(outputPath, JSON.stringify(artifact, null, 2) + "\n", "utf8");

console.log("Stage 2 corrective #2 oracle: " + fixedCount + "/" + checks.length + " issue families fixed.");
console.log("Evidence: " + outputPath);
for (const check of checks) console.log((check.fixed ? "FIXED" : "FAILED") + " " + check.id + " — " + check.title);
if (fixedCount !== checks.length) process.exitCode = 1;
