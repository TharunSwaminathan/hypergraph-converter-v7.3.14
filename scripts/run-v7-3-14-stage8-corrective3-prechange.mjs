import { writeFile } from "node:fs/promises";
import { dispatchCompiledAction } from "../src/agent/deterministicNlu/dispatchCompiledAction.js";

const PARENT_COMMIT = "6b0af8a8a33e5dccc0a9cb7f336d82e1bddaa1e7";

function preparedFor({ domain, typedKind, typedValue, sideEffectClass, requestSemantics }) {
  return {
    handled: true,
    nlu: {
      primaryDomain: domain,
      ambiguities: [],
      confidence: { level: "high", score: 1 },
      limits: { truncated: false },
    },
    compilation: {
      handled: true,
      domain,
      typedKind,
      typedValue,
      sideEffectClass,
      dispatchAuthorized: true,
      semanticConfidence: { level: "high", score: 1 },
      ...(requestSemantics === undefined ? {} : { requestSemantics }),
    },
    runtimeTrace: {
      requestId: "stage8-corrective3-prechange",
      status: "prepared",
      sideEffectClass: sideEffectClass ?? "unknown",
      modelCalls: [],
      validatorCalls: [],
    },
  };
}

async function probe(fixture) {
  const handlerCalls = {
    graphMutation: 0,
    dashboardControl: 0,
    datasetMapping: 0,
    parserWorkflow: 0,
    legacyAction: 0,
    groundedQuestion: 0,
    helpQuery: 0,
    blockedSideEffect: 0,
  };
  const state = { graphVersion: 7, mappingRevision: 4, parserRevision: 3, navigationVersion: 2 };
  const before = JSON.stringify(state);
  const call = name => async () => {
    handlerCalls[name] += 1;
    if (name !== "blockedSideEffect") state[`${name}Calls`] = handlerCalls[name];
    return {
      handled: true,
      outcome: name === "blockedSideEffect" ? "authorization_blocked" : "synthetic_handler_called",
      stateMutationCommitted: name !== "blockedSideEffect",
      confirmationStaged: name === "graphMutation",
    };
  };
  const result = await dispatchCompiledAction({
    prepared: preparedFor(fixture),
    query: fixture.query ?? "",
    state,
    handlers: {
      graphMutation: call("graphMutation"),
      dashboardControl: call("dashboardControl"),
      datasetMapping: call("datasetMapping"),
      parserWorkflow: call("parserWorkflow"),
      legacyAction: call("legacyAction"),
      groundedQuestion: call("groundedQuestion"),
      helpQuery: call("helpQuery"),
      blockedSideEffect: call("blockedSideEffect"),
    },
  });
  return {
    id: fixture.id,
    finding: fixture.finding,
    query: fixture.query ?? "",
    prepared: {
      domain: fixture.domain,
      typedKind: fixture.typedKind,
      typedValue: fixture.typedValue,
      declaredSideEffectClass: fixture.sideEffectClass ?? null,
      requestSemanticsPresent: fixture.requestSemantics !== undefined,
    },
    handlerCalls,
    protectedHandlerCalls: Object.entries(handlerCalls)
      .filter(([name]) => name !== "blockedSideEffect")
      .reduce((sum, [, count]) => sum + count, 0),
    protectedStateChanged: before !== JSON.stringify(state),
    actualSideEffectClass: result.runtimeTrace.actualSideEffectClass ?? null,
    dispatchPath: result.runtimeTrace.dispatchPath ?? null,
    dispatchBlockReason: result.runtimeTrace.dispatchBlockReason ?? null,
    authorizationDecision: result.runtimeTrace.authorizationDecision ?? null,
  };
}

