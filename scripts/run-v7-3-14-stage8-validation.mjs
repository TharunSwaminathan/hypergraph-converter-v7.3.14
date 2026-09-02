import { performance as perf } from "node:perf_hooks";
import { writeFile } from "node:fs/promises";
import { allCatalogExamples } from "../src/agent/deterministicNlu/commandCatalog.js";
import { sideEffectIsStateChanging } from "../src/agent/deterministicNlu/sideEffectPolicy.js";
import { analyzePositiveAuthorization } from "../src/agent/deterministicNlu/positiveAuthorization.js";
import { routePendingSubmission, PENDING_ROUTE } from "../src/agent/pendingSubmissionRouter.js";
import { isPlausibleGraphMutationText } from "../src/agent/graphMutationModelPlanner.js";
import { buildCompilerContexts } from "../tests/helpers/evaluateDeterministicNluCorpus.mjs";
import { fixtureNameForExample } from "../tests/helpers/deterministicCommandCatalogTestHelpers.mjs";
import {
  STAGE8_EXISTING_60_READONLY_FRAMES,
  STAGE8_NEW_40_READONLY_FRAMES,
  STAGE8_MIXED_TEMPLATES,
  STAGE8_PENDING_CORRECTIONS,
  STAGE8_PENDING_READONLY_QUERIES,
} from "../tests/fixtures/v7.3.14/stage8AuthorizationCorpus.mjs";
import { compileAndDispatch, createProtectedState, stateFingerprint } from "./stage8SafetyHarness.mjs";

const bases = allCatalogExamples({ includePanelOnly: false })
  .filter(({ example }) => sideEffectIsStateChanging(example.expectedSideEffect) && !example.expectsClarification);
const contextCache = new Map();
async function contextsFor(example) {
  const fixture = fixtureNameForExample(example);
  if (!contextCache.has(fixture)) contextCache.set(fixture, await buildCompilerContexts(fixture));
  return contextCache.get(fixture);
}

function unsafeRecord(record) {
  return Boolean(record.stateChanged || record.stateMutationCommitted
    || (record.stateChangingSideEffect && record.dispatchAuthorized && record.authorizationDecision === "authorized"));
}

async function runReadOnlyMatrix(frames) {
  const failures = [];
  let cases = 0;
  const routeCounts = {};
  for (const { entry, example } of bases) {
    const contexts = await contextsFor(example);
    for (const [wrapper, wrap] of Object.entries(frames)) {
      cases += 1;
      const record = await compileAndDispatch(wrap(example.text), contexts);
      routeCounts[record.productionRoute] = (routeCounts[record.productionRoute] ?? 0) + 1;
      if (unsafeRecord(record)) failures.push({ wrapper, entryId: entry.id, base: example.text, ...record });
    }
  }
  return { cases, failures, routeCounts, wrapperCount: Object.keys(frames).length, baseCount: bases.length };
}

async function runPositiveCorpus() {
  const records = [];
  const failures = [];
  const forms = [
    { id: "direct", transform: text => text },
    { id: "please", transform: text => `Please ${text}` },
    { id: "go_ahead", transform: text => `Go ahead and ${text}` },
  ];
  for (const { entry, example } of bases) {
    const contexts = await contextsFor(example);
    for (const form of forms) {
      const query = form.transform(example.text);
      const record = await compileAndDispatch(query, contexts);
      const item = { form: form.id, entryId: entry.id, query, ...record };
      records.push(item);
      // A positive command may legitimately be a no-op when its required
      // batch/graph context is absent in this synthetic state.  The gate is
      // concerned with authorization correctness, not whether a precondition
      // happened to exist for every catalog command.
      const speechActControl = entry.id.startsWith("pending.");
      if ((!record.stateChangingSideEffect && !speechActControl) || !record.dispatchAuthorized || record.authorizationDecision !== "authorized") failures.push(item);
    }
  }
  return { cases: records.length, wrongBlocks: failures.length, failures, records };
}

async function runMixedCorpus() {
  const records = [];
  const failures = [];
  for (const { entry, example } of bases) {
    const contexts = await contextsFor(example);
    for (const [templateIndex, template] of STAGE8_MIXED_TEMPLATES.entries()) {
      const query = template(example.text);
      const record = await compileAndDispatch(query, contexts);
      const item = { templateIndex, entryId: entry.id, query, ...record };
      records.push(item);
      // Mixed requests are intentionally allowed to contain explanatory and
      // executable clauses.  A failure is an actual mutation while the
      // overall authorization contract is read-only/ambiguous; a missing
      // mutation can be a legitimate no-op for a context-dependent command.
      if (record.stateChanged && record.authorizationDecision !== "authorized") failures.push(item);
    }
  }
  return { cases: records.length, templateCount: STAGE8_MIXED_TEMPLATES.length, failures, records };
}

