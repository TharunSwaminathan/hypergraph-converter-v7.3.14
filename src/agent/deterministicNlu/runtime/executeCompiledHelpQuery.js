import { composeHelpQueryResponse } from "../commandCatalogFormatter.js";

export async function executeCompiledHelpQuery({ prepared, executeHelpQuery } = {}) {
  const query = prepared?.compilation?.typedValue ?? prepared?.compilation?.compiled?.query ?? {};
  const response = composeHelpQueryResponse(query);
  if (typeof executeHelpQuery === "function") {
    return executeHelpQuery(prepared, response);
  }
  return {
    handled: true,
    outcome: "responded",
    response,
    tracePatch: {
      modelCalls: [],
      genericActionPlannerCallCount: 0,
      legacyRawParserCallCount: 0,
      stateMutationCommitted: false,
    },
  };
}
