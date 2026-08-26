# Deterministic Help Architecture

## v7.3.10 compositional request semantics

The Help boundary is derived from the whole request, not only anchored prefixes.

```text
user text
-> shared request semantics
   instructional | explicit read-only | reported/example | quoted
   hypothetical | negated action | correction scope | direct control
-> read-only side-effect authorization gate
-> typed Help/catalog response OR validated direct action
```

A valid action phrase embedded inside a request for instructions remains read-only:

```text
Explain the steps to use author_id as the vertex key. -> Help
Use author_id as the vertex key.                      -> mapping edit
What button cancels the pending action?               -> Help; pending preserved
Cancel pending action.                                -> direct pending control
```

The same semantics run before pending cancellation, confirmation, Stop, parser apply, graph mutation, mapping/grouping, batch commands, and local-model fallback. `sideEffectPolicy.js` is the final fail-closed boundary: informational speech cannot authorize a state-changing side-effect class.

## Runtime boundaries

- Help search is local deterministic catalog search.
- Help queries compile to `DeterministicHelpQuery` and use `executeCompiledHelpQuery`.
- Insert-example controls never auto-submit.
- Pending Help is routed before broad conversation handling and preserves the pending action.
- Owner-ID request coordination allows concurrent read-only Help/direct Stop without letting one request clear another request's lifecycle.
- Ordinary Help uses zero Ollama, cloud, backend, graph mutation, mapping mutation, parser execution, confirmation staging, pending cancellation, or runtime stop.

## Registry and policy authority

- `actionIntentRegistry.js` defines public/internal/speech-act visibility and required context.
- `actionContextPolicy.js` enforces required context before legacy action dispatch.
- `confirmationPolicy.js` is the single confirmation-policy/copy authority.
- `actionLexicon.js` is the shared action/control vocabulary.
- `validatePlannedAction(...)` rejects planner/registry handler drift.

## Drift prevention

`docs/DETERMINISTIC_COMMAND_REFERENCE.md` is generated from the command catalog.

```bash
node scripts/generate-deterministic-command-reference.mjs
node tests/deterministic-command-reference-doc.test.mjs
```

The v7.3.10 release gates additionally execute the complete state-changing command catalog through 40 instructional frames and 20 explicit non-execution frames.