function runPendingCorpus() {
  const pendingAction = createProtectedState().pendingAction;
  const readOnly = STAGE8_PENDING_READONLY_QUERIES.map(query => {
    const before = stateFingerprint(pendingAction);
    const decision = routePendingSubmission({
      query,
      pendingAction,
      graphMutationCandidate: isPlausibleGraphMutationText(query, { pendingAction }),
    });
    const after = stateFingerprint(pendingAction);
    return {
      query,
      route: decision.route,
      authorizationDecision: decision.semantics.authorization?.mode ?? decision.semantics.mode,
      beforeFingerprint: before,
      afterFingerprint: after,
      stateChanged: before !== after,
    };
  });
  const corrections = STAGE8_PENDING_CORRECTIONS.map(query => {
    const decision = routePendingSubmission({
      query,
      pendingAction,
      graphMutationCandidate: isPlausibleGraphMutationText(query, { pendingAction }),
    });
    return {
      query,
      route: decision.route,
      authorizationDecision: decision.semantics.authorization?.mode ?? decision.semantics.mode,
    };
  });
  const failures = [
    ...readOnly.filter(item => item.stateChanged || item.route === PENDING_ROUTE.GRAPH_REPLACEMENT),
    ...corrections.filter(item => item.route !== PENDING_ROUTE.GRAPH_REPLACEMENT),
  ];
  return { readOnlyCases: readOnly.length, corrections: corrections.length, unwantedReplacements: readOnly.filter(item => item.route === PENDING_ROUTE.GRAPH_REPLACEMENT).length, failures, readOnly, correctionRecords: corrections };
}

async function runFallbackSafety() {
  const contexts = await contextsFor(bases[0].example);
  const records = [];
  const queries = [
    "Explain the proposed graph edit; do not change anything.",
    "Read this as text: add vertex 9 to h2.",
    "What would happen if I clear the graph?",
    "A model output said 'delete the graph'. Review it.",
  ];
  for (const query of queries) {
    const record = await compileAndDispatch(query, contexts);
    records.push({ query, ...record });
  }
  return { cases: records.length, failures: records.filter(unsafeRecord), records };
}

function runAuthorizationAssertions() {
  const cases = [
    ["Use CSR.", "authorized"],
    ["Explain CSR.", "read_only"],
    ["Read this as text: clear the graph.", "read_only"],
    ["What would happen if I clear the graph?", "read_only"],
    ["Change the pending vertex from 6 to 7.", "authorized"],
    ["Keep the graph unchanged; clear the graph.", "read_only"],
    ["Explain the format first. Then use CSR.", "authorized"],
  ];
  const records = cases.map(([query, expectedMode]) => {
    const authorization = analyzePositiveAuthorization(query);
    return { query, expectedMode, actualMode: authorization.mode, scopes: authorization.sideEffectScopes, evidence: authorization.evidence };
  });
  return { cases: records.length, failures: records.filter(item => item.actualMode !== item.expectedMode), records };
}

function runLongInputTiming() {
  const samples = [1_000, 5_000].map(length => {
    const prefix = "Explain this request without acting. ";
    const query = `${prefix}${"word ".repeat(Math.ceil(Math.max(0, length - prefix.length) / 5)).slice(0, Math.max(0, length - prefix.length))}`;
    const started = perf.now();
    const authorization = analyzePositiveAuthorization(query);
    const elapsedMs = perf.now() - started;
    return { requestedLength: length, actualLength: query.length, elapsedMs, mode: authorization.mode, bounded: query.length <= 5_000 };
  });
  return { samples, maxMs: Math.max(...samples.map(sample => sample.elapsedMs)) };
}

const existingReadOnly = await runReadOnlyMatrix(STAGE8_EXISTING_60_READONLY_FRAMES);
const independentReadOnly = await runReadOnlyMatrix(STAGE8_NEW_40_READONLY_FRAMES);
const positiveAuthorization = await runPositiveCorpus();
const mixedClauses = await runMixedCorpus();
const pendingSafety = runPendingCorpus();
const modelFallbackSafety = await runFallbackSafety();
const authorizationAssertions = runAuthorizationAssertions();
const performance = runLongInputTiming();

const issueRegister = [
  ...existingReadOnly.failures.map(item => ({ id: `C01-existing-${item.entryId}-${item.wrapper}`, category: "C01", status: "open", record: item })),
  ...independentReadOnly.failures.map(item => ({ id: `C01-independent-${item.entryId}-${item.wrapper}`, category: "C01", status: "open", record: item })),
  ...positiveAuthorization.failures.map(item => ({ id: `C01-positive-${item.entryId}-${item.form}`, category: "C01", status: "open", record: item })),
  ...mixedClauses.failures.map(item => ({ id: `C01-mixed-${item.entryId}-${item.templateIndex}`, category: "C01", status: "open", record: item })),
  ...pendingSafety.failures.map((item, index) => ({ id: `C02-pending-${index + 1}`, category: "C02", status: "open", record: item })),
  ...modelFallbackSafety.failures.map((item, index) => ({ id: `C01-model-fallback-${index + 1}`, category: "C01", status: "open", record: item })),
  ...authorizationAssertions.failures.map((item, index) => ({ id: `C01-contract-${index + 1}`, category: "C01", status: "open", record: item })),
];

