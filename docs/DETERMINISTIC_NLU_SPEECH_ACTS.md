# Deterministic NLU Speech Acts

The speech-act classifier prevents domain words from being mistaken for execution authority.

Supported speech acts:

- `imperative_request`
- `polite_interrogative_request`
- `informational_question`
- `hypothetical_question`
- `status_question`
- `explanation_question`
- `reported_command`
- `quoted_command`
- `correction`
- `cancellation`
- `declarative_mapping_statement`
- `declarative_graph_statement`
- `unknown`

Examples:

```text
Could you use paper_id as the key?
-> polite_interrogative_request
-> mapping edit allowed after typed validation
```

```text
Would paper_id make a better key?
-> hypothetical_question
-> read-only grounded response
```

```text
The guide says "apply the parser result."
-> reported/quoted command
-> no confirmation and no graph change
```

Speech-act classification is followed by side-effect authorization. It is not itself an execution path.
