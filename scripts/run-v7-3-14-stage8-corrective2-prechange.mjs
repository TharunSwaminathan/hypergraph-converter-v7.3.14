import { writeFile } from "node:fs/promises";
import { dispatchCompiledAction } from "../src/agent/deterministicNlu/dispatchCompiledAction.js";
import { analyzeRequestSemantics } from "../src/agent/deterministicNlu/requestSemantics.js";

const PARENT_COMMIT = "ea6c442b5219f7452fd1dc32663cec580790911e";

function preparedFor({
  domain,
  typedKind,
  typedValue,
  sideEffectClass,
  requestSemantics,
}) {
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
      requestId: "stage8-corrective2-prechange",
      status: "prepared",
      sideEffectClass: sideEffectClass ?? "unknown",
      modelCalls: [],
      validatorCalls: [],
    },
  };
}

async function probe({ id, query = "", ...fixture }) {
  const handlerCalls = {
    graphMutation: 0,
    dashboardControl: 0,
    datasetMapping: 0,
    parserWorkflow: 0,
    legacyAction: 0,
    blockedSideEffect: 0,
  };
  const state = { graphVersion: 7, pendingAction: null };
  const before = JSON.stringify(state);
  const call = name => async () => {
    handlerCalls[name] += 1;
    if (name !== "blockedSideEffect") state.graphVersion += 1;
    return {
      handled: true,
      outcome: name === "blockedSideEffect" ? "authorization_blocked" : "synthetic_handler_called",
      stateMutationCommitted: name !== "blockedSideEffect",
    };
  };
  const result = await dispatchCompiledAction({
    prepared: preparedFor(fixture),
    query,
    state,
    handlers: {
      graphMutation: call("graphMutation"),
      dashboardControl: call("dashboardControl"),
      datasetMapping: call("datasetMapping"),
      parserWorkflow: call("parserWorkflow"),
      legacyAction: call("legacyAction"),
      blockedSideEffect: call("blockedSideEffect"),
    },
  });
  return {
    id,
    queryLength: query.length,
    queryAuthorization: query ? analyzeRequestSemantics(query).authorization : null,
    prepared: {
      domain: fixture.domain,
      typedKind: fixture.typedKind,
      typedValue: fixture.typedValue,
      declaredSideEffectClass: fixture.sideEffectClass ?? null,
      requestSemanticsPresent: fixture.requestSemantics !== undefined,
    },
    handlerCalls,
    stateChanged: before !== JSON.stringify(state),
    dispatchPath: result.runtimeTrace.dispatchPath,
    authorizationDecision: result.runtimeTrace.authorizationDecision ?? null,
    dispatchBlockReason: result.runtimeTrace.dispatchBlockReason ?? null,
  };
}

const graphPlan = { operations: [{ type: "CLEAR_GRAPH" }] };
const dashboardPlan = { canonicalIntent: "NAVIGATE_STATS" };
const truncatedQuery = `Clear the graph. ${"context ".repeat(630)}Do not clear the graph.`;
const cases = [
  {
    id: "S8-N03-A-navigation-auth-graph-plan-declared-read-only",
    query: "Use CSR.",
    domain: "graph_mutation",
    typedKind: "GraphMutationPlan",
    typedValue: graphPlan,
    sideEffectClass: "read_only",
  },
  {
    id: "S8-N03-B-navigation-auth-graph-plan-declared-navigation",
    query: "Use CSR.",
    domain: "graph_mutation",
    typedKind: "GraphMutationPlan",
    typedValue: graphPlan,
    sideEffectClass: "navigation",
  },
  {
    id: "S8-N03-C-graph-auth-dashboard-plan-declared-graph",
    query: "Clear the graph.",
    domain: "dashboard_control",
    typedKind: "DashboardControlIntent",
    typedValue: dashboardPlan,
    sideEffectClass: "graph_edit_preview",
  },
  {
    id: "S8-N03-D-mapping-auth-graph-plan-declared-mapping",
    query: "Map papers.csv to authors.csv.",
    domain: "graph_mutation",
    typedKind: "GraphMutationPlan",
    typedValue: graphPlan,
    sideEffectClass: "reversible_mapping_edit",
  },
  {
    id: "S8-N03-E-truncated-graph-plan-declared-read-only",
    query: truncatedQuery,
    domain: "graph_mutation",
    typedKind: "GraphMutationPlan",
    typedValue: graphPlan,
    sideEffectClass: "read_only",
  },
  {
    id: "S8-N03-F-read-only-auth-graph-plan-declared-read-only",
    query: "Explain what clearing the graph would do.",
    domain: "graph_mutation",
    typedKind: "GraphMutationPlan",
    typedValue: graphPlan,
    sideEffectClass: "read_only",
  },
  {
    id: "S8-N04-empty-query-no-semantics-state-changing-plan",
    query: "",
    domain: "graph_mutation",
    typedKind: "GraphMutationPlan",
    typedValue: graphPlan,
    sideEffectClass: "graph_edit_preview",
  },
];

const records = [];
for (const fixture of cases) records.push(await probe(fixture));

const byId = Object.fromEntries(records.map(record => [record.id, record]));
const output = {
  stage: 8,
  corrective: 2,
  kind: "prechange_final_dispatch_characterization",
  parentCommit: PARENT_COMMIT,
  packageVersion: "7.3.13",
  noStage9Work: true,
  findings: [
    {
      id: "S8-N03",
      severity: "High",
      title: "Final dispatch authorizes caller-declared side-effect class instead of actual typed-plan side effect",
      status: byId["S8-N03-A-navigation-auth-graph-plan-declared-read-only"].handlerCalls.graphMutation === 1
        && byId["S8-N03-B-navigation-auth-graph-plan-declared-navigation"].handlerCalls.graphMutation === 1
        ? "confirmed"
        : "not_reproduced",
    },
    {
      id: "S8-N04",
      severity: "Medium",
      title: "State-changing prepared actions can bypass authorization when query semantics are absent",
      status: byId["S8-N04-empty-query-no-semantics-state-changing-plan"].handlerCalls.graphMutation === 1
        ? "confirmed"
        : "not_reproduced",
    },
  ],
  records,
};

await writeFile(
  "artifacts/v7.3.14-stage8-corrective2-prechange.json",
  `${JSON.stringify(output, null, 2)}\n`,
);

console.log(JSON.stringify({
  findings: output.findings,
  records: records.map(record => ({
    id: record.id,
    handlers: record.handlerCalls,
    stateChanged: record.stateChanged,
    dispatchPath: record.dispatchPath,
    dispatchBlockReason: record.dispatchBlockReason,
  })),
}, null, 2));

if (output.findings.some(finding => finding.status !== "confirmed")) process.exitCode = 1;
