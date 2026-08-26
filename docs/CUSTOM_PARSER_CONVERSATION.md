# Custom Parser Conversation

## Current mapping-first workflow

```text
upload files
-> deterministic profiling/grouping
-> DatasetMappingSpec validation/repair
-> optional local Ollama explanation/refinement
-> deterministic parser generation
-> user review
-> explicit confirmation
-> disposable Web Worker execution
-> pre-serialization bounded clone and shape limits
-> canonical validation and preview
-> separate apply confirmation
```

Conversational mapping corrections update only the active mapping specification after deterministic validation. Parser execution and parser-result application remain separate confirmation boundaries.

## Trust and security boundary

Custom Parser accepts reviewed/trusted local JavaScript. It is not a formal sandbox for hostile code.

Defense-in-depth controls include:

- static rejection of network, DOM, storage, worker-spawn, dynamic-import, eval/Function, reflection/prototype, global-runtime, and active-content surfaces;
- reduced/shadowed globals and a reduced frozen `Object` facade;
- constructor-chain hardening before reviewed code runs;
- sanitized and frozen file/helper inputs;
- disposable worker isolation, timeout, cancellation, and termination;
- bounded logs and input sizes;
- bounded plain-data cloning before `postMessage`, including depth, node, string, hyperedge, and incidence limits;
- main-thread revalidation, canonical normalization, preview, and explicit apply confirmation.

These controls reduce accidental and common escape risks but do not prove containment of arbitrary adversarial JavaScript. Review generated or pasted parser code and run only code you trust. Uploaded file contents are data, never instructions.

## Deterministic routing

Routine file-role, key, join, policy, plan, parser-generation, run, and apply requests enter the shared deterministic NLU layer before compatibility helpers. Read-only questions about any of these actions remain Help and cannot stage or execute parser work.
