# Deterministic-First Graph Routing

> **v7.3.5 correction:** v7.3.4 compiled graph plans were created but some forwarding options were dropped by the panel. v7.3.5 forwards the complete precompiled bundle and records observed planner diagnostics.


For high-confidence graph language, App now accepts a precompiled `GraphMutationPlan` from the central compiler:

```text
compileDeterministicAction
-> graph_mutation_v1
-> precompiled GraphMutationPlan
-> previewGraphMutation
-> confirmation card
```

When semantic confidence is high, model planning is bypassed even if Ollama is connected. Medium-confidence graph language can ask for clarification or use the typed local model planner when connected. Low-confidence language does not stage a graph edit.

Graph plans are bound to graph ID, graph version, graph fingerprint, and pending action details; stale plans are rejected instead of being silently recompiled.
