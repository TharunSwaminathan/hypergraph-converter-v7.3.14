import { writeFile } from "node:fs/promises";
import os from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createDerivedProductCache } from "../src/derived/derivedProductCache.js";
import { createDerivedRequestCoordinator } from "../src/derived/derivedRequestCoordinator.js";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outputPath = join(projectRoot, "artifacts", "v7.3.14-stage7-corrective-prechange.json");
const graphA = Object.freeze({ name: "Graph A" });
const graphB = Object.freeze({ name: "Graph B" });
const aValue = Object.freeze({ status: "computed", edges: [{ src: "A_ONLY_1", dst: "A_ONLY_2" }] });
const cache = createDerivedProductCache();
const coordinator = createDerivedRequestCoordinator();
let resolveA;
const execution = new Promise(resolve => { resolveA = resolve; });

cache.activateGraph(41, graphA);
const request = coordinator.request({
  channel: "v2v",
  graphVersion: 41,
  graphIdentity: graphA,
  operationType: "v2v",
  options: {},
  execute: () => ({ promise: execution, cancel() {} }),
});
cache.activateGraph(42, graphB);
resolveA(aValue);
const outcome = await request.promise;
const accepted = cache.setComplete("v2v", {}, outcome.value);
const repeatedBActivationChangedContext = cache.activateGraph(42, graphB);
const observedByB = cache.peek("v2v", {});

const artifact = {
  stage: 7,
  corrective: "S7-N01",
  kind: "context_bound_derived_cache_prechange_reproduction",
  authoritativeParent: "2b68cca38f4ca7b91b101b1689c4f606c615e7f2",
  environment: {
    runtime: process.version,
    platform: `${process.platform}/${process.arch}`,
    os: `${os.type()} ${os.release()}`,
    cpu: os.cpus()?.[0]?.model ?? "unavailable",
  },
  sequence: [
    "activate cache Graph A / version 41",
    "start coordinator request A",
    "activate shared cache Graph B / version 42 without advancing coordinator",
    "complete request A while coordinator still treats A as current",
    "call current ambient cache.setComplete",
    "repeat activateGraph(42, B)",
    "lookup V2V under B context",
  ],
  observed: {
    coordinatorOutcome: outcome.status,
    ambientWriteAccepted: accepted,
    repeatedBActivationChangedContext,
    bLookupObservedAReference: observedByB === aValue,
    bLookupValue: observedByB,
    cacheSnapshot: cache.getSnapshot(),
  },
  reproduced: outcome.status === "completed"
    && accepted === true
    && repeatedBActivationChangedContext === false
    && observedByB === aValue,
  failingTestEvidence: {
    directInfrastructure: {
      test: "tests/stage7-corrective-cache-context.test.mjs",
      expectedSecureWriteAccepted: false,
      observedWriteAccepted: true,
      failure: "late A completion must be rejected at the cache boundary",
    },
    reactHookSharedCache: {
      test: "tests/stage7-corrective-hook-cache-race.test.mjs",
      controlledInterleaving: "B render activates shared cache and suspends in a transition while the committed A hook/coordinator remains active; then A resolves.",
      expectedBLookup: null,
      observedBLookupContains: "A_ONLY_1 -- A_ONLY_2",
      failure: "committed replacement: old V2V must not poison B cache",
    },
  },
  requiredInvariant: "A completion must be rejected unless both its graphVersion and graphIdentity match the active cache context.",
};

await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
console.log(`Stage 7 corrective pre-change reproduction written: ${outputPath}`);
console.log(JSON.stringify(artifact.observed, null, 2));
