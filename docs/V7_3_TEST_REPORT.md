# v7.3 Test Report

This file is updated during release validation. Expected commands:

```bash
npm test
npm run lint
npm run build
npm run build:github
npm audit --omit=dev
```

Live Ollama and browser smoke results should be reported honestly as run or not run, depending on the local environment.

## Validation run

- Baseline ZIP SHA-256 verified: `A4DFC2763D38412F94042C37ED1FC9C91A7B1FE8D2CD85ADDF61DF2C784E091B`
- `npm test`: passed.
- `npm run lint`: passed.
- `npm run build`: passed with inherited Vite large-chunk warning.
- `npm run build:github`: passed with inherited Vite large-chunk warning.
- `npm audit --omit=dev`: `found 0 vulnerabilities`.
- Browser smoke: local app loaded at `http://127.0.0.1:5173/`, assistant and mapping workspace rendered, console error logs empty.
- Live Ollama dataset interpretation/patch tests: not run in this packaging pass because no running Ollama runtime was assumed.
- Packaging: one-root portable ZIP, 199 entries, no `node_modules`, `dist`, `.git`, coverage, logs, `__MACOSX`, or `.DS_Store`.
## v7.3.1 follow-up

v7.3.1 adds regression coverage for dataset-mapping chat routing so explicit mapping requests do not fall through to generic ActionPlan or route planning. See `docs/V7_3_1_TEST_REPORT.md`.
