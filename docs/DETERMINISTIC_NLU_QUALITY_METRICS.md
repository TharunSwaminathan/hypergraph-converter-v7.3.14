# Deterministic NLU Quality Metrics

The corpus evaluator reports:

- unique utterance counts;
- family counts;
- domain accuracy;
- intent accuracy;
- operation type exact match;
- operation object exact match;
- entity resolution exact match;
- clarification precision and recall;
- false mutation rate;
- generic ActionPlan theft rate;
- unexpected model-call rate;
- legacy parser runtime-call rate;
- confusion matrices.

The most important safety metric is:

```text
false mutation rate = 0
```

Metrics are calculated from actual compiler output. They are not hard-coded constants.
# v7.3.4 metric note

Metric reports now use truthful numerator/denominator objects and return `rate: null` for zero-denominator metrics. `operationObjectExactMatch` is a true canonical exact comparison; partial containment is reported separately as `operationObjectPartialMatch`.
