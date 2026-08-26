# v7.3.4 Test Report

> **v7.3.5 correction:** v7.3.4 had 840 static entries, but many were template-derived; its integrated zero-call report used inert callbacks; and precompiled graph options were dropped before reaching App. See `V7_3_5_TEST_REPORT.md`.


Validated commands:

```text
npm ci
npm test
npm run lint
npm run build
npm run build:github
npm audit --omit=dev
```

Results:

- Full test chain passed.
- Lint passed.
- Production and GitHub builds passed with the existing non-fatal Vite large-chunk warning.
- `npm audit --omit=dev` reported 0 vulnerabilities.
- Compiler report: `artifacts/deterministic-nlu-quality-report.json`.
- Integrated routing report: `artifacts/deterministic-nlu-integrated-routing-report.json`.
- Static held-out corpus: 840 fixtures, 291 families, zero duplicate-normalized utterances, zero high-similarity pairs reported by the local checker.

Generated `artifacts/`, `dist/`, and `node_modules/` are excluded from the portable ZIP.
