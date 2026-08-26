# v7.3.2 Test Report

This release preserves the v7.3.1 test suite and adds deterministic NLU coverage.

## Automated coverage added

- normalization and protected text;
- tokenization and filename preservation;
- clause connectors and negation polarity;
- domain/intent scoring;
- negation, corrections, discourse references, confidence, ambiguity;
- deterministic response composition;
- dataset mapping and grouping grammars;
- parser workflow grammar;
- graph mutation paraphrases;
- dashboard route/control classification;
- compound request handling;
- adversarial long input and identifier edge cases;
- repeated-template held-out corpus instance counts;
- v7.3.2 end-to-end authorship regression.

## Held-out corpus instance targets

v7.3.2 executed the requested number of utterance instances, but many instances were generated from a small set of repeated templates. Treat those counts as deterministic consistency coverage, not as evidence of hundreds of unique held-out paraphrases. v7.3.3 replaces this with checked-in static semantic fixtures and exact typed-output evaluation.

```text
dataset mapping: 120
mapping questions: 40
corrections: 40
graph mutation: 100
parser workflow: 80
dashboard/control: 80
negative/ambiguous: 40
```

## Expected validation commands

```bash
npm test
npm run lint
npm run build
npm run build:github
npm audit --omit=dev
python scripts/package-portable-source.py
unzip -t hypergraph-converter-v7-deterministic-conversational-nlu-workflow-expansion-portable.zip
```

Record the actual command results in the release handoff.
