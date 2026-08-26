# v7.3.9 Test Report

> Historical baseline report. The additional failures found after this report are remediated and retested in `docs/V7_3_10_TEST_REPORT.md`.
This report records verification for the v7.3.9 Generalized Help Speech Safety, Registry Authority, and Command Metadata release.

## Baseline

Source baseline:

```text
hypergraph-converter-v7-deterministic-help-safety-complete-command-inventory-portable.zip
```

Expected SHA-256:

```text
86A83DC0FA347A12939ADF4BF9D8E9E9EC33FE5FEDB068C940D1090619F61191
```

The baseline ZIP was copied into a new v7.3.9 project folder. The uploaded baseline archive was not modified.

## New targeted tests

v7.3.9 adds these focused regressions:

- `tests/deterministic-help-generalized-speech.test.mjs`
- `tests/deterministic-help-pending-state-protection.test.mjs`
- `tests/deterministic-help-runtime-stop-protection.test.mjs`
- `tests/deterministic-help-state-preservation-matrix.test.mjs`
- `tests/deterministic-help-action-contrast-matrix.test.mjs`
- `tests/deterministic-help-phrase-families.test.mjs`
- `tests/deterministic-action-registry-exact-match.test.mjs`
- `tests/deterministic-action-registry-edit-mapping.test.mjs`
- `tests/deterministic-command-catalog-parameterized-actions.test.mjs`
- `tests/deterministic-command-control-contexts.test.mjs`
- `tests/deterministic-help-v2v-search.test.mjs`
- `tests/deterministic-help-keyboard-accessibility.test.mjs`
- `tests/regression-v7-3-9.test.mjs`

## Validation commands

Final command results are filled in after the release validation run:

```text
npm run lint
npm run test
npm run build
npm run build:github
npm audit
npm audit --omit=dev
```

## Results

- `npm run lint`: PASS.
- `npm run test`: PASS.
  - Held-out matrix: `1320/1320`.
  - Combined minimum with held-out: `8580/8580`.
  - Deterministic static held-out corpus: `840` fixtures.
  - Deterministic command catalog examples: `186` verified examples.
  - New v7.3.9 Help/registry/accessibility tests: PASS.
- `npm run build`: PASS.
  - Vite emitted the existing non-fatal large-chunk warning for the main bundled JS file.
- `npm run build:github`: PASS.
  - Vite emitted the same existing non-fatal large-chunk warning.
- `npm audit`: PASS, `0 vulnerabilities`.
- `npm audit --omit=dev`: PASS, `0 vulnerabilities`.

## Browser smoke

PASS using local Vite preview and system Chrome.

Observed:

- app loaded at `http://127.0.0.1:4173/`;
- visible `Hypergraph Converter Studio` shell;
- no browser console errors;
- Help panel opened;
- `summary` elements rendered: `123`;
- `summary[tabindex="-1"]`: `0`;
- command-specific Try labels: `186`;
- command-specific Copy labels: `186`;
- chat query `Please show me how to add vertex 6 to h2.` returned read-only deterministic Help and explicitly stated that nothing changed and no confirmation was staged.

## Packaging

PASS.

Output:

```text
hypergraph-converter-v7-generalized-help-speech-safety-registry-authority-portable.zip
```

Verification:

```text
entries: 432
project roots: 1
root: hypergraph-converter-v7-generalized-help-speech-safety-registry-authority
CRC bad entry: None
node_modules entries: 0
dist entries: 0
artifacts entries: 0
__MACOSX entries: 0
.DS_Store entries: 0
backslash path entries: 0
```

The final ZIP SHA-256 is recorded in the Codex handoff response after packaging, because including the ZIP hash inside a file that is itself packaged would change the archive hash.
