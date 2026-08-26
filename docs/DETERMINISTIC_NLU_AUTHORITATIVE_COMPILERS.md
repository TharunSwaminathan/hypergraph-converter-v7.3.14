# Deterministic NLU Authoritative Compilers

v7.3.3 uses one compiler as the semantic authority for each deterministic domain.

```text
dataset_mapping    -> dataset_mapping_v1
dataset_grouping   -> dataset_grouping_v1
graph_mutation     -> graph_mutation_v1
parser_workflow    -> parser_workflow_v1
dashboard_control  -> dashboard_control_v1
grounded_question  -> grounded_question_v1
```

The shared NLU stage may score multiple domain candidates. After selection, only one compiler produces typed semantics for the turn. High-confidence deterministic requests must report:

```text
legacyParserCalled: false
modelCalled: false
genericActionPlannerCalled: false
```

Older wrappers are retained for import compatibility, not as normal runtime interpreters.
# v7.3.4 runtime note

The authoritative compiler registry is now used by production chat through `compileDeterministicAction(...)`, not only by tests. High-confidence supported turns are dispatched from the central typed result without a second raw-text interpretation step.
