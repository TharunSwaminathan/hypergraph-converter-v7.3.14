import { executeCompiledDashboardControl } from "./executeCompiledDashboardControl.js";
import { executeCompiledGraphMutation } from "./executeCompiledGraphMutation.js";
import { executeCompiledGroundedQuestion } from "./executeCompiledGroundedQuestion.js";
import { executeCompiledHelpQuery } from "./executeCompiledHelpQuery.js";
import { executeCompiledMapping } from "./executeCompiledMapping.js";
import { executeCompiledParserWorkflow } from "./executeCompiledParserWorkflow.js";

export function createProductionDeterministicHandlers({
  prepared,
  query,
  options = {},
  callbacks = {},
  instrumentation = null,
} = {}) {
  const observe = (name) => instrumentation?.recordHandlerCall?.(name);
  return {
    truncated: async (...args) => {
      observe("truncated");
      return callbacks.truncated?.(...args);
    },
    clarification: async (...args) => {
      observe("clarification");
      return callbacks.clarification?.(...args);
    },
    stale: async (...args) => {
      observe("stale");
      return callbacks.stale?.(...args);
    },
    contextMissing: async (...args) => {
      observe("contextMissing");
      return callbacks.contextMissing?.(...args);
    },
    blockedSideEffect: async (...args) => {
      observe("blockedSideEffect");
      return callbacks.blockedSideEffect?.(...args);
    },
    groundedQuestion: async () => {
      observe("groundedQuestion");
      return executeCompiledGroundedQuestion({ prepared, executeGroundedQuestion: callbacks.groundedQuestion });
    },
    helpQuery: async () => {
      observe("helpQuery");
      return executeCompiledHelpQuery({ prepared, executeHelpQuery: callbacks.helpQuery });
    },
    datasetMapping: async () => {
      observe("datasetMapping");
      return executeCompiledMapping({ prepared, query, options, applyMapping: callbacks.datasetMapping });
    },
    parserWorkflow: async () => {
      observe("parserWorkflow");
      return executeCompiledParserWorkflow({ prepared, executeParserWorkflow: callbacks.parserWorkflow });
    },
    graphMutation: async () => {
      observe("graphMutation");
      return executeCompiledGraphMutation({ prepared, query, options, stageGraphMutation: callbacks.graphMutation });
    },
    dashboardControl: async () => {
      observe("dashboardControl");
      return executeCompiledDashboardControl({ prepared, query, executeDashboardControl: callbacks.dashboardControl });
    },
    legacyAction: async () => {
      observe("legacyAction");
      return callbacks.legacyAction?.(prepared, query) ?? { handled: false, outcome: "not_handled" };
    },
  };
}
