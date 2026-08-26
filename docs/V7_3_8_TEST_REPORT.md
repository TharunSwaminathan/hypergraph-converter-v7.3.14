# v7.3.8 Test Report

## v7.3.9 supersession note

v7.3.8 remains the immutable baseline for this remediation, but later review found remaining gaps:

- Help-speech detection was too narrow for frames such as `Please show me how to...`, `Can you tell me how to...`, and `What command should I use to...`;
- Help questions asked while a pending action existed could be too close to direct cancel/confirm/runtime-stop wording;
- `correction` was documented too much like a public command instead of a speech-act-only interpretation concept;
- parameterized commands such as `Activate batch <number>` and `Generate parser for batch <number>` were not fully represented in the public command catalog;
- some control entries used broad required-context metadata instead of the exact context needed for safe dispatch.

v7.3.9 addresses those gaps and records its validation in `docs/V7_3_9_TEST_REPORT.md`.

This report records the intended verification scope for the v7.3.8 Deterministic Help Safety and Complete Command Inventory release.

## Added tests

- `tests/deterministic-help-safety-boundary.test.mjs`
- `tests/deterministic-help-politeness-distinction.test.mjs`
- `tests/deterministic-action-intent-registry.test.mjs`
- `tests/deterministic-command-catalog-legacy-actions.test.mjs`
- `tests/deterministic-command-catalog-authoritative-coverage.test.mjs`
- `tests/deterministic-command-catalog-control-entries.test.mjs`
- `tests/deterministic-help-algorithm-filter.test.mjs`
- `tests/deterministic-help-quoted-diagnostics.test.mjs`
- `tests/deterministic-help-deep-link.test.mjs`
- `tests/deterministic-help-search-legacy-actions.test.mjs`
- `tests/regression-v7-3-8.test.mjs`

## Required final commands

```bash
npm run test
npm run lint
npm run build
npm run build:github
npm audit
npm audit --omit=dev
```

Packaging validation:

```bash
python scripts/package-portable-source.py
python tests/portable-zip-paths.test.mjs
unzip -t hypergraph-converter-v7-deterministic-help-safety-complete-command-inventory-portable.zip
```

## Manual/browser smoke coverage

The browser smoke check should verify:

1. The app loads with no startup console errors.
2. Help can be opened from the assistant tab.
3. `#help/graph.add-incidence` opens the Help tab and expands/focuses the matching command.
4. Searching Help for `clear active batch`, `connect local model`, and `validate mapping` finds the new legacy action entries.
5. Typing `How do I clear the active batch?` returns Help and does not stage a pending action.
6. Typing `Clear the active batch` remains a direct deterministic action command.
7. Algorithm Help explains panel-only behavior without listing the chatbot-support explainer card as if it were an algorithm.

Final command outputs are recorded in the Codex handoff response for this release.
