import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildH2H,
  expH2HAvailabilityResult,
  expIncidence,
} from "../src/utils/mappings.js";
import {
  autoDetect,
  parseCSVFmt,
  parseIncidence,
  parseInputFormat,
} from "../src/utils/parsers.js";
import { DERIVED_STATUS } from "../src/utils/derivedResults.js";

const scriptRoot = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(scriptRoot);
const outputArgument = process.argv.find(argument => argument.startsWith("--output="));
const outputPath = resolve(outputArgument?.slice("--output=".length)
  ?? join(projectRoot, "artifacts", "v7.3.14-stage2-final-corrective-oracle.json"));
const appSource = await readFile(join(projectRoot, "src", "App.jsx"), "utf8");

const checks = [];
const verify = (id, title, fixed, evidence) => checks.push({ id, title, fixed: Boolean(fixed), evidence });
const edge = (id, vertices = ["shared"]) => ({ id, vertices, time: null, weight: 1 });

const quotedCsv = parseCSVFmt('"#payload",x\nsecond,row');
const quotedIncidenceText = 'hyperedge_id,vertex_id\n"#h1",a\n"#h1",b';
const quotedIncidence = parseIncidence(quotedIncidenceText);
const source = [
  { id: "#h1", vertices: ["a", "b"], time: null, weight: 1 },
  { id: "__proto__", vertices: ["constructor"], time: null, weight: 1 },
  { id: "constructor", vertices: ["toString"], time: null, weight: 1 },
  { id: "toString", vertices: ["null"], time: null, weight: 1 },
  { id: "null", vertices: [0], time: null, weight: 1 },
  { id: "0", vertices: [0], time: null, weight: 1 },
];
const incidenceExport = expIncidence(source);
const detectedExport = autoDetect(incidenceExport);
const roundTrip = parseInputFormat(detectedExport, { text: incidenceExport });
const multiline = parseCSVFmt('"line 1\n# payload\nline 3",x\nsecond,row');
verify(
  "S2-N04",
  "Lexical comments and RFC-quoted leading-# data remain distinct and Incidence export round-trips",
  quotedCsv.length === 2
    && quotedCsv[0].vertices[0] === "#payload"
    && quotedIncidence.length === 1
    && quotedIncidence[0].id === "#h1"
    && autoDetect(quotedIncidenceText) === "incidence"
    && /^hyperedge_id,vertex_id,time,weight\r\n"#h1",a,,1/m.test(incidenceExport)
    && detectedExport === "incidence"
    && JSON.stringify(roundTrip) === JSON.stringify(source)
    && multiline[0].vertices[0] === "line 1\n# payload\nline 3"
    && parseCSVFmt("# comment\nh1,#inline")[0].vertices[1] === "#inline",
  { quotedCsv, quotedIncidence, detectedExport, incidenceExport, roundTrip, multiline },
);

const computed = expH2HAvailabilityResult(buildH2H([edge("h1"), edge("h2")]), {
  status: DERIVED_STATUS.COMPUTED,
});
const unrepresentable = expH2HAvailabilityResult(buildH2H([edge("edge:colon"), edge("other")]), {
  status: DERIVED_STATUS.COMPUTED,
});
const overBudget = expH2HAvailabilityResult([], {
  status: DERIVED_STATUS.OVER_BUDGET,
  reason: "H2H projection exceeds the configured safety budget.",
});
const notRequested = expH2HAvailabilityResult([], {
  status: DERIVED_STATUS.NOT_REQUESTED,
  reason: "Open the Mappings tab to request it.",
});
const downloadStart = appSource.indexOf("function downloadExportForAgent");
const downloadEnd = appSource.indexOf("function downloadCurrentExport", downloadStart);
const downloadBody = appSource.slice(downloadStart, downloadEnd);
const appContract = {
  descriptorAlwaysReturnsStructuredResult: /result:\s*\(\)\s*=>\s*h2hExportResult/.test(appSource)
    && !/h2hResult\.status\s*===\s*DERIVED_STATUS\.COMPUTED\s*\?\s*expH2HResult\(h2h\)\s*:\s*null/.test(appSource),
  refusalPrecedesDownloader: downloadBody.indexOf("if (!resolved.ok)") >= 0
    && downloadBody.indexOf("if (!resolved.ok)") < downloadBody.indexOf("dl(selected.fn"),
  refusalHasNoFilename: !/filename/.test(downloadBody.match(/if \(!resolved\.ok\)[^\n]*/)?.[0] ?? ""),
};
verify(
  "S2-N03C",
  "Every H2H availability state is explicit and non-computed downloads fail closed",
  computed.ok
    && computed.status === DERIVED_STATUS.COMPUTED
    && !unrepresentable.ok
    && !overBudget.ok
    && overBudget.status === DERIVED_STATUS.OVER_BUDGET
    && /^# H2H projection not computed\./.test(overBudget.text)
    && !notRequested.ok
    && notRequested.status === DERIVED_STATUS.NOT_REQUESTED
    && Object.values(appContract).every(Boolean),
  { computed, unrepresentable, overBudget, notRequested, appContract },
);

const fixedCount = checks.filter(check => check.fixed).length;
const artifact = {
  stage: 2,
  kind: "final_corrective_behavior_oracle",
  parentCorrectiveCommit: "6c8b1fba3d2aa964bf0c2905fcac4ce3c4cab669",
  fixedCount,
  total: checks.length,
  checks,
};
await writeFile(outputPath, JSON.stringify(artifact, null, 2) + "\n", "utf8");

console.log("Stage 2 final corrective oracle: " + fixedCount + "/" + checks.length + " issue families fixed.");
console.log("Evidence: " + outputPath);
for (const check of checks) console.log((check.fixed ? "FIXED" : "FAILED") + " " + check.id + " — " + check.title);
if (fixedCount !== checks.length) process.exitCode = 1;
