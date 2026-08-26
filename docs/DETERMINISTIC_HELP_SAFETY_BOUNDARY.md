# Deterministic Help Safety Boundary

## Release invariant

```text
A request for instructions, syntax, steps, procedure, explanation,
documentation, walkthrough, button/menu location, example, quotation,
hypothetical discussion, or explicit non-execution must never authorize
a state-changing side-effect class—even when it contains a valid command.
```

Protected examples include:

- `I was wondering how to use author_id as the vertex key.`
- `Explain the steps to mark expected.json as validation only.`
- `Could you tell me what to type to add vertex 6 to h2?`
- `What button do I click to cancel the pending action?`
- `This is an example command, not a request: "Apply parser result".`
- `Make no changes; explain how to clear the graph.`
- `Never create hyperedge h3.`

Their direct counterparts remain actionable only through the existing validated path:

- mapping/grouping edits commit only after deterministic validation;
- graph edits create a preview and confirmation;
- parser run/apply and graph replacement require confirmation;
- pending confirm/cancel requires compatible pending state;
- runtime Stop requires active cancellable work.

## Enforcement layers

1. `requestSemantics.js` classifies response scope compositionally.
2. speech-act and intent classifiers preserve read-only scope.
3. compilation emits Help/grounded typed values for read-only requests.
4. `sideEffectPolicy.js` blocks any conflicting state-changing compilation.
5. pending routing evaluates Help/direct control before cancellation or conversation fallback.
6. runtime required-context and stale-binding checks run before handler dispatch.
7. structured handler outcomes are the only source of `stateMutationCommitted`.

## Release matrices

- 164 state-changing examples × 40 instructional frames = 6,560 requests.
- 164 state-changing examples × 20 explicit no-action/reported/hypothetical frames = 3,280 requests.
- Required result: zero state-changing compilations in both matrices.
