export async function executeCompiledMapping({ prepared, query, options = {}, applyMapping } = {}) {
  if (typeof applyMapping !== "function") return { handled: false, outcome: "not_handled" };
  return applyMapping(prepared, query, {
    ...options,
    precompiledDraft: prepared?.compilation?.typedValue ?? null,
    precompiledCompilation: prepared?.compilation ?? null,
    semanticConfidence: prepared?.compilation?.semanticConfidence ?? null,
    contextBinding: prepared?.contextBinding ?? null,
  });
}
