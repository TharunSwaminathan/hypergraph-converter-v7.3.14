# v7.2 Test Report

v7.2.1 keeps this historical v7.2 report for baseline regression context. The focused v7.2.1 validation is recorded in `docs/V7_2_1_TEST_REPORT.md`.

Validation date: 2026-07-27

Runtime:

```text
node --version -> v24.14.0
npm --version  -> 11.4.2
```

Dependency install:

```text
npm ci -> passed
added 166 packages in 2s
```

Full test command:

```text
npm run test -> passed
```

Exact `npm test` note:

```text
npm executable on PATH -> unavailable in this Codex runtime
bundled npm-cli.js test -> failed before project execution because cached npm 11.4.2 is missing ./commands/test.js
equivalent project script npm run test -> passed
```

Included results:

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
```

Lint:

```text
npm run lint -> passed
```

Build:

```text
npm run build -> passed
```

Vite emitted the existing chunk-size warning for a JavaScript chunk larger than 500 kB. This is a warning, not a failed build.

GitHub Pages build:

```text
npm run build:github -> passed
```

Audit:

```text
npm audit --omit=dev -> found 0 vulnerabilities
```

Individual v7.2 direct tests:

```text
node tests/graph-mutation.test.mjs -> passed
node tests/conversational-graph-mutation.test.mjs -> passed
node tests/custom-parser-conversation.test.mjs -> passed
node tests/parser-sandbox.test.mjs -> passed
node tests/regression-v7-2.test.mjs -> passed
```

Browser smoke test:

```text
Loaded http://127.0.0.1:5173/
Rendered title content: Hypergraph Converter Studio -> yes
Rendered assistant content: Hypergraph Assistant -> yes
Console error count on initial load: 0
```

Live UI smoke test:

```text
Loaded H2V sample with Load Example -> passed
Converted sample graph -> passed
Stats visible after conversion -> passed
Graph Preview visible after conversion -> passed
Algorithms section visible after conversion -> passed
Asked assistant: add Charlie to h0 -> confirmation card staged
Mutation did not execute before confirmation -> passed
Console error count during live smoke: 0
```
