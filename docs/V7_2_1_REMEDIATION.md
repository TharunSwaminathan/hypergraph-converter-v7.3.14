# v7.2.1 Remediation

This release remediates the v7.2.0 conversational graph-mutation gap: graph edits were parsed by a deterministic regular-expression interpreter before a connected local model could interpret more natural phrasing.

## What changed

- Added a dedicated `plan_graph_mutation` local-model task.
- Added strict `GraphMutationDraft` schema and deterministic draft validation.
- Added a bounded graph-mutation planner prompt for local Ollama.
- Added deterministic conversion from validated draft references to existing `GraphMutationPlan` operations.
- Wired the app so connected model planning runs before deterministic fallback for plausible graph-edit requests.
- Kept `graphMutationConversation.js` as the offline/failure fallback.
- Fixed trailing modifier contamination in the fallback without globally deleting words from IDs.
- Added no-op handling before confirmation staging.
- Added pending graph-mutation correction handling.

## Authority boundary

```text
model draft
-> deterministic validation
-> deterministic resolution
-> deterministic plan
-> deterministic preview
-> confirmation
-> deterministic commit
```

The model cannot commit, call React setters, execute parser code, resolve graph IDs authoritatively, bypass confirmation for real changes, or claim a graph change occurred.

## Preserved behavior

Existing routes, exports, mappings, Custom Parser Studio, upload-batch isolation, parser profiles, algorithms, local Ollama bridge, direct Ollama setup, confirmation snapshots, graph identity/version/fingerprint checks, history, and undo are preserved.

## Remaining limitations

The planner does not add standalone vertex storage, vertex attributes, merge/split operations, a graph query language, a backend, cloud model providers, or long-term memory. Natural language support is bounded by the local model draft and deterministic resolver.
