# Deterministic Runtime Trace Lifecycle

Each accepted deterministic turn has one request ID and one retained trace record.

Trace states:

```text
prepared -> dispatching -> completed
                     -> stale_rejected
                     -> cancelled
                     -> failed
```

Preparation records analysis and compilation. Dispatch merges observed domain-handler diagnostics, validator calls, model calls, recompilation counts, confirmation staging, commits, stale rejection, and elapsed time. `recordCompletedDeterministicTrace()` upserts the final record by request ID so a preparation-only trace does not remain as the final history entry.

Advanced diagnostics expose the completed trace without storing raw uploaded file content or hidden model reasoning.
