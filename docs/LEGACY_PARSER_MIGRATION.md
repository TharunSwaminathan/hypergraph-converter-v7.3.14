# Legacy Parser Migration

v7.3.3 narrows legacy parser authority.

Dataset mapping:

- `deterministicDatasetMappingPatch.js` is now a thin adapter around `compileDatasetMappingGrammar`.
- independent raw-text fallback functions such as old role/time/join sentence parsers are not used after compiler no-match.
- `customParserConversation.js` no longer clones and directly mutates legacy mapping objects. v1 mappings migrate in memory or return a safe clarification requiring the v2 typed patch path.

Graph mutation:

- `graphMutationConversation.js` remains as a compatibility adapter.
- supported graph language compiles through `graph_mutation_v1` to existing `GraphMutationPlan` objects.
- preview and confirmation boundaries remain unchanged.

Dashboard/control:

- dashboard grammar returns canonical control intents and slots.
- existing dashboard planners may validate or execute those intents, but raw text is not the semantic contract for the deterministic compiler path.

Remaining compatibility adapters are marked by diagnostics and should report `legacyParserCalled: false` during normal deterministic runtime.
# v7.3.4 migration note

Production chat routing now calls the central deterministic compiler once and dispatches typed results. Legacy raw-text parser/control adapters remain compatibility paths only for unsupported fallthrough, not the normal path after a successful deterministic compilation.
