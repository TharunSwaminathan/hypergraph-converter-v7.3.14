# Transformation Plan

`src/agent/transformationPlan.js` converts a validated mapping into deterministic steps such as:

- read files;
- parse delimited or Matrix Market text;
- filter rows;
- build lookups;
- join rows;
- split list columns;
- group memberships;
- deduplicate memberships;
- preserve empty hyperedges;
- emit canonical hyperedges.

Each plan has a stable fingerprint. Parser code is compiled from the plan by `src/agent/transformationPlanCompiler.js`; model-generated executable parser code is not the primary path.
