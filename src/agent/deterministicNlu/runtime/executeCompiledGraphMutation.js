export async function executeCompiledGraphMutation({
  prepared,
  query,
  options = {},
  stageGraphMutation,
} = {}) {
  if (typeof stageGraphMutation !== "function") return { handled: false, outcome: "not_handled" };
  return stageGraphMutation(query, {
    ...options,
    returnDetails: true,
    deterministicNlu: prepared?.nlu ?? null,
    precompiledPlan: prepared?.compilation?.typedValue ?? null,
    precompiledCompilation: prepared?.compilation ?? null,
    semanticConfidence: prepared?.compilation?.semanticConfidence ?? null,
    contextBinding: prepared?.contextBinding ?? null,
    deterministicFirst: true,
  });
}
