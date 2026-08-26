# Deterministic NLU Corpus Completion

> **v7.3.5 correction:** literal fixture count alone is not corpus authenticity. v7.3.5 adds opaque-suffix, semantic-family, clause-skeleton, and reviewed-ground-truth checks.


The v7.3.4 corpus keeps the 46 v7.3.3 fixtures as `core-regressions` and adds 840 static held-out fixtures across separate JSONL files:

- dataset mapping actions: 150
- dataset mapping questions/non-actions: 50
- dataset grouping actions: 70
- dataset grouping questions/non-actions: 20
- graph mutation actions: 150
- graph mutation questions/non-actions: 40
- parser workflow actions/status: 100
- dashboard/control commands/questions: 100
- corrections: 60
- negative/ambiguous/adversarial: 100

Each fixture includes category, family, context, text, expected domain/intent/mode/typed kind, operation expectations, mutation expectation, and routing-call expectations.
