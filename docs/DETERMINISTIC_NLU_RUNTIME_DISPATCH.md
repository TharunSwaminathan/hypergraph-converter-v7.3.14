# Deterministic NLU Runtime Dispatch

Production chat routing now uses a central App-owned compile action:

```text
compileDeterministicTurn(query, pending context)
```

That action builds verified context from the active batch, mapping revision, grouping revision, committed graph identity/fingerprint, graph history, selected entity, recent references, and pending action. The panel then calls `dispatchCompiledAction(...)` with typed domain handlers.

No successful compiled turn is reinterpreted through raw-text dashboard classification, raw graph parsing, or generic ActionPlan planning.
