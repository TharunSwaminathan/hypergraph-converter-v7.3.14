# v7.3.8 Implementation Notes

## v7.3.9 supersession note

v7.3.8 is preserved as the baseline release. v7.3.9 keeps this architecture but generalizes the Help-speech detector, preserves pending actions during Help questions, moves `correction` to speech-act-only registry status, and adds exact parameterized command metadata. See `docs/V7_3_9_IMPLEMENTATION.md`.

v7.3.8 is the Deterministic Help Safety and Complete Command Inventory release.

## Implemented

- Added `src/agent/actionIntentRegistry.js` for the older deterministic `ActionPlanner` command surface.
- Added `src/agent/deterministicNlu/helpSeekingGuards.js` and routed broad Help-seeking frames into `help_query`.
- Added `src/agent/deterministicNlu/domains/legacyActionGrammar.js` and a `LegacyActionIntent` compiler path.
- Routed typed legacy actions through `dispatchCompiledAction(...)` and `createProductionDeterministicHandlers(...)`.
- Added direct execution support in `AgentChatPanel` for pending cancel, pending confirm, and runtime stop compiled from legacy action commands.
- Preserved action/question distinction: Help frames are read-only; polite/direct requests remain actionable.
- Generated catalog entries for every public legacy action intent and kept internal-only intents out of public Help.
- Fixed panel-only algorithm Help filtering.
- Preserved quoted graph IDs consistently between preliminary entity diagnostics and final graph mutation operations.
- Added Help deep links, stable command card anchors, copy links, and related-command buttons.

## Safety notes

Help queries do not execute or stage mutations. The tests use forbidden handler spies to confirm Help queries do not reach graph mutation, dataset mapping, parser workflow, dashboard control, legacy action, model, or generic ActionPlan dispatch.

Runtime/local model behavior remains unchanged from v7.3.7 except for better deterministic catalog coverage of runtime control commands. The model remains optional local assistance only.

## Inventory

- Catalog entries: 113
- Verified executable examples: 179
- Legacy action intents: 79
- Public legacy actions: 46
- Internal-only legacy intents: 33
- Deprecated legacy intents: 0

## Files of interest

- `src/agent/actionIntentRegistry.js`
- `src/agent/deterministicNlu/helpSeekingGuards.js`
- `src/agent/deterministicNlu/domains/legacyActionGrammar.js`
- `src/agent/deterministicNlu/commandCatalog.js`
- `src/components/DeterministicCommandHelp.jsx`
- `src/components/AgentChatPanel.jsx`
- `docs/DETERMINISTIC_ACTION_INTENT_INVENTORY.md`
- `docs/DETERMINISTIC_HELP_SAFETY_BOUNDARY.md`
