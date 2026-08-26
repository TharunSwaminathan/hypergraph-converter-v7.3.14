# Action Registry Authority

`src/agent/actionIntentRegistry.js` is the authoritative inventory for deterministic legacy chat commands beside the typed NLU domains.

## Runtime authority in v7.3.10

Registry metadata is enforced, not merely displayed:

- `actionContextPolicy.js` evaluates every `requiredContext` item before legacy dispatch;
- missing context produces deterministic clarification and no handler call;
- `validatePlannedAction(...)` verifies that `handlerKind` maps only to documented planner kinds;
- `confirmationPolicy.js` centrally maps capability actions to registered confirmation action types;
- exact-match tests extract the real `actionPlanner.js` switch cases and compare them to the registry control intents.

## Visibility classes

| Visibility | Meaning |
| --- | --- |
| `public_chat_command` | Direct chat text may match and compile it. |
| `internal_only` | Compatibility/planner implementation detail; not advertised or exact-matchable. |
| `speech_act_only` | Conversational control concept, not a standalone planner command. |
| `deprecated` | Historical/retired intent. |
| `panel_only` | UI feature without an executable chat handler. |

`correction` remains speech-act-only. Its executable examples prove replacement behavior only with matching pending/recent interpretation context.

## Parameterized public commands

- `edit_mapping`
- `activate_batch_number`
- `generate_parser_for_batch`
- `local_model_select`

Missing required slots fail with clarification. Numbered parser generation executes activation and generation as one validated compound plan rather than recursively submitting a second chat message.
