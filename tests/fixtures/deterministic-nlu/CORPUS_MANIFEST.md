# Deterministic NLU Held-Out Corpus Manifest

The held-out corpus contains 840 static, reviewed fixtures:

```text
dataset mapping actions: 150
dataset mapping questions: 50
dataset grouping actions: 70
dataset grouping questions: 20
graph mutation actions: 150
graph mutation questions: 40
parser workflow: 100
dashboard/control: 100
corrections: 60
negative/ambiguous/adversarial: 100
```

Rules:

1. Every literal and normalized utterance is unique.
2. Opaque suffixes and unrelated one-off tokens are prohibited.
3. Families name real semantic or linguistic constructions rather than fixture numbers.
4. Expected semantics are reviewed product ground truth, not copied automatically from compiler output.
5. Questions, hypotheticals, reported commands, and quoted commands declare read-only side effects.
6. Action fixtures declare their exact typed kind, operations, entities, speech act, and side-effect class.
7. Corpus integrity checks report substantive skeletons, clause skeletons, high-similarity pairs, family dominance, and review coverage.
