# Dataset Mapping Chat Routing

## v7.3.2 deterministic NLU-first routing

The chat router now calls `maybeHandleDeterministicNlu(query)` before the older dataset-mapping intent gate. High-confidence supported dataset grouping and mapping turns compile to typed `DatasetMappingPatch` operations with `plannerPath: deterministic_nlu`, so routine requests do not call Ollama even when a local model is connected.

The previous v7.3.1 mapping gate remains as a compatibility and fallback layer. It still protects broad interpretation questions and non-mapping dashboard/graph actions from accidental mapping edits.

Dataset-mapping chat handling now runs before graph mutation, deterministic dashboard controls, conversational gating, and generic ActionPlan routing.

Routing priority for a normal turn:

```text
1. pending execution-action handling
2. dataset mapping / interpretation candidate handling
3. deterministic mapping fallback where applicable
4. graph mutation handling
5. deterministic dashboard controls
6. ordinary conversation/action gate
7. generic ActionPlan for remaining application actions
```

Intent classes:

- `explicit_patch`: direct file/column/role/key/join/policy edits.
- `interpretation`: broad dataset meaning or role interpretation.
- `clarification_answer`: bounded answer to a mapping clarification.
- `mapping_question`: non-mutating explanation grounded in active profile/mapping state.
- `not_mapping`: graph actions, exports, parser execution, stats, route changes, or general concepts.

For an active Custom Parser batch, handled mapping requests set diagnostics with:

```js
genericActionPlannerCalled: false
routePlannerCalled: false
```

The active route and parse mode are preserved unless a validated typed patch explicitly contains `SET_PARSE_MODE`.

The deterministic fallback resolves references in this order:

```text
files: exact case-sensitive -> exact case-insensitive -> unique basename -> unique clear alias -> clarification
columns: exact header -> case-insensitive exact header -> unique normalized header -> clarification
```

It never invents missing files or columns.
