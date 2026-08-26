import {
  compileGraphMutationGrammar,
  looksLikeGraphMutationRequest,
} from "./deterministicNlu/domains/graphMutationGrammar.js";

export { looksLikeGraphMutationRequest };

export function interpretGraphMutationRequest(text, hyperedges = [], graphIdentity = {}, graphHistory = [], selectedEntity = null, recentReferences = {}) {
  const compiled = compileGraphMutationGrammar(text, {
    hyperedges,
    graphIdentity,
    graphHistory,
    selectedEntity,
    recentReferences,
  });
  if (compiled.noMatch) return compiled;
  return {
    ...compiled,
    diagnostics: {
      ...(compiled.diagnostics ?? {}),
      compatibilityAdapter: "graphMutationConversation",
      legacyParserCalled: false,
    },
  };
}
