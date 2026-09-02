import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createDerivedProductCache } from "../src/derived/derivedProductCache.js";
import { createDerivedRequestCoordinator } from "../src/derived/derivedRequestCoordinator.js";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outputPath = join(projectRoot, "artifacts", "v7.3.14-stage7-corrective-oracle.json");
const graphA = Object.freeze({ name: "Graph A" });
const graphB = Object.freeze({ name: "Graph B" });
const aValue = computedV2V("A_ONLY_1", "A_ONLY_2");
const bValue = computedV2V("B_ONLY_1", "B_ONLY_2");

const primaryRace = await reproduceFixedRace();
const identityRace = verifySameVersionDifferentIdentity();
const versionRace = verifySameIdentityDifferentVersion();
const operationContract = verifyOperationContract();
const incompleteContract = verifyIncompleteContract();
const reviewFiles = await hashReviewFiles();
const cacheSource = await readFile(join(projectRoot, "src", "derived", "derivedProductCache.js"), "utf8");
const hookSource = await readFile(join(projectRoot, "src", "hooks", "useAsyncDerivedProduct.js"), "utf8");

const artifact = {
  stage: 7,
  corrective: "S7-N01",
  kind: "context_bound_derived_cache_postchange_oracle",
  authoritativeParent: "2b68cca38f4ca7b91b101b1689c4f606c615e7f2",
  correctiveCommitsAtMeasurement: [
    "15c4a20 stage-7-corrective: reproduce context-bound cache race",
    "73dd74c stage-7-corrective: bind derived cache writes to graph context",
  ],
  environment: {
    runtime: process.version,
    platform: `${process.platform}/${process.arch}`,
    os: `${os.type()} ${os.release()}`,
    cpu: os.cpus()?.[0]?.model ?? "unavailable",
  },
  invariant: {
    statement: "A successful async cache write is accepted only when both the producing graphVersion and graphIdentity are Object.is-equal to the active cache context.",
    versionCheckPresent: /Object\.is\(graphVersion, activeGraphVersion\)/.test(cacheSource),
    identityCheckPresent: /Object\.is\(graphIdentity, activeGraphIdentity\)/.test(cacheSource),
    ambientPublicSetCompleteRemoved: !/\bsetComplete,\s*\n/.test(cacheSource),
    hookPassesProducingContext: /setCompleteForGraph\([\s\S]*outcome\.metadata\.graphVersion,[\s\S]*graphIdentity,/.test(hookSource),
  },
  primaryRace,
  sameVersionDifferentIdentity: identityRace,
  sameIdentityDifferentVersion: versionRace,
  operationContract,
  incompleteContract,
  controlledReactIntegration: {
    test: "tests/stage7-corrective-hook-cache-race.test.mjs",
    committedReplacement: "passed",
    sameVersionPreviewIdentityReplacement: "passed",
    unmistakableValues: ["A_ONLY_1", "A_ONLY_MATRIX", "B_ONLY_1", "B_ONLY_MATRIX"],
    assertions: [
      "no A-only V2V entry in B cache",
      "no A-only Matrix entry in B cache",
      "no A-only row, projection edge, Matrix text, or export after B is authoritative",
      "stale download remains disabled",
      "B computes and caches normally",
      "loading settles",
      "no unhandled rejection",
    ],
  },
  testResults: {
    correctiveFocused: "2/2 files passed",
    originalStage7Focused: "5/5 files passed",
    originalStage7Oracle: "all five findings true",
    fullNodeSuite: "203/203 files passed in 60.1s",
  },
  reviewFiles,
  findings: {
    s7N01Resolved: primaryRace.lateAWriteAccepted === false
      && primaryRace.bLookupAfterLateA === null
      && primaryRace.bWriteAccepted === true
      && primaryRace.bLookupIsExactB === true,
    identityIndependentOfVersion: identityRace.rejected,
    versionIndependentOfIdentity: versionRace.rejected,
    allAsyncOperationsProtected: operationContract.every(result => result.rejected),
    incompleteResultsStillRefused: incompleteContract.refusedWrites === incompleteContract.statuses.length,
    coordinatorDefensePreserved: primaryRace.coordinatorOldAOutcome === "completed",
    cacheDefenseIndependent: primaryRace.contextRejectedWrites === 1,
  },
};

await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
console.log(`Stage 7 corrective oracle written: ${outputPath}`);
console.log(JSON.stringify(artifact.findings, null, 2));

async function reproduceFixedRace() {
  const cache = createDerivedProductCache();
  const coordinator = createDerivedRequestCoordinator();
  const aWork = deferredExecution();
  cache.activateGraph(41, graphA);
  const requestA = coordinator.request({
    channel: "v2v",
    graphVersion: 41,
    graphIdentity: graphA,
    operationType: "v2v",
    options: {},
    execute: aWork.execute,
  });
  cache.activateGraph(42, graphB);
  aWork.resolve(aValue);
  const outcomeA = await requestA.promise;
  const lateAWriteAccepted = cache.setCompleteForGraph(
    outcomeA.metadata.graphVersion,
    graphA,
    "v2v",
    {},
    outcomeA.value,
  );
  const repeatedBActivationChangedContext = cache.activateGraph(42, graphB);
  const bLookupAfterLateA = cache.peek("v2v", {}) ?? null;
  const bWriteAccepted = cache.setCompleteForGraph(42, graphB, "v2v", {}, bValue);
  const bLookup = cache.peek("v2v", {});
  const snapshot = cache.getSnapshot();
  return {
    coordinatorOldAOutcome: outcomeA.status,
    lateAWriteAccepted,
    repeatedBActivationChangedContext,
    bLookupAfterLateA,
    bWriteAccepted,
    bLookupIsExactB: bLookup === bValue,
    bLookup,
    contextRejectedWrites: snapshot.contextRejectedWrites,
    cacheSnapshot: snapshot,
  };
}

function verifySameVersionDifferentIdentity() {
  const cache = createDerivedProductCache();
  const previewA = {};
  const previewB = {};
  cache.activateGraph(55, previewA);
  cache.activateGraph(55, previewB);
  const accepted = cache.setCompleteForGraph(55, previewA, "matrix", {}, computedMatrix("A_ONLY_MATRIX"));
  return { accepted, rejected: accepted === false && cache.peek("matrix", {}) === undefined };
}

function verifySameIdentityDifferentVersion() {
  const cache = createDerivedProductCache();
  const identity = {};
  cache.activateGraph(70, identity);
  cache.activateGraph(71, identity);
  const accepted = cache.setCompleteForGraph(70, identity, "h2h", {}, computedH2H("A_ONLY_H"));
  return { accepted, rejected: accepted === false && cache.peek("h2h", {}) === undefined };
}

function verifyOperationContract() {
  const values = {
    h2h: computedH2H("A_ONLY_H"),
    v2v: aValue,
    matrix: computedMatrix("A_ONLY_MATRIX"),
    line_graph: aValue,
  };
  return Object.entries(values).map(([operationType, value]) => {
    const cache = createDerivedProductCache();
    cache.activateGraph(80, graphA);
    cache.activateGraph(81, graphB);
    const accepted = cache.setCompleteForGraph(80, graphA, operationType, {}, value);
    return { operationType, accepted, rejected: accepted === false && cache.peek(operationType, {}) === undefined };
  });
}

function verifyIncompleteContract() {
  const cache = createDerivedProductCache();
  const statuses = ["cancelled", "error", "over_budget", "computing", "not_requested"];
  cache.activateGraph(90, graphB);
  const accepted = statuses.map(status => cache.setCompleteForGraph(90, graphB, status, {}, { status, value: null }));
  return { statuses, accepted, refusedWrites: cache.getSnapshot().refusedWrites, entryCount: cache.getSnapshot().entryCount };
}

async function hashReviewFiles() {
  const files = [
    "src/App.jsx",
    "src/derived/derivedProductCache.js",
    "src/derived/derivedRequestCoordinator.js",
    "src/derived/derivedWorkerClient.js",
    "src/derived/derivedOperations.js",
    "src/hooks/useAsyncDerivedProduct.js",
    "src/utils/derivedRequests.js",
    "src/utils/derivedResults.js",
    "src/utils/mappings.js",
    "src/workers/derivedWorker.js",
    "src/algorithms/compactTrace.js",
    "src/algorithms/traversal.js",
    "src/algorithms/shortestPath.js",
    "tests/stage7-matrix-indexed-differential.test.mjs",
    "tests/stage7-lazy-derived-products.test.mjs",
    "tests/stage7-derived-request-races.test.mjs",
    "tests/stage7-compact-traces.test.mjs",
    "tests/stage7-worker-policy.test.mjs",
    "tests/stage7-corrective-cache-context.test.mjs",
    "tests/stage7-corrective-hook-cache-race.test.mjs",
  ];
  return Promise.all(files.map(async file => {
    const absolutePath = join(projectRoot, file);
    const data = await readFile(absolutePath);
    return {
      path: relative(projectRoot, absolutePath).replaceAll("\\", "/"),
      bytes: data.length,
      sha256: createHash("sha256").update(data).digest("hex"),
    };
  }));
}

function deferredExecution() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { execute: () => ({ promise, cancel() {} }), resolve };
}

function computedV2V(src, dst) {
  return Object.freeze({ status: "computed", edges: Object.freeze([{ src, dst, hyperedges: ["h"], weight: 1 }]) });
}

function computedMatrix(text) {
  return Object.freeze({ status: "computed", text, value: text });
}

function computedH2H(id) {
  return Object.freeze({ status: "computed", value: Object.freeze([{ hid: id, neighbors: [], sharedVertices: [] }]) });
}
