# v7.3.3 Test Report

v7.3.3 replaces the repeated-template held-out corpus with checked-in static semantic fixtures.

Current corpus summary:

```text
unique utterances: 46
families: 37
duplicate normalized utterances: 0
false mutation rate target: 0
```

The evaluator writes a machine-readable report to:

```text
artifacts/deterministic-nlu-quality-report.json
```

That artifact is generated during tests and is excluded from the portable source ZIP.

Validation commands for the release:

```bash
node --version
npm --version
npm ci
npm test
npm run lint
npm run build
npm run build:github
npm audit --omit=dev
python scripts/package-portable-source.py
unzip -t hypergraph-converter-v7-deterministic-nlu-consolidation-corpus-hardening-portable.zip
```

Manual browser checks should verify that deterministic mapping, graph mutation preview/confirmation, parser workflow controls, dashboard navigation, and local runtime diagnostics still load without console errors.
# v7.3.4 correction note

This v7.3.3 report described a 46-fixture compiler regression set. It should not be read as evidence of broad held-out coverage or integrated browser runtime call counts. v7.3.4 adds separate compiler and integrated routing reports with 840 static held-out fixtures and observed dispatcher counters.
