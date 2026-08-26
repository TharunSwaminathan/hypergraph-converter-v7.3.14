# Graph Mutation Architecture

Hypergraph Converter Studio v7.2.2 keeps the model-backed semantic planning layer while preserving deterministic graph mutation authority and the existing canonical graph model.

## Canonical graph

The committed graph remains `hes` in `src/App.jsx`.

Each hyperedge is normalized as:

```js
{ id, vertices, time, weight, attributes }
```

There is no standalone vertex table. A vertex exists when it appears in at least one hyperedge. Because of that, requests such as “add vertex Charlie” are intentionally ambiguous unless the user names a target hyperedge.

`finalHes` remains the effective display/export graph and may include an explicit Batch Updates preview overlay. Conversational mutations commit to `hes`, not to a transient visualization-only view, and v7.3.6 blocks conversational graph edits while a batch preview is active until the user commits or discards it.

## Identity and versioning

The graph identity is tracked with:

- `graphId`
- `graphVersion`
- `graphFingerprint`

`graphVersion` increments only when committed canonical graph content changes. It does not increment for route switches, text edits, upload-batch navigation, visualization layout changes, export preview selection, or toggling a preview.

## Mutation flow

```text
user chat text
  -> when Ollama is connected, strict non-executable GraphMutationDraft
  -> runtime draft validation
  -> deterministic entity/reference resolution
  -> existing normalized mutation plan
  -> validation against current graph identity/fingerprint
  -> preview
  -> no confirmation when the preview is a no-op or preview-only
  -> confirmation card when graph content would change
  -> re-validation
  -> commitGraph(...)
  -> verification message
```

If Ollama is unavailable, disabled, disconnected, times out, or returns invalid structured output after one repair attempt, the app falls back to `src/agent/graphMutationConversation.js`. That deterministic regex interpreter is explicitly the offline/failure fallback, not the primary path when the local model is connected.

Ollama interprets meaning only. It may propose surface references such as “that hyperedge” or `h0`; deterministic code decides whether those references resolve, are stale, are ambiguous, or require clarification. No model output is executed directly.

## v7.2.2 runtime reliability layer

v7.2.2 adds a local-model request coordinator above the mutation flow. Only one Ollama-backed task can run at a time. Graph planning, repair, conversation, diagnostics, mapping, parser generation, and optional summaries share the same active request record and abort controller.

Stop and timeout are deliberately separate:

- explicit Stop aborts the active request, does not run repair, does not invoke deterministic fallback, and does not stage a graph change;
- timeout marks generation as timed out/degraded and may use deterministic fallback for supported graph commands, still through deterministic preview and confirmation.

Connection state and generation state are also separate. A tiny health check can pass while a full planner request later times out; the UI reports that as connected but degraded/timed out rather than pretending the full planner is healthy.

## Pending correction lifecycle

When a graph mutation is staged, the user can still ask what the pending preview affects, cancel it, or revise it conversationally. A revision discards the older pending plan and creates a new plan ID, plan hash, preview, and confirmation snapshot. The old confirmation card cannot commit a replaced plan.

## No-op and preview-only turns

Duplicate incidences and other deterministic no-op previews return an immediate grounded response and do not create a confirmation card. Preview-only requests, such as “what would happen if...”, produce a deterministic impact summary and do not stage a commit.

## Stale confirmation protection

Confirmation snapshots include the active batch, mapping revision, parser result, parser code version, graph ID, graph version, graph fingerprint, mutation plan ID/hash, and selection fingerprint when applicable. If any relevant state changes before Confirm is clicked, the action is rejected as stale.

## Recent references and selection

Recent verified references are bounded, in-memory, scoped to the current graph identity, and pruned against the current graph. The resolver may use them only after exact IDs and current selection are considered. Visual selection is displayed near the assistant and cleared after graph changes.

## Undo

Committed graph changes append bounded mutation-history entries with before/after snapshots. “Undo last mutation” restores the previous committed graph snapshot after confirmation.
