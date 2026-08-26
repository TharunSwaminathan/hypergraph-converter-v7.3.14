export async function executeCompiledGroundedQuestion({ prepared, executeGroundedQuestion } = {}) {
  if (typeof executeGroundedQuestion !== "function") return { handled: false, outcome: "not_handled" };
  return executeGroundedQuestion(prepared);
}
