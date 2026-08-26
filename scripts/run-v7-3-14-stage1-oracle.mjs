import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compareWithExpectedOutput, parseExpectedOutputText } from "../src/agent/expectedOutputComparison.js";
import { computedDerived } from "../src/utils/derivedResults.js";
import {
  createGraphIdentifierMap,
  getGraphIdentifierValue,
  graphIdentifiersEqual,
  setGraphIdentifierValue,
} from "../src/utils/graphIdentifiers.js";
import { countTriadsBounded, DERIVED_STATUS } from "../src/utils/mappings.js";
import { parseCSRJson, parseSimple } from "../src/utils/parsers.js";
import {
  CSRInvalidIds,
  DuplicateHyperedgeID,
  ExpectedProtoID,
  ManySingletons2001,
} from "../tests/fixtures/v7.3.14/stage0-regression-fixtures.mjs";

const scriptRoot = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(scriptRoot);
const outputArgument = process.argv.find(argument => argument.startsWith("--output="));
const outputPath = resolve(outputArgument?.slice("--output=".length) ?? join(projectRoot, "artifacts", "v7.3.14-stage1-oracle.json"));
const vizSource = await readFile(join(projectRoot, "src", "components", "Viz.jsx"), "utf8");

const checks = [];
const verify = (id, title, fixed, evidence) => checks.push({ id, title, fixed: Boolean(fixed), evidence });

let invalidIdentifiersRejected = 0;
for (const fixture of Object.values(CSRInvalidIds)) {
  try {
    parseCSRJson(JSON.stringify(fixture));
  } catch (error) {
    if (/string or finite number identifier/.test(error.message)) invalidIdentifiersRejected += 1;
  }
}
verify(
  "HG713-C06",
  "CSR/CSC rejects unsupported identifiers before coercion",
  invalidIdentifiersRejected === Object.keys(CSRInvalidIds).length,
  { fixturesRejected: invalidIdentifiersRejected, accidentalObjectIdentifier: false },
);

const nodes = createGraphIdentifierMap();
for (const id of ["__proto__", "constructor", "toString"]) setGraphIdentifierValue(nodes, id, { id });
verify(
  "HG713-S03",
  "Visualization node storage treats reserved identifiers as data",
  nodes.size === 3
    && getGraphIdentifierValue(nodes, "__proto__")?.id === "__proto__"
    && !/const nodes = \{\}/.test(vizSource),
  { nodeStore: "Map", reservedKeys: [...nodes.keys()] },
);

let duplicateDiagnostic = null;
try {
  parseSimple(DuplicateHyperedgeID.map(edge => `${edge.id}: ${edge.vertices.join(" ")}`).join("\n"));
} catch (error) {
  duplicateDiagnostic = error.message;
}
verify(
  "N01",
  "Simple/H2V rejects duplicate hyperedge identity",
  /duplicate/i.test(duplicateDiagnostic ?? ""),
  { diagnostic: duplicateDiagnostic },
);

verify(
  "N02",
  "Literal null identifier remains distinct from unset state",
  graphIdentifiersEqual(null, "null") === false
    && graphIdentifiersEqual(undefined, "null") === false
    && graphIdentifiersEqual("null", "null") === true
    && !/String\(searchHit\) === String\(/.test(vizSource),
  { nullEqualsLiteralNull: graphIdentifiersEqual(null, "null") },
);

const expectedProto = parseExpectedOutputText(ExpectedProtoID.text);
const expectedProtoComparison = compareWithExpectedOutput(ExpectedProtoID.actual, expectedProto);
verify(
  "N03",
  "Expected-output comparison preserves reserved hyperedge IDs",
  Object.hasOwn(expectedProto.h2v, "__proto__")
    && expectedProtoComparison.allHyperedgeIdsMatched
    && expectedProtoComparison.vertexSetsMatched === 1,
  {
    ownKeys: Object.keys(expectedProto.h2v),
    expectedHyperedges: expectedProtoComparison.expectedStats.hyperedges,
  },
);

const triads = countTriadsBounded(ManySingletons2001());
let computedNullRejected = false;
try {
  computedDerived("triads", null);
} catch {
  computedNullRejected = true;
}
verify(
  "HG713-R07",
  "Bounded triad result cannot report computed plus null",
  triads.status === DERIVED_STATUS.OVER_BUDGET
    && triads.value === null
    && computedDerived("triads", 0).value === 0
    && computedNullRejected,
  { result: triads, computedNullRejected, computedZeroAccepted: true },
);

const fixedCount = checks.filter(check => check.fixed).length;
const artifact = {
  stage: 1,
  scope: "canonical_identity_and_result_state_contracts",
  historicalStage0Evidence: "artifacts/v7.3.14-stage0-oracle.json",
  fixedCount,
  total: checks.length,
  checks,
};
await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");

console.log(`Stage 1 corrected-behavior oracle: ${fixedCount}/${checks.length} issue families fixed.`);
console.log(`Evidence: ${outputPath}`);
for (const check of checks) console.log(`${check.fixed ? "FIXED" : "FAILED"} ${check.id} — ${check.title}`);
if (fixedCount !== checks.length) process.exitCode = 1;
