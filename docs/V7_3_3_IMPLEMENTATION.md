# v7.3.3 Implementation Notes

v7.3.3 is a consolidation release for deterministic conversational NLU. It keeps the v7.3.2 feature set, but removes runtime authority from repeated raw-text fallback parsers where supported deterministic language can be compiled into typed actions.

The architecture is:

```text
raw user message
-> analyzeDeterministicNlu
-> compileDeterministicAction
-> one authoritative domain compiler
-> existing typed draft/action schema
-> existing deterministic validators
-> preview, confirmation, or safe read-only response
```

Authoritative compilers added or consolidated:

- `dataset_mapping_v1`: compiles conversational dataset mapping/grouping language to `DatasetMappingPatch` drafts.
- `dataset_grouping_v1`: filtered grouping view over the same typed mapping compiler.
- `graph_mutation_v1`: compiles graph-edit language to existing `GraphMutationPlan` objects and draft metadata.
- `dashboard_control_v1`: compiles route/control language to canonical dashboard intents and slots.
- `parser_workflow_v1`: preserves typed parser workflow operations.
- `grounded_question_v1`: preserves grounded status/explanation questions.

Compatibility wrappers remain for old imports, but they are non-authoritative. `graphMutationConversation.js` forwards to `graph_mutation_v1`; `customParserConversation.js` migrates legacy v1 mapping shapes in memory or fails safely, and does not directly mutate mapping specs.

No cloud APIs, API keys, LangGraph, backend services, bundled models, or automatic remote model calls were added.
