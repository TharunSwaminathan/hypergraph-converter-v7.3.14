# Deterministic NLU Reference Resolution

References may resolve only from verified current state:

- active uploaded files and bounded dataset profiles;
- exact profiled columns;
- active `DatasetMappingSpec` and dataset groups;
- current graph entities and current visual selection;
- recent verified graph references;
- pending action type;
- recent deterministic interpretation trace.

## File resolution

Dataset files resolve by exact name, exact case-insensitive name, unique basename, or unique deterministic alias. Ambiguous substring matches are rejected with a clarification.

## Column resolution

Columns resolve by exact header, case-insensitive exact header, or unique normalized header in the relevant active file. Missing explicit columns produce clarifications instead of guessing.

## Graph resolution

Graph entities resolve through the existing graph entity resolver. Selection and recent references are usable only if they still exist in the current graph identity. Graph replacement clears stale references.

## Corrections

Correction markers such as `actually`, `instead`, `rather than`, `no`, and `I meant` replace or revise the relevant verified prior/pending interpretation. They do not duplicate a previous state-changing operation.

