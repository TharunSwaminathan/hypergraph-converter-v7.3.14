# Deterministic NLU Lexicon

The central lexicon is in `src/agent/deterministicNlu/domainLexicon.js`. Each alias maps to one canonical concept. New aliases should be added deliberately and covered by tests.

## Families

- dataset roles: vertex table, hyperedge table, membership table, validation output, update stream, ignored file;
- key terms: key, id, identifier, composite key;
- relationship terms: membership joins, links, connects, belongs to;
- policies: preserve empty hyperedges, deduplicate memberships;
- grouping terms: together, separate, first two;
- parser phases: transformation plan, parser generation, run, apply, next step;
- graph operations: add incidence, remove incidence, rename;
- dashboard sections: stats, visualization, export, runtime diagnostics;
- correction, cancellation, and question markers.

## Ambiguous terms

`edge` can mean a pairwise graph edge, a hyperedge, or an export/input route depending on context. `h2v`, `v2h`, `h2h`, `csr`, and `csc` are treated as dashboard/route terms when used with route, format, export, input, tab, preview, use, open, or switch language.

## Rule discipline

Aliases should not approximate semantic similarity. If a synonym is added, add a held-out test that proves it maps to the intended canonical concept and does not steal nearby domains.

