# v7.3 Implementation

v7.3 turns Custom Parser fallback into a mapping-first workflow:

```text
profile -> group -> map -> clarify -> plan -> generate -> run -> reconcile -> preview -> apply
```

The deterministic application owns file/column verification, mapping validation, transformation-plan creation, parser generation, trusted-code worker execution, reconciliation, and graph replacement. The optional local model can interpret meaning or suggest typed patches only.

No cloud APIs, API keys, backend services, LangGraph, autonomous agents, or bundled model weights are added.
