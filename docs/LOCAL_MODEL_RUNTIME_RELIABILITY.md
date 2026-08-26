# Local Model Runtime Reliability

## v7.3.2 deterministic-first hybrid routing

v7.3.2 reduces unnecessary local-model traffic. Supported high-confidence turns are handled by deterministic NLU and existing typed validators with zero Ollama calls. Ambiguous domain-specific turns may ask a targeted clarification or use the typed local-model planner when connected. Open-ended conversation can still use the local model, but model prose is never executable authority.

Diagnostics can show the deterministic understanding path, domain, intent, confidence, and concise interpretation trace. These diagnostics intentionally do not contain hidden chain-of-thought or full uploaded file previews.

v7.2.2 treats the local assistant as a single shared Ollama runtime. The dashboard remains deterministic and offline-capable; Ollama may interpret language, but it does not mutate graph state or bypass confirmation.

## Exclusive request policy

The app has two layers of protection:

1. `AgentChatPanel` sets an immediate `requestInFlightRef` before appending an accepted user turn.
2. `createLocalModelRequestCoordinator()` owns a synchronous active request record for all model call paths.

If a request is active, later model-backed actions are rejected instead of queued:

```text
The local assistant is already working. Wait for it to finish or press Stop.
```

The typed message remains in the composer so the user can send it later.

## Stop and timeout

Stop and timeout are separate states:

| Condition | Classification | Fallback? | Graph change? |
| --- | --- | --- | --- |
| user clicks Stop | `request_aborted` | no | no |
| planner exceeds budget | `model_generation_timeout` | yes, if deterministic fallback supports the request | only after preview and confirmation |
| invalid structured draft | validation failure | one repair attempt if budget remains, then fallback | only after preview and confirmation |
| ordinary conversation timeout | `model_generation_timeout` | no graph fallback | no |

Stop aborts both streamed conversation and non-streaming structured planner requests through the active coordinator `AbortController`.

## Connection state versus generation state

Connection state describes endpoint/model reachability:

```text
disconnected | testing | connected | error
```

Generation state describes the current or last model task:

```text
idle | generating | stopping | degraded | timed_out
```

A full graph-planner timeout does not automatically mark Ollama disconnected. The endpoint may still be reachable while generation is degraded.

## Metrics

Ollama responses may include nanosecond metrics:

- `total_duration`
- `load_duration`
- `prompt_eval_count`
- `prompt_eval_duration`
- `eval_count`
- `eval_duration`
- `done_reason`

`ollamaMetrics.js` converts these to milliseconds, output tokens per second, client elapsed time, and approximate transport overhead. The app stores only bounded diagnostics for the most recent requests and does not store hidden reasoning, full prompts, uploaded data, or file previews.

## Planner readiness

The basic connection test verifies tags/model presence and a tiny structured response. It is not a guarantee that the full graph planner is ready.

The graph-planner readiness diagnostic sends a tiny in-memory graph request, validates the returned `GraphMutationDraft`, reports prompt/schema size and metrics, and never stages or commits a mutation.

CLI equivalent when Ollama is available:

```bash
node scripts/smoke-test-graph-mutation-planner.mjs
```

Useful environment overrides:

```bash
HYPERGRAPH_OLLAMA_BASE_URL=http://127.0.0.1:8787/ollama
HYPERGRAPH_OLLAMA_MODEL=qwen3:8b
HYPERGRAPH_PLANNER_TIMEOUT_MS=60000
```

## Recent references and selection

Recent references are stored only after deterministic verification: resolved mutation plans, deterministic fallback plans, committed plans, or explicit visual selection. The store is bounded to five vertices and five hyperedges, pruned against the current graph, cleared on graph identity change, and not persisted across browser sessions.

Resolution priority is:

1. exact explicit ID;
2. explicit selected reference;
3. unique current visual selection for an unambiguous pronoun;
4. unique recent verified entity;
5. clarification.

The assistant context bar shows `Selection: hyperedge h1`, `Selection: vertex 4`, or `Selection: none`. Selection is cleared after committed graph changes to avoid stale references.
# v7.3 dataset-planning tasks

The v7.3 dataset interpretation and mapping-patch model tasks use the same exclusive local-model request coordinator, Stop path, timeout handling, and metrics as v7.2.2. Model output is restricted to non-executable JSON drafts and cannot run parser code or replace graph state.
## v7.3.1 mapping task degradation

Mapping task failures do not automatically mark Ollama disconnected. If the endpoint remains healthy but `plan_dataset_mapping_patch` is invalid or times out, generation state becomes degraded or timed out and the deterministic mapping fallback remains available.
