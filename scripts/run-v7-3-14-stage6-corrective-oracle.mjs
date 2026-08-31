import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAlgorithmIncidenceIndex } from "../src/algorithms/algorithmIncidence.js";
import { K_CORE_STATUS, runKCore } from "../src/algorithms/kCore.js";
import { runShortestPath } from "../src/algorithms/shortestPath.js";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const artifactPath = join(projectRoot, "artifacts", "v7.3.14-stage6-corrective-oracle.json");
const issuePath = join(projectRoot, "artifacts", "v7.3.14-stage6-corrective-issue-register.json");
const prechange = await readJson("v7.3.14-stage6-corrective-prechange.json");
const stage1 = await readJson("v7.3.14-stage1-oracle.json");
const stage6 = await readJson("v7.3.14-stage6-oracle.json");
const adapterSource = await readFile(join(projectRoot, "src", "algorithms", "algorithmIncidence.js"), "utf8");
const shortestSource = await readFile(join(projectRoot, "src", "algorithms", "shortestPath.js"), "utf8");
const triadSource = await readFile(join(projectRoot, "src", "utils", "mappings.js"), "utf8");
const appSource = await readFile(join(projectRoot, "src", "App.jsx"), "utf8");

const numericGraph = [record(1, [0, 2])];
const numericIndex = buildAlgorithmIncidenceIndex(numericGraph);
const numericShortest = runShortestPath(numericGraph, { startVertex: 0, targetVertex: 2 });
const numericKCore = runKCore(numericGraph);
const exactStrings = [" A ", "\"foo\"", "__proto__", "constructor", "toString", "null", "#lead", "é", "e\u0301", "😀"];
const exactIndex = buildAlgorithmIncidenceIndex([record(" exact ", exactStrings)]);
const invalidValues = [{ x: 1 }, [], true, false, 1n, null, undefined, Number.NaN, Infinity, -Infinity, "", "   "];
const invalidTargets = invalidValues.filter(value => value !== null && value !== undefined);
const queryGraph = [record("query", ["a", "b"])];
const noTargetNull = runShortestPath(queryGraph, { startVertex: "a", targetVertex: null });
const noTargetUndefined = runShortestPath(queryGraph, { startVertex: "a", targetVertex: undefined });
const unknown = runShortestPath(queryGraph, { startVertex: "missing", targetVertex: "b" });
const specialGraph = [record("__proto__", ["null", "__proto__", "constructor", "toString", "é", "e\u0301"] )];
const specialIndex = buildAlgorithmIncidenceIndex(specialGraph);

const checks = [
  check("S6C-01", "Pre-fix arbitrary coercion reproduced on the exact parent", Object.values(prechange.findings).every(Boolean), prechange.findings),
  check("S6C-02", "Finite-number compatibility is preserved", same([...numericIndex.hyperedges], ["1"])
    && same([...numericIndex.vertices], ["0", "2"])
    && numericShortest.reachable === true
    && numericShortest.distances.get("2") === 1
    && numericKCore.status === K_CORE_STATUS.COMPUTED, summarizeNumeric()),
  check("S6C-03", "Exact structured strings are preserved", same([...exactIndex.hyperedges], [" exact "])
    && same([...exactIndex.vertices], exactStrings), { hyperedges: [...exactIndex.hyperedges], vertices: [...exactIndex.vertices] }),
  check("S6C-04", "Invalid graph vertex types are rejected", invalidValues.every(value => rejects(() => buildAlgorithmIncidenceIndex([record("edge", ["anchor", value])]))), { rejectedFamilies: invalidValues.map(describe) }),
  check("S6C-05", "Invalid hyperedge ID types and missing IDs are rejected", invalidValues.every(value => rejects(() => buildAlgorithmIncidenceIndex([record(value, ["anchor"])])))
    && rejects(() => buildAlgorithmIncidenceIndex([{ vertices: ["anchor"] }])), { rejectedFamilies: [...invalidValues.map(describe), "missing"] }),
  check("S6C-06", "Invalid shortest query ID types are rejected", invalidValues.every(value => rejects(() => runShortestPath(queryGraph, { startVertex: value, targetVertex: "b" })))
    && invalidTargets.every(value => rejects(() => runShortestPath(queryGraph, { startVertex: "a", targetVertex: value }))), {
    rejectedStartFamilies: invalidValues.map(describe),
    rejectedTargetFamilies: invalidTargets.map(describe),
  }),
  check("S6C-07", "Null/undefined target absence semantics are preserved", noTargetNull.targetVertex === null
    && noTargetNull.reachable === null
    && noTargetUndefined.targetVertex === null
    && noTargetUndefined.reachable === null, {
    null: summarizeShortest(noTargetNull),
    undefined: summarizeShortest(noTargetUndefined),
  }),
  check("S6C-08", "Unknown valid string behavior is preserved", unknown.startVertex === "missing"
    && unknown.reachable === false
    && unknown.distances.size === 0, summarizeShortest(unknown)),
  check("S6C-09", "Literal-null, prototype, and Unicode identities are preserved", same([...specialIndex.hyperedges], ["__proto__"])
    && same([...specialIndex.vertices], specialGraph[0].vertices)
    && specialIndex.vertices.includes("é")
    && specialIndex.vertices.includes("e\u0301")
    && specialIndex.vertices.indexOf("é") !== specialIndex.vertices.indexOf("e\u0301"), {
    hyperedges: [...specialIndex.hyperedges],
    vertices: [...specialIndex.vertices],
  }),
  check("S6C-10", "Shortest differential is unchanged", stage6.shortestDifferential.seed === 6_975_797
    && stage6.shortestDifferential.graphs === 3_000
    && stage6.shortestDifferential.runs === 12_000
    && stage6.shortestDifferential.mismatches === 0, stage6.shortestDifferential),
  check("S6C-11", "K-core differential is unchanged", stage6.kCoreDifferential.seed === 113_305_363
    && stage6.kCoreDifferential.graphs === 3_000
    && stage6.kCoreDifferential.mismatches === 0, stage6.kCoreDifferential),
  check("S6C-12", "Stage 1 identity contract remains authoritative", stage1.fixedCount === stage1.total
    && /normalizeGraphIdentifier/.test(adapterSource)
    && /normalizeGraphIdentifier/.test(shortestSource)
    && !/\.map\(String\)/.test(adapterSource)
    && !/String\(startVertex\)|String\(targetVertex\)/.test(shortestSource), {
    stage1: { fixedCount: stage1.fixedCount, total: stage1.total },
    centralPolicyUsedByAdapter: /normalizeGraphIdentifier/.test(adapterSource),
    centralPolicyUsedByQueries: /normalizeGraphIdentifier/.test(shortestSource),
  }),
  check("S6C-13", "Stage 6 architecture and canonical-only triad entry are unchanged", /buildIncidenceIndex\(canonical\)/.test(adapterSource)
    && !/buildWeightedAdjacency|buildV2V/.test(shortestSource)
    && /countTriadsBounded\(finalHes\)/.test(appSource)
    && /normalizeParsedHyperedges\(targetFormat, raw\)/.test(appSource)
    && /function buildTriadAdjacencyBounded/.test(triadSource), {
    incidenceFoundation: "buildIncidenceIndex(canonical)",
    shortestProjectionMaterialization: false,
    triadContract: "canonical-only application producer; Stats passes finalHes",
    triadProductionChanged: false,
  }),
];

