# v7.3.9 Implementation Notes

> Superseded for current use by v7.3.10. v7.3.9 is retained as historical baseline documentation; its fixed-prefix Help claims are not the current safety boundary. See `docs/RELEASE_v7.3.10.md`.
v7.3.9 is the Generalized Help Speech Safety, Registry Authority, and Command Metadata remediation release.

The release starts from the immutable v7.3.8 portable ZIP and preserves the deterministic offline architecture. No cloud API, backend service, API key, hosted model call, bundled model weight, or automatic remote model call was added.

## Primary safety fix

The previous v7.3.8 Help guard correctly protected several `How do I...` forms, but it was too narrow. Some instructional frames could still resemble executable commands after normalization, especially near pending confirmations or runtime controls.

v7.3.9 routes generalized instructional Help speech before mutation-capable paths:

```text
instructional Help frame
-> help_query
-> DeterministicHelpQuery
-> catalog response
-> read_only
-> no pending-action change
-> no runtime stop
-> no parser apply
-> no graph/batch/mapping mutation
-> no model call
```

Protected frames include:

- `How do I ...`
- `Please show me how to ...`
- `Can you tell me how to ...`
- `Tell me how to ...`
- `I want to know how to ...`
- `Could you explain how to ...`
- `Walk me through how to ...`
- `What is the procedure to ...`
- `Which command should I use to ...`
- `Where do I go to ...`
- `What syntax do I use to ...`

Direct requests remain actionable:

```text
Please show me how to add vertex 6 to h2 -> Help only
Please add vertex 6 to h2                 -> graph edit preview
How do I cancel the pending action?       -> Help only, pending action preserved
Cancel the pending action                 -> pending action cancelled
How do I stop the current request?        -> Help only
Stop the current request                  -> runtime stop control
```

## Registry authority

`src/agent/actionIntentRegistry.js` now distinguishes:

- `public_chat_command`: executable deterministic chat commands;
- `internal_only`: planner/internal compatibility intents that must not be advertised as commands;
- `speech_act_only`: speech-act concepts such as correction that are documented but not standalone planner actions;
- `deprecated`;
- `panel_only`.

The `correction` intent is no longer exposed as a public legacy planner action. It remains documented as `correction.replace-interpretation` with the required context `matching_pending_or_recent_interpretation`.

## Parameterized public commands

v7.3.9 documents and compiles parameterized public commands without creating duplicate app pipelines:

- `Activate batch <number>` -> existing active-batch switch;
- `Generate parser for batch <number>` -> activate the numbered batch, then reuse the existing parser-generation path;
- `Use model <model name>` -> read-only explanation of the single-model Ollama configuration.

`edit_mapping` is public as a navigation command that focuses the existing mapping editor. It does not apply edited mapping JSON.

## Corrected command metadata

The command catalog now records more precise context requirements:

- `pending.confirm` -> `compatible_pending_confirmation`;
- `runtime.stop` -> `active_cancellable_work`;
- `parser.apply-result` -> `parser_result_ready`;
- `graph.undo-last-mutation` -> `reversible_committed_history`;
- `correction.replace-interpretation` -> `matching_pending_or_recent_interpretation`;
- numbered batch commands -> `existing_batch` and, for parser generation, `valid_mapping_for_batch`.

## Accessibility

The Help UI no longer removes native keyboard focus from `<summary>` disclosure controls. Try/copy/deep-link buttons include command-specific `aria-label` values.

## Files of interest

- `src/agent/deterministicNlu/helpSeekingGuards.js`
- `src/agent/deterministicNlu/speechActClassifier.js`
- `src/agent/deterministicNlu/intentClassifier.js`
- `src/agent/actionIntentRegistry.js`
- `src/agent/deterministicNlu/commandCatalog.js`
- `src/components/AgentChatPanel.jsx`
- `src/components/DeterministicCommandHelp.jsx`
- `tests/deterministic-help-generalized-speech.test.mjs`
- `tests/deterministic-help-pending-state-protection.test.mjs`
- `tests/deterministic-command-catalog-parameterized-actions.test.mjs`