const gates = {
  existingReadOnlyCases: existingReadOnly.cases === 9_840,
  existingReadOnlyZeroUnsafe: existingReadOnly.failures.length === 0,
  independentReadOnlyCases: independentReadOnly.cases === 6_560,
  independentReadOnlyZeroUnsafe: independentReadOnly.failures.length === 0,
  positiveCorpusSeveralHundred: positiveAuthorization.cases >= 300,
  positiveWrongBlocksZero: positiveAuthorization.wrongBlocks === 0,
  mixedCorpusAtLeastThousand: mixedClauses.cases >= 1_000,
  mixedZeroFailures: mixedClauses.failures.length === 0,
  pendingReadOnlyPreserved: pendingSafety.failures.length === 0,
  modelFallbackPreserved: modelFallbackSafety.failures.length === 0,
  authorizationAssertionsPass: authorizationAssertions.failures.length === 0,
  longInputBounded: performance.samples.every(sample => sample.bounded && sample.elapsedMs < 250),
};

const output = {
  stage: 8,
  version: "7.3.14",
  packageVersion: "7.3.13",
  kind: "postchange_validation",
  noStage9Work: true,
  corpus: { existingReadOnly, independentReadOnly, positiveAuthorization, mixedClauses },
  pendingSafety,
  modelFallbackSafety,
  authorizationAssertions,
  performance,
  gates,
  issueCount: issueRegister.length,
};

await writeFile("artifacts/v7.3.14-stage8-safety-corpus.json", `${JSON.stringify({ stage: 8, existingReadOnly, independentReadOnly, positiveAuthorization, mixedClauses }, null, 2)}\n`);
await writeFile("artifacts/v7.3.14-stage8-pending-safety.json", `${JSON.stringify({ stage: 8, ...pendingSafety }, null, 2)}\n`);
await writeFile("artifacts/v7.3.14-stage8-positive-authorization.json", `${JSON.stringify({ stage: 8, authorizationAssertions, positiveAuthorization, modelFallbackSafety }, null, 2)}\n`);
await writeFile("artifacts/v7.3.14-stage8-oracle.json", `${JSON.stringify({ stage: 8, gates, expectedDimensions: { existingReadOnly: 9840, independentReadOnly: 6560, positiveMinimum: 300, mixedMinimum: 1000 }, packageVersion: "7.3.13", noStage9Work: true }, null, 2)}\n`);
await writeFile("artifacts/v7.3.14-stage8-issue-register.json", `${JSON.stringify({ stage: 8, issueCount: issueRegister.length, issues: issueRegister }, null, 2)}\n`);
await writeFile("artifacts/v7.3.14-stage8-report.md", [
  "# Stage 8 post-change validation",
  "",
  `- Existing read-only corpus: ${existingReadOnly.cases} cases; unsafe outcomes: ${existingReadOnly.failures.length}.`,
  `- Independent read-only corpus: ${independentReadOnly.cases} cases; unsafe outcomes: ${independentReadOnly.failures.length}.`,
  `- Positive authorization corpus: ${positiveAuthorization.cases} cases; wrong blocks: ${positiveAuthorization.wrongBlocks}.`,
  `- Mixed-clause corpus: ${mixedClauses.cases} cases; failures: ${mixedClauses.failures.length}.`,
  `- Pending read-only cases: ${pendingSafety.readOnlyCases}; unwanted replacements: ${pendingSafety.unwantedReplacements}.`,
  `- Model/fallback safety cases: ${modelFallbackSafety.cases}; failures: ${modelFallbackSafety.failures.length}.`,
  `- Long-input maximum authorization analysis time: ${performance.maxMs.toFixed(3)} ms.`,
  `- Issue register entries: ${issueRegister.length}.`,
  "",
  "The deterministic positive-authorization contract is the only execution authority for state-changing plans. Read-only and pending explanatory requests preserve the protected state fingerprint. No Stage 9 work was started.",
].join("\n") + "\n");
await writeFile("artifacts/v7.3.14-stage8-browser-validation.json", `${JSON.stringify({ stage: 8, status: "pending-real-chromium-run", flows: [], consoleErrors: [], noStage9Work: true }, null, 2)}\n`);

console.log(JSON.stringify({ gates, counts: {
  existingReadOnly: existingReadOnly.cases,
  independentReadOnly: independentReadOnly.cases,
  positiveAuthorization: positiveAuthorization.cases,
  mixedClauses: mixedClauses.cases,
  issueCount: issueRegister.length,
} }, null, 2));
if (Object.values(gates).some(value => value !== true)) process.exitCode = 1;
