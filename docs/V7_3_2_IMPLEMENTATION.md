# v7.3.2 Implementation Notes

v7.3.2 adds a shared deterministic conversational NLU layer for common assistant workflows. It is intentionally offline and inspectable. It does not add a cloud API, backend service, LangGraph dependency, autonomous agent runtime, model weights, or any new executable authority.

## Pipeline

```text
raw user text
-> protected text scan
-> normalization
-> tokenization
-> clause parsing
-> domain and intent scoring
-> entity/value extraction
-> negation, correction, and reference resolution
-> ambiguity/confidence analysis
-> domain compiler
-> existing typed draft/action
-> existing validator
-> existing preview/confirmation/execution
-> grounded deterministic response
```

## Main integration points

- `src/agent/deterministicNlu/` contains the shared language primitives and domain grammars.
- `src/agent/deterministicDatasetMappingPatch.js` tries high-confidence deterministic NLU before model/fallback paths.
- `src/agent/datasetMappingIntent.js` uses NLU as a stronger classifier while preserving legacy interpretation behavior.
- `src/components/AgentChatPanel.jsx` calls the deterministic NLU router before the older dataset-mapping and generic ActionPlan routing.
- `src/agent/graphMutationConversation.js` keeps graph mutation execution inside the existing deterministic preview/confirmation flow.

## Safety boundaries

NLU output is never applied directly. Dataset mapping compiles to `DatasetMappingPatch`; graph mutation routes to the existing graph mutation planner; parser workflow routes to existing plan/parser/run/apply functions. Parser runs and parser-result applies still require confirmation. Graph-changing actions still require graph mutation confirmation.

## Hybrid policy

```text
high confidence -> deterministic typed action
medium confidence -> clarification or typed local-model planner when connected
low confidence/open-ended -> local conversation if connected, deterministic fallback/help if offline
```

The deterministic path is preferred for routine supported requests and makes zero model calls.

