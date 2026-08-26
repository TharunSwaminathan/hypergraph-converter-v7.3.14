# v7.2.2 Remediation Notes

Hypergraph Converter Studio v7.2.2 is a focused conversational runtime reliability release. It starts from the v7.2.1 planner remediation baseline and keeps the same deterministic authority boundary:

```text
model interpretation
-> deterministic draft validation
-> deterministic reference resolution
-> deterministic preview
-> confirmation for real changes
-> deterministic commit
```

No new graph operation types, parser formats, cloud APIs, API keys, hosted model endpoints, model weights, LangGraph dependency, or backend database were added.

## What changed

- `src/agent/localModelRequestCoordinator.js` adds a synchronous exclusive coordinator. One local-model request may be active across the whole app.
- `src/components/AgentChatPanel.jsx` adds a synchronous composer lock so rapid submissions cannot enter before React state rerenders.
- `src/App.jsx` routes model-backed conversation, graph planning, orchestration, diagnostics, and optional summaries through the coordinator.
- Stop now aborts streamed conversation and non-streaming structured planner requests through the active `AbortController`.
- Explicit Stop is classified as `request_aborted` and does not trigger repair, deterministic fallback, pending confirmation, or graph mutation.
- Timeout is classified as `model_generation_timeout`. A graph-planner timeout may use deterministic fallback, still with normal preview/confirmation safety.
- `src/agent/localModelRuntimeState.js` separates endpoint connection from generation state.
- `src/agent/ollamaMetrics.js` normalizes Ollama nanosecond metrics into bounded request diagnostics.
- `src/agent/graphConversationReferences.js` keeps bounded recent verified graph references for phrases such as “that one”.
- The assistant displays current selection state and clears stale selection after committed graph changes.
- Local Runtime Diagnostics now distinguishes a basic health check from the full graph-planner readiness test.

## Planner prompt and schema reduction

The planner still attaches `GRAPH_MUTATION_DRAFT_SCHEMA` through Ollama's structured `format` field. The schema is no longer embedded inside the prompt JSON or repair text.

Measured budgets from the v7.2.2 source:

| Item | Measured size |
| --- | ---: |
| typical planner prompt | 2,370 characters |
| bounded maximum planner prompt | 9,106 characters |
| serialized response schema | 2,981 characters |
| repair prompt addition | 1,265 characters |
| planner output cap | 768 tokens |

The model-facing schema is a compact transport schema with nullable operation fields. Runtime validation remains operation-specific and strict in `graphMutationDraftValidator.js`.

## Timeout defaults

| Task | Timeout |
| --- | ---: |
| health check | 30 seconds |
| graph planner total | 60 seconds |
| graph planner first attempt | 45 seconds |
| minimum repair budget | 10 seconds |
| ActionPlan orchestration | 60 seconds |
| conversation | 120 seconds |
| mapping | 120 seconds |
| custom parser generation | 120 seconds |
| summarization | 45 seconds |

The graph planner uses one total deadline across the initial generation, validation, and optional repair. Repair is skipped when the remaining budget is too small.

## Remaining limitations

- The local model is still optional and must be started by the user.
- Live planner latency depends on the user's machine, Ollama state, model load state, and bridge/direct transport.
- Recent references are intentionally in-memory only and scoped to the current graph identity.
- The canonical graph still has no standalone vertex table; vertices exist through incidences.