const clearOperation = [{ type: "CLEAR_GRAPH" }];
const cases = [
  {
    id: "S8-N05-A-domain-graph-kind-dashboard-payload-graph",
    finding: "S8-N05",
    domain: "graph_mutation",
    typedKind: "DashboardControlIntent",
    typedValue: { canonicalIntent: "NOOP", operations: clearOperation },
    sideEffectClass: "read_only",
    query: "",
  },
  {
    id: "S8-N05-B-domain-graph-kind-grounded-payload-graph",
    finding: "S8-N05",
    domain: "graph_mutation",
    typedKind: "GroundedQuestion",
    typedValue: { question: "What would clearing do?", operations: clearOperation },
    sideEffectClass: "read_only",
    query: "Explain graph clearing without changing anything.",
  },
  {
    id: "S8-N05-C-domain-dashboard-kind-graph",
    finding: "S8-N05",
    domain: "dashboard_control",
    typedKind: "GraphMutationPlan",
    typedValue: { operations: clearOperation },
    sideEffectClass: "graph_edit_preview",
    query: "Clear the graph.",
  },
  {
    id: "S8-N05-D-domain-mapping-kind-parser",
    finding: "S8-N05",
    domain: "dataset_mapping",
    typedKind: "ParserWorkflowOperation",
    typedValue: { operations: [{ type: "GENERATE_TRANSFORMATION_PLAN" }] },
    sideEffectClass: "workflow_preparation",
    query: "Generate the transformation plan.",
  },
  {
    id: "S8-N05-E-domain-parser-kind-mapping",
    finding: "S8-N05",
    domain: "parser_workflow",
    typedKind: "DatasetMappingPatch",
    typedValue: { operations: [{ type: "SET_FILE_ROLE", fileName: "papers.csv", role: "hyperedge_table" }] },
    sideEffectClass: "reversible_mapping_edit",
    query: "Map papers.csv as the hyperedge table.",
  },
  {
    id: "S8-N05-F-domain-legacy-kind-dashboard",
    finding: "S8-N05",
    domain: "legacy_action",
    typedKind: "DashboardControlIntent",
    typedValue: { canonicalIntent: "NAVIGATE_STATS", requiredContext: [] },
    sideEffectClass: "navigation",
    query: "Show statistics.",
  },
  {
    id: "S8-N06-known-file-picker-self-declares-read-only",
    finding: "S8-N06",
    domain: "legacy_action",
    typedKind: "LegacyActionIntent",
    typedValue: { kind: "open_file_picker", sideEffect: "read_only", requiredContext: [] },
    sideEffectClass: "read_only",
    query: "",
  },
];

const records = [];
for (const fixture of cases) records.push(await probe(fixture));
const byId = Object.fromEntries(records.map(record => [record.id, record]));
const output = {
  stage: 8,
  corrective: 3,
  kind: "prechange_plan_identity_and_legacy_authority_characterization",
  parentCommit: PARENT_COMMIT,
  packageVersion: "7.3.13",
  noStage9Work: true,
  findings: [
    {
      id: "S8-N05",
      severity: "High",
      title: "Final gate and handler routing can disagree on domain versus typed plan identity",
      status: byId["S8-N05-A-domain-graph-kind-dashboard-payload-graph"].handlerCalls.graphMutation === 1
        ? "confirmed"
        : "not_reproduced",
    },
    {
      id: "S8-N06",
      severity: "High",
      title: "Legacy ActionIntent can self-declare a read_only side-effect class instead of using authoritative registry metadata",
      status: byId["S8-N06-known-file-picker-self-declares-read-only"].handlerCalls.legacyAction === 1
        ? "confirmed"
        : "not_reproduced",
    },
  ],
  records,
};

await writeFile(
  "artifacts/v7.3.14-stage8-corrective3-prechange.json",
  `${JSON.stringify(output, null, 2)}\n`,
);

console.log(JSON.stringify({
  findings: output.findings,
  records: records.map(record => ({
    id: record.id,
    handlers: record.handlerCalls,
    actualSideEffectClass: record.actualSideEffectClass,
    dispatchPath: record.dispatchPath,
    dispatchBlockReason: record.dispatchBlockReason,
  })),
}, null, 2));

if (output.findings.some(finding => finding.status !== "confirmed")) process.exitCode = 1;
