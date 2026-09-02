import { writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { allCatalogExamples } from "../src/agent/deterministicNlu/commandCatalog.js";
import { sideEffectIsStateChanging } from "../src/agent/deterministicNlu/sideEffectPolicy.js";
import { routePendingSubmission } from "../src/agent/pendingSubmissionRouter.js";
import { isPlausibleGraphMutationText } from "../src/agent/graphMutationModelPlanner.js";
import { buildCompilerContexts } from "../tests/helpers/evaluateDeterministicNluCorpus.mjs";
import { fixtureNameForExample } from "../tests/helpers/deterministicCommandCatalogTestHelpers.mjs";
import {
  STAGE8_EXISTING_60_READONLY_FRAMES,
  STAGE8_PENDING_CORRECTIONS,
  STAGE8_PENDING_READONLY_QUERIES,
} from "../tests/fixtures/v7.3.14/stage8AuthorizationCorpus.mjs";
import { compileAndDispatch, createProtectedState, stateFingerprint } from "./stage8SafetyHarness.mjs";

const EXPECTED_PARENT = "32e4fca5ac2ca1229cceef260b2fa8827415887f";
const head = execFileSync("git", ["-c", "safe.directory=C:/Users/tharu/OneDrive/Documents/Candi/hypergraph-converter-v7.3.14", "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
if (head !== EXPECTED_PARENT) throw new Error(`Stage 8 prechange must run at ${EXPECTED_PARENT}; got ${head}`);

const bases = allCatalogExamples({ includePanelOnly: false })
  .filter(({ example }) => sideEffectIsStateChanging(example.expectedSideEffect) && !example.expectsClarification);
const contextCache = new Map();
async function contextsFor(example) {
  const fixture = fixtureNameForExample(example);
  if (!contextCache.has(fixture)) contextCache.set(fixture, await buildCompilerContexts(fixture));
  return contextCache.get(fixture);
}

const readonlyFailures = [];
const routeCounts = {};
let readonlyCases = 0;
for (const { entry, example } of bases) {
  const contexts = await contextsFor(example);
  for (const [wrapper, wrap] of Object.entries(STAGE8_EXISTING_60_READONLY_FRAMES)) {
    readonlyCases += 1;
    const record = await compileAndDispatch(wrap(example.text), contexts);
    routeCounts[record.productionRoute] = (routeCounts[record.productionRoute] ?? 0) + 1;
    if (record.stateChanged || record.stateMutationCommitted || (record.stateChangingSideEffect && record.dispatchAuthorized)) {
      readonlyFailures.push({ wrapper, entryId: entry.id, base: example.text, ...record });
    }
  }
}

const positiveFailures = [];
const positiveRecords = [];
for (const { entry, example } of bases) {
  const record = await compileAndDispatch(example.text, await contextsFor(example));
  positiveRecords.push({ entryId: entry.id, ...record });
  if (!record.stateChangingSideEffect || !record.dispatchAuthorized) positiveFailures.push({ entryId: entry.id, ...record });
}

const pendingAction = createProtectedState().pendingAction;
const pendingReadonly = STAGE8_PENDING_READONLY_QUERIES.map(query => {
  const before = stateFingerprint(pendingAction);
  const decision = routePendingSubmission({
    query,
    pendingAction,
    graphMutationCandidate: isPlausibleGraphMutationText(query, { pendingAction }),
  });
  return {
    query,
    route: decision.route,
    speechAct: decision.semantics.requestedResponse,
    authorizationDecision: decision.semantics.authorization?.mode ?? decision.semantics.mode,
    beforeFingerprint: before,
    afterFingerprint: stateFingerprint(pendingAction),
    stateChanged: before !== stateFingerprint(pendingAction),
  };
});
const pendingCorrections = STAGE8_PENDING_CORRECTIONS.map(query => {
  const decision = routePendingSubmission({
    query,
    pendingAction,
    graphMutationCandidate: isPlausibleGraphMutationText(query, { pendingAction }),
  });
  return { query, route: decision.route, authorizationDecision: decision.semantics.authorization?.mode ?? decision.semantics.mode };
});

const output = {
  stage: 8,
  kind: "prechange_characterization",
  authoritativeParent: EXPECTED_PARENT,
  observedHead: head,
  packageVersion: "7.3.13",
  packageLockVersion: "7.3.13",
  stage9Begun: false,
  corpus: {
    baseCount: bases.length,
    wrapperCount: Object.keys(STAGE8_EXISTING_60_READONLY_FRAMES).length,
    cases: readonlyCases,
    unsafe: readonlyFailures.length,
    routeCounts,
    failures: readonlyFailures,
  },
  c01KnownUnsafe: readonlyFailures,
  c02Pending: {
    readOnlyCases: pendingReadonly.length,
    unwantedReplacements: pendingReadonly.filter(item => item.route === "graph_replacement").length,
    records: pendingReadonly,
    corrections: pendingCorrections,
  },
  positive: {
    cases: positiveRecords.length,
    wrongBlocks: positiveFailures.length,
    failures: positiveFailures,
    records: positiveRecords,
  },
  fingerprintPolicy: {
    fields: Object.keys(createProtectedState()),
    permittedReadOnlyChanges: ["conversation message history", "bounded diagnostic trace history"],
  },
};

if (output.corpus.baseCount !== 164 || output.corpus.wrapperCount !== 60 || output.corpus.cases !== 9840) {
  throw new Error(`Unexpected Stage 8 corpus dimensions: ${output.corpus.baseCount} x ${output.corpus.wrapperCount} = ${output.corpus.cases}`);
}
await writeFile("artifacts/v7.3.14-stage8-prechange-characterization.json", `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({
  head,
  corpus: { cases: readonlyCases, unsafe: readonlyFailures.length },
  pending: output.c02Pending,
  positive: { cases: positiveRecords.length, wrongBlocks: positiveFailures.length },
}, null, 2));

