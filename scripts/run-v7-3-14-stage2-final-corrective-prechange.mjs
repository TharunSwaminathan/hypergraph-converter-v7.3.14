import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expIncidence } from "../src/utils/mappings.js";
import { autoDetect, parseCSVFmt, parseIncidence } from "../src/utils/parsers.js";

const scriptRoot = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(scriptRoot);
const outputArgument = process.argv.find(argument => argument.startsWith("--output="));
const outputPath = resolve(outputArgument?.slice("--output=".length)
  ?? join(projectRoot, "artifacts", "v7.3.14-stage2-final-corrective-prechange.json"));
const appSource = await readFile(join(projectRoot, "src", "App.jsx"), "utf8");

const capture = operation => {
  try { return { ok: true, value: operation() }; }
  catch (error) { return { ok: false, error: error.message }; }
};

const quotedCsv = '"#payload",x\nsecond,row';
const quotedIncidence = 'hyperedge_id,vertex_id\n"#h1",a\n"#h1",b';
const source = [{ id: "#h1", vertices: ["a", "b"], time: null, weight: 1 }];
const incidenceExport = expIncidence(source);

const artifact = {
  stage: 2,
  kind: "final_corrective_prechange_characterization",
  parentCommit: "6c8b1fba3d2aa964bf0c2905fcac4ce3c4cab669",
  confirmedGaps: {
    "S2-N04": {
      quotedCsv: capture(() => parseCSVFmt(quotedCsv)),
      quotedIncidence: capture(() => parseIncidence(quotedIncidence)),
      quotedIncidenceDetectedAs: autoDetect(quotedIncidence),
      incidenceExport,
      incidenceExportPhysicalDataRows: incidenceExport.split(/\r\n|\n|\r/).slice(1),
      incidenceExportDetectedAs: autoDetect(incidenceExport),
      incidenceExportRoundTrip: capture(() => parseIncidence(incidenceExport)),
    },
    "S2-N03C": {
      nonComputedH2HResultIsNullable: /h2hResult\.status\s*===\s*DERIVED_STATUS\.COMPUTED\s*\?\s*expH2HResult\(h2h\)\s*:\s*null/.test(appSource),
      genericFallbackCanReturnSuccess: /selected\.result\?\.\(\)\s*\?\?\s*\{\s*ok:\s*true/.test(appSource),
      overBudgetDownloadBehavior: "Falls through the nullable result to ok:true and can download the diagnostic as h2h.txt.",
      notRequestedDownloadBehavior: "Falls through the nullable result to ok:true and can download the diagnostic as h2h.txt.",
    },
  },
  failingCorrectiveTests: [
    "tests/stage2-final-corrective-leading-hash-csv.test.mjs",
    "tests/stage2-final-corrective-h2h-availability.test.mjs",
  ],
};

await writeFile(outputPath, JSON.stringify(artifact, null, 2) + "\n", "utf8");
console.log("Stage 2 final corrective pre-change characterization captured.");
console.log("Evidence: " + outputPath);
