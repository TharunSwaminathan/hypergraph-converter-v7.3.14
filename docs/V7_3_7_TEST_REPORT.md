# v7.3.7 Test Report

## v7.3.8 note

v7.3.8 preserves this v7.3.7 report as the historical validation record for the original catalog release. The follow-up remediation expands the catalog from 68 entries / 86 verified examples to 113 entries / 179 verified examples and fixes the Help-seeking safety leak where `How do I ...` questions could reach direct legacy action planning. See `docs/V7_3_8_TEST_REPORT.md` for the current release results.

This report summarizes the v7.3.7 validation pass for the deterministic command catalog and Help system.

## New targeted tests

- `tests/deterministic-command-catalog-integrity.test.mjs`
- `tests/deterministic-command-catalog-coverage.test.mjs`
- `tests/deterministic-command-catalog-examples.test.mjs`
- `tests/deterministic-command-catalog-routing.test.mjs`
- `tests/deterministic-help-query.test.mjs`
- `tests/deterministic-help-search.test.mjs`
- `tests/deterministic-help-try-command.test.mjs`
- `tests/deterministic-command-reference-doc.test.mjs`
- `tests/regression-v7-3-7.test.mjs`

## What the new tests verify

- Catalog IDs are unique and entries validate against stable enums.
- All deterministic graph, mapping, grouping, parser, dashboard, and Help-query operations/intents have catalog coverage.
- Panel-only features are labeled honestly and do not advertise chat patterns.
- Every advertised chat example compiles through the real deterministic analyzer/compiler.
- Integrated routing reaches the typed runtime dispatcher without model calls, generic ActionPlan calls, or legacy parser calls.
- Help queries return catalog-driven responses without mutation.
- Search finds commands for practical user terms such as `add vertex`, `paper key`, `confirmation`, `quoted`, `offline`, `graph preview`, and `validation file`.
- Try buttons insert examples only, guard non-empty composer replacement, focus the composer, and do not submit automatically.
- The generated Markdown reference is not stale.
- v7.3.7 regressions cover multi-vertex additions, parser negation, policy/grouping distinction, algorithm panel-only help, and package identity.

## Current catalog verification

```text
catalog entries: 68
verified executable examples: 86
example compilation mismatches: 0
```

## Final validation results

Observed on the release packaging pass:

```text
npm ci --registry=https://registry.npmjs.org/  PASS
npm run test                                 PASS
npm run lint                                 PASS
npm run build                                PASS
npm run build:github                         PASS
npm audit                                    PASS, 0 vulnerabilities
npm audit --omit=dev                         PASS, 0 vulnerabilities
```

Build note: Vite/Rolldown reported the existing large JavaScript chunk warning after minification; the build completed successfully.

## Browser smoke result

The local browser smoke check passed:

- Help tab rendered the deterministic command catalog.
- Search found `Add vertices to a hyperedge`.
- The command card showed examples and offline/deterministic labels.
- `Try this command` inserted `Add vertex 6 to h2` into the composer only.
- Try did not send a chat message and did not mutate the graph.
- Help search distinguished read-only questions such as `Would paper_id be a better key?` from mutating key-column commands.
- Quoted identifier guidance rendered.
- Chat query `How do I add a vertex to a hyperedge?` returned catalog help.
- Chat query `Can the deterministic chatbot run BFS?` explained that algorithms are panel-only.
- Browser console errors: none.

## Portable ZIP validation

```text
zip: hypergraph-converter-v7-deterministic-command-catalog-help-system-portable.zip
entries: 394
crc_bad: None
root: hypergraph-converter-v7-deterministic-command-catalog-help-system
forbidden entries: 0
WSL unzip -t: PASS
SHA-256: 6FF421A7ED90DB477DDA723A689B06D50452EDB9020E0512DDA532A542DE946D
```
