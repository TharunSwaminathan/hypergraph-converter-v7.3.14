# Deterministic NLU Response Composer

Assistant responses are composed from verified facts: accepted operations, validation results, before/after state, diagnostics, warnings, no-op outcomes, and pending confirmation metadata.

## Rules

- Do not claim a graph, mapping, parser, or export change unless the existing action path reports success.
- Do not use unverified model prose to describe a committed change.
- Keep routine messages natural, but store technical details in diagnostics.
- Use concise interpretation traces for "why did you interpret it that way?" questions.
- Do not expose hidden model reasoning, prompts, full uploaded file previews, or raw file contents.

## Examples

```text
Got it - papers.csv now defines hyperedges using paper_id, and papers with no memberships will remain as empty hyperedges.

No parser was run, and the graph has not changed.
```

```text
I interpreted that as dataset mapping because it matched verified files authors.csv and papers.csv, the node/group role aliases, and the profiled ID columns author_id and paper_id.
```

