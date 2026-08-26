# Deterministic Conversational NLU

The deterministic NLU layer makes common chat requests feel conversational while staying predictable. It uses bounded lexical and regular-expression recognizers, but regex matches are not execution authority.

## Result shape

The analyzer returns a serializable object with these stable fields:

```js
{
  version: 1,
  rawText,
  normalizedText,
  protectedSpans,
  tokens,
  clauses,
  primaryDomain,
  primaryIntent,
  mode,
  domainCandidates,
  intentCandidates,
  entities,
  values,
  references,
  operations,
  negations,
  corrections,
  ambiguities,
  unresolvedReferences,
  confidence: { score, level, reasons },
  safetyClass,
  trace,
  limits,
  modifiers
}
```

## Supported domains

- `dataset_grouping`
- `dataset_mapping`
- `parser_workflow`
- `graph_mutation`
- `dashboard_control`
- `grounded_question`
- `unknown`

Conversion/export routing still reuses the app's existing deterministic route/export controllers where appropriate.

## Limits

The analyzer bounds work to 5,000 parsed characters, 1,000 tokens, 20 clauses, and 20 operations per turn. Oversized messages are marked in `limits.truncated`. Protected-span diagnostics scan the raw message so quoted identifiers remain visible for auditing, but parsing still uses the bounded prefix.

## Unsupported language

The deterministic layer does not claim human-level language understanding. Unsupported, ambiguous, contradictory, or stale-reference turns should ask a targeted clarification, fall back to deterministic help, or use the optional local model only as a typed advisory planner.
# v7.3.4 runtime note

The production chat runtime now uses `compileDeterministicTurn(...)` and `dispatchCompiledAction(...)` for supported deterministic turns. This replaces the older panel-local pattern of compiling individual domain grammars before falling through to legacy raw-text control routing.

