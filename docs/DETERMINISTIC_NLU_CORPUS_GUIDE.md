# Deterministic NLU Corpus Guide

The v7.3.3 corpus lives in:

```text
tests/fixtures/deterministic-nlu/semantic-corpus.mjs
tests/fixtures/contexts/
```

Rules:

- fixture text is checked in statically;
- every normalized utterance must be unique;
- numeric-only substitutions do not count as diversity;
- each fixture must name a context, family, and expected semantics;
- executable expectations compare typed domains, intents, operation types, partial operation objects, resolved entities, clarification behavior, and safety flags;
- negative fixtures must not produce graph mutation plans or forbidden confirmation operations.

The integrity tests check duplicate normalized text, repeated skeletons, family coverage, and high-similarity pairs.
# v7.3.4 corpus note

The v7.3.3 46-fixture set is retained as `core-regressions`. v7.3.4 adds 840 checked-in held-out fixtures in `tests/fixtures/deterministic-nlu/*.heldout.jsonl`, loaded by `semantic-corpus.mjs`.
