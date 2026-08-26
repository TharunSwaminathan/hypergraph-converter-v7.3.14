# v7.3.4 Implementation Notes

v7.3.4 integrates the central deterministic NLU compiler into the production chat path.

The runtime path is:

```text
AgentChatPanel
-> agentActions.compileDeterministicTurn(query)
-> App-owned deterministic context
-> analyzeDeterministicNlu once
-> compileDeterministicAction once
-> dispatchCompiledAction
-> existing typed domain handlers
```

The release preserves existing validators, previews, confirmations, trusted-code worker hardening, graph mutation commit logic, local Ollama support, uploads, algorithms, routes, exports, and visualization behavior.

Corrections from v7.3.3:

- `compileDeterministicAction` is now production runtime code.
- High-confidence graph plans bypass model planning even when Ollama is connected.
- Mapping patch assist accepts a precompiled `DatasetMappingPatch` draft and does not recompile raw text.
- Dashboard commands dispatch canonical `DashboardControlIntent` values through `resolveCanonicalControlPlan`.
- Quality metrics use observed integrated routing counters and truthful denominators.
- The 46 v7.3.3 fixtures are retained as core regressions, while v7.3.4 adds 840 static held-out fixtures.
