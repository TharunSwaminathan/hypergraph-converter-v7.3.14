# Compositional Help-Intent Safety

## Purpose

v7.3.10 replaces isolated Help-prefix recognition with a shared semantic scope classifier and a final side-effect authorization boundary.

A sentence can contain a perfectly valid command and still be read-only because the user is asking for explanation, instructions, documentation, an example, or non-execution.

## Semantic scope

`src/agent/deterministicNlu/requestSemantics.js` recognizes and composes:

- instructional questions and procedure/syntax requests;
- explicit read-only and “make no changes” scope;
- quoted, reported, documentation, and example commands;
- hypothetical and third-person procedure questions;
- negated actions;
- correction language;
- exact direct pending confirm/cancel and runtime Stop controls.

The classifier does not treat politeness alone as Help. Direct requests such as `Please add vertex 6 to h2` remain actionable, while `Please describe how to add vertex 6 to h2` remains read-only.

## Fail-closed compilation

The speech-act and intent layers preserve read-only scope. `sideEffectPolicy.js` then prevents any informational compilation from authorizing:

- mapping or grouping revisions;
- graph edit previews or commits;
- parser generation/run/apply controls;
- batch activation/generation controls;
- pending confirmation/cancellation;
- runtime Stop;
- downloads, file pickers, settings changes, or navigation when the request is explanatory.

## Pending-state ordering

`routePendingSubmission(...)` runs before any pending cancellation matcher or broad conversation path. Read-only Help always wins over action words embedded inside it. Exact direct controls remain available only after required-context validation.

## Release gates

The tests derive all state-changing public catalog examples instead of maintaining a hand-picked action list.

```text
164 state-changing examples × 40 instructional frames = 6,560
164 state-changing examples × 20 no-action/reported frames = 3,280
```

Both matrices must produce zero state-changing side-effect classes. Direct-action contrast tests separately prove that unwrapped commands still route to their intended validated action paths.
