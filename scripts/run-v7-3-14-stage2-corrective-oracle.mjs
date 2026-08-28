import { writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assessH2HExportRepresentability,
  buildH2H,
  expH2H,
} from "../src/utils/mappings.js";
import {
  autoDetect,
  parseCSVFmt,
  parseCsvDocument,
  parseH2HText,
} from "../src/utils/parsers.js";

const scriptRoot = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(scriptRoot);
const outputArgument = process.argv.find(argument => argument.startsWith("--output="));
const outputPath = resolve(outputArgument?.slice("--output=".length)
  ?? join(projectRoot, "artifacts", "v7.3.14-stage2-corrective-oracle.json"));

const checks = [];
const verify = (id, title, fixed, evidence) => checks.push({
  id,
  title,
  fixed: Boolean(fixed),
  evidence,
});
const edge = (id, vertices = ["shared"]) => ({ id, vertices, time: null, weight: 1 });

const detectionInputs = {
  quotedShared: '"foo[shared: bar]",x\nsecond,row',
  quotedWholeH2H: '"h1: h2[shared: x]",other',
  quotedMultilineH2H: '"line1\nh1: h2[shared: x]",foo\nsecond,row',
  unquotedCsvPayload: "foo[shared: bar],x\nsecond,row",
  h2h: "h1: h2[shared: x]",
  h2hMultipleShared: "h1: h2[shared: x,y]",
  quotedH2hSource: '"quoted-edge": h2[shared: x]',
  h2hNone: "h1: (none)",
  approvedSimpleAmbiguity: "h1: garbage",
  malformedStructuralH2h: "h1: h2[shared: x] trailing",
};
const detectionOutputs = Object.fromEntries(
  Object.entries(detectionInputs).map(([name, text]) => [name, autoDetect(text)]),
);
verify(
  "S2-R03A",
  "Auto Detect recognizes H2H structure only outside RFC-quoted payload",
  detectionOutputs.quotedShared === "csv"
    && detectionOutputs.quotedWholeH2H === "csv"
    && detectionOutputs.quotedMultilineH2H === "csv"
    && detectionOutputs.unquotedCsvPayload === "csv"
    && detectionOutputs.h2h === "h2h"
    && detectionOutputs.h2hMultipleShared === "h2h"
    && detectionOutputs.quotedH2hSource === "h2h"
    && detectionOutputs.h2hNone === "h2h"
    && detectionOutputs.approvedSimpleAmbiguity === "simple"
    && detectionOutputs.malformedStructuralH2h === "h2h",
  detectionOutputs,
);

const commentInputs = {
  comma: "# comment, containing comma\n1 2 3\n2 4",
  leadingSpace: "   # comment, containing comma\n1 2 3\n2 4",
  quote: '# comment "with quotes"\n1 2 3\n2 4',
  betweenRows: "1 2 3\n# comment, punctuation\n2 4",
  crlf: "# comment, containing comma\r\n1 2 3\r\n2 4",
  both: '# "quoted", comment\n1 2 3',
};
const commentOutputs = Object.fromEntries(
  Object.entries(commentInputs).map(([name, text]) => [
    name,
    parseCSVFmt(text).map(item => item.vertices),
  ]),
);
const expectedTwoRows = JSON.stringify([[1, 2, 3], [2, 4]]);
const multilinePayload = '"line one\n# not a comment because this is inside the quoted field\nline three",x';
const multilineExpected = [["line one\n# not a comment because this is inside the quoted field\nline three", "x"]];
const multilineCsvDocument = parseCsvDocument(multilinePayload);
const multilineCsvFormat = parseCSVFmt(multilinePayload).map(item => item.vertices);
const commentNeutralAdjacency = {
  withoutComment: autoDetect("A:B"),
  withPunctuatedComment: autoDetect("# comment, punctuation\nA:B"),
};
verify(
  "S2-R03B",
  "Ignored full-line comments cannot select RFC grammar or corrupt multiline payload",
  Object.entries(commentOutputs).every(([name, value]) => (
    JSON.stringify(value) === (name === "both" ? JSON.stringify([[1, 2, 3]]) : expectedTwoRows)
  ))
    && JSON.stringify(multilineCsvDocument) === JSON.stringify(multilineExpected)
    && JSON.stringify(multilineCsvFormat) === JSON.stringify(multilineExpected)
    && autoDetect(multilinePayload) === "csv"
    && commentNeutralAdjacency.withPunctuatedComment === commentNeutralAdjacency.withoutComment,
  {
    commentOutputs,
    multilineCsvDocument,
    multilineCsvFormat,
    multilineAutoDetect: autoDetect(multilinePayload),
    commentNeutralAdjacency,
  },
);

