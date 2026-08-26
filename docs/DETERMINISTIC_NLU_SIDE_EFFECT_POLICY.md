# Deterministic NLU Side-Effect Policy

Compiled results are classified as:

- `read_only`
- `reversible_mapping_edit`
- `reversible_grouping_edit`
- `workflow_preparation`
- `requires_parser_run_confirmation`
- `requires_graph_apply_confirmation`
- `graph_edit_preview`
- `navigation`
- `runtime_control`
- `cancellation`
- `unknown`

Read-only speech acts may dispatch only read-only results. A grammar that recognizes mapping or graph operations inside an informational question is converted to a grounded question before dispatch.

Graph mutation plans are still previews: they stage confirmation but do not commit graph state. Parser-run and parser-result application requests retain their existing confirmation boundaries.

Safety metrics are domain-independent. They count false state-changing dispatch, false commit, false confirmation staging, question-to-edit, hypothetical-to-edit, reported-command-to-edit, and quoted-command-to-edit outcomes.
