# v7.2.1 Test Report

Superseded note: v7.2.2 keeps these v7.2.1 checks and adds runtime reliability coverage. See `docs/V7_2_2_TEST_REPORT.md` for the current release validation.

Validation date: 2026-07-27

This report covers the focused conversational planner remediation. The final validation commands were run from:

```text
hypergraph-converter-v7-conversational-planner-remediation
```

## Added focused coverage

- `tests/graph-mutation-model-planner.test.mjs`
- `tests/graph-mutation-conversation-heldout.test.mjs`
- `tests/graph-mutation-pending-correction.test.mjs`
- `tests/graph-mutation-noop.test.mjs`
- `tests/regression-v7-2-1.test.mjs`

The held-out deterministic fallback corpus covers polite requests, indirect phrasing, leading/trailing modifiers, modifier-like legitimate IDs, and non-mutation turns.

## Automated results

Runtime:

```text
node --version -> v24.14.0
npm --version  -> 11.4.2
```

Aggregate command:

```text
npm run test -> passed
```

Exact alias note:

```text
npm test -> failed before project execution in this Codex runtime because cached npm 11.4.2 is missing ./commands/test.js
equivalent project script npm run test -> passed
```

Included output:

```text
settings migration: 10/10
automatic connection fallback: 10/10
client payloads: 5/5
UI assertions: 13/13
diagnostic isolation: 9/9
bridge allowlist: 6/6
conversation/action regressions: 10/10
script/source assertions: 24/24
Ollama-only local model tests passed.
Held-out matrix: 1320/1320
Combined minimum with held-out: 8580/8580
Held-out negative non-conversion cases: 5/5
Held-out semantic relation tests passed.
graph mutation tests passed.
conversational graph mutation tests passed.
custom parser conversation tests passed.
parser sandbox tests passed.
v7.2 regression source tests passed.
graph mutation model planner tests passed.
graph mutation held-out conversation tests passed (34 checks).
graph mutation pending correction tests passed.
graph mutation no-op tests passed.
v7.2.1 regression source tests passed.
```

Other validation:

```text
npm run lint -> passed
npm run build -> passed with inherited Vite large-chunk warning
npm run build:github -> passed with inherited Vite large-chunk warning
npm audit --omit=dev -> found 0 vulnerabilities
```

## Manual smoke status

Chrome smoke with Vite at `http://127.0.0.1:5173/`:

```text
initial render -> passed
title -> hypergraph-converter
Hypergraph Converter Studio visible -> yes
Hypergraph Assistant visible -> yes
initial console errors -> 0
Load Example + Convert H2V sample -> passed
sample graph visible -> 3 hyperedges, 5 vertices, 9 incidences, graph version 1
assistant no-op: Add vertex 4 to h1 again. -> “Vertex 4 is already in h1, so there’s nothing to change.”
no-op confirmation card -> absent
stage real mutation: Add vertex 7 to h0. -> confirmation card shown
cancel through chat: Never mind. -> confirmation cleared, graph version stayed 1
console errors after smoke -> 0
```

Connected live Ollama/qwen3:8b browser scenarios were not run in this environment. The model-planner path is covered by mocked structured-output tests; the live smoke covered the offline deterministic fallback and pending-action safety path.
