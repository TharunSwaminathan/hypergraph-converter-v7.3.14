# Generalized Help Speech Classification

> Superseded by the compositional semantics in `docs/COMPOSITIONAL_HELP_INTENT_SAFETY.md`. This file remains as v7.3.9 history.
v7.3.9 treats instructional Help speech as read-only before any action routing.

The key distinction is not the topic. It is the speech act:

| User text | Classification | Result |
| --- | --- | --- |
| `Please show me how to add vertex 6 to h2` | `help_seeking_question` | Help catalog response |
| `Please add vertex 6 to h2` | `imperative_request` | Graph edit preview |
| `Can you tell me how to apply parser result?` | `help_seeking_question` | Help catalog response |
| `Apply parser result` | `imperative_request` | Parser-result apply confirmation if ready |
| `How do I stop the current request?` | `help_seeking_question` | Help catalog response |
| `Stop the current request` | `cancellation` | Runtime stop control |

## Recognized instructional frames

The Help detector in `src/agent/deterministicNlu/helpSeekingGuards.js` recognizes the following families:

- how-to questions;
- polite “show/tell/explain me how” requests;
- “I want/need to know how” requests;
- instructions/steps/workflow/procedure/syntax requests;
- “which command should I use” requests;
- “where do I go to” route-help requests;
- “what do I type” syntax requests.

The topic is preserved with `helpSeekingTopic(...)` so Help search can still find the relevant command. For example:

```text
Can you tell me how to generate parser for batch 2?
-> topic: generate parser for batch 2
-> Help command explanation
```

## Non-Help examples

The detector intentionally does not treat these as Help:

```text
Can you show me the graph?
Show me the graph.
Please clear the graph.
Could you clear the graph?
Stop the current request.
```

Those forms are routed by the normal deterministic compiler and remain subject to existing validation and confirmation rules.
