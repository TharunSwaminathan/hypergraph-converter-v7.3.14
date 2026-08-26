# Deterministic NLU Corpus Authenticity

The v7.3.5 held-out corpus is stored as static JSONL and is evaluated separately from the 46 historic core regressions.

Current held-out totals:

```text
literal unique: 840
normalized unique: 840
substantive skeleton unique: 756
clause skeleton unique: 796
semantic families: 315
opaque suffix violations: 0
ground-truth reviewed: 840/840
high-similarity pairs reported: 108
```

Integrity checks reject:

- opaque synthetic suffixes such as `amber0`;
- fake numbered family labels;
- duplicate normalized utterances;
- dominant family or clause-skeleton groups;
- category/domain contradictions without rationale;
- unreviewed ground truth.

High-similarity pairs are reported rather than hidden. Similarity alone is not an error when the fixtures test materially different scope, negation, reference, or speech-act behavior.
