# v7.3.5 Test Report

## Automated tests

`npm test` passed after the v7.3.5 package identity update. The suite includes the inherited v7.2-v7.3.4 regressions plus dedicated v7.3.5 tests for graph option forwarding, speech-act safety, question safety, completed traces, corpus authenticity, cross-domain integrated routing, forbidden-call observation, and source regressions.

## Compiler evaluation

Held-out corpus: 840 fixtures.

```text
domain accuracy: 840/840
intent accuracy: 840/840
mode accuracy: 840/840
speech-act accuracy: 840/840
side-effect accuracy: 840/840
operation-type exact match: 840/840
operation-object exact match: 840/840
entity-resolution exact match: 840/840
clarification precision: 15/15
clarification recall: 15/15
false state-changing dispatches: 0/215 read-only fixtures
```

The partial-operation containment metric is retained only as supplementary evidence and is not described as exact matching.

## Integrated routing evaluation

The full 840-fixture held-out corpus was dispatched through the extracted deterministic coordinator and production-handler factory.

```text
analysis calls: 840
compilation calls: 840
mapping typed-handler calls: 265
graph typed-handler calls: 185
parser workflow calls: 90
dashboard canonical calls: 100
grounded question calls: 185
model-planner calls: 0
generic ActionPlan calls: 0
legacy-parser calls: 0
raw dashboard classifier calls: 0
false confirmation staging for read-only fixtures: 0
```

Injected-failure tests verified that model, generic, legacy, and raw-classifier metrics become non-zero when those boundaries are deliberately invoked.

## Environment limitations

Live Ollama/qwen3 generation was not run in this environment. `npm ci`, lint, build, GitHub build, and audit are reported separately because dependency installation depends on the available npm registry.

## Validation environment status

In this ChatGPT execution environment:

```text
node: v22.16.0
npm: 10.9.2
npm test: passed
npm ci: not completed; the configured internal registry returned 404 for zod-validation-error@4.0.2
npm run lint: not run because dependencies could not be installed
npm run build: not run because dependencies could not be installed
npm run build:github: not run because dependencies could not be installed
npm audit --omit=dev: not run because dependencies could not be installed
browser smoke: not run
live Ollama: not run
```

These unavailable checks are not reported as passed. The portable archive is validated separately with Python CRC and `unzip -t`.
