export async function executeCompiledParserWorkflow({ prepared, executeParserWorkflow } = {}) {
  if (typeof executeParserWorkflow !== "function") return { handled: false, outcome: "not_handled" };
  return executeParserWorkflow(prepared);
}
