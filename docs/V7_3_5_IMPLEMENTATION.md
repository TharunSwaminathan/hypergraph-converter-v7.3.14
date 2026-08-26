# v7.3.5 Implementation

v7.3.5 remediates graph dispatch wiring, deterministic runtime traces, speech-act safety, side-effect classification, corpus authenticity, and integrated routing evidence.

## Runtime flow

```text
one user message
-> one deterministic NLU analysis
-> one authoritative domain compilation
-> speech-act and side-effect safety gate
-> semantic-confidence decision
-> canonical typed dispatch
-> existing validator / preview / confirmation
-> completed observed runtime trace
```

## Graph dispatch repair

`AgentChatPanel.stageGraphMutationDetailed()` forwards the complete precompiled graph bundle:

- `precompiledPlan`
- `precompiledCompilation`
- `semanticConfidence`
- `contextBinding`
- `deterministicFirst`

`App.prepareGraphMutationForAgent()` uses a current, high-confidence precompiled plan directly. It validates the graph binding, calls `previewGraphMutation`, and stages the existing confirmation without calling the model or compiling the sentence again. Planner diagnostics are derived from observed execution and returned to the turn trace.

## Question safety

The compiler now distinguishes direct and polite requests from informational questions, hypotheticals, status questions, explanations, reported commands, and quoted commands. Read-only speech acts cannot authorize mapping, grouping, graph, parser-run, or graph-apply side effects. Polite requests such as “Could you use paper_id as the key?” remain actionable.

## Side effects

Every compiled result receives a domain-independent side-effect class. Mapping edits, grouping edits, graph edit previews, workflow preparation, confirmation-required actions, navigation, runtime controls, and read-only responses are measured separately.

## Corpus and evaluation

The held-out suite contains 840 literal and normalized unique static fixtures across 315 semantic families. The authenticity checker reports substantive and clause skeleton counts, opaque suffix violations, family dominance, ground-truth review status, and high-similarity clusters. The compiler evaluator and integrated routing evaluator are separate.

## Compatibility

No graph or mapping operation type was added. Existing validators, trusted-code worker hardening, graph confirmation, parser-run confirmation, graph-apply confirmation, batch isolation, graph identity checks, and local-model coordinator remain authoritative.
