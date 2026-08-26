# Deterministic NLU Production Handler Testing

The integrated routing evaluator uses the same preparation, canonical dispatch, and production-handler factory used by the chat runtime. Dependencies are injected at actual handler boundaries so tests can observe:

- mapping typed-handler calls;
- graph typed-handler calls;
- parser workflow calls;
- canonical dashboard calls;
- grounded question calls;
- model-planner calls;
- generic ActionPlan calls;
- legacy parser calls;
- raw dashboard classifier calls;
- validator calls;
- confirmation staging and state commits.

The full 840-fixture held-out corpus is evaluated cross-domain. Additional negative tests inject forbidden calls and verify that the corresponding metric becomes non-zero, proving that zero-call reports are not structurally fixed.
