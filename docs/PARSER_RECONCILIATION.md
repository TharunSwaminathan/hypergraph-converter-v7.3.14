# Parser Reconciliation

`src/agent/parserReconciliation.js` summarizes parser-worker output before graph apply. It records source rows, filtered rows, unmatched reference examples, duplicate memberships removed, empty hyperedges, emitted hyperedges, vertices, incidences, warnings, errors, expected-output comparison, mapping revision, and plan fingerprint.

Fatal reconciliation or empty graph output blocks apply unless an explicit safe override is implemented in a future release.
