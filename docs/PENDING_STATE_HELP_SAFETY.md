# Pending-State Help Safety

v7.3.10 routes every message received while an action is pending through `routePendingSubmission(...)` before broad conversation handling.

```text
pending action + Help/instruction request -> deterministic Help; preserve pending
pending action + direct Confirm           -> confirm compatible pending action
pending action + direct Cancel            -> cancel pending action
pending graph action + replacement edit   -> validated replacement path
other action text                         -> require confirm/cancel first
```

Help about controls is not the control itself:

```text
Would you mind explaining how to cancel the pending action? -> Help
What button do I click to stop the current request?          -> Help
Cancel pending action.                                      -> cancel
Confirm pending action.                                     -> confirm
Stop.                                                       -> runtime stop only with active work
```

The live UI passes the current `pendingAction` into deterministic dispatch. Required-context authority verifies `pending_action` or `compatible_pending_confirmation` before handlers run. Selection, graph, mapping, parser, batch, and mutation-plan fingerprints are rechecked at confirmation time.

Owner-ID request coordination replaces the former shared Boolean in-flight flag. A read-only Help request or direct Stop may overlap active work, but finishing it removes only its own request token and cannot clear another request's busy lifecycle.
