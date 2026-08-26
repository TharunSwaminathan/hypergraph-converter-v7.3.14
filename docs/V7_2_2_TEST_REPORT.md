# v7.2.2 Test Report

Validation date: 2026-07-27

This report covers the conversational runtime reliability remediation package:

```text
hypergraph-converter-v7-conversational-runtime-reliability-remediation
```

## Baseline

The immutable v7.2.1 baseline archive was verified before editing:

```text
hypergraph-converter-v7-conversational-planner-remediation-portable.zip
SHA-256: BE5E4EB1166C651AFFBC9C5D7AC0DDDD3685250387A6E86807A80082966565A8
package: hypergraph-converter-v7-conversational-planner-remediation
version: 7.2.1
```

Baseline validation in a clean temporary extraction passed:

```text
npm ci -> passed
npm run test -> passed
npm run lint -> passed
npm run build -> passed with inherited Vite large-chunk warning
npm run build:github -> passed with inherited Vite large-chunk warning
npm audit --omit=dev -> found 0 vulnerabilities
```

## Added focused coverage

- `tests/local-model-request-coordinator.test.mjs`
- `tests/local-model-cancellation.test.mjs`
- `tests/local-model-runtime-state.test.mjs`
- `tests/graph-mutation-planner-budget.test.mjs`
- `tests/ollama-metrics.test.mjs`
- `tests/graph-conversation-references.test.mjs`
- `tests/regression-v7-2-2.test.mjs`

## Prompt/schema budget report

Measured from the v7.2.2 source:

```text
typical planner prompt characters: 2370
maximum bounded planner prompt characters: 9106
response schema characters: 2981
repair addition characters: 1265
planner num_predict: 768
planner timeout: 60000 ms
```

## Final validation status

Runtime:

```text
node --version -> v24.14.0
npm --version  -> 11.4.2
npm ci         -> added 166 packages in 2s
```

Aggregate tests:

```text
npm run test -> passed
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
local model request coordinator tests passed.
local model cancellation tests passed.
local model runtime state tests passed.
graph mutation planner budget tests passed.
ollama metrics tests passed.
graph conversation reference tests passed.
v7.2.2 regression source tests passed.
```

Individual test files were also run directly and passed.

Other validation:

```text
npm run lint -> passed
npm run build -> passed with inherited Vite large-chunk warning
npm run build:github -> passed with inherited Vite large-chunk warning
npm audit --omit=dev -> found 0 vulnerabilities
```

Live Ollama smoke:

```text
ollama command -> not found
http://localhost:11434/api/tags -> timed out
node scripts/smoke-test-graph-mutation-planner.mjs with a short timeout -> failed cleanly because the local runtime was unavailable
```

Browser smoke:

```text
Vite local URL -> http://127.0.0.1:5174/
title -> hypergraph-converter
Hypergraph Converter Studio visible -> yes
Hypergraph Assistant visible -> yes
console errors -> 0
```

## Manual acceptance status

The static/browser-independent checks cover:

- one-request-at-a-time coordinator;
- rapid-submit guard source;
- structured cancellation classification;
- timeout fallback eligibility;
- prompt/schema budget;
- metrics conversion;
- runtime-state transitions;
- recent-reference lifecycle;
- deterministic fallback preservation;
- source regression against cloud/API/LangGraph additions.

Connected live `qwen3:8b` scenarios depend on the user machine's Ollama runtime and should be repeated in WSL/Windows with:

```bash
bash run-with-ollama.sh
node scripts/smoke-test-graph-mutation-planner.mjs
```