const representableHyperedgeIds = [
  "plain",
  "internal space",
  "edge,comma",
  "edge]bracket",
  '"literal-quote"',
  "__proto__",
  "null",
];
const unrepresentableHyperedgeIds = [
  "edge:colon",
  "edge[bracket",
  " leading",
  "trailing ",
  "line\nbreak",
  "#comment-like",
];
const representableSharedVertexIds = ["v:1", "left[open", '"quoted"', "__proto__", "null", "0"];
const unrepresentableSharedVertexIds = ["shared,comma", "shared space", "ends]", "007", "Infinity", "line\nbreak"];
const representableRows = buildH2H(representableHyperedgeIds.map(id => edge(id)));
const representableAssessment = assessH2HExportRepresentability(representableRows);
const representableRoundTrip = parseH2HText(expH2H(representableRows));
const hyperedgeGuards = unrepresentableHyperedgeIds.map(id => {
  const rows = buildH2H([edge(id), edge("other")]);
  return { id, assessment: assessH2HExportRepresentability(rows), exported: expH2H(rows) };
});
const sharedVertexGuards = unrepresentableSharedVertexIds.map(id => {
  const rows = buildH2H([edge("h1", [id]), edge("h2", [id])]);
  return { id, assessment: assessH2HExportRepresentability(rows), exported: expH2H(rows) };
});
const representableSharedRoundTrips = representableSharedVertexIds.map(id => {
  const rows = buildH2H([edge("h1", [id]), edge("h2", [id])]);
  const exported = expH2H(rows);
  const parsed = parseH2HText(exported);
  return { id, exact: parsed.every(item => item.vertices.map(String).includes(id)) };
});
verify(
  "S2-N03",
  "Legacy H2H export emits only the characterized lossless identifier subset",
  representableAssessment.ok
    && representableRoundTrip.map(item => item.id).sort().join("\0")
      === [...representableHyperedgeIds].sort().join("\0")
    && hyperedgeGuards.every(item => !item.assessment.ok
      && item.assessment.kind === "hyperedge"
      && item.exported.startsWith("# H2H export not generated."))
    && sharedVertexGuards.every(item => !item.assessment.ok
      && item.assessment.kind === "shared-vertex"
      && item.exported.startsWith("# H2H export not generated."))
    && representableSharedRoundTrips.every(item => item.exact),
  {
    outcome: "GUARDED",
    representableHyperedgeIds,
    unrepresentableHyperedgeIds,
    representableSharedVertexIds,
    unrepresentableSharedVertexIds,
    hyperedgeGuards,
    sharedVertexGuards,
    representableSharedRoundTrips,
  },
);

const fixedCount = checks.filter(check => check.fixed).length;
const artifact = {
  stage: 2,
  kind: "corrective_behavior_oracle",
  parentStage2Commit: "f2f5da21bee2db4ac4bb0e133779c10e2829de13",
  fixedCount,
  total: checks.length,
  checks,
};
await writeFile(outputPath, JSON.stringify(artifact, null, 2) + "\n", "utf8");

console.log("Stage 2 corrective oracle: " + fixedCount + "/" + checks.length + " issue families fixed.");
console.log("Evidence: " + outputPath);
for (const check of checks) console.log((check.fixed ? "FIXED" : "FAILED") + " " + check.id + " — " + check.title);
if (fixedCount !== checks.length) process.exitCode = 1;
