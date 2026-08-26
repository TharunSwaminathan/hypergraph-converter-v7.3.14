# Graph Mutation Schema

## GraphMutationDraft

v7.2.1 adds a separate model-facing `GraphMutationDraft`. It is intentionally non-executable.

Required top-level fields:

```json
{
  "task": "plan_graph_mutation",
  "classification": "mutation|clarification|not_mutation|unsupported",
  "intentSummary": "bounded string",
  "operations": [],
  "clarificationQuestion": null,
  "correction": {
    "isCorrection": false,
    "replacePendingPlan": false
  },
  "previewOnly": false,
  "acknowledgement": "bounded user-facing string",
  "confidence": "high|medium|low"
}
```

Entity references are surface references, not resolved IDs:

```json
{
  "entityType": "vertex|hyperedge",
  "referenceKind": "literal|selected|pronoun|recent|last_created",
  "surfaceText": "h0"
}
```

The model draft may only use graph operation types already supported by the deterministic engine. The app rejects extra properties, unknown operations, unsafe attribute keys, oversized fields, executable-looking code text, invalid entity-reference shapes, and more than ten operations.

## GraphMutationPlan

Mutation plans use schema version `1`.

```js
{
  schemaVersion: 1,
  planId,
  source,
  summary,
  createdAt,
  expectedGraphId,
  expectedGraphVersion,
  expectedGraphFingerprint,
  operations,
  metadata,
  planHash
}
```

Supported operation types:

- `ADD_HYPEREDGE`
- `REMOVE_HYPEREDGE`
- `ADD_INCIDENCE`
- `REMOVE_INCIDENCE`
- `RENAME_HYPEREDGE`
- `RENAME_VERTEX`
- `REMOVE_VERTEX_GLOBAL`
- `SET_HYPEREDGE_WEIGHT`
- `SET_HYPEREDGE_TIME`
- `SET_HYPEREDGE_ATTRIBUTE`
- `REMOVE_HYPEREDGE_ATTRIBUTE`
- `COMMIT_BATCH_UPDATES`
- `CLEAR_GRAPH`
- `UNDO_LAST_MUTATION`

Empty-hyperedge policy is explicit for incidence removals:

- `keep_empty`
- `remove_empty`
- `ask`

`ask` is not executable. The assistant must clarify before producing an executable plan.

Security checks reject unsupported operations, stale graph identity/fingerprint, stale plan hashes, non-serializable values, and prototype-pollution attribute keys such as `__proto__`, `prototype`, and `constructor`.
