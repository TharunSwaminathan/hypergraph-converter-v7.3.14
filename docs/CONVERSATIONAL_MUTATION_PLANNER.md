# Conversational Mutation Planner

## v7.3.2 graph mutation NLU access

Graph mutation paraphrases are now visible to the shared deterministic NLU classifier, but graph changes still flow through the existing graph mutation interpreter, validator, preview, and confirmation pipeline. The NLU layer can classify and route phrases such as `h0 should include 4 too`; it does not commit graph state.

Scoped removal language such as `Take vertex 4 out of h1, but keep it in the other hyperedges` remains a single incidence removal, not a global vertex deletion.

v7.2.2 keeps connected graph mutation semantic-first without letting the model mutate graph state, and adds runtime reliability hardening around the local Ollama request path.

```text
natural request
-> local qwen3:8b GraphMutationDraft
-> strict draft validation
-> deterministic reference resolution
-> existing GraphMutationPlan
-> deterministic preview
-> confirmation only for real graph changes
-> deterministic commit after stale-state checks
```

The planner is local-only and uses the existing Ollama client with `think: false` and a strict response schema. It does not add a backend, cloud API, API key, hosted model endpoint, bundled model weights, or LangGraph dependency.

In v7.2.2, the schema is attached through Ollama's structured `format` field but is not duplicated inside ordinary or repair prompt text. Planner context is bounded to four recent turns, small ID samples, compact pending-plan summaries, current selection, and bounded recent verified references. The measured typical planner prompt is 2,370 characters, the bounded maximum is 9,106 characters, and the serialized schema is 2,981 characters.

The planner uses one total 60-second deadline across initial generation, validation, and optional repair. It also uses `keep_alive: 10m`, `think: false`, and `num_predict: 768`.

## Draft versus plan

`GraphMutationDraft` is a semantic sketch. It may say the user probably wants to add an incidence and may name surface references such as `h0`, `that hyperedge`, or `Alice`. It is not trusted as executable state.

The deterministic resolver then checks the current graph, selected entity, graph identity, and pending mutation context. Only after resolution does the app create the existing `GraphMutationPlan`.

## Corrections

If a graph mutation is pending, the user may revise it:

```text
Remove Alice everywhere.
Actually, only remove Alice from h0.
```

The revised turn replaces the earlier plan with a new plan ID, plan hash, preview, and confirmation token. Questions such as “What will this affect?” describe the pending preview instead of replacing it. “Never mind” cancels the pending action without changing the graph.

## No-op and preview-only behavior

If the deterministic preview shows identical before/after graph fingerprints, the assistant responds immediately and does not display a confirmation card. This covers duplicate incidences such as adding vertex `4` to `h0` when it is already present.

Preview-only requests show impact but do not stage a commit.

## Fallback

When Ollama is disabled, disconnected, unavailable, times out, or returns invalid structured output after one repair attempt, the app falls back to `src/agent/graphMutationConversation.js`. That fallback remains deterministic and offline.

The fallback now has command-aware handling for trailing modifiers such as `again`, `too`, `as well`, `please`, and `now`. It first tries the full captured text as an exact graph ID and preserves quoted modifier-like IDs.

Explicit Stop is different from timeout. If the user presses Stop during a planner request, the request is classified as `request_aborted`, repair is skipped, deterministic fallback is not run, and no pending graph change is prepared.

## Recent references and selection

v7.2.2 adds a bounded recent-reference store for verified graph entities. References are recorded only from deterministic facts such as resolved plans, committed plans, fallback plans, or explicit visual selection. The resolver can use a unique recent hyperedge or vertex for phrases such as "that one" after checking that the entity still exists in the current graph.

The assistant context bar also displays `Selection: ...` or `Selection: none`. Selection is cleared after committed graph changes to avoid stale references.