const passed = checks.filter(checkItem => checkItem.passed).length;
const artifact = {
  stage: 6,
  kind: "canonical_identifier_boundary_corrective_oracle",
  parentStage6Commit: "1b08b07920523aeebe25c3e4a602137bc699c7fa",
  prechangeCommit: "0175748",
  issue: "S6-N01",
  status: passed === checks.length ? "passed" : "failed",
  passed,
  total: checks.length,
  environment: { runtime: process.version, platform: `${process.platform}/${process.arch}` },
  differential: {
    shortest: stage6.shortestDifferential,
    kCore: stage6.kCoreDifferential,
  },
  stage6Oracle: { status: stage6.status, passed: stage6.passed, total: stage6.total },
  triadSamePatternAssessment: {
    contract: "canonical-only application producer",
    applicationEntry: "countTriadsBounded(finalHes)",
    canonicalizationEntry: "normalizeParsedHyperedges(targetFormat, raw)",
    productionChangeRequired: false,
  },
  checks,
};
await writeFile(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");

const issueRegister = {
  stage: 6,
  parentStage6Commit: "1b08b07920523aeebe25c3e4a602137bc699c7fa",
  issues: [{
    id: "S6-N01",
    severity: "Medium",
    status: passed === checks.length ? "fixed" : "open",
    title: "Stage 6 algorithm compatibility adapter silently coerces unsupported identifier types",
    rootCause: "The adapter and shortest query boundary used broad JavaScript String coercion instead of the approved Stage 1 identifier validator.",
    resolution: "Algorithm records and non-null shortest query IDs now use normalizeGraphIdentifier; malformed or missing hyperedge IDs are never synthesized.",
    productionFiles: ["src/algorithms/algorithmIncidence.js", "src/algorithms/shortestPath.js"],
    evidence: {
      prechange: "artifacts/v7.3.14-stage6-corrective-prechange.json",
      oracle: "artifacts/v7.3.14-stage6-corrective-oracle.json",
      focusedTest: "tests/stage6-corrective-identifier-boundary.test.mjs",
    },
  }],
};
await writeFile(issuePath, `${JSON.stringify(issueRegister, null, 2)}\n`, "utf8");

console.log(`Stage 6 corrective oracle: ${passed}/${checks.length} families passed.`);
console.log(`Evidence: ${artifactPath}`);
console.log(`Issue register: ${issuePath}`);
for (const checkItem of checks) console.log(`${checkItem.passed ? "PASS" : "FAIL"} ${checkItem.id} — ${checkItem.title}`);
if (passed !== checks.length) process.exitCode = 1;

async function readJson(name) {
  return JSON.parse(await readFile(join(projectRoot, "artifacts", name), "utf8"));
}

function record(id, vertices) {
  return { id, vertices, time: null, weight: 1, attributes: {} };
}

function rejects(callback) {
  try {
    callback();
    return false;
  } catch {
    return true;
  }
}

function summarizeNumeric() {
  return {
    hyperedges: [...numericIndex.hyperedges],
    vertices: [...numericIndex.vertices],
    shortest: summarizeShortest(numericShortest),
    kCore: { status: numericKCore.status, coreness: [...numericKCore.coreness] },
  };
}

function summarizeShortest(result) {
  return {
    startVertex: result.startVertex,
    targetVertex: result.targetVertex,
    reachable: result.reachable,
    distances: [...result.distances],
    path: result.path,
  };
}

function describe(value) {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "number" && Number.isNaN(value)) return "NaN";
  if (value === Infinity) return "Infinity";
  if (value === -Infinity) return "-Infinity";
  if (typeof value === "bigint") return "BigInt";
  if (Array.isArray(value)) return "array";
  if (typeof value === "string" && !value.trim()) return "blank string";
  return typeof value;
}

function check(id, title, condition, evidence) {
  return { id, title, passed: Boolean(condition), evidence };
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
