# Deterministic NLU Integrated Metrics

> **v7.3.5 correction:** v7.3.4 integrated counters were not connected to all production call boundaries. v7.3.5 adds production-handler spies and injected-failure tests.


v7.3.4 separates:

- compiler evaluation: semantic quality of `analyzeDeterministicNlu` + `compileDeterministicAction`;
- integrated routing evaluation: observed calls through the extracted dispatcher and injected handlers.

Metric objects report:

```json
{
  "correct": 38,
  "evaluated": 40,
  "excluded": 800,
  "rate": 0.95,
  "status": "evaluated"
}
```

Metrics with zero evaluated fixtures report `rate: null` and `status: "not_evaluated"`; they are never treated as perfect scores.
