import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildH2H, expH2H } from "../src/utils/mappings.js";
import {
  autoDetect,
  parseCSRCsv,
  parseIncidence,
  parseInputFormat,
} from "../src/utils/parsers.js";

const EXPECTED_PARENT = "90aa5a2a8066502f9a950ff8d062385602c5b613";
const scriptRoot = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(scriptRoot);
const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: projectRoot, encoding: "utf8" }).trim();
if (head !== EXPECTED_PARENT) {
  throw new Error("This historical characterization only runs at " + EXPECTED_PARENT + "; current HEAD is " + head + ".");
}

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
const unsafeH2H = expH2H(buildH2H([edge("edge:colon"), edge("other")]));
const appSource = await readFile(join(projectRoot, "src", "App.jsx"), "utf8");

const artifact = {
  stage: 2,
  kind: "corrective2_prechange_characterization",
  parentCommit: EXPECTED_PARENT,
  confirmedGaps: {
    "S2-R03C": {
      incidenceDetectedAs: autoDetect(incidenceText),
      incidenceDirectParse: capture(() => parseIncidence(incidenceText)),
      incidenceDetectedDispatch: capture(() => parseInputFormat(autoDetect(incidenceText), { text: incidenceText })),
      csrDetectedAs: autoDetect(csrText),
      csrDirectParse: capture(() => parseCSRCsv(csrText)),
      csrDetectedDispatch: capture(() => parseInputFormat(autoDetect(csrText), { text: csrText })),
    },
    "S2-R03D": {
      balancedQuotedSource: autoDetect('"quoted-edge": h2[shared: x]'),
      oddQuotedSource: autoDetect('"odd: h2[shared: x]'),
      oddQuotedNeighbor: autoDetect('h1: h2"odd[shared: x]'),
      balancedInternalQuoteSource: autoDetect('foo"bar"baz: h2[shared: x]'),
      oddQuotedSharedVertex: autoDetect('h1: h2[shared: "odd]'),
      validQuotedCsv: autoDetect('"h1: h2[shared: x]",other'),
      malformedQuotedCsvWithoutH2H: autoDetect('"unterminated CSV payload'),
    },
    "S2-N03B": {
      unsafeH2HStringResult: unsafeH2H,
      uiDownloadsCurrentTextDirectly: /onClick=\{\(\)\s*=>\s*dl\(curExp\.fn,\s*exportContent\)\}/.test(appSource),
      agentDownloadsBeforeReturningSuccess: /dl\(selected\.fn,[\s\S]{0,180}return\s*\{\s*ok:\s*true,\s*exportId:/.test(appSource),
      structuredH2HResultAvailable: /expH2HResult/.test(appSource),
    },
  },
  failingCorrectiveTests: [
    "tests/stage2-corrective2-commented-csv-routes.test.mjs",
    "tests/stage2-corrective2-h2h-quote-invariant.test.mjs",
    "tests/stage2-corrective2-h2h-download-contract.test.mjs",
  ],
};

const outputPath = join(projectRoot, "artifacts", "v7.3.14-stage2-corrective2-prechange.json");
await writeFile(outputPath, JSON.stringify(artifact, null, 2) + "\n", "utf8");
console.log("Stage 2 corrective #2 pre-change evidence: " + outputPath);
